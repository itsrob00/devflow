---
name: continue
description: Continue unfinished devflow work. Lists this project's unfinished flows (flows whose PR merged drop off), asks which one, and continues it where it stopped, with nothing from the others.
argument-hint: "[flow id or number]"
disable-model-invocation: true
---

Which one: $ARGUMENTS

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root.

1. **One flow per conversation.** If this conversation already works on a flow (devflow reminds you of it with each message), stop: tell the user to `/clear`, then run `/devflow:continue <id>` for the one they want. If they named the flow already active here, just keep working on it.
2. **List.** Run `devflow flows`. Each saved flow is a numbered line (id, flow, step, date, title), then what's next. Below come older handoffs and tickets not saved as flows, each with the command that continues it. A `done:` line is a flow whose PR merged since the last check; it's closed now, so mention it in one line and don't offer it.
3. **Pick.** Don't read any flow's files or explore the code before the user picks.
   - Nothing listed: say there's no unfinished devflow work here and `/devflow:start <task>` starts some. Stop.
   - The request names one (an id, a number, words matching one title, or an older entry's `resume <path>` or `ticket <ref>`): take it. If it names a flow that's done, say so and stop.
   - Only one entry: say which and continue with it.
   - Otherwise ask with `AskUserQuestion`, newest first, each option labelled with the title, with the flow, step and date as its description. It holds four options; with more, put the whole numbered list in the question and let the user answer with a number or id. Numbers refer to the list you just printed.
   - An `unreadable:` line is a flow with a broken state file: mention it, and don't offer it.
4. **Continue.** Read `${CLAUDE_PLUGIN_ROOT}/skills/start/SKILL.md` and follow it with the task `resume <id>`. For an older entry, first save it as a flow, then do the same:
   - A handoff (`resume <path>`): read it; it names the flow and step. Run `devflow flow new`, `devflow flow set <id> step=...` and `devflow flow handoff <id> <path>`.
   - A ticket (`ticket <ref>`): `devflow flow new feature <the ticket's feature>`, then `devflow flow set <id> tickets=<ref> step="4. Shape"`.
