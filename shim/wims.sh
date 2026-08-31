# wims shell function — bash and zsh.
#
# A child process can never change its parent's working directory, so the TUI
# writes its choice to a temp file and this function performs the cd itself.
# That is what makes your shell *stay* in the session's folder afterwards.
#
# Source this from ~/.zshrc or ~/.bashrc, or run:  eval "$(wims-tui --print-shim)"

wims() {
  if ! command -v wims-tui >/dev/null 2>&1; then
    printf 'wims: wims-tui is not on your PATH. Re-run install.sh.\n' >&2
    return 127
  fi

  local __wims_out __wims_rc __wims_action __wims_dir __wims_id __wims_extra
  __wims_out="$(mktemp "${TMPDIR:-/tmp}/wims.XXXXXX")" || return 1

  WIMS_ACTION_FILE="$__wims_out" command wims-tui "$@"
  __wims_rc=$?

  if [ ! -s "$__wims_out" ]; then
    rm -f "$__wims_out"
    return $__wims_rc
  fi

  IFS="$(printf '\t')" read -r __wims_action __wims_dir __wims_id __wims_extra < "$__wims_out"
  rm -f "$__wims_out"

  # Only ever pass through the one flag we know about, never arbitrary text.
  case "$__wims_extra" in
    --dangerously-skip-permissions) ;;
    *) __wims_extra="" ;;
  esac

  if [ -n "$__wims_dir" ]; then
    if [ -d "$__wims_dir" ]; then
      cd "$__wims_dir" || return 1
    else
      printf 'wims: folder no longer exists: %s\n' "$__wims_dir" >&2
      return 1
    fi
  fi

  case "$__wims_action" in
    resume)
      if [ -n "$__wims_extra" ]; then
        command claude --resume "$__wims_id" "$__wims_extra"
      else
        command claude --resume "$__wims_id"
      fi
      ;;
    new)
      if [ -n "$__wims_extra" ]; then
        command claude "$__wims_extra"
      else
        command claude
      fi
      ;;
    cd) ;;
    *)  printf 'wims: unknown action: %s\n' "$__wims_action" >&2; return 1 ;;
  esac
}
