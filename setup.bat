@echo off
REM One-time setup for the IEMS dashboard on Windows.
REM Usage: double-click this file, or run "setup.bat" from cmd/PowerShell.

cd /d "%~dp0"

echo ==^> [1/3] تثبيت المكتبات (npm install)...
call npm install
if errorlevel 1 goto :error

echo ==^> [2/3] إعداد ملف البيئة (.env)...
if not exist .env (
  copy .env.example .env >nul
  for /f "delims=" %%s in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set SECRET=%%s
  powershell -Command "(Get-Content .env) -replace 'replace_this_with_a_long_random_secret', '%SECRET%' | Set-Content .env"
  echo     تم إنشاء .env مع JWT_SECRET عشوائي وآمن.
) else (
  echo     .env موجود بالفعل - لم يتم تعديله.
)

echo ==^> [3/3] تشغيل السيرفر...
echo     أول تشغيل هيولد قاعدة البيانات وكلمات مرور الموظفين تلقائيا.
echo     كلمات المرور هتتطبع هنا، وكمان في db\credentials_TO_DISTRIBUTE.csv
echo     افتح المتصفح على: http://localhost:3000
echo.
call npm start
goto :eof

:error
echo حصل خطأ اثناء تثبيت المكتبات. تأكد ان Node.js متثبت على الجهاز.
pause
