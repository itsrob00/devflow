---
name: setup
description: Set up a repo for devflow, once per repo. Checks that Matt Pocock's skills and pstack are installed without clashing, then runs the setup steps that are still missing.
disable-model-invocation: true
---

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root. Run each skill the way `/devflow:start` does: `devflow show <skill>`, then follow the SKILL.md it prints.

The setup skills below each explore, ask, show a draft and write, one after another, which turns setup into a long back-and-forth. Run them as one pass instead: explore everything first, ask every question at once, show every draft at once, then do the long work without stopping. Every step of each skill still happens; only the order and the number of interruptions change.

## 1. Check

Run `devflow doctor`. It runs `git init` if the folder isn't a repo; pass that line on.

- `install` lines (a dependency was disabled or removed): show them and stop. The user runs them, restarts Claude Code, and runs `/devflow:setup` again.
- Nothing missing: say devflow is set up here, and stop.

For each piece doctor reports missing, do the exploring part of its skill now, without asking anything:

- **Issue tracker:** `setup-matt-pocock-skills`, its step 1 (Explore).
- **pstack models:** `setup-pstack`, its steps 1 and 2 (detect models, load current state). pstack's settings live in your home folder, so they cover every repo on this machine.
- **Verification skill:** `create-verification-skill`, its step 1 (interview the repo). Note anything it can't observe.

## 2. Plan

One short message: what's already set up, what this run will set up (one line each), and that you'll ask everything up front, show the drafts once, then work through the rest without stopping.

## 3. Ask, once

Ask every question in a single structured-question call (`AskUserQuestion`), recommended option first and marked as recommended, so the user can accept them all at once. Only include the questions that apply:

- **Issue tracker** (`setup-matt-pocock-skills` section A): recommend what the remote points at, otherwise local markdown.
- **Triage labels** (section B): only when `triage` is installed. Recommend the defaults.
- **Domain docs** (section C): only when exploring found monorepo signals.
- **Which file gets the Agent skills block:** only when neither `CLAUDE.md` nor `AGENTS.md` exists.
- **pstack budget** (`setup-pstack` step 3a): recommend `large`.
- **Collision:** for each `collision:` line, whether to delete that loose pstack copy of `tdd` or `teach` (devflow uses Matt's). Recommend yes.
- **Verification:** anything step 1 couldn't observe (how to sign in, which surface matters most).

## 4. Review, once

Apply the answers and show every draft in one message:

- From `setup-matt-pocock-skills` step 3: the Agent skills block and each `docs/agents/*.md` file.
- From `setup-pstack` step 3c: the role table, with Claude models only (in Claude Code, Grok can't run), panels at their default length, and any role that needs a choice marked.
- The verification skill's plan: the surface, how it'll launch and drive the app, and where evidence goes.

Ask once whether to go ahead or change something. Apply changes and show only what changed.

## 5. Set up

Work through the rest without asking again, unless something fails:

1. Delete any collision folders the user agreed to.
2. `setup-matt-pocock-skills` steps 4 and 5: write the block and the docs files, and create labels if section B ran.
3. `setup-pstack` steps 4 to 6: validate and write the settings file. Skip its step 7, the verification-skill offer.
4. `create-verification-skill` steps 2 to 5. Say first that this is the longest step, since it builds, launches and drives the app once to prove the skill works.

## 6. Done

Run `devflow doctor` and show a short checklist: each piece with a ✓ and the file it wrote, anything still open with why, and how to change each later (edit `docs/agents/*.md`, rerun `/setup-pstack`, `/maintain-verification-skill`). End with the next step: `/devflow:start <what you want done>`.
