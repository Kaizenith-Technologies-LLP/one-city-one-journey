# Generates the One Journey launcher icon PNGs with System.Drawing.
#   icon.png             1024x1024, blue background + route motif (legacy / iOS / web)
#   icon_foreground.png  1024x1024, transparent, motif inside the adaptive-icon safe zone
# Usage: powershell -ExecutionPolicy Bypass -File assets\icon\generate_icon.ps1
Add-Type -AssemblyName System.Drawing

$outDir = $PSScriptRoot
$blue = [System.Drawing.ColorTranslator]::FromHtml('#1E5BC6')
$white = [System.Drawing.Color]::White
$accent = [System.Drawing.ColorTranslator]::FromHtml('#FFC531')

function Draw-Motif([System.Drawing.Graphics]$g, [float]$scale, [float]$offset) {
    # All coordinates designed on a 1024 canvas, then scaled around the centre.
    function P([float]$x, [float]$y) { New-Object System.Drawing.PointF(($offset + $x * $scale), ($offset + $y * $scale)) }

    # Route: S-curve from the bottom-left origin stop to the tip of the destination pin.
    $pen = New-Object System.Drawing.Pen($white, (60 * $scale))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddBezier((P 290 720), (P 420 520), (P 560 760), (P 690 580))
    $g.DrawPath($pen, $path)

    # Origin stop: white ring with blue centre.
    $r = 92 * $scale
    $c = P 290 720
    $g.FillEllipse((New-Object System.Drawing.SolidBrush($white)), $c.X - $r, $c.Y - $r, 2 * $r, 2 * $r)
    $r2 = 44 * $scale
    $g.FillEllipse((New-Object System.Drawing.SolidBrush($blue)), $c.X - $r2, $c.Y - $r2, 2 * $r2, 2 * $r2)

    # Intermediate stop: accent dot at the route midpoint.
    $m = P 490 640
    $r3 = 56 * $scale
    $g.FillEllipse((New-Object System.Drawing.SolidBrush($accent)), $m.X - $r3, $m.Y - $r3, 2 * $r3, 2 * $r3)

    # Destination pin (teardrop) whose tip sits on the route end.
    $pin = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cx = 690; $cy = 360; $pr = 130
    $pin.AddArc(($offset + ($cx - $pr) * $scale), ($offset + ($cy - $pr) * $scale), (2 * $pr * $scale), (2 * $pr * $scale), 150, 240)
    $pin.AddLine((P ($cx + $pr * 0.866) ($cy + $pr * 0.5)), (P $cx ($cy + 230)))
    $pin.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush($white)), $pin)
    $hr = 50 * $scale
    $h = P $cx $cy
    $g.FillEllipse((New-Object System.Drawing.SolidBrush($blue)), $h.X - $hr, $h.Y - $hr, 2 * $hr, 2 * $hr)
}

function New-Canvas {
    $bmp = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    return @($bmp, $g)
}

# Full icon: solid blue square (launchers apply their own mask), motif at ~90%.
$bmp, $g = New-Canvas
$g.Clear($blue)
$s = 0.9; Draw-Motif $g $s (512 * (1 - $s))
$bmp.Save((Join-Path $outDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# Adaptive foreground: transparent, motif within the central 66% safe zone.
$bmp, $g = New-Canvas
$s = 0.7; Draw-Motif $g $s (512 * (1 - $s))
$bmp.Save((Join-Path $outDir 'icon_foreground.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

Write-Host "Wrote icon.png and icon_foreground.png to $outDir"
