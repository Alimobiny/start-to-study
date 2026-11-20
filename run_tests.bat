@echo off
rem One-click regression tests for the dashboard (Node.js required).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
node tests\run-tests.mjs
if errorlevel 1 goto failed
echo.
echo All tests passed.
pause
exit /b 0

:nonode
echo Node.js not found. Install Node.js 18 or newer, then run again.
pause
exit /b 1

:failed
echo.
echo Some tests FAILED. See the list above.
pause
exit /b 1
