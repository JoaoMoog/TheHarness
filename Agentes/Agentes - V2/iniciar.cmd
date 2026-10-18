@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 24 LTS em https://nodejs.org e abra novamente este arquivo.
  pause
  exit /b 1
)
node "%~dp0iniciar.mjs" %*
if errorlevel 1 (
  echo.
  echo A CLARA nao iniciou. Confira a mensagem acima.
  pause
  exit /b 1
)
