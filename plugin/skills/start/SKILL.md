---
name: start
description: Start dev work with devflow. Picks a flow (feature, bug, big job, small change), runs each step's skill from Matt Pocock's skills and pstack, and proves the result.
argument-hint: "<what you want done>"
disable-model-invocation: true
---

Task: $ARGUMENTS

With no task, follow `${CLAUDE_PLUGIN_ROOT}/skills/continue/SKILL.md` instead; it brings you back here with `resume <id>` as the task.

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root.

## Running a step's skill

Each step names a skill. Run it with `devflow show <skill>` and follow what it prints, not with the Skill tool and not your own way. A step that looks obvious still runs its skill: an easy bug still gets `diagnosing-bugs`' red loop and `blast-radius`'s proven safety fact. Where a skill asks the user something, ask; don't answer for them. If the user said they're away, take the recommended option and say which.

## Saved flows

Each flow is saved under `.devflow/flows/<id>/`; the next session starts from it. Keep it current:

- `devflow flow set <id> step="<n>. <name>"` each time a step finishes, naming the step to continue from. Add `next="..."` when the next session needs one more line (which ticket, which decision is open), and `tickets=<folder or tracker ref>` when `to-tickets` or `wayfinder` publishes tickets.
- `devflow flow done <id>` when the flow finishes.

One conversation works on one flow: use only its id, and don't read other flows' folders or take steps from them, even related ones.

## Resuming

`resume <id>`: skip step 1 (don't pick a flow, rerun `doctor` or `settings`, or explore the code to get oriented). Run `devflow flow show <id>` and go to **2. Run the flow** with the flow it names, starting the todo list at its step. Its handoff, if any, gives the map, playbook, decision log and spec paths, the open ticket, and settings the user changed. A Feature with a next ticket works it from Feature step 4. A Big flow continues `big.md` at the saved step.

Older work not saved as a flow:

- `resume <path>`: read that handoff; it names the flow and step. Save it with `devflow flow new`, `devflow flow set <id> step=...` and `devflow flow handoff <id> <path>`, then continue as above.
- `ticket <ref>`: save a Feature flow named after the ticket's feature, run `devflow flow set <id> tickets=<ref>`, and work the ticket from Feature step 4.

Don't rerun a step an earlier session finished. Run `devflow show` for a skill when you reach its step, not before; if it reports the skill missing, run `devflow doctor <flow>` then.

## 1. Pick the flow

Read the task, and the code it touches if needed. Pick one:

| Flow | When |
|---|---|
| **Feature** | New or changed behavior that needs a design decision or touches more than a couple of files. |
| **Bug** | Something is broken, throws, fails, or got slower. |
| **Big** | More than one session can hold: a migration, a greenfield project, a foggy multi-part effort. |
| **Small** | Clear what to do, one or two files, nothing for the user to decide. New behavior is a Feature, however small. |

Say the flow and why in one line, then continue; ask only when two fit equally well. Save it with `devflow flow new <flow> <short title>` and give the user the id. If a Small change grows past two files or makes you choose behavior the task didn't specify, switch to Feature with `devflow flow set <id> flow=feature` and say so.

Run `devflow doctor <flow>`. If it lists missing skills, show them with its install line and stop. Mention any other NOT READY line once and continue. If it ran `git init`, pass that line on.

Run `devflow settings`. The user's words in this conversation override them for this run.

## 2. Run the flow

Read `${CLAUDE_PLUGIN_ROOT}/skills/start/flows/<flow>.md` for `feature`, `bug` or `big`. For Small, by setting:

- **poteto-mode**: `poteto-mode` with the task. It picks its own playbook.
- **direct**: make the change, run the closest tests and the type check, and show the diff.

Keep a todo list whose first items are the flow's steps, each with its skill. Mark a step done only after you ran `devflow show` for its skill and met that skill's completion criteria. A skipped step stays listed with `skip: <reason>`.

## Git

With the git guard on, `git push`, `reset --hard`, `clean -f`, `branch -D`, and commands that discard the whole working tree are blocked. Run a blocked command on its own, never chained after a commit. When a step needs one, give the user the exact command and continue with what doesn't depend on it. Never look for another way to do the same thing.

## Finish

Save where the flow stands: `devflow flow done <id>` if it's finished. If work is left, `devflow flow set <id> step=...` and write a short handoff to `.devflow/flows/<id>/handoff.md` (replacing the one there) with only what `devflow flow show` doesn't give:

```
# <title>
Flow: <Feature|Bug|Big|Small> · continue from: <step>, <ticket if any>
Done this session: <one line>
Open: <decisions or questions still waiting on the user>
Paths: <spec, map or playbook, decision log, branch>
Settings changed: <any the user overrode, or none>
```

Then report: the flow, the skills that ran (only those loaded with `devflow show`; list other steps as skipped, with why), what changed, the evidence (test runs, the `verify-*` run, `blast-radius`'s safety fact), and what's left for the user. If work is left, say the next session picks it up with `/clear` and `/devflow:continue`. If the session hit a snag worth learning from, suggest `/devflow:wrap`; its handoff replaces the short one.
