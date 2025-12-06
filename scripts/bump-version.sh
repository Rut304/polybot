#!/bin/bash
# Bump version and build number
# Usage: ./scripts/bump-version.sh [major|minor|patch]

VERSION_FILE="VERSION"
CURRENT_VERSION=$(cat $VERSION_FILE | tr -d '\n')

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Bump based on argument
case "${1:-patch}" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch|*)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "$NEW_VERSION" > $VERSION_FILE

# Get build number (commit count)
BUILD_NUMBER=$(git rev-list --count HEAD 2>/dev/null || echo "0")

echo "Version: $NEW_VERSION (Build #$BUILD_NUMBER)"
echo "$NEW_VERSION"
