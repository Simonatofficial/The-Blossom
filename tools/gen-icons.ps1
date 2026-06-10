# Generates PWA PNG icons (cosmos-flower-in-orbit sigil, docs/06+09) with GDI+.
# Usage: powershell -File tools/gen-icons.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'icons'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function Draw-Icon([int]$size, [double]$pad, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'

  $bg = [System.Drawing.ColorTranslator]::FromHtml('#1b1430')
  $g.Clear($bg)

  $cx = $size / 2.0; $cy = $size / 2.0
  $scale = ($size * (1.0 - 2.0 * $pad)) / 64.0   # art designed on a 64-unit grid

  # orbit ring
  $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 167, 139, 250), [single](1.8 * $scale))
  $g.TranslateTransform($cx, $cy)
  $g.RotateTransform(-20)
  $g.DrawEllipse($ringPen, [single](-27 * $scale), [single](-10 * $scale), [single](54 * $scale), [single](20 * $scale))
  $g.ResetTransform()

  # back petals (lighter, offset 22.5deg)
  $backBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(215, 232, 160, 176))
  for ($i = 0; $i -lt 8; $i++) {
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(22.5 + 45 * $i)
    $g.FillEllipse($backBrush, [single](-4.6 * $scale), [single](-19.5 * $scale), [single](9.2 * $scale), [single](18 * $scale))
    $g.ResetTransform()
  }

  # front petals
  $petalBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#d8697f'))
  for ($i = 0; $i -lt 8; $i++) {
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(45 * $i)
    $g.FillEllipse($petalBrush, [single](-5.4 * $scale), [single](-23 * $scale), [single](10.8 * $scale), [single](22 * $scale))
    $g.ResetTransform()
  }

  # core
  $coreBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#e0a23c'))
  $g.FillEllipse($coreBrush, [single]($cx - 6.5 * $scale), [single]($cy - 6.5 * $scale), [single](13 * $scale), [single](13 * $scale))
  $rimPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#f3d9a0'), [single](1.2 * $scale))
  $g.DrawEllipse($rimPen, [single]($cx - 6.5 * $scale), [single]($cy - 6.5 * $scale), [single](13 * $scale), [single](13 * $scale))

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $path"
}

Draw-Icon 192 0.06 (Join-Path $outDir 'icon-192.png')
Draw-Icon 512 0.06 (Join-Path $outDir 'icon-512.png')
Draw-Icon 512 0.20 (Join-Path $outDir 'maskable-512.png')   # 20% safe zone
