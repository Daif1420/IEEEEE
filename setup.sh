#!/usr/bin/env bash
# One-time setup for the IEMS dashboard: installs dependencies, creates .env
# with a real random JWT secret, and starts the server.
# Usage: bash setup.sh

set -e
cd "$(dirname "$0")"

echo "==> [1/3] تثبيت المكتبات (npm install)..."
npm install

echo "==> [2/3] إعداد ملف البيئة (.env)..."
if [ ! -f .env ]; then
  cp .env.example .env
  # generate a real random secret instead of the placeholder
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
  else
    SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  fi
  # portable in-place sed (works on both GNU and BSD/macOS sed)
  sed -i.bak "s/replace_this_with_a_long_random_secret/$SECRET/" .env && rm -f .env.bak
  echo "    تم إنشاء .env مع JWT_SECRET عشوائي وآمن."
else
  echo "    .env موجود بالفعل - لم يتم تعديله."
fi

echo "==> [3/3] تشغيل السيرفر..."
echo "    أول تشغيل هيولّد قاعدة البيانات وكلمات مرور الموظفين تلقائيًا."
echo "    كلمات المرور هتتطبع هنا في الـ Terminal، وكمان في db/credentials_TO_DISTRIBUTE.csv"
echo "    افتح المتصفح على: http://localhost:3000"
echo ""
npm start
