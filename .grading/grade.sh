#!/bin/bash
set -euo pipefail

# ============================================================================
# Grading script for ts-write-tests-api
# Runs candidate tests against reference and 6 buggy variants
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NONCE=$(cat /dev/urandom | LC_ALL=C tr -dc 'a-f0-9' | head -c 32)

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy the full project to a temp workspace
cp -r "$PROJECT_DIR"/* "$TEMP_DIR/" 2>/dev/null || true
cp -r "$PROJECT_DIR"/.grading "$TEMP_DIR/"
cd "$TEMP_DIR"

# Ensure test environment
export NODE_ENV=test

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  npm install --silent 2>/dev/null
fi

# Create grading jest config
cat > jest.grade.config.js << 'JESTEOF'
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  silent: true,
};
JESTEOF

# Save original routes
cp src/routes/tasks.ts src/routes/tasks.ts.original

# ============================================================================
# Phase 1: Run against reference (all bugs fixed)
# ============================================================================

cp .grading/reference/routes/tasks.ts src/routes/tasks.ts

REFERENCE_RESULT=$(npx jest --config jest.grade.config.js --json 2>/dev/null || true)
REFERENCE_TOTAL=$(echo "$REFERENCE_RESULT" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
  console.log(data.numTotalTests || 0);
" 2>/dev/null || echo "0")
REFERENCE_PASSED=$(echo "$REFERENCE_RESULT" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
  console.log(data.numPassedTests || 0);
" 2>/dev/null || echo "0")

if [ "$REFERENCE_TOTAL" -gt 0 ]; then
  REFERENCE_PASS_RATE=$(node -e "console.log(Math.round(($REFERENCE_PASSED / $REFERENCE_TOTAL) * 100))")
else
  REFERENCE_PASS_RATE=0
fi

# ============================================================================
# Phase 2: Run against each buggy variant
# ============================================================================

MUTATION_RESULTS="["
MUTATIONS_CAUGHT=0
MUTATIONS_TOTAL=6

BUGGY_DESCRIPTIONS=(
  "POST does not validate required title field"
  "GET filtering ignores status parameter"
  "PUT returns 200 even when task not found"
  "DELETE does not actually delete the record"
  "Sort parameter is vulnerable to SQL injection"
  "Pagination offset calculation is wrong"
)

for i in 1 2 3 4 5 6; do
  # Swap routes with buggy variant
  cp ".grading/buggy-v$i/routes/tasks.ts" src/routes/tasks.ts

  BUGGY_RESULT=$(npx jest --config jest.grade.config.js --json 2>/dev/null || true)
  BUGGY_FAILED=$(echo "$BUGGY_RESULT" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
    console.log(data.numFailedTests || 0);
  " 2>/dev/null || echo "0")

  if [ "$BUGGY_FAILED" -gt 0 ]; then
    CAUGHT="true"
    MUTATIONS_CAUGHT=$((MUTATIONS_CAUGHT + 1))
  else
    CAUGHT="false"
  fi

  DESC="${BUGGY_DESCRIPTIONS[$((i-1))]}"
  if [ "$i" -gt 1 ]; then
    MUTATION_RESULTS="$MUTATION_RESULTS,"
  fi
  MUTATION_RESULTS="$MUTATION_RESULTS{\"variant\":\"buggy-v$i\",\"description\":\"$DESC\",\"caught\":$CAUGHT}"
done

MUTATION_RESULTS="$MUTATION_RESULTS]"

if [ "$MUTATIONS_TOTAL" -gt 0 ]; then
  MUTATION_SCORE=$(node -e "console.log(Math.round(($MUTATIONS_CAUGHT / $MUTATIONS_TOTAL) * 100))")
else
  MUTATION_SCORE=0
fi

# Restore original
cp src/routes/tasks.ts.original src/routes/tasks.ts 2>/dev/null || true

# ============================================================================
# Output results
# ============================================================================

cat << JSONEOF
{
  "nonce": "$NONCE",
  "referencePassRate": $REFERENCE_PASS_RATE,
  "referenceTotal": $REFERENCE_TOTAL,
  "referencePassed": $REFERENCE_PASSED,
  "mutationResults": $MUTATION_RESULTS,
  "mutationsCaught": $MUTATIONS_CAUGHT,
  "mutationsTotal": $MUTATIONS_TOTAL,
  "mutationScore": $MUTATION_SCORE
}
JSONEOF
