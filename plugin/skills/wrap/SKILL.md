---
name: wrap
description: Close a devflow session. Reviews what went wrong into changes to checks, standards or skills, blocks repeated mistakes, and writes a handoff if work is unfinished.
argument-hint: "[what the next session is for]"
disable-model-invocation: true
---

What the next session is for (a hint the host fills in): $ARGUMENTS

If that line is empty or shows no text, take it from the user's message, or leave it to what's left.

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root. Run each skill with `devflow show <skill>` and follow what it prints, not with the agent's own skill-loading tool (Claude Code's Skill tool).

Run this in the session it looks back on, before starting a fresh session.

1. **Review.** Run the session review `devflow settings` names: `retro`, `reflect` or `handoff`. Present its suggestions; apply only the ones the user picks. With `handoff` (the default on OpenCode and Gemini, whose session transcripts devflow can't read), the session review is a handoff only, with no transcript review: say so and go on to the next steps.
2. **Repeated mistakes.** If the user corrected the same kind of mistake more than once in this session, or says the agent keeps making it across sessions, run `correct`. Otherwise skip this step and say so.
3. **Handoff.** If work is unfinished, run `handoff` with what the next session is for (or what's left) as its focus. Save it as `handoff.md` in this session's flow folder (`.devflow/flows/<id>/`, replacing the one there; with no saved flow, run `devflow flow new` first), not the temp folder `handoff` names. Start the file with the flow, the step to continue from, and any settings the user changed; after a Big session, also what step 4 of `${CLAUDE_PLUGIN_ROOT}/skills/start/flows/big.md` lists. Save the step with `devflow flow set <id> step=...`. Tell the user to start a fresh session (`/clear` in Claude Code) and run devflow's continue skill (`/devflow:continue` in Claude Code), or give it `<id>` to skip the list.
