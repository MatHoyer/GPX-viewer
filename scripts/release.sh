#!/usr/bin/env bash
# Cut a release: bump web/package.json, commit `chore(release): X.Y.Z`,
# tag X.Y.Z and push. Pushing the tag fires the Docker and Release workflows.
#
# Usage: scripts/release.sh [patch|minor|major|X.Y.Z]   (default: patch)
# Set SKIP_CHECKS=1 to skip the quality gates.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

die() { echo "error: $*" >&2; exit 1; }

bump=${1:-patch}

# Guard rails before anything destructive.
[ -z "$(git status --porcelain)" ] || die "working tree is not clean"

branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = main ] || die "must be on main (on $branch)"

git fetch --quiet --tags origin main
git merge-base --is-ancestor origin/main HEAD \
  || die "main is behind or diverged from origin/main"

latest=$(git tag --list '[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n1)
latest=${latest:-0.0.0}
IFS=. read -r major minor patch <<<"$latest"

case "$bump" in
  patch) next="$major.$minor.$((patch + 1))" ;;
  minor) next="$major.$((minor + 1)).0" ;;
  major) next="$((major + 1)).0.0" ;;
  [0-9]*.[0-9]*.[0-9]*) next=$bump ;;
  *) die "unknown bump '$bump' (patch|minor|major|X.Y.Z)" ;;
esac

[[ "$next" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "invalid version '$next'"
git rev-parse -q --verify "refs/tags/$next" >/dev/null && die "tag $next already exists"

pkg_version=$(node -p "require('./web/package.json').version")
if [ "$pkg_version" != "$latest" ]; then
  echo "warning: web/package.json is at $pkg_version but latest tag is $latest"
fi

echo "Releasing $latest -> $next"
read -r -p "Continue? [y/N] " answer
[[ "$answer" =~ ^[yY]$ ]] || die "aborted"

if [ "${SKIP_CHECKS:-0}" != 1 ]; then
  echo "Running quality gates..."
  unformatted=$(gofmt -l cmd internal web)
  [ -z "$unformatted" ] || die "gofmt needed on: $unformatted"
  go vet ./...
  go test ./...
  (cd web && pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build)
fi

node -e '
  const fs = require("fs");
  const path = "web/package.json";
  const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
  pkg.version = process.argv[1];
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
' "$next"

git add web/package.json
git commit -m "chore(release): $next"
git tag -a "$next" -m "$next"

git push origin main
git push origin "$next"

echo "Released $next"
