@echo off
REM OpenPresenter - lanceur Windows (double-clic).
REM Resout le dossier, trouve un runtime Node.js 20+, puis delegue a app\launcher\launch.mjs.
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%CD%"
set "NODE="

if exist "%ROOT%\runtime\node.exe" set "NODE=%ROOT%\runtime\node.exe"
if not defined NODE if exist "%ROOT%\runtime\node\node.exe" set "NODE=%ROOT%\runtime\node\node.exe"
if not defined NODE (
  for /f "delims=" %%i in ('where node 2^>nul') do (
    if not defined NODE set "NODE=%%i"
  )
)
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"

if not defined NODE goto :noruntime

for /f "delims=" %%v in ('"%NODE%" -e "process.stdout.write(process.versions.node)"') do set "VERSION=%%v"
for /f "tokens=1 delims=." %%a in ("%VERSION%") do set "MAJOR=%%a"
if %MAJOR% LSS 20 goto :oldruntime

"%NODE%" "%ROOT%\app\launcher\launch.mjs" %*
exit /b %ERRORLEVEL%

:noruntime
echo.
echo ============================================================
echo    OpenPresenter
echo ============================================================
echo.
echo Node.js est introuvable sur cet ordinateur.
echo.
echo   1. Ouvrez https://nodejs.org/fr dans un navigateur
echo   2. Telechargez la version "LTS" (Windows Installer .msi)
echo   3. Installez-la en laissant les options par defaut
echo   4. Relancez OpenPresenter.bat
echo.
echo Alternative sans installation : copiez node.exe dans runtime\
echo Aucune installation n'est faite sans votre accord.
echo.
pause
exit /b 70

:oldruntime
echo.
echo OpenPresenter necessite Node.js 20 ou plus recent.
echo Version detectee : %VERSION%
echo Telechargez la version "LTS" sur https://nodejs.org/fr, puis relancez.
echo.
pause
exit /b 70
