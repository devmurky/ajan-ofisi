<#
.SYNOPSIS
  Antigravity CLI'ye (agy) etkileşimsiz bir iş verir, çıktıyı dosyaya ve Ajan Ofisi'ne yazar.

.DESCRIPTION
  agy'yi --print --output-format stream-json ile çağırır. Her araç adımı anında
  ~/agy-tools/ofis/events.jsonl dosyasına "progress" olayı olarak yazılır; Ajan Ofisi
  (http://localhost:4317) bunları canlı gösterir. Sonuç ~/agy-tools/out/<iş>.md dosyasına
  yazılır ve yolu son satırda yazdırılır.

  Aynı ajana aynı anda tek iş verilir: ajan meşgulse iş sıraya girer ("queued").

  agy'nin generate_image aracı görselleri ~/.gemini/antigravity-cli/brain altına kaydeder.
  Sarmalayıcı iş sırasında oluşan görselleri çalışma klasörüne ve ~/agy-tools/out/<iş>/
  klasörüne kopyalar.

.EXAMPLE
  .\ask-agy.ps1 -Prompt "Ana sayfa için 3 hero görseli üret" -WorkDir C:\proje\assets

.EXAMPLE
  .\ask-agy.ps1 -PromptFile .\gorev.md -WorkDir C:\proje -Model claude-opus-5-5-high

.NOTES
  - Sadece Argon ve Claude modelleri kullanılır. Varsayılan: gemini-4-argon-medium.
  - -Mode: accept-edits (varsayılan; dosya düzenlemeleri onaysız, terminal komutları reddedilir),
    plan (sadece plan), auto. -AutoApprove tüm araç izinlerini sormadan onaylar
    (--dangerously-skip-permissions); sadece git altındaki klasörlerde kullan.
#>
[CmdletBinding(DefaultParameterSetName = 'Text')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Text', Position = 0)]
    [string]$Prompt,

    [Parameter(Mandatory = $true, ParameterSetName = 'File')]
    [string]$PromptFile,

    [string]$WorkDir = (Get-Location).Path,

    [ValidateSet('gemini-4-argon-low', 'gemini-4-argon-medium', 'gemini-4-argon-high',
                 'claude-opus-5-5-low', 'claude-opus-5-5-medium', 'claude-opus-5-5-high',
                 'claude-sonnet-5-5-low', 'claude-sonnet-5-5-medium', 'claude-sonnet-5-5-high')]
    [string]$Model = 'gemini-4-argon-medium',

    # Ofiste görünecek ajan adı; boşsa modelden türetilir (Argon / Opus / Sonnet)
    [string]$Agent = '',

    # Ofiste görünecek kısa iş başlığı; boşsa prompt'un başı kullanılır
    [string]$Title = '',

    [ValidateSet('accept-edits', 'plan', 'auto')]
    [string]$Mode = 'accept-edits',

    [ValidateSet('', 'low', 'medium', 'high', 'xhigh', 'max')]
    [string]$Effort = '',

    [int]$TimeoutSec = 900,

    # Üretilen görselleri çalışma klasörüne kopyalama
    [switch]$NoCopyImages,

    # Ajanın okuyabileceği ek klasörler (ör. referans görsellerin yüklendiği klasör)
    [string[]]$AddDir = @(),

    # Ekip toplantısı kimliği (ofiste ajanı toplantı odasına oturtur)
    [string]$Meeting = '',

    # Ajanın yanıtını düz metin olarak bu dosyaya da yaz
    [string]$ResultFile = '',

    [switch]$AutoApprove
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$imageExt = @('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg')

$toolsDir = Join-Path $HOME 'agy-tools'
$outRoot = Join-Path $toolsDir 'out'
$eventsFile = Join-Path $toolsDir 'ofis\events.jsonl'
$lockDir = Join-Path $toolsDir 'ofis\locks'
$brainDir = Join-Path $HOME '.gemini\antigravity-cli\brain'

function Write-OfficeEvent([hashtable]$Data) {
    $Data['ts'] = (Get-Date).ToString('o')
    New-Item -ItemType Directory -Force -Path (Split-Path $eventsFile) | Out-Null
    $line = (New-Object PSObject -Property $Data | ConvertTo-Json -Compress -Depth 5) + "`n"
    for ($i = 0; $i -lt 5; $i++) {
        try { [IO.File]::AppendAllText($eventsFile, $line, $utf8); return }
        catch { Start-Sleep -Milliseconds 100 }
    }
}

function Get-FileSnapshot([string]$Root) {
    $map = @{}
    Get-ChildItem -LiteralPath $Root -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\(\.git|node_modules)\\' } |
        ForEach-Object { $map[$_.FullName] = "$($_.Length)|$($_.LastWriteTimeUtc.Ticks)" }
    return $map
}

function Get-FreeName([string]$Dir, [string]$Name) {
    $base = [IO.Path]::GetFileNameWithoutExtension($Name)
    $ext = [IO.Path]::GetExtension($Name)
    $candidate = $Name
    $n = 2
    while (Test-Path -LiteralPath (Join-Path $Dir $candidate)) { $candidate = "$base-$n$ext"; $n++ }
    return $candidate
}

# Bir araç adımını ofiste gösterilecek kısa Türkçe etikete çevirir
function Get-StepLabel($Step) {
    $name = [string]$Step.tool_name
    $target = ''
    $params = $null
    if ($Step.tool_info) { $params = $Step.tool_info.parameters }
    if ($params) {
        foreach ($prop in $params.PSObject.Properties) {
            $v = [string]$prop.Value
            if ($v.Length -lt 400 -and $v -match '^[A-Za-z]:[\\/]|^[\\/~.]') {
                try { $target = Split-Path $v -Leaf } catch { $target = '' }
                if ($target) { break }
            }
        }
    }
    $label = switch -Regex ($name) {
        'generate_image' { 'görsel üretiyor'; break }
        '^(write_file|write_to_file|create_file)' { 'dosya yazıyor'; break }
        'edit|replace' { 'dosya düzenliyor'; break }
        'read_file|view_file|view_' { 'dosya okuyor'; break }
        'list_dir|find_by_name|glob' { 'klasöre bakıyor'; break }
        'grep|search' { 'arıyor'; break }
        'command|terminal|shell' { 'komut çalıştırmak istiyor'; break }
        '^browser' { 'tarayıcıda çalışıyor'; break }
        'subagent|invoke_agent' { 'alt ajan çağırıyor'; break }
        'permission' { 'izin istiyor'; break }
        'ask_question' { 'soru soruyor'; break }
        default { $name }
    }
    if ($target) { return "${label}: $target" }
    return $label
}

# agy'yi bul: önce PATH, sonra resmi kurulum klasörü
$agy = (Get-Command agy -ErrorAction SilentlyContinue).Source
if (-not $agy) {
    $fallback = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
    if (Test-Path $fallback) { $agy = $fallback }
    else { throw "agy bulunamadı. Kurulum: irm https://antigravity.google/cli/install.ps1 | iex" }
}

if ($PSCmdlet.ParameterSetName -eq 'File') {
    $Prompt = Get-Content -LiteralPath $PromptFile -Raw -Encoding UTF8
}
if ([string]::IsNullOrWhiteSpace($Prompt)) { throw 'Prompt boş.' }

if (-not (Test-Path -LiteralPath $WorkDir -PathType Container)) { throw "Çalışma klasörü yok: $WorkDir" }
$WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path
$project = Split-Path $WorkDir -Leaf

if (-not $Agent) {
    $Agent = switch -Wildcard ($Model) {
        'gemini-4-argon*' { 'Argon' }
        'claude-opus*' { 'Opus' }
        'claude-sonnet*' { 'Sonnet' }
        default { 'Ajan' }
    }
}
if (-not $Title) {
    $Title = ($Prompt -replace '\s+', ' ').Trim()
    if ($Title.Length -gt 80) { $Title = $Title.Substring(0, 77) + '...' }
}

$jobId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + (Get-Random -Minimum 1000 -Maximum 9999)
$jobDir = Join-Path $outRoot $jobId
$outFile = Join-Path $outRoot "$jobId.md"
$streamFile = Join-Path $outRoot "$jobId.stream.jsonl"
New-Item -ItemType Directory -Force -Path $outRoot, $lockDir | Out-Null
$common = @{ job = $jobId; agent = $Agent; model = $Model; title = $Title; project = $project }
if ($Meeting) { $common['meeting'] = $Meeting }

# Kuyruk: aynı ajana aynı anda tek iş. Kilit, süreç bitince Windows tarafından bırakılır.
# Bekleyenler ofis\queue\<ajan>.json dosyasında sıralı durur; ofisten "öne al" bu sırayı değiştirir.
$safeAgent = $Agent -replace '[^\w\-]', '_'
$lockPath = Join-Path $lockDir "$safeAgent.lock"
$queueDir = Join-Path $toolsDir 'ofis\queue'
New-Item -ItemType Directory -Force -Path $queueDir | Out-Null
$queuePath = Join-Path $queueDir "$safeAgent.json"

# Kuyruk dosyasını özel kilitle açıp düzenler; yaşamayan süreçlerin kayıtlarını atar
function Edit-Queue([scriptblock]$Fn) {
    for ($i = 0; $i -lt 60; $i++) {
        $fs = $null
        try {
            $fs = [IO.File]::Open($queuePath, 'OpenOrCreate', 'ReadWrite', 'None')
            $sr = New-Object IO.StreamReader($fs, $utf8, $false, 4096, $true)
            $txt = $sr.ReadToEnd(); $sr.Dispose()
            $list = @()
            # PS 5.1: ConvertFrom-Json diziyi tek nesne olarak verir; boru ile açıyoruz
            if ($txt.Trim()) { $list = @((ConvertFrom-Json $txt) | ForEach-Object { $_ }) }
            $list = @($list | Where-Object { $_ -and ($_.job -eq $jobId -or (Get-Process -Id ([int]$_.pid) -ErrorAction SilentlyContinue)) })
            $list = @(& $Fn $list)
            $bytes = $utf8.GetBytes((ConvertTo-Json -InputObject $list -Compress -Depth 3))
            $fs.SetLength(0); $fs.Write($bytes, 0, $bytes.Length)
            return , $list
        }
        catch { Start-Sleep -Milliseconds 60 }
        finally { if ($fs) { $fs.Dispose() } }
    }
    return , @()
}

$lock = $null
$queuedAt = $null
$inQueue = $false
while (-not $lock) {
    $list = Edit-Queue { param($l) $l }
    $myTurn = if ($inQueue) { $list.Count -eq 0 -or $list[0].job -eq $jobId } else { $list.Count -eq 0 }
    if ($myTurn) { try { $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') } catch { } }
    if (-not $lock) {
        if (-not $inQueue) {
            $queuedAt = Get-Date
            $null = Edit-Queue { param($l) @($l) + @([pscustomobject]@{ job = $jobId; pid = $PID }) }
            $inQueue = $true
            Write-OfficeEvent ($common + @{ type = 'queued'; task = $Prompt; workdir = $WorkDir; pid = $PID })
        }
        Start-Sleep -Milliseconds 1500
    }
}
if ($inQueue) { $null = Edit-Queue { param($l) @($l | Where-Object { $_.job -ne $jobId }) } }

# Windows PowerShell 5.1, yerel programlara giden argümanlardaki çift tırnakları kaçırmaz
$promptArg = $Prompt -replace '"', '\"'

$agyArgs = @('--model', $Model, '--mode', $Mode, '--print-timeout', "$($TimeoutSec)s", '--output-format', 'stream-json')
# agy 1.5.2: --disable-slash-commands plan modunu etkisiz bırakıyor
if ($Mode -ne 'plan') { $agyArgs += '--disable-slash-commands' }
if ($Effort) { $agyArgs += @('--effort', $Effort) }
if ($AutoApprove) { $agyArgs += '--dangerously-skip-permissions' }
foreach ($d in $AddDir) { if ($d -and (Test-Path -LiteralPath $d -PathType Container)) { $agyArgs += @('--add-dir', $d) } }
$agyArgs += @('--print', $promptArg)

$before = Get-FileSnapshot $WorkDir
$started = Get-Date
Write-OfficeEvent ($common + @{ type = 'start'; mode = $Mode; task = $Prompt; workdir = $WorkDir; pid = $PID })

$raw = New-Object System.Collections.Generic.List[string]
$steps = New-Object System.Collections.Generic.List[string]
$response = ''
$resultStatus = ''
$tokens = 0
$denied = $false
$toolError = $false
$exitCode = 1
$wroteText = $false
Push-Location -LiteralPath $WorkDir
# agy UTF-8 yazar; PowerShell 5.1 varsayılan olarak OEM kod sayfasıyla okur ve Türkçe karakterleri bozar
$prevOutEnc = [Console]::OutputEncoding
try { [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false) } catch { }
try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $agy @agyArgs 2>&1 | ForEach-Object {
        $line = "$_"
        $raw.Add($line)
        if ($line -match 'denied|cannot prompt') { $denied = $true }
        if ($line -notmatch '^\s*\{') { return }
        try { $o = $line | ConvertFrom-Json } catch { return }
        if ($o.event -eq 'step_update') {
            $s = $o.step_update
            if ($s.step_type -eq 'tool' -and $s.state -eq 'ACTIVE') {
                $label = Get-StepLabel $s
                $steps.Add($label)
                Write-OfficeEvent ($common + @{ type = 'progress'; tool = [string]$s.tool_name; label = $label })
            }
            elseif ($s.step_type -eq 'tool' -and $s.state -notin @('DONE', 'ACTIVE')) {
                $toolError = $true
                $label = "durdu ($($s.state)): $(Get-StepLabel $s)"
                $steps.Add($label)
                Write-OfficeEvent ($common + @{ type = 'progress'; tool = [string]$s.tool_name; label = $label; warn = $true })
            }
            elseif ($s.step_type -eq 'agent_response' -and $s.state -eq 'ACTIVE' -and -not $wroteText) {
                $wroteText = $true
                Write-OfficeEvent ($common + @{ type = 'progress'; tool = 'response'; label = 'yanıtı yazıyor' })
            }
        }
        elseif ($o.event -eq 'result') {
            $r = $o.result
            $resultStatus = [string]$r.status
            $response = [string]$r.response
            if ($r.usage) { $tokens = [int]$r.usage.total_tokens }
        }
    }
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
}
catch {
    $raw.Add("Sarmalayıcı hatası: $_")
}
finally {
    try { [Console]::OutputEncoding = $prevOutEnc } catch { }
    Pop-Location
}
$elapsed = [int]((Get-Date) - $started).TotalSeconds
[IO.File]::WriteAllText($streamFile, ($raw -join "`n"), $utf8)

# Çalışma klasöründe değişen dosyalar
$after = Get-FileSnapshot $WorkDir
$changed = @($after.Keys | Where-Object { $before[$_] -ne $after[$_] } | Sort-Object)
$removed = @($before.Keys | Where-Object { -not $after.ContainsKey($_) } | Sort-Object)

# generate_image çıktıları (brain klasörü) + çalışma klasöründe değişen görseller
$files = @()
$brainImages = @()
if (Test-Path -LiteralPath $brainDir) {
    $brainImages = @(Get-ChildItem -LiteralPath $brainDir -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $imageExt -contains $_.Extension.ToLower() -and $_.LastWriteTime -ge $started.AddSeconds(-2) })
}
$workImages = @($changed | Where-Object { $imageExt -contains ([IO.Path]::GetExtension($_)).ToLower() })
if ($brainImages.Count -or $workImages.Count) {
    New-Item -ItemType Directory -Force -Path $jobDir | Out-Null
}
foreach ($img in $brainImages) {
    $name = Get-FreeName $jobDir $img.Name
    Copy-Item -LiteralPath $img.FullName -Destination (Join-Path $jobDir $name)
    $savedTo = $null
    if (-not $NoCopyImages) {
        $wname = Get-FreeName $WorkDir $img.Name
        Copy-Item -LiteralPath $img.FullName -Destination (Join-Path $WorkDir $wname)
        $savedTo = Join-Path $WorkDir $wname
    }
    $files += @{ name = $name; url = "/out/$jobId/$([Uri]::EscapeDataString($name))"; kind = 'image'; source = 'generate_image'; savedTo = $savedTo }
}
foreach ($path in $workImages) {
    $name = Get-FreeName $jobDir ([IO.Path]::GetFileName($path))
    Copy-Item -LiteralPath $path -Destination (Join-Path $jobDir $name)
    $files += @{ name = $name; url = "/out/$jobId/$([Uri]::EscapeDataString($name))"; kind = 'image'; source = 'workdir'; savedTo = $path }
}

# Yanıt metni: stream-json sonucu; yoksa JSON olmayan satırlar
$text = $response
if (-not $text) { $text = ($raw | Where-Object { $_ -notmatch '^\s*\{' -and $_ -notmatch '^warning: ' }) -join "`n" }
$status = 'done'
$reason = ''
$allText = $raw -join "`n"
if ($allText -match 'not signed in|please (sign|log) ?in|sign in to continue|login required|unauthenticated|invalid_grant|token (has )?expired') {
    # agy oturumu düşmüş: kullanıcının yeniden giriş yapması gerekiyor
    $status = 'blocked'; $reason = 'auth'
    $text = "Antigravity'ye yeniden giriş gerekli: bir terminalde 'agy' çalıştırıp Google ile giriş yap.`n`n" + $text
}
elseif ($exitCode -ne 0) { $status = 'fail' }
elseif ($text -match 'no output produced' -or ($resultStatus -and $resultStatus -ne 'SUCCESS' -and $denied)) { $status = 'blocked'; $reason = 'permission' }
elseif ($resultStatus -and $resultStatus -ne 'SUCCESS') { $status = 'fail' }
elseif ($toolError -and $text.Trim().Length -lt 400) { $status = 'blocked'; $reason = 'permission' }   # araç reddedildi, iş yarıda kaldı

$relChanged = @($changed | ForEach-Object { $_.Substring($WorkDir.Length).TrimStart('\') })
$relRemoved = @($removed | ForEach-Object { $_.Substring($WorkDir.Length).TrimStart('\') })
$waited = 0
if ($queuedAt) { $waited = [int]($started - $queuedAt).TotalSeconds }

$report = @(
    '# agy çıktısı'
    ''
    "- İş: $jobId"
    "- Ajan: $Agent"
    "- Proje: $project"
    "- Zaman: $($started.ToString('yyyy-MM-dd HH:mm:ss'))"
    "- Süre: $elapsed sn" + $(if ($waited) { " (sırada bekleme: $waited sn)" } else { '' })
    "- Model: $Model"
    "- Mod: $Mode"
    "- Çalışma klasörü: $WorkDir"
    "- Otomatik onay: $([bool]$AutoApprove)"
    "- Çıkış kodu: $exitCode"
    "- Sonuç: $resultStatus"
    "- Token: $tokens"
    "- Durum: $status"
    ''
    '## Prompt'
    ''
    $Prompt
    ''
    '## Adımlar'
    ''
)
if ($steps.Count) { $report += ($steps | ForEach-Object { "- $_" }) } else { $report += '- (araç kullanılmadı)' }
$report += @('', '## Yanıt', '', $text, '', '## Değişen dosyalar', '')
if ($relChanged.Count) { $report += ($relChanged | ForEach-Object { "- $_" }) } else { $report += '- (yok)' }
if ($relRemoved.Count) { $report += ''; $report += '## Silinen dosyalar'; $report += ''; $report += ($relRemoved | ForEach-Object { "- $_" }) }
if ($files.Count) {
    $report += ''; $report += '## Görseller'; $report += ''
    $report += ($files | ForEach-Object { "- $($_.name)" + $(if ($_.savedTo) { " -> $($_.savedTo)" } else { '' }) })
}
$report += @('', "Ham akış: $streamFile")
[IO.File]::WriteAllText($outFile, ($report -join "`n"), $utf8)

if ($ResultFile) {
    try { New-Item -ItemType Directory -Force -Path (Split-Path $ResultFile) | Out-Null; [IO.File]::WriteAllText($ResultFile, $text, $utf8) } catch { }
}
$summary = $text.Trim()
if ($summary.Length -gt 1200) { $summary = $summary.Substring(0, 1197) + '...' }
Write-OfficeEvent ($common + @{ type = $status; reason = $reason; seconds = $elapsed; waited = $waited; exitCode = $exitCode; tokens = $tokens; steps = $steps.Count; summary = $summary; changed = $relChanged; removed = $relRemoved; files = $files; report = "/out/$jobId.md" })

$lock.Dispose()
Write-Output $outFile
exit $exitCode
