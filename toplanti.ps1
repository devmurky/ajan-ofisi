<#
.SYNOPSIS
  Ekip toplantısı: her uzman ajan kendi rol (skill) dosyasına göre projeyi inceler, Raportör toplu rapor yazar.

.DESCRIPTION
  Rol dosyaları: ~/agy-tools/ekip/roller/*.md (üstte ad / baslik / model / sira bilgisi, altta yönerge).
  1. Uzmanlar aynı anda, salt-okuma (plan) kipinde başlatılır; projede hiçbir dosyayı değiştirmezler.
  2. Her uzmanın bölümü ~/agy-tools/out/meetings/<toplantı>/ klasörüne yazılır.
  3. Raportör bölümleri okuyup toplu raporu yazar.
  4. Rapor proje klasörüne EKIP-RAPORU-<tarih>.md olarak kaydedilir; ofis toplantıyı canlı gösterir.

.EXAMPLE
  .\toplanti.ps1 -WorkDir C:\proje -Brief "Kuaförler için online randevu uygulaması"

.EXAMPLE
  .\toplanti.ps1 -WorkDir C:\proje -Roles mimar,guvenlik,kalite -Topic "Yayın öncesi inceleme"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$WorkDir,

    # Proje özeti / fikir (boş klasörde yeni proje için önemli)
    [string]$Brief = '',
    [string]$BriefFile = '',

    [string]$Topic = 'Proje başlangıç toplantısı',

    # Rol dosyası adları (uzantısız). Boşsa raportör dışındaki tüm roller.
    [string[]]$Roles = @(),

    [int]$TimeoutSec = 900,

    # Raporun proje klasöründeki adı
    [string]$OutName = ''
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$tools = $PSScriptRoot
$ask = Join-Path $tools 'ask-agy.ps1'
$roleDir = Join-Path $tools 'ekip\roller'
$eventsFile = Join-Path $tools 'ofis\events.jsonl'
# Proje sahibinin adı: ofis ayarlarındaki "owner" alanı (yoksa "Patron")
$owner = 'Patron'
try {
    $ayar = Get-Content (Join-Path $tools 'ofis\ayarlar.json') -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json
    if ($ayar.owner) { $owner = [string]$ayar.owner }
} catch { }

function Write-OfficeEvent([hashtable]$Data) {
    $Data['ts'] = (Get-Date).ToString('o')
    $line = (New-Object PSObject -Property $Data | ConvertTo-Json -Compress -Depth 6) + "`n"
    for ($i = 0; $i -lt 5; $i++) { try { [IO.File]::AppendAllText($eventsFile, $line, $utf8); return } catch { Start-Sleep -Milliseconds 100 } }
}

# Rol dosyası: --- arasındaki "anahtar: değer" satırları + yönerge gövdesi
function Read-Role([string]$Path) {
    $txt = [IO.File]::ReadAllText($Path, $utf8)
    $meta = @{ file = [IO.Path]::GetFileNameWithoutExtension($Path) }
    $body = $txt
    if ($txt -match '(?s)^\s*---\s*\r?\n(.*?)\r?\n---\s*\r?\n(.*)$') {
        foreach ($l in ($Matches[1] -split '\r?\n')) { if ($l -match '^\s*([\w]+)\s*:\s*(.+?)\s*$') { $meta[$Matches[1]] = $Matches[2] } }
        $body = $Matches[2]
    }
    $meta['body'] = $body.Trim()
    if (-not $meta.ad) { $meta.ad = $meta.file }
    if (-not $meta.baslik) { $meta.baslik = $meta.ad }
    if (-not $meta.sira) { $meta.sira = 50 }
    return $meta
}
function Q([string]$s) { '"' + ($s -replace '"', '\"') + '"' }
# Ajanın araç çağrıları arasındaki ara sözlerini ("Önce dosyaları okuyorum…") at: ilk Markdown başlığından başlat
function Clean-Section([string]$t) {
    $t = $t.Trim()
    $i = [regex]::Match($t, '(?m)^#{1,3} ').Index
    if ($i -gt 0 -and $i -lt 600) { $t = $t.Substring($i) }
    return $t.Trim()
}

if (-not (Test-Path -LiteralPath $WorkDir -PathType Container)) { throw "Klasör yok: $WorkDir" }
$WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path
$project = Split-Path $WorkDir -Leaf
if ($BriefFile) { $Brief = [IO.File]::ReadAllText($BriefFile, $utf8) }

$all = @(Get-ChildItem $roleDir -Filter *.md | ForEach-Object { Read-Role $_.FullName })
$reporter = $all | Where-Object { $_.raportor -eq 'true' } | Select-Object -First 1
$experts = @($all | Where-Object { $_.raportor -ne 'true' })
if ($Roles.Count) {
    $want = @($Roles | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
    $experts = @($experts | Where-Object { $want -contains $_.file.ToLower() -or $want -contains $_.ad.ToLower() })
}
$experts = @($experts | Sort-Object { [int]$_.sira })
if (-not $experts.Count) { throw 'Hiç uzman rolü seçilmedi.' }
if (-not $reporter) { throw 'Raportör rol dosyası (raportor: true) bulunamadı.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$meetingId = "toplanti-$stamp"
$meetDir = Join-Path $tools "out\meetings\$meetingId"
New-Item -ItemType Directory -Force -Path $meetDir | Out-Null
$briefText = if ($Brief.Trim()) { $Brief.Trim() } else { '(Özet verilmedi; projeyi klasördeki dosyalardan anla.)' }
[IO.File]::WriteAllText((Join-Path $meetDir 'ozet.md'), "# $Topic`n`nProje: $project`nKlasör: $WorkDir`n`n$briefText`n", $utf8)

# Proje dosya listesi: ajanlar klasörü listelemek için komut çalıştırmaya kalkmasın
$skip = '\\(\.git|node_modules|dist|build|\.next|\.venv|venv|__pycache__|\.cache|coverage)\\'
$files = @(Get-ChildItem -LiteralPath $WorkDir -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch $skip } | Select-Object -First 300)
$listing = if ($files.Count) { ($files | ForEach-Object { '- ' + $_.FullName.Substring($WorkDir.Length).TrimStart('\') + " ($([Math]::Round($_.Length / 1KB, 1)) KB)" }) -join "`n" } else { '(klasör boş; projeyi özetten değerlendir)' }
$toolRules = @"
## Araç kuralları (çok önemli)
- Terminal komutu ÇALIŞTIRMA. run_command otomatik reddedilir ve işin yarıda kalır.
- Dosya okumak için view_file, klasör içeriği için list_dir, arama için grep_search ve find_by_name kullan.
- Hiçbir dosya oluşturma, değiştirme ya da silme. Sonucunu sadece yanıt olarak yaz.
"@

$started = Get-Date
Write-OfficeEvent @{
    type = 'meeting-start'; meeting = $meetingId; topic = $Topic; project = $project; workdir = $WorkDir; agent = 'Claude'
    roles = @($experts | ForEach-Object { @{ agent = $_.ad; title = $_.baslik; model = $_.model } })
    reporter = @{ agent = $reporter.ad; model = $reporter.model }
}
Write-Host "Toplantı başladı: $meetingId · $($experts.Count) uzman"

# ---------- 1. uzmanlar aynı anda ----------
$sectionFormat = @"
## Bölüm biçimi (Markdown, Türkçe, en fazla ~700 kelime)
Yanıtın sadece şu bölüm olsun; dosya oluşturma ya da değiştirme:

## {AD} · {BASLIK}
**Kısa değerlendirme:** tek cümle.

### Bulgular
- [Yüksek | Orta | Düşük] bulgu — ilgili dosya yolu (varsa)

### Öneriler
1. somut öneri

### Açık sorular
- Proje sahibine ($owner) sorulması gerekenler
"@
$procs = @()
foreach ($r in $experts) {
    $prompt = @"
Bir ekip toplantısındasın. Projeyi aşağıdaki rol yönergene göre incele ve kendi bölümünü yaz.

$($r.body)

## Proje
- Konu: $Topic
- Proje klasörü (çalışma klasörün): $WorkDir
- Proje özeti (proje sahibi $owner yazdı):
$briefText

## Proje dosyaları (en fazla 300)
$listing

$toolRules

$($sectionFormat -replace '\{AD\}', $r.ad -replace '\{BASLIK\}', $r.baslik)
"@
    $pf = Join-Path $meetDir "$($r.file).prompt.txt"
    $rf = Join-Path $meetDir "$($r.file).md"
    [IO.File]::WriteAllText($pf, $prompt, (New-Object Text.UTF8Encoding($true)))
    $argLine = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File $(Q $ask) -PromptFile $(Q $pf) -WorkDir $(Q $WorkDir) -Model $($r.model) -Agent $(Q $r.ad) -Title $(Q "Toplantı · $($r.baslik)") -Mode plan -Meeting $meetingId -ResultFile $(Q $rf) -TimeoutSec $TimeoutSec -AddDir $(Q $meetDir)"
    # -NoNewWindow: çıktı yönlendirmesiyle birlikte pencere açılmaz
    $p = Start-Process powershell.exe -ArgumentList $argLine -NoNewWindow -PassThru `
        -RedirectStandardOutput (Join-Path $meetDir "$($r.file).log") -RedirectStandardError (Join-Path $meetDir "$($r.file).err")
    $procs += [pscustomobject]@{ role = $r; proc = $p; result = $rf }
    Start-Sleep -Milliseconds 400
}
$deadline = (Get-Date).AddSeconds($TimeoutSec + 120)
foreach ($x in $procs) {
    $left = [int]([Math]::Max(1, ($deadline - (Get-Date)).TotalSeconds))
    try { Wait-Process -Id $x.proc.Id -Timeout $left -ErrorAction Stop } catch { try { Stop-Process -Id $x.proc.Id -Force } catch { } }
}

# ---------- 2. bölümleri topla ----------
$sections = foreach ($x in $procs) {
    $t = if (Test-Path $x.result) { Clean-Section ([IO.File]::ReadAllText($x.result, $utf8)) } else { '' }
    # 300 karakterden kısa yanıt: ajan yarıda kalmış sayılır
    $ok = $t.Length -ge 300
    if (-not $ok) { $t = "## $($x.role.ad) · $($x.role.baslik)`n`n_Bu uzman bölümünü tamamlayamadı (hata, izin ya da zaman aşımı)._" + $(if ($t) { "`n`n> Son yanıtı: $t" } else { '' }) }
    [pscustomobject]@{ role = $x.role; text = $t; ok = $ok }
}
$sectionsFile = Join-Path $meetDir 'bolumler.md'
[IO.File]::WriteAllText($sectionsFile, (($sections | ForEach-Object { $_.text }) -join "`n`n---`n`n"), $utf8)
$okCount = @($sections | Where-Object { $_.ok }).Count
Write-Host "Uzman bölümleri: $okCount / $($experts.Count)"

# ---------- 3. raportör ----------
$synthFile = Join-Path $meetDir 'sentez.md'
$rprompt = @"
$($reporter.body)

## Toplantı
- Konu: $Topic
- Proje: $project ($WorkDir)
- Katılan uzmanlar: $(($experts | ForEach-Object { "$($_.ad) ($($_.baslik))" }) -join ', ')
- Proje özeti dosyası: $(Join-Path $meetDir 'ozet.md')
- Uzman bölümleri dosyası (hepsini view_file ile oku): $sectionsFile

$toolRules

Raporu yanıt olarak yaz; dosyaya yazmaya çalışma, betik kaydedecek.
"@
$rpf = Join-Path $meetDir 'raportor.prompt.txt'
[IO.File]::WriteAllText($rpf, $rprompt, (New-Object Text.UTF8Encoding($true)))
$null = & $ask -PromptFile $rpf -WorkDir $WorkDir -Model $reporter.model -Agent $reporter.ad -Title "Toplantı · toplu rapor" -Mode plan -Meeting $meetingId -ResultFile $synthFile -TimeoutSec $TimeoutSec -AddDir $meetDir
$synth = if (Test-Path $synthFile) { Clean-Section ([IO.File]::ReadAllText($synthFile, $utf8)) } else { '' }
$synthOk = $synth.Length -ge 300
if (-not $synthOk) { $synth = "# Ekip raporu: $project`n`n_Raportör toplu raporu yazamadı; aşağıda uzman bölümleri var._" }

# ---------- 4. raporu yaz ----------
$elapsed = [int]((Get-Date) - $started).TotalSeconds
if (-not $OutName) { $OutName = "EKIP-RAPORU-$(Get-Date -Format 'yyyyMMdd-HHmm').md" }
$report = @(
    $synth
    ''
    '---'
    ''
    "_Toplantı: $Topic · $(Get-Date -Format 'dd.MM.yyyy HH:mm') · $([Math]::Round($elapsed / 60, 1)) dk · katılımcılar: $(($experts | ForEach-Object { $_.ad }) -join ', '), Raportör · Ajan Ofisi_"
    ''
    '# Ekler: uzman bölümleri'
    ''
    (($sections | ForEach-Object { $_.text }) -join "`n`n---`n`n")
) -join "`n"
$reportPath = Join-Path $WorkDir $OutName
[IO.File]::WriteAllText($reportPath, $report, $utf8)
[IO.File]::WriteAllText((Join-Path $meetDir 'rapor.md'), $report, $utf8)

Write-OfficeEvent @{
    type = 'meeting-done'; meeting = $meetingId; topic = $Topic; project = $project; agent = 'Claude'
    report = $reportPath; url = "/out/meetings/$meetingId/rapor.md"; ok = ($okCount -eq $experts.Count -and $synthOk); experts = $okCount; total = $experts.Count; seconds = $elapsed
    summary = ($synth -split "`n" | Where-Object { $_ -and $_ -notmatch '^#' } | Select-Object -First 3) -join ' '
}
Write-Host "Rapor: $reportPath"
Write-Output $reportPath
