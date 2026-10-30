---
name: continue
description: Continue unfinished devflow work. Lists this project's unfinished flows (flows whose PR merged drop off), asks which one, and continues it where it stopped, with nothing from the others.
argument-hint: "[flow id or number]"
disable-model-invocation: true
---

Which one (a hint the host fills in): $ARGUMENTS

If that line is empty or shows no text, take the request from the user's message. If the user gave none, list the flows and ask which.

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root.

1. **One flow per conversation.** If this conversation already works on a flow (devflow reminds you of it with each message), stop: tell the user to start a fresh session (`/clear` in Claude Code), then run devflow's continue skill with `<id>` for the one they want (`/devflow:continue <id>` in Claude Code). If they named the flow already active here, just keep working on it.
2. **List.** Run `devflow flows`. Each saved flow is a numbered line (id, flow, step, date, title), then what's next. Below come older handoffs and tickets not saved as flows, each with what to continue it with. A `done:` line is a flow whose PR merged since the last check; it's closed now, so mention it in one line and don't offer it.
3. **Pick.** Don't read any flow's files or explore the code before the user picks.
   - Nothing listed: say there's no unfinished devflow work here and devflow's start skill with a task starts some (`/devflow:start <task>` in Claude Code). Stop.
   - The request names one (an id, a number, words matching one title, or an older entry's `resume <path>` or `ticket <ref>`): take it. If it names a flow that's done, say so and stop.
   - Only one entry: say which and continue with it.
   - Otherwise ask the user, as one multiple-choice question where the agent supports it (Claude Code's `AskUserQuestion`), newest first, each option labelled with the title, with the flow, step and date as its description. A multiple-choice question holds four options at most; with more, put the whole numbered list in the question and let the user answer with a number or id. Numbers refer to the list you just printed.
   - An `unreadable:` line is a flow with a broken state file: mention it, and don't offer it.
4. **Continue.** Read `${CLAUDE_PLUGIN_ROOT}/skills/start/SKILL.md` and follow it with the task `resume <id>`. For an older entry, first save it as a flow, then do the same:
   - A handoff (`resume <path>`): read it; it names the flow and step. Run `devflow flow new`, `devflow flow set <id> step=...` and `devflow flow handoff <id> <path>`.
   - A ticket (`ticket <ref>`): `devflow flow new feature <the ticket's feature>`, then `devflow flow set <id> tickets=<ref> step="4. Shape"`.
