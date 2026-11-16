---
name: continue
description: Pick up unfinished devflow work. Lists this project's unfinished flows, asks which when there are several, and continues it from its saved step.
argument-hint: "[flow id or title]"
disable-model-invocation: true
---

Which one (a hint the host fills in): $ARGUMENTS

If that line is empty or shows no text, take it from the user's message. With none named, the task is "keep going".

Read `${CLAUDE_PLUGIN_ROOT}/skills/start/SKILL.md` and follow it from its step 1, with the flow the user named, or "keep going", as the task.
