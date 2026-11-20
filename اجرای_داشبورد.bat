@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py run_dashboard.py
) else (
    where python >nul 2>nul
    if not errorlevel 1 (
        python run_dashboard.py
    ) else (
        echo Python پيدا نشد. Python 3 را نصب کن و دوباره اجرا کن.
        pause
    )
)
endlocal
