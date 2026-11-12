$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskRoot
try {
    & npm.cmd run build:android-ui
    if ($LASTEXITCODE -ne 0) { throw 'App UI build failed.' }
    Push-Location -LiteralPath (Join-Path $taskRoot 'android')
    try {
        & .\gradlew.bat assembleDebug
        if ($LASTEXITCODE -ne 0) { throw 'Android package build failed.' }
    } finally { Pop-Location }
    $taskRelease = Join-Path $taskRoot 'releases'
    New-Item -ItemType Directory -Force -Path $taskRelease | Out-Null
    Copy-Item -LiteralPath (Join-Path $taskRoot 'android\app\build\outputs\apk\debug\app-debug.apk') -Destination (Join-Path $taskRelease 'RoboContol-Marwane-Haddane-debug.apk')
    Write-Output 'Android package ready in releases/RoboContol-Marwane-Haddane-debug.apk'
} finally { Pop-Location }
