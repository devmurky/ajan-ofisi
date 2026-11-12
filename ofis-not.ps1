<#
.SYNOPSIS
  Ajan Ofisi'ne Claude Code'un (yönetici) kendi olayını yazar.

.EXAMPLE
  .\ofis-not.ps1 -Type review -Text "Argon'un görsellerini inceliyorum" -Target Argon

.EXAMPLE
  .\ofis-not.ps1 -Type approve -Text "Görseller onaylandı, projeye eklendi" -Target Argon -Job 20261106-153044-1234
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Text,

    # note: genel not | plan: işi planlıyor | review: inceliyor | approve: onayladı | reject: düzeltme istedi
    [ValidateSet('note', 'plan', 'review', 'approve', 'reject')]
    [string]$Type = 'note',

    # İlgili ajan (Argon, Opus, Sonnet...)
    [string]$Target = '',

    # İlgili iş kimliği
    [string]$Job = '',

    [string]$Agent = 'Claude'
)

$eventsFile = Join-Path $HOME 'agy-tools\ofis\events.jsonl'
New-Item -ItemType Directory -Force -Path (Split-Path $eventsFile) | Out-Null
$data = [ordered]@{ type = $Type; agent = $Agent; text = $Text; target = $Target; job = $Job; ts = (Get-Date).ToString('o') }
$line = (New-Object PSObject -Property $data | ConvertTo-Json -Compress) + "`n"
[IO.File]::AppendAllText($eventsFile, $line, (New-Object Text.UTF8Encoding($false)))
