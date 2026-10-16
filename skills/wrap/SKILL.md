---
name: wrap
description: Close a devflow session. Reviews what went wrong and turns it into changes to checks, standards, or skills, blocks mistakes the agent keeps repeating, and writes a handoff if work is unfinished.
argument-hint: "[what the next session is for]"
disable-model-invocation: true
---

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root. Run each skill the way `/devflow:start` does: `devflow show <skill>`, then follow the SKILL.md it prints in full.

Run this in the session it looks back on, before `/clear`.

1. **Review.** `devflow settings` names the session review. **retro**: Matt's `retro`, which suggests changes to checks, coding standards, and steering files. **reflect**: pstack's `reflect`, which runs three reviewers and routes each lesson to an edit of an existing skill. Present the suggestions; apply only the ones the user picks.
2. **Repeated mistakes.** If the user corrected the same kind of mistake more than once in this session, or says the agent keeps making it across sessions, run `correct`. It turns each one into an architecture, type, lint, or test rule that fails on the real mistake. Otherwise skip this step and say so.
3. **Handoff.** If work is unfinished, run `handoff` with $ARGUMENTS (or what's left) as the next session's focus. Start the file with the devflow flow, the step to continue from, and any settings the user changed, as `/devflow:start`'s Big step 4 does. Give the user the file path and the line to start with: `/devflow:start resume <path>`.
