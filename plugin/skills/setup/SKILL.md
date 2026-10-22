---
name: setup
description: Set up a repo for devflow, once per repo. Checks that Matt Pocock's skills and pstack are installed without clashing, then sets up what's still missing with defaults, asking only what it can't decide. /devflow:start runs it on its own when a repo isn't set up.
disable-model-invocation: true
---

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root.

Setup should take about a minute. Pick defaults instead of asking, write files instead of showing drafts, and don't build or launch the app. Everything it writes is plain text the user can edit later.

## 1. Check

Run `devflow doctor`. If it ran `git init`, pass that line on.

- `install` lines (a dependency was disabled or removed): show them and stop. The user runs them, restarts Claude Code, and runs `/devflow:setup` again.
- READY: say devflow is set up here, list how to change each piece later (see **4. Done**), and stop.

## 2. Ask only what defaults can't settle

Ask in one `AskUserQuestion` call, recommended option first, and only when one of these applies. Most repos get no question.

- **Collision:** for each `collision:` line, whether to delete that loose pstack copy of `tdd` or `teach` (devflow uses Matt's). Recommend yes.
- **Domain docs:** only when the repo has monorepo signals (`pnpm-workspace.yaml`, a `workspaces` field in `package.json`, or `packages/*` with their own `src/`): single-context or multi-context. Recommend single-context.

## 3. Set up

Do each missing piece without stopping, then delete any collision folders the user agreed to.

- **pstack models:** run `devflow pstack-models`. It writes `~/.claude/rules/pstack-models.md` with Opus at the large budget, once per machine. Don't run `/setup-pstack`.
- **Issue tracker:** run `devflow show setup-matt-pocock-skills` for its folder and templates, but do only its step 4 (Write) with these choices, skipping its questions and drafts:
  - Tracker: GitHub if `git remote -v` points at GitHub, GitLab if at GitLab, otherwise local markdown. Fill the template from its folder.
  - Domain docs: single-context unless step 2 chose otherwise.
  - Skip triage labels; devflow doesn't install `triage`.
  - The Agent skills block goes in `CLAUDE.md` if it exists, else `AGENTS.md` if that exists, else a new `CLAUDE.md`.

The verification skill isn't part of setup. The feature and bug flows offer to build one the first time they need to prove a change in the running app.

## 4. Done

Run `devflow doctor` and show a short checklist: each piece with a ✓ and the file it wrote, the tracker and doc layout it picked, and how to change each later (edit `docs/agents/*.md`, `/setup-pstack` for other models or budgets, `/create-verification-skill` any time). Add one line: small changes run `/poteto-mode`, which uses far more tokens than the `direct` option; switch in `/plugin`, under devflow, Configure options. If `/devflow:start` brought you here with a task, go back to it now. Otherwise end with the next step: `/devflow:start <what you want done>`.
