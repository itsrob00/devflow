---
name: start
description: Start a piece of development work with devflow. Picks one of four flows (feature, bug, big job, small change), then runs each step's skill from Matt Pocock's skills and pstack, and proves the result before it ships.
argument-hint: "<what you want done>"
disable-model-invocation: true
---

Task: $ARGUMENTS

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root.

## Running a step's skill

Each step names a skill. Running a step means running that skill, not doing the step your own way: `devflow show <skill>`, then follow what it prints. Don't use the Skill tool for these: most of them are user-invoked only, and the user invoked them by running `/devflow:start`.

A step that looks obvious still runs its skill: an easy bug still gets `diagnosing-bugs`' red loop and `blast-radius`'s proven safety fact. Where a skill asks the user something, ask; don't answer for them. If the user said they're away, take the skill's recommended option and say which one you took.

## Picking up earlier work

A task that starts with `resume <path>` or `ticket <ref>` continues work an earlier session set up, so skip step 1. Don't pick a flow again, don't rerun `devflow doctor` or `devflow settings`, and don't explore the code to get oriented; the handoff or ticket says where things stand.

- `resume <path>`: read that file. It names the flow, the step and ticket to continue from, and any settings the user changed. Go to **2. Run the flow** with that flow, and start the todo list at that step.
- `ticket <ref>`: go to **2. Run the flow** with Feature, from step 4.

Don't rerun a step an earlier session finished. Run `devflow show` for a skill when you reach its step, not before. If it reports the skill missing, run `devflow doctor <flow>` then.

## 1. Pick the flow

Read the task, then the code it touches if you need to. Pick one:

| Flow | When |
|---|---|
| **Feature** | New or changed behavior that needs a design decision or touches more than a couple of files. |
| **Bug** | Something is broken, throws, fails, or got slower. |
| **Big** | More than one session can hold: a migration, a greenfield project, a foggy multi-part effort. |
| **Small** | Clear what to do, one or two files, nothing for the user to decide. New behavior is a Feature, however small. |

Say the flow and the reason in one line, then continue. Only ask when two flows fit equally well. If a Small change grows past two files or makes you choose behavior the task didn't specify, switch to Feature and say so.

Run `devflow doctor <flow>` (use `feature`, `bug`, `big` or `small`). If a skill the flow needs is missing, list them with the install line it prints and stop. Any other NOT READY line: mention it once and continue. A folder that isn't a git repository is not a reason to stop: doctor runs `git init` there and says so, and you pass that line on.

Run `devflow settings`. The settings are `/plugin` options; the user's words in this conversation win over them for this run.

## 2. Run the flow

Read the flow's steps: `${CLAUDE_PLUGIN_ROOT}/skills/start/flows/<flow>.md` for `feature`, `bug` or `big`, or **Small** below. Keep a todo list whose first items are its steps, each with its skill name. Mark a step done only after you ran `devflow show` for its skill and met that skill's completion criteria. A step you skip stays on it with `skip: <reason>`.

## Small

- Setting **poteto-mode**: `poteto-mode` with the task. It picks its own playbook.
- Setting **direct**: make the change, run the tests closest to it and the type check, and show the diff.

## Git

With the git guard on, `git push`, `reset --hard`, `clean -f`, `branch -D`, and commands that discard the whole working tree are blocked. Run a blocked command on its own, never chained after a commit, so the rest still runs. When a step needs one, give the user the exact command and continue with what doesn't depend on it. Never look for another way to do the same thing.

## Finish

End with a short report: the flow, the skills that ran (only those you loaded with `devflow show`; any other step is skipped, with why), what changed, the evidence it works (test runs, the `verify-*` run, `blast-radius`'s safety fact), and what's left for the user. Then suggest `/devflow:wrap` if the session hit a snag worth learning from.
