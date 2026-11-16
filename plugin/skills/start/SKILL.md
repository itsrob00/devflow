---
name: start
description: Run development work as a devflow flow. Picks the flow (small change, feature, bug or big job), runs each step's skill, stops once to show the plan, then builds, proves and ships. With nothing, or "keep going", picks up unfinished work. For any request to build, change or fix code.
argument-hint: "[what you want done, or nothing to keep going]"
---

Task (a hint the host fills in): $ARGUMENTS

If that line is empty or shows no text, the task is in the user's message: take it from there.

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root.

Read `${CLAUDE_PLUGIN_ROOT}/principles.md` once per conversation. Its seven rules apply to every step.

## 1. Keep going, or start

- **Nothing, "keep going", or a saved flow's id or title:** run `devflow flows`. With one unfinished flow, or one the user named, take it. With several and none named, ask which in one question. With none, say there is nothing unfinished and stop. Then run `devflow flow show <id>` and continue that flow's file at the saved step. Don't redo a finished step and don't explore the code again to get oriented: the plan, the decision list and the tickets it lists are the context.
- **Anything else** is new work. Go on to step 2.

## 2. Pick the flow

Read the task, and the code it touches if you need to.

| Flow | When |
|---|---|
| **Small** | Clear what to do, one or two files, nothing for the user to decide. |
| **Feature** | New or changed behaviour that fits one session. |
| **Bug** | Something is broken, throws, fails or got slower. |
| **Big** | More than one session can hold: a migration, a new project, a change in many parts. |

Say the flow and why in one line and continue. Ask only when two fit equally well.

For every flow but Small, save it: `devflow flow new <flow> <short title>`. It prints the flow's id and folder. The plan, the decision list and any ticket files live in that folder.

Run `devflow settings` once. What the user says in this conversation overrides a setting for this run.

If the folder isn't a git repository, run `git init` and say so.

## 3. Run the flow

Read `${CLAUDE_PLUGIN_ROOT}/skills/start/flows/<flow>.md` and work through its steps in order.

- **A step names a skill.** The skill `x` is the file `${CLAUDE_PLUGIN_ROOT}/skills/x/SKILL.md`. Read it when you reach its step and follow it to its "Done when" line. Read each skill once per conversation.
- **A step that looks obvious still runs its skill.** A skipped step is reported as skipped, with the reason.
- **One stop.** A flow with a plan shows it and waits once for the user's go. Nothing else waits on the user except a decision that is theirs or an action that cannot be undone.
- **Save as you go.** After each step, `devflow flow set <id> step="<n>. <name>"` with the step to continue from. Add `next="..."` when a later session needs one more line, `branch=<name>` when the flow gets its branch, `tickets=<issue or folder>` when tickets are published, and `pr=<number or url>` when the pull request is open.
- **Keep a visible list** of the flow's steps (Claude Code's `TodoWrite`, or a checklist in the conversation) and mark each as it finishes.

One flow at a time. If the user asks for unrelated work in the middle of one, say the current flow is saved, then start the new one.

A flow that outgrows its kind changes kind: `devflow flow set <id> flow=<kind>`, said in one line.

## Git

With the git guard on, `git push`, `reset --hard`, `clean -f`, `branch -D` and commands that discard the whole working tree are blocked while a flow runs. Run a blocked command on its own, never chained after a commit. When a step needs one, give the user the exact command and continue with whatever doesn't depend on it. Never look for another way to do the same thing.

## Finish

- A flow with a pull request is finished when it merges. `devflow flows` notices and marks it done, so don't mark it yourself.
- A flow with no pull request: `devflow flow done <id>`.
- If the session ends with work left, the saved step is enough. Tell the user that "keep going" in any later session picks it up.

Report in a few lines: what changed, the evidence (the test run, the safety fact, the proof from the running app), the decisions you took for the user, any step you skipped and why, and what is left for them.

If the user corrected the same kind of mistake twice in this session, add one line suggesting devflow's learn skill (`/devflow:learn` in Claude Code). Don't run it unasked.
