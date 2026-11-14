# Where the plan and tickets live

Read the tracker from `git remote -v`, unless the `tracker` setting names one.

| Remote points at | Tracker | CLI |
|---|---|---|
| GitHub | GitHub Issues | `gh` |
| GitLab | GitLab Issues | `glab` |
| anything else, or no remote | files in the flow's folder | none |

File issues only into the user's own repo. In a fork, check the target first with `gh repo view --json nameWithOwner`.

A plan that fits one session is never published. It stays in `plan.md`.

## GitHub

- **Spec:** one issue holding the plan. `gh issue create --title "..." --body-file plan.md`
- **Ticket:** a sub-issue of the spec, created blockers first so each can name real numbers. `gh issue create --parent <spec> --title "..." --body "..."`
- **Blockers:** `gh issue edit <ticket> --add-blocked-by <blocker>`. On a `gh` too old for sub-issues or blockers, put `Part of #<spec>` and a `Blocked by: #<n>` line at the top of the ticket body.
- **Unblocked?** `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` returns 0.
- **Done:** `gh issue close <ticket>` with a comment naming the commit. Close the spec when the pull request merges.

## GitLab

- **Spec:** `glab issue create --title "..." --description "..."`
- **Ticket:** an issue with `Part of #<spec>` at the top, linked with `--linked-issues <spec>`.
- **Blockers:** post the quick action `/blocked_by #<n>` as a note: `glab issue note <ticket> --message "/blocked_by #<n>"`.
- **Done:** `glab issue note <ticket> --message "..."`, then `glab issue close <ticket>`.

## Files

- **Spec:** `plan.md` in the flow's folder.
- **Ticket:** one file each under `tickets/` in the flow's folder, `01-<slug>.md` upward in dependency order. Never one combined file.
- **Done:** change the ticket's `Status:` line to `done`.

```md
# 01: <ticket title>

**What it makes work:** <the behaviour, from the user's point of view>
**Blocked by:** <ticket numbers, or none>
**Size:** <simple or complex>
**Status:** open

- [ ] <acceptance criterion>
- [ ] <acceptance criterion>
```
