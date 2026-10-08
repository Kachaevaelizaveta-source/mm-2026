$root = (Get-Location).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:8000/')
$listener.Start()
Write-Host "Serving $root on http://localhost:8000/"
while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $relative = $context.Request.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
    $file = Join-Path $root ($relative -replace '/', '\\')
    if (Test-Path $file -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
      $mime = switch ($ext) { '.html' {'text/html; charset=utf-8'} '.css' {'text/css; charset=utf-8'} '.js' {'application/javascript; charset=utf-8'} '.json' {'application/json; charset=utf-8'} default {'application/octet-stream'} }
      $bytes = [IO.File]::ReadAllBytes($file)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = $mime
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $context.Response.StatusCode = 404
    }
    $context.Response.Close()
  } catch { }
}
