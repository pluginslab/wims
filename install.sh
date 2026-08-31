#!/usr/bin/env bash
# wims installer: builds the TUI, links the binary, and wires up the shell
# function that makes `cd` stick. Safe to re-run; use --uninstall to reverse.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${WIMS_BIN_DIR:-$HOME/.local/bin}"
BEGIN_MARK="# >>> wims >>>"
END_MARK="# <<< wims <<<"

info()  { printf '\033[36m›\033[0m %s\n' "$*"; }
ok()    { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[33m!\033[0m %s\n' "$*" >&2; }
die()   { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

detect_shell() {
  case "${SHELL:-}" in
    *fish) echo fish ;;
    *bash) echo bash ;;
    *)     echo zsh  ;;
  esac
}

rc_file() {
  case "$1" in
    fish) echo "$HOME/.config/fish/config.fish" ;;
    bash) [ -f "$HOME/.bashrc" ] && echo "$HOME/.bashrc" || echo "$HOME/.bash_profile" ;;
    *)    echo "${ZDOTDIR:-$HOME}/.zshrc" ;;
  esac
}

strip_block() {
  # Remove any previous wims block, in place, without needing GNU sed.
  local file="$1"
  [ -f "$file" ] || return 0
  grep -q "$BEGIN_MARK" "$file" || return 0
  local tmp
  tmp="$(mktemp)"
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '
    index($0, b) { skip = 1 }
    !skip        { print }
    index($0, e) { skip = 0 }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

trim_trailing_blanks() {
  # Keeps re-running the installer from stacking blank lines in the rc file.
  local file="$1" tmp
  [ -f "$file" ] || return 0
  tmp="$(mktemp)"
  awk '{ l[NR] = $0 }
       END { last = NR
             while (last > 0 && l[last] ~ /^[[:space:]]*$/) last--
             for (i = 1; i <= last; i++) print l[i] }' "$file" > "$tmp"
  mv "$tmp" "$file"
}

uninstall() {
  local shell rc
  shell="$(detect_shell)"
  rc="$(rc_file "$shell")"
  if [ -f "$rc" ]; then
    cp "$rc" "$rc.wims.bak"
    strip_block "$rc"
    trim_trailing_blanks "$rc"
    ok "Removed the wims block from $rc (backup at $rc.wims.bak)"
  fi
  rm -f "$BIN_DIR/wims-tui"
  ok "Removed $BIN_DIR/wims-tui"
  info "Session transcripts were not touched. Open a new shell to finish."
  exit 0
}

[ "${1:-}" = "--uninstall" ] && uninstall

# --- prerequisites -----------------------------------------------------------
command -v node >/dev/null 2>&1 || die "node is required (v20 or newer)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "node v20+ required, found $(node -v)."
command -v npm >/dev/null 2>&1 || die "npm is required."
command -v claude >/dev/null 2>&1 || warn "'claude' is not on your PATH, so wims can still browse, but not resume."

# --- build -------------------------------------------------------------------
info "Installing dependencies…"
( cd "$REPO" && npm install --silent --no-fund --no-audit )

info "Building…"
( cd "$REPO" && npm run --silent build )

[ -f "$REPO/dist/cli.js" ] || die "build produced no dist/cli.js"
chmod +x "$REPO/dist/cli.js"

# --- link the binary ---------------------------------------------------------
mkdir -p "$BIN_DIR"
ln -sf "$REPO/dist/cli.js" "$BIN_DIR/wims-tui"
ok "Linked $BIN_DIR/wims-tui"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) warn "$BIN_DIR is not on your PATH. Add it, or wims will not be found." ;;
esac

# --- install the shell function ---------------------------------------------
SHELL_NAME="$(detect_shell)"
RC="$(rc_file "$SHELL_NAME")"
SHIM="$REPO/shim/wims.sh"
[ "$SHELL_NAME" = "fish" ] && SHIM="$REPO/shim/wims.fish"

mkdir -p "$(dirname "$RC")"
[ -f "$RC" ] && cp "$RC" "$RC.wims.bak"
strip_block "$RC"
trim_trailing_blanks "$RC"

{
  printf '\n%s\n' "$BEGIN_MARK"
  if [ "$SHELL_NAME" = "fish" ]; then
    printf 'test -f %s; and source %s\n' "$SHIM" "$SHIM"
  else
    printf '[ -f "%s" ] && . "%s"\n' "$SHIM" "$SHIM"
  fi
  printf '%s\n' "$END_MARK"
} >> "$RC"

ok "Added the wims function to $RC"

printf '\n'
ok "Done. Start a new shell (or: source \"$RC\") and run:  wims"
printf '  Enter resumes a session AND leaves your shell in its folder.\n'
