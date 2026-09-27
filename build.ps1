$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$sourceDir = Join-Path $projectRoot "src"
$manifestDir = Join-Path $projectRoot "manifests"
$distDir = Join-Path $projectRoot "dist"

if (Test-Path -LiteralPath $distDir) {
    $resolvedDist = (Resolve-Path -LiteralPath $distDir).Path
    $expectedPrefix = $projectRoot.TrimEnd("\") + "\"

    if (-not $resolvedDist.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Diretório de saída inválido: $resolvedDist"
    }

    Remove-Item -LiteralPath $resolvedDist -Recurse -Force
}

New-Item -ItemType Directory -Path $distDir | Out-Null

$targets = @(
    @{
        Name = "chromium"
        Manifest = "manifest.chromium.json"
    },
    @{
        Name = "firefox"
        Manifest = "manifest.firefox.json"
    }
)

foreach ($target in $targets) {
    $targetDir = Join-Path $distDir $target.Name
    New-Item -ItemType Directory -Path $targetDir | Out-Null

    Copy-Item -Path (Join-Path $sourceDir "*") -Destination $targetDir -Recurse
    Copy-Item `
        -LiteralPath (Join-Path $manifestDir $target.Manifest) `
        -Destination (Join-Path $targetDir "manifest.json")

    $archive = Join-Path $distDir ("replay-sports-downloader-" + $target.Name + ".zip")
    Compress-Archive -Path (Join-Path $targetDir "*") -DestinationPath $archive
}

Write-Host "Pacotes criados em $distDir"

