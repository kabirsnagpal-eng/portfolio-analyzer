# Starts the backend (port 8000) and the frontend dev server (port 5173) in two new windows.
# Usage:  powershell -ExecutionPolicy Bypass -File .\run.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "Backend virtual environment not found. Run the setup steps in README.md first." -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path (Join-Path $root "frontend\node_modules"))) {
    Write-Host "Frontend dependencies not installed. Run 'npm install' in .\frontend first." -ForegroundColor Yellow
    exit 1
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; & '$py' -m uvicorn app.main:app --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"
Write-Host "Backend:  http://127.0.0.1:8000/api/docs"
Write-Host "Frontend: http://localhost:5173"
