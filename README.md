# devflow

**A development workflow for coding agents, in two parts. A short working mode is always on, so a plain request is done carefully with no ceremony. A command runs the work as a flow that plans it, stops once for your go, then builds, checks, proves and ships it. It's a Claude Code plugin, and it also installs on Codex CLI, Cursor and OpenCode.**

```
/devflow:start add CSV export to the reports page
```

Every step of a flow is a short skill that ships with devflow. Not on Claude Code? See [Other coding agents](#other-coding-agents).

## Quick start

You need Claude Code, Node 18 or later, and git.

1. **Install** the plugin, then restart Claude Code so its hooks load:

   ```
   /plugin marketplace add itsrob00/devflow
   /plugin install devflow@devflow
   ```

2. **Work.** There is nothing to set up per repo. Ask for something plainly and it runs under devflow mode. Or start a flow:

   ```
   /devflow:start <what you want done>
   ```

3. **Pick a flow up later**, in any session:

   ```
   /devflow:continue
   ```

## Use

| You type | What happens |
|---|---|
| a plain request | It is worked under **devflow mode**. No flow, no saved state, no stop. |
| `/devflow:start <task>` | A flow for the task. With no task it picks up unfinished work. |
| `/devflow:continue` | Picks up unfinished work. |
| `/devflow:learn` | Looks back over a session that went sideways and turns what went wrong into a check, a type or a test. |

### devflow mode

The mode is about 400 words loaded into every session: seven rules and six steps. It is devflow's own take on pstack's `poteto-mode`, cut down to what changes how the agent works.

- **The rules:** decide and proceed, smallest change that solves it, prove it on the real thing, fix causes not symptoms, small units each checked before the next, keep the main context small, fix repeated mistakes with structure.
- **The steps for a plain request:** say the goal in one line, read before writing, ask at most once, build test-first, prove it, report with evidence. It commits or pushes only when you ask.
- **When the work is bigger** than the mode suits, it says once that `/devflow:start` would run it as a flow, and carries on unless you switch.

The whole text is in [plugin/mode.md](plugin/mode.md). Turn it off with the devflow mode setting.

### Flows

```
/devflow:start rename the Settings tab to Preferences         → Small
/devflow:start add CSV export to the reports page             → Feature
/devflow:start the cart total ignores quantity                → Bug
/devflow:start migrate the API client from axios to fetch     → Big
```

- **It asks once.** devflow looks facts up itself and takes the decisions it can recommend with confidence. The ones that are yours come in one round of at most five questions, each with a recommended answer. Say "grill me" for a full interview.
- **It stops once.** A feature or a big job shows you one screen: what done means, what changes, the decisions, and for a big job the tickets. It waits for your go. A reply that changes the plan counts as the go.
- **Then it runs to the end.** Nothing else waits on you except a decision that is yours or an action that can't be undone. The pull request lists every decision taken for you, so you can overrule any of them in review.

Once a flow is running, just talk. You don't retype the command with each message.

### The four flows

**Small**: clear what to do, one or two files, nothing for you to decide. No plan and no stop: the change, the nearest tests, the diff.

**Feature**: new or changed behaviour that fits one session.
1. `understand` the code, `decide` what is open (`prototype` or `research` when a decision needs one), `shape` the types and boundaries
2. `plan`, then the one stop
3. `build` test-first in the session, on a branch
4. `review` against the plan and the repo's standards, `check` what it could break elsewhere, `challenge` on risky changes
5. `prove` it in the running app, then `ship` the pull request

**Bug**: something broken or slow.
1. `diagnose`: a loop that goes red, a minimal reproduction, a cause proven by a run
2. A stop only when the fix is more than a small change
3. The regression test and the fix, then `check`, `prove` and `ship`

**Big**: more than one session can hold.
1. The same steps as a feature up to the plan, which cuts the work into tickets with blocking edges, each marked simple or complex
2. The one stop, with the ticket list
3. Each unblocked ticket is built by a fresh subagent in its own worktree, several at once. The main session reads every diff and reruns its tests before merging it.
4. One branch, one commit per ticket, one pull request at the end

Every step is also a skill you can run by itself, such as `/devflow:understand` or `/devflow:review`. `/devflow:wizard` writes a script for steps only you can do.

### Picking up later

devflow saves every flow in the project under `.devflow/flows/` (git-ignored): its step, branch, plan and decision list, and a big job's tickets when they are kept as files.

- `/devflow:continue` in any session. With several unfinished flows it asks which, and `/devflow:continue <id>` skips the question.
- While a conversation is on a flow, devflow reminds the agent of it with every message, so a plain reply like "go with B" stays part of the flow.
- A flow that ships as a pull request is marked done when it merges (devflow checks with `gh`).
- When a session starts in a project with unfinished flows, devflow says so in one line.
- A big job resumes from its tickets. `devflow flow show <id>` names the ones that are ready.

### Where things are written

- **Plan and decisions**: `plan.md` and `decisions.md` in the flow's folder.
- **A big job's plan and tickets**: GitHub or GitLab issues when the git remote points there, with the plan as the parent issue. Otherwise files in the flow's folder.
- **Terms and lasting decisions**: `GLOSSARY.md` and `docs/adr/` in the repo, written when a term or a decision is settled.
- **The verification skill**: a `verify-*` skill in the project, built the first time a change has to be proven in the running app. The plan says when it will build one.

## Settings

Set these in `/plugin`, under devflow, Configure options. Saying otherwise in your request ("skip the adversarial review") wins for that run.

| Setting | Default | What it does |
|---|---|---|
| Git safety hook | on | While a flow is running in the conversation, blocks `git push`, `reset --hard`, `clean -f`, `branch -D`, and commands that discard the whole working tree (`checkout .`, `restore .`, `checkout -f`, `switch --discard-changes`). The agent gives you the command to run instead. Conversations not on a flow aren't affected. |
| No code comments | on | The agent adds no comments or docstrings to code it writes or edits, unless you ask. It leaves existing comments alone unless a change makes them wrong. |
| devflow mode | on | Loads the mode into every session, so plain requests are worked by its rules and steps. Off: only flows carry devflow's rules. |
| Adversarial review | risky changes | When two fresh subagents try to break the change, keeping only findings a run proves: on risky changes (auth, permissions, payments, data migration or deletion, concurrency, public APIs), always, or never. |
| Subagents at once | 3 | How many tickets of a big job are built at the same time. 1 to 10. |
| Subagent model | auto | The model that builds a big job's tickets. `auto` uses the agent's fast model for tickets marked simple and its strong model for ones marked complex (Sonnet and Opus on Claude Code). Any model name is used for every ticket. |
| Issue tracker | auto | Where a big job's plan and tickets go. `auto` reads the git remote. Or `github`, `gitlab`, `files`. |

Outside `/plugin`, put the same settings in a JSON file:

- `~/.config/devflow/settings.json` for every project
- `.devflow/settings.json` at the project's git root for one project

The keys are `git_guard`, `no_comments` and `mode` (`true` or `false`), `adversarial_review` (`risky changes`, `always` or `never`), `subagent_count` (a number), `subagent_model` (`auto` or a model name) and `tracker` (`auto`, `github`, `gitlab` or `files`). For example: `{"subagent_count": 5}`.

The project file overrides the user file, except that it can't turn the git guard off, so a cloned repo can't disarm it. In Claude Code, the `/plugin` options override both. devflow skips a missing or unreadable file and any value it doesn't know. `devflow settings` shows the result, with the fast and strong model `auto` uses on your agent.

### Coming from 1.2

- devflow no longer installs Matt Pocock's skills or pstack. In Claude Code, remove the two old plugins: `/plugin uninstall devflow-matt@devflow` and `/plugin uninstall devflow-pstack@devflow`. On other agents, `update` removes the skills the old install added.
- `/devflow:setup` and `/devflow:wrap` are gone. Nothing needs setting up, and `/devflow:learn` is the session review. `/devflow:start` and `/devflow:continue` stay.
- Small changes no longer run pstack's `poteto-mode`. devflow mode is always on instead, with or without a flow.
- The `small_changes`, `grilling` and `after_session` settings are gone and are ignored if still set.
- Flows saved by 1.2 still list, with their old step names.

## Other coding agents

devflow also runs on Codex CLI, Cursor and OpenCode. This doesn't change the Claude Code install above.

You need Node 18 or later and git. The installer runs through `npx`, which comes with Node.

**Install**, once per agent:

```
npx github:itsrob00/devflow install --agent <codex|cursor|opencode>
```

This puts devflow in your home folder. Add `--project` to put it in the current repo instead, under the git root, so a team can share one setup. The install:
- copies devflow's skills into the agent's skills folder, each named `devflow-<skill>` the way that agent expects
- writes the agent's hooks for the git guard and the flow reminders, plus the written fallbacks described below
- records every file it wrote in `~/.config/devflow/installs.json` (`.devflow/installs.json` with `--project`)

When it finishes, the install prints any step the agent still needs from you, such as trusting Codex's hooks.

**Update** re-runs every recorded install from the latest release. Name an agent to update only that one, and add `--project` to update only the installs in this repo:

```
npx github:itsrob00/devflow update [--agent <name>] [--project]
```

**Uninstall** removes exactly what the record lists:

```
npx github:itsrob00/devflow uninstall --agent <name> [--project]
```

Run the skills the way your agent runs skills, with the task after them or in your next message. devflow mode is loaded at session start here too.

| Agent | Start | Pick up later |
|---|---|---|
| Codex CLI | `$devflow-start <task>` | `$devflow-continue` |
| Cursor | `/devflow-start <task>` | `/devflow-continue` |
| OpenCode | `@devflow-start <task>` | `@devflow-continue` |

The step skills follow the same pattern, such as `$devflow-review`.

### Before the first run

- **Codex CLI** runs devflow's hooks only after you trust them. Run `/hooks` in Codex and trust each devflow hook. For a `--project` install, trust the project first. Codex skips a changed hook until you trust it again, so repeat this after each devflow update.
- **OpenCode** needs version 2 for devflow's plugin. If `opencode --version` shows 1.x, run `opencode upgrade --major`.
- **Cursor** needs nothing extra.

### Where the files go

Paths are for a user install, from your home folder. With `--project` they move into the repo, as noted. devflow's scripts go to `~/.config/devflow/runtime/<agent>/` (`.devflow/runtime/<agent>/` with `--project`).

| Agent | Skills | Always-on instructions | Hooks | Git guard backstop |
|---|---|---|---|---|
| Codex CLI | `.codex/skills` (project: `.agents/skills`) | `.codex/AGENTS.md` (project: `AGENTS.md`) | `.codex/hooks.json` | `.codex/rules/devflow.rules` |
| Cursor | `.cursor/skills` | rule `.cursor/rules/devflow.mdc`, always applied | `.cursor/hooks.json` | none |
| OpenCode | `.config/opencode/skills` (project: `.opencode/skills`) | `.config/opencode/AGENTS.md` (project: `AGENTS.md`) | plugin in `.config/opencode/devflow-plugin` (project: `.opencode/devflow-plugin`), added to the `plugins` list in `opencode.jsonc` | none |

- Codex's project skills go to `.agents/skills` because Codex reads no other project skills folder. Other agents read that folder too.
- With `--project`, the hook commands find `.devflow/runtime/<agent>` by walking up from the folder the agent runs in, so they work from any subfolder of the repo.
- When devflow edits a file you already have (a hooks file, `opencode.jsonc`, `AGENTS.md`), it adds its own entries, or a block between `devflow:begin` and `devflow:end` markers. Uninstall takes out only those.
- `opencode.jsonc` must be plain JSON with no comments. Otherwise install stops and tells you what to add by hand.

The settings work on every agent. There's no `/plugin` screen outside Claude Code, so use the settings files described under [Settings](#settings).

### What falls back to written instructions

Every install writes the git guard rules into the agent's always-on instructions, along with "check `devflow active` before replying", so devflow still behaves when hooks don't run. Beyond that:

- **Codex CLI.** Hooks run only in trusted projects. Until you trust a project, the written rules in `AGENTS.md` are all that guard it. If you keep an `AGENTS.override.md`, Codex reads it instead of `AGENTS.md` and never sees devflow's block, so copy the block across.
- **Cursor.** Cursor's prompt hook can't add context, so the per-message reminder comes from the always-applied rule. The guard hook fails closed: if it errors, Cursor blocks the command. Cursor doesn't promise to load a rule from your home folder, so if devflow's rule doesn't show up in Cursor's rules, install with `--project` in each repo.
- **OpenCode.** OpenCode has no session-start hook, so the plugin's per-prompt context hook carries the session-start reminder.

The Codex `.rules` file is a second guard that doesn't depend on hooks. It blocks the guarded git commands in every session, not only during a flow, because it can't tell whether a flow is running. When you need one of them, run it yourself in a terminal; to lift the block, uninstall devflow for Codex. It only catches simple commands: Codex checks a `bash -c` script against the rules only when the script is a plain chain of commands, so a script with variables or `$(...)` gets past it. The hook guard still checks those.

Subagents run on your agent's own models. `devflow settings` shows the fast and strong model that `auto` picks there.

## Contributing

The plugin lives in `plugin/`, which is all that installing it copies. The tests stay at the repo root. `node --test` runs them for the git guard, the helper CLI, its hooks and the installer, and CI runs them on Ubuntu and Windows for every PR and push to main. Add a guard case for any command it should block or let through. To try a change to the installer or the plugin files, run `node plugin/scripts/devflow-install.mjs update --local`, which re-runs every recorded install from this checkout. [CONTRIBUTING.md](CONTRIBUTING.md) says how the skills are laid out and how to write one.

## Credits

devflow's skills are adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills) and Lauren Tan's pstack, originally in [cursor/plugins](https://github.com/cursor/plugins) and mirrored at [backnotprop/pstack](https://github.com/backnotprop/pstack). Both are MIT. [plugin/CREDITS.md](plugin/CREDITS.md) says which skill came from which original and carries both licences.

## License

MIT
