---
name: start
description: Start a piece of development work with devflow. Picks one of four flows (feature, bug, big job, small change), then runs each step's skill from Matt Pocock's skills and pstack, and proves the result before it ships.
argument-hint: "<what you want done>"
disable-model-invocation: true
---

Task: $ARGUMENTS

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root.

## Running a step's skill

Each step names a skill. Running a step means running that skill, not doing the step your own way.

Run `devflow show <skill>`. It prints the SKILL.md devflow uses. Read all of it and follow it as if the user had typed the command, including its phases and its completion checklist. Relative links resolve against the folder it names. When it calls another skill, run that one the same way. Don't use the Skill tool for these: most of them are user-invoked only, and the user invoked them by running `/devflow:start`.

A step that looks obvious still runs its skill: an easy bug still gets `diagnosing-bugs`' red loop and `blast-radius`'s proven safety fact. Follow each skill's own checkpoints. Where it asks the user something, ask; don't answer for them. If the user said they're away, take the skill's recommended option and say which one you took.

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

Keep a todo list whose first items are the chosen flow's steps, each with its skill name. Mark a step done only after you ran `devflow show` for its skill and met that skill's completion criteria. A step you skip stays on it with `skip: <reason>`.

## Feature

1. **Understand.** `how`: where the feature should live and how the code around it works.
2. **Decide.** `grill-with-docs`: interview the user until the plan holds up, recording ADRs and glossary terms. When a question needs a runnable answer (a state model, a UI to look at), use `prototype`, then come back to the grilling with what it showed.
3. **Write it down.** Only when the build needs more than this session: `to-spec`, then `to-tickets`. Then stop. Tell the user to `/clear` and run `/devflow:start ticket <ref>` for each ticket, blockers first, so each build starts with a clean context. Keep steps 1 to 3 in this one context.
   - A task that names a ticket (`ticket <ref>`) starts here at step 4. Read the ticket and the spec it links.
4. **Shape.** `architect` when the change adds types or crosses a module boundary. Skip it for code that stays inside one function.
5. **Build.** `implement`. It drives `tdd` at seams agreed with the user, runs `code-review` on the result, and commits. Don't run `code-review` again afterwards.
6. **Check.**
   - `blast-radius` on the diff since the branch point, with its safety fact proven by running code or marked unproven.
   - `interrogate` per the multi-model review setting. With **risky changes**, run it when the diff touches auth, permissions, payments, data migrations or deletion, concurrency, or a public API. Fix what it puts under "Act on".
7. **Prove.** If the project has a `verify-*` skill (`devflow doctor feature` lists it), use it to drive the feature as a user would and save the evidence. If there is none, say the change is unproven in the running app and suggest `/devflow:setup`.
8. **Ship.** `pr` to write the PR body, using the evidence from step 7. Pushing is the user's (see Git below). Give them the push command, then `gh pr create --body-file <file>`.

## Bug

1. **History.** When it's a regression and how the code got this way matters (a recent change, a reverted fix, a deliberate threshold): `why`.
2. **Diagnose and fix.** `diagnosing-bugs`. It builds a loop that goes red on this bug, tests hypotheses, writes the regression test before the fix at a real seam, fixes it, and cleans up. Don't add a separate `tdd` pass; that test is part of its phase 5.
3. **Check.** `blast-radius` on the fix, with its safety fact proven by running code or marked unproven.
4. **Prove.** For a bug a user can see, reproduce the original scenario with the project's `verify-*` skill and show it now passes.
5. **Commit** with a message that names the root cause. If `diagnosing-bugs` found no good seam for a regression test, say so in the report: the code's structure is keeping the bug from being locked down.

## Big

1. **Plan.**
   - The way there isn't clear yet (open decisions, unknown scope): `wayfinder`. It maps the work as decision tickets and resolves them one at a time. When the map clears, continue with Feature step 3 (`to-spec`, then `to-tickets`).
   - The way is clear but long (a migration, a sweep across many call sites, a multi-part change): `figure-it-out`. It designs the playbook and runs it.
2. **Log decisions.** `show-me-your-work` from the start, so a reviewer can trust the result later. Its trail review asks for a different model family, which Claude Code doesn't have: every model it runs is Claude. Spawn that reviewer on the `judgment and prose` model from the pstack models file (omit `model` for `inherit-parent` or `auto`), never on a model the user didn't configure. In the Attention section write `reviewed by <model> (fresh context; Claude Code has no other model family)`, and report a fallback only if a spawn actually failed, with its error.
3. **End of each session.** `handoff` with what the next session is for. Tell the user the file path and to start the next session with `/devflow:start resume <path>`. A task that starts with `resume` reads that file first and continues where it says.

## Small

- Setting **poteto-mode**: `poteto-mode` with the task. It picks its own playbook.
- Setting **direct**: make the change, run the tests closest to it and the type check, and show the diff.

## Git

With the git guard on, `git push`, `reset --hard`, `clean -f`, `branch -D`, and commands that discard the whole working tree are blocked. Run a blocked command on its own, never chained after a commit, so the rest still runs. When a step needs one, give the user the exact command and continue with what doesn't depend on it. Never look for another way to do the same thing.

## Finish

End with a short report: the flow, the skills that ran (only those you loaded with `devflow show`; any other step is skipped, with why), what changed, the evidence it works (test runs, the `verify-*` run, `blast-radius`'s safety fact), and what's left for the user. Then suggest `/devflow:wrap` if the session hit a snag worth learning from.
