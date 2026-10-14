# Test-only bridge to native Windows Job Objects. No policy changes/elevation.
param(
    [Parameter(Mandatory=$true)][string]$NodePath,
    [Parameter(Mandatory=$true)][string]$ChildPath,
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [Parameter(Mandatory=$true)][string]$ErrorPath,
    [Parameter(Mandatory=$true)][string]$ReportPath,
    [Parameter(Mandatory=$true)][string]$WorkingDirectory,
    [ulong]$MemoryBytes = 536870912,
    [int]$CpuSeconds = 5,
    [int]$WallMs = 15000
)
$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'portrait_decode_job.cs')
$result = [PortraitJobProbe]::Run($NodePath, $ChildPath, $InputPath, $OutputPath, $ErrorPath, $WorkingDirectory, $MemoryBytes, $CpuSeconds, $WallMs)
$stream = [System.IO.File]::Open($ReportPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($result | ConvertTo-Json -Depth 4))
    $stream.Write($bytes, 0, $bytes.Length)
} finally { $stream.Dispose() }
