<#
.SYNOPSIS
  Ajan Ofisi duman testi. Gerçek ofise dokunmaz: sunucuyu ayrı portta, geçici bir olay dosyasıyla çalıştırır.

.DESCRIPTION
  1. Sözdizimi: server.js, hook-core.js, hook.js, static/*.js (node --check) ve PowerShell betikleri
  2. Sunucuyu 4399 portunda geçici events dosyasıyla başlatır
  3. Sahte olaylar ekler (start/progress/done/queued/intern/claude/plan) ve /events akışında görünmelerini bekler
  4. Güvenlik: tokensız /api/task 403, Origin'li /api/hook 403, izinsiz model 400, yol aşımı 403
  5. /api/hook ile gelen kanca girdisinin olaya dönüştüğünü kontrol eder

.EXAMPLE
  powershell -File ~/agy-tools/ofis/test-ofis.ps1
#>
$ErrorActionPreference = 'Stop'
$ofis = Split-Path -Parent $MyInvocation.MyCommand.Path
$tools = Split-Path -Parent $ofis
$port = 4399
# localhost önce IPv6'ya (::1) gider; sunucu yalnızca 127.0.0.1'de dinler
$base = "http://127.0.0.1:$port"
$tmp = Join-Path $env:TEMP "ofis-test-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp | Out-Null
$events = Join-Path $tmp 'events.jsonl'
'' | Set-Content $events -NoNewline
$fail = 0
function Ok($name, $cond, $detail = '') {
    if ($cond) { Write-Host "  [tamam] $name" -ForegroundColor Green }
    else { Write-Host "  [HATA]  $name $detail" -ForegroundColor Red; $script:fail++ }
}

Write-Host '1) Sözdizimi'
foreach ($f in @('server.js', 'hook-core.js', 'hook.js') + (Get-ChildItem (Join-Path $ofis 'static') -Filter *.js | ForEach-Object { "static\$($_.Name)" })) {
    & node --check (Join-Path $ofis $f) 2>$null
    Ok $f ($LASTEXITCODE -eq 0)
}
foreach ($p in (Join-Path $tools 'ask-agy.ps1'), (Join-Path $tools 'ofis-not.ps1')) {
    $errs = $null; $null = [System.Management.Automation.Language.Parser]::ParseFile($p, [ref]$null, [ref]$errs)
    $bom = [IO.File]::ReadAllBytes($p)[0] -eq 0xEF
    Ok "$(Split-Path $p -Leaf) (sözdizimi + BOM)" (($errs.Count -eq 0) -and $bom)
}

Write-Host '2) Sunucu'
$env:OFIS_PORT = "$port"; $env:OFIS_EVENTS = $events; $env:OFIS_NO_TOAST = '1'
$srv = Start-Process node -ArgumentList "`"$(Join-Path $ofis 'server.js')`"" -PassThru -WindowStyle Hidden
Remove-Item Env:OFIS_PORT, Env:OFIS_EVENTS, Env:OFIS_NO_TOAST
try {
    $up = $false
    for ($i = 0; $i -lt 30 -and -not $up; $i++) { try { Invoke-WebRequest "$base/api/settings" -UseBasicParsing -TimeoutSec 2 | Out-Null; $up = $true } catch { Start-Sleep -Milliseconds 200 } }
    Ok 'sunucu açıldı' $up
    $page = Invoke-WebRequest "$base/" -UseBasicParsing
    Ok 'sayfa' ($page.StatusCode -eq 200 -and $page.Content -match '/static/app.js')
    Ok 'statik dosya' ((Invoke-WebRequest "$base/static/app.js" -UseBasicParsing).StatusCode -eq 200)

    Write-Host '3) Olaylar'
    $now = (Get-Date).ToString('o')
    $fake = @(
        @{ type = 'start'; job = 'T1'; agent = 'Sonnet'; model = 'claude-sonnet-5-5-low'; title = 'Duman testi'; project = 'test-duman'; ts = $now },
        @{ type = 'progress'; job = 'T1'; agent = 'Sonnet'; label = 'dosya yazıyor: a.txt'; ts = $now },
        @{ type = 'done'; job = 'T1'; agent = 'Sonnet'; title = 'Duman testi'; seconds = 3; summary = 'Türkçe: çğıöşü'; ts = $now },
        @{ type = 'queued'; job = 'T2'; agent = 'Opus'; title = 'Sıra'; ts = $now },
        @{ type = 'intern-start'; id = 'I1'; title = 'Alt görev'; agent = 'Claude'; ts = $now },
        @{ type = 'claude'; state = 'busy'; label = 'okuyor: x'; agent = 'Claude'; ts = $now },
        @{ type = 'plan'; agent = 'Claude'; text = 'Toplantı'; ts = $now }
    )
    $utf8 = New-Object Text.UTF8Encoding($false)
    $lines = ($fake | ForEach-Object { New-Object PSObject -Property $_ | ConvertTo-Json -Compress }) -join "`n"
    [IO.File]::AppendAllText($events, $lines + "`n", $utf8)
    Start-Sleep -Milliseconds 800
    # SSE: geçmiş olayı ilk mesajda gelir
    $req = [Net.WebRequest]::Create("$base/events"); $req.Timeout = 5000
    $resp = $req.GetResponse(); $sr = New-Object IO.StreamReader($resp.GetResponseStream(), $utf8)
    $first = ''; while (-not $first.Contains("`n`n")) { $first += [char]$sr.Read() }
    $resp.Close()
    Ok 'SSE geçmişi' ($first -match 'event: history' -and $first -match 'Duman testi' -and $first -match 'çğıöşü')
    Ok 'yedi olay geçmişte' (([regex]::Matches($first, '"type":')).Count -ge 7)

    Write-Host '4) Güvenlik'
    function Code($script) { try { & $script | Out-Null; 200 } catch { [int]$_.Exception.Response.StatusCode } }
    Ok 'tokensız /api/task → 403' ((Code { Invoke-WebRequest "$base/api/task" -Method POST -ContentType 'application/json' -Body '{}' -UseBasicParsing }) -eq 403)
    $tok = (Invoke-RestMethod "$base/api/token").token
    $h = @{ 'X-Ofis-Token' = $tok; Origin = "http://127.0.0.1:$port" }
    Ok 'izinsiz model → 400' ((Code { Invoke-WebRequest "$base/api/task" -Method POST -Headers $h -ContentType 'application/json' -Body '{"model":"gemini-3.8-flash-high","workdir":"C:\\","prompt":"x"}' -UseBasicParsing }) -eq 400)
    Ok 'yanlış köken → 403' ((Code { Invoke-WebRequest "$base/api/task" -Method POST -Headers @{ 'X-Ofis-Token' = $tok; Origin = 'http://evil.example' } -ContentType 'application/json' -Body '{}' -UseBasicParsing }) -eq 403)
    Ok 'yol aşımı → 403/404' ((Code { Invoke-WebRequest "$base/out/..%2F..%2F.ssh%2Fid_rsa" -UseBasicParsing }) -in 403, 404)
    Ok "Origin'li kanca → 403" ((Code { Invoke-WebRequest "$base/api/hook" -Method POST -Headers @{ Origin = 'http://evil.example' } -ContentType 'application/json' -Body '{}' -UseBasicParsing }) -eq 403)

    Write-Host '5) Kanca'
    $hook = '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"C:/p/app.js"},"cwd":"C:/p/duman","session_id":"abc12345xyz"}'
    Invoke-WebRequest "$base/api/hook" -Method POST -ContentType 'application/json' -Body $hook -UseBasicParsing | Out-Null
    Start-Sleep -Milliseconds 300
    Ok 'kanca olaya dönüştü' ((Get-Content $events -Raw -Encoding UTF8) -match '"label":"düzenliyor: app.js"')

    Write-Host '6) İstatistik ve tekrar'
    $stats = Invoke-RestMethod "$base/api/stats?tests=1"
    Ok '/api/stats 14 gün' ($stats.days.Count -eq 14 -and $stats.agents.Sonnet.jobs -ge 1)
    $day = (Get-Date).ToString('yyyy-MM-dd')
    # PS 5.1: Invoke-RestMethod JSON dizisini tek nesne verir; boru ile açıyoruz
    $evs = @((Invoke-RestMethod "$base/api/events?date=$day") | ForEach-Object { $_ })
    Ok '/api/events bugün' ($evs.Count -ge 7)
    $roles = @((Invoke-RestMethod "$base/api/roles") | ForEach-Object { $_ })
    Ok '/api/roles (6 uzman + raportör)' (@($roles | Where-Object { -not $_.raportor }).Count -ge 6 -and @($roles | Where-Object { $_.raportor }).Count -eq 1)
    Ok 'rapor görüntüleyici' ((Invoke-WebRequest "$base/rapor" -UseBasicParsing).Content -match 'DOMPurify')
    Ok 'toplantı tokensız → 403' ((Code { Invoke-WebRequest "$base/api/meeting" -Method POST -ContentType 'application/json' -Body '{}' -UseBasicParsing }) -eq 403)
    Ok 'ayar yazma tokensız → 403' ((Code { Invoke-WebRequest "$base/api/settings" -Method POST -ContentType 'application/json' -Body '{}' -UseBasicParsing }) -eq 403)
}
finally {
    if ($srv -and -not $srv.HasExited) { Stop-Process -Id $srv.Id -Force }
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
if ($fail) { Write-Host "`n$fail test başarısız." -ForegroundColor Red; exit 1 }
Write-Host "`nTüm testler geçti." -ForegroundColor Green
