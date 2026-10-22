---
name: wrap
description: Close a devflow session. Reviews what went wrong into changes to checks, standards or skills, blocks repeated mistakes, and writes a handoff if work is unfinished.
argument-hint: "[what the next session is for]"
disable-model-invocation: true
---

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root. Run each skill with `devflow show <skill>` and follow what it prints, not with the Skill tool.

Run this in the session it looks back on, before `/clear`.

1. **Review.** Run the session review `devflow settings` names: `retro` or `reflect`. Present its suggestions; apply only the ones the user picks.
2. **Repeated mistakes.** If the user corrected the same kind of mistake more than once in this session, or says the agent keeps making it across sessions, run `correct`. Otherwise skip this step and say so.
3. **Handoff.** If work is unfinished, run `handoff` with $ARGUMENTS (or what's left) as the next session's focus. Save it as `handoff.md` in this session's flow folder (`.devflow/flows/<id>/`, replacing the one there; with no saved flow, run `devflow flow new` first), not the temp folder `handoff` names. Start the file with the flow, the step to continue from, and any settings the user changed; after a Big session, also what step 4 of `${CLAUDE_PLUGIN_ROOT}/skills/start/flows/big.md` lists. Save the step with `devflow flow set <id> step=...`. Tell the user to `/clear` and run `/devflow:continue` (or `/devflow:continue <id>` to skip the list).
