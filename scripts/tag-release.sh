#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Taxora Node.js SDK - Semantic Version Tagger
# Usage:
#   ./scripts/tag-release.sh patch [-m "message"]
#   ./scripts/tag-release.sh minor [-m "message"]
#   ./scripts/tag-release.sh major [-m "message"]
#   ./scripts/tag-release.sh v1.2.3 [-m "message"]   # explicit version
#   ./scripts/tag-release.sh dry-run patch           # compute only
#
# Behavior:
# - Fetches latest tag (vX.Y.Z). If none:
#     patch -> v0.0.1, minor -> v0.1.0, major -> v1.0.0
# - Bumps the version in package.json to match the tag.
# - Creates annotated tag and pushes to origin.
# -----------------------------------------------------------------------------

# --- helpers -----------------------------------------------------------------
die() { echo "❌ $*" >&2; exit 1; }
info(){ echo "➤ $*"; }

require_git_repo() {
  [ -d .git ] || die "Not a git repository."
}

ensure_clean_tree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "⚠️  You have uncommitted changes."
    read -r -p "Continue anyway? (y/N): " c
    [[ "$c" =~ ^[Yy]$ ]] || exit 1
  fi
}

fetch_tags() {
  info "Fetching tags…"
  git fetch --tags --quiet || true
}

latest_tag() {
  git tag --list 'v[0-9]*' --sort=-version:refname | head -n1
}

parse_semver() {
  local v="${1#v}"
  IFS='.' read -r MAJ MIN PAT <<<"$v"
  echo "$MAJ" "$MIN" "$PAT"
}

bump_from_none() {
  case "$1" in
    patch) echo "v0.0.1" ;;
    minor) echo "v0.1.0" ;;
    major) echo "v1.0.0" ;;
    *) die "No existing tags. Use patch|minor|major or explicit vX.Y.Z." ;;
  esac
}

compute_next() {
  local mode="$1" latest="$2"
  if [[ -z "$latest" ]]; then
    bump_from_none "$mode"
    return
  fi

  read -r MAJ MIN PAT < <(parse_semver "$latest")
  case "$mode" in
    patch) printf "v%d.%d.%d\n" "$MAJ" "$MIN" "$((PAT+1))" ;;
    minor) printf "v%d.%d.0\n" "$MAJ" "$((MIN+1))" ;;
    major) printf "v%d.0.0\n" "$((MAJ+1))" ;;
    *) die "Unknown mode: $mode" ;;
  esac
}

valid_version() {
  [[ "$1" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

bump_package_json() {
  local version="${1#v}"   # strip leading 'v'
  local pkg="package.json"
  [[ -f "$pkg" ]] || die "package.json not found."

  info "Bumping package.json version to $version…"
  # Use node to update version in-place (avoids sed portability issues)
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = '$version';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  git add package.json
  git commit -m "chore: bump version to v$version"
}

# --- args --------------------------------------------------------------------
MODE=""
MESSAGE=""
DRYRUN="false"

# allow "dry-run" as first arg
if [[ "${1:-}" == "dry-run" ]]; then
  DRYRUN="true"; shift || true
fi

# mode or explicit version
MODE="${1:-}"; shift || true
[[ -z "$MODE" ]] && die "Usage: $0 [dry-run] patch|minor|major|vX.Y.Z [-m \"message\"]"

# optional -m "message"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message) MESSAGE="${2:-}"; shift 2 ;;
    *) die "Unknown option: $1" ;;
  esac
done

# --- main --------------------------------------------------------------------
require_git_repo
ensure_clean_tree
fetch_tags

LATEST="$(latest_tag)"
info "Latest tag: ${LATEST:-<none>}"

if valid_version "$MODE"; then
  NEXT="$MODE"
else
  case "$MODE" in
    patch|minor|major) NEXT="$(compute_next "$MODE" "$LATEST")" ;;
    *) die "Mode must be patch|minor|major or a version like v1.2.3" ;;
  esac
fi

valid_version "$NEXT" || die "Computed/Provided version '$NEXT' is not valid SemVer (vX.Y.Z)."

if [[ "$DRYRUN" == "true" ]]; then
  echo "Would tag: $NEXT"
  exit 0
fi

MESSAGE="${MESSAGE:-Release $NEXT}"

bump_package_json "$NEXT"

info "Creating annotated tag: $NEXT"
git tag -a "$NEXT" -m "$MESSAGE"

info "Pushing commit and tag to origin…"
git push origin HEAD
git push origin "$NEXT"

echo "✅ Done. Created & pushed $NEXT"

REPO_URL="https://github.com/theconcept-technologies/taxora-sdk-node"
info "Opening repository page: $REPO_URL"
if command -v open >/dev/null 2>&1; then
  open "$REPO_URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$REPO_URL" >/dev/null 2>&1 || true
elif command -v start >/dev/null 2>&1; then
  start "$REPO_URL" >/dev/null 2>&1 || true
else
  info "Please open $REPO_URL manually."
fi
