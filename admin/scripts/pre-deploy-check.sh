#!/bin/bash
# Pre-deployment validation script
# Run this before pushing to catch common issues

set -e

echo "🔍 Running pre-deployment checks..."
echo ""

cd "$(dirname "$0")/.."

# 1. TypeScript type checking
echo "📘 Checking TypeScript..."
npx tsc --noEmit
echo "✅ TypeScript: No errors"
echo ""

# 2. ESLint
echo "📝 Running ESLint..."
npm run lint
echo "✅ ESLint: No errors"
echo ""

# 3. Build test (catches syntax errors)
echo "🏗️  Testing build..."
npm run build > /dev/null 2>&1 || {
  echo "❌ Build failed!"
  npm run build
  exit 1
}
echo "✅ Build: Success"
echo ""

# 4. Check for common mistakes
echo "🔎 Checking for common mistakes..."

# Check for console.log in production code (excluding tests)
CONSOLE_LOGS=$(grep -rn "console.log" src/ --include="*.tsx" --include="*.ts" | grep -v "// debug" | grep -v "// DEBUG" | head -5 || true)
if [ -n "$CONSOLE_LOGS" ]; then
  echo "⚠️  Found console.log statements (consider removing for production):"
  echo "$CONSOLE_LOGS"
  echo ""
fi

# Check for TODO comments that might be blocking
TODOS=$(grep -rn "TODO:" src/ --include="*.tsx" --include="*.ts" | head -5 || true)
if [ -n "$TODOS" ]; then
  echo "📌 Found TODO comments:"
  echo "$TODOS"
  echo ""
fi

# Check for hardcoded localhost URLs
LOCALHOST=$(grep -rn "localhost" src/ --include="*.tsx" --include="*.ts" | grep -v "// " | grep -v "test" | head -5 || true)
if [ -n "$LOCALHOST" ]; then
  echo "⚠️  Found hardcoded localhost references:"
  echo "$LOCALHOST"
  echo ""
fi

# 5. Check for secrets (basic check)
echo "🔐 Checking for potential secrets..."
SECRETS=$(grep -rEn "(api_key|apikey|secret|password|token).*=.*['\"][a-zA-Z0-9]{20,}" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -5 || true)
if [ -n "$SECRETS" ]; then
  echo "❌ POTENTIAL SECRETS FOUND! Review these lines:"
  echo "$SECRETS"
  exit 1
fi
echo "✅ No obvious secrets detected"
echo ""

# 6. Check for missing auth headers in API calls (basic grep)
echo "🔑 Checking API calls for auth patterns..."
MISSING_AUTH=$(grep -rn "fetch('/api/" src/ --include="*.tsx" --include="*.ts" -A3 | grep -B2 "method:" | grep -v "Authorization" | grep "fetch" | head -5 || true)
if [ -n "$MISSING_AUTH" ]; then
  echo "⚠️  These API calls might be missing auth headers (verify manually):"
  echo "$MISSING_AUTH"
  echo ""
fi

echo ""
echo "✅ All pre-deployment checks passed!"
echo ""
echo "Next steps:"
echo "  git add -A && git commit -m 'your message'"
echo "  git push"
