# wims shell function for fish.
#
# A child process can never change its parent's working directory, so the TUI
# writes its choice to a temp file and this function performs the cd itself.
#
# Source this from ~/.config/fish/config.fish, or save it as
# ~/.config/fish/functions/wims.fish

function wims --description "Where Is My Session: find and resume a Claude Code session"
    if not command -q wims-tui
        echo "wims: wims-tui is not on your PATH. Re-run install.sh." >&2
        return 127
    end

    set -l __out (mktemp)
    env WIMS_ACTION_FILE=$__out wims-tui $argv
    set -l __rc $status

    if not test -s $__out
        rm -f $__out
        return $__rc
    end

    set -l __parts (string split \t -- (head -n 1 $__out))
    rm -f $__out

    set -l __action $__parts[1]
    set -l __dir ""
    set -l __id ""
    set -l __extra ""
    if test (count $__parts) -ge 2
        set __dir $__parts[2]
    end
    if test (count $__parts) -ge 3
        set __id $__parts[3]
    end
    if test (count $__parts) -ge 4
        # Only ever pass through the one flag we know about.
        if test "$__parts[4]" = "--dangerously-skip-permissions"
            set __extra $__parts[4]
        end
    end

    if test -n "$__dir"
        if test -d "$__dir"
            cd "$__dir"; or return 1
        else
            echo "wims: folder no longer exists: $__dir" >&2
            return 1
        end
    end

    switch $__action
        case resume
            if test -n "$__extra"
                command claude --resume $__id $__extra
            else
                command claude --resume $__id
            end
        case new
            if test -n "$__extra"
                command claude $__extra
            else
                command claude
            end
        case cd
            # cd already done above
        case '*'
            echo "wims: unknown action: $__action" >&2
            return 1
    end
end
