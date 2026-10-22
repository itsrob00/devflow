# devflow

**A Claude Code plugin that turns Matt Pocock's skills and pstack into one guided workflow: describe a task, and devflow plans, builds, checks and proves it, step by step.**

```
/devflow:start <what you want done>
```

devflow sorts the task into a feature, a bug, a multi-session job or a small change, then runs that flow's skills in order and stops to ask you whenever a step needs your decision. It's my customised setup on top of [Matt Pocock's skills](https://github.com/mattpocock/skills) and [Lauren Tan's pstack](https://github.com/backnotprop/pstack).

## Quick start

Requires Claude Code, Node 18 or later, and git.

1. **Install** the plugin, then restart Claude Code so its hooks load:

   ```
   /plugin marketplace add itsrob00/devflow
   /plugin install devflow@devflow
   ```

2. **Set up the repo.** Run this once in each repo, before your first `/devflow:start` there:

   ```
   /devflow:setup
   ```

   It checks that devflow's skills are installed without clashes, then sets up what the repo is missing, in about a minute:
   - your issue tracker: GitHub or GitLab if the remote points there, otherwise local markdown, written to `docs/agents/`
   - pstack's models, once per machine. `/setup-pstack` defaults to Grok, which Claude Code can't run, so setup writes Opus at the large budget.
   - `git init`, if the folder isn't a repo yet

   It picks defaults instead of asking, and only asks when it can't decide (a monorepo, or a clashing `tdd` or `teach` copy). Edit `docs/agents/*.md` or rerun `/setup-pstack` to change its choices. The verification skill that drives your app to prove changes work isn't built here: the first feature or bug flow that needs it offers to build it. If you forget, `/devflow:start` runs setup for you when a flow needs something that's missing, but then it happens in the middle of your task.

3. **Start work:**

   ```
   /devflow:start <what you want done>
   ```

4. **Pick it up later**, in a fresh session:

   ```
   /devflow:continue
   ```

Installing devflow also installs two dependencies, straight from the upstream repos and kept in sync with them:

- **devflow-matt**: the 20 of Matt Pocock's skills that devflow runs.
- **devflow-pstack**: the 43 pstack skills devflow runs, including `unslop`, `/poteto-mode` and its principles.

Skills devflow doesn't use stay out, including pstack's `tdd` and `teach`, which would clash with Matt's. The ones it installs show in the slash menu under their plugin name, such as `/devflow-pstack:unslop` or `/devflow-matt:tdd`; devflow runs them for you, so you don't need to.

## Use

```
/devflow:start add CSV export to the reports page        → Feature
/devflow:start the cart total ignores quantity           → Bug
/devflow:start migrate the API client from axios to fetch → Big
/devflow:start rename the Settings tab to Preferences     → Small
```

These are the only commands you need, in the order you'd use them:

| Run | What it does |
|---|---|
| `/devflow:setup` | Once per repo, before your first `/devflow:start` there. Sets up whatever the repo is missing. |
| `/devflow:start <task>` | Starts a flow for the task, setting the repo up first if it needs it. |
| `/devflow:continue` | Picks up unfinished work. `/devflow:start` with no task does the same. |
| `/devflow:wrap` | Reviews the session and saves a handoff. |

Once a flow is running, just talk to Claude; you don't retype `/devflow` with each message.

### The four flows

**Feature**: new behaviour that needs a design decision.
1. `how`, then `grill-with-docs` (and `prototype` if useful)
2. `to-spec` and `to-tickets` if it needs more than one session (`implement-spec` can then build the tickets in parallel in one run)
3. `architect`, then `implement` (which drives `tdd` and `code-review`)
4. `blast-radius`, plus `interrogate` on risky changes
5. Prove it with your `verify-*` skill, then `pr`

**Bug**: something broken or slow.
1. `why` for regressions
2. `diagnosing-bugs`: regression test, fix, cleanup
3. `blast-radius`, then prove it

**Big**: more than one session.
- `wayfinder` when the path is unclear, `figure-it-out` when it's clear but long
- `show-me-your-work` throughout, `handoff` at the end of each session

**Small**: one or two files, clear change, no new behaviour.
- `poteto-mode`, or a direct edit (see Settings)

### Picking up later

```
/devflow:continue
```

Every flow is saved in the project under `.devflow/flows/` (git-ignored) with its step, tickets and last handoff. `/devflow:continue` lists the unfinished ones, asks which to pick up, and continues it from where it stopped; `/devflow:continue <id>` skips the question. `/devflow:start` with no task does the same. A session works on one flow and reads only its folder; run `/clear` before switching. Once a conversation starts or continues a flow, devflow reminds Claude of it with every message you send, until the flow finishes or you `/clear`. A flow that ships as a PR is marked done when the PR merges (devflow checks with `gh`), so merged work drops off the list on its own. When Claude Code starts in a project with unfinished flows, devflow says so in one line. Each run that leaves work saves a short handoff; `/devflow:wrap` writes a fuller one.

- A multi-session feature stops after the tickets. Run `/devflow:continue` in a fresh session for each one; it picks the next open ticket.
- A big job merges grilling-only tickets into one session, shows the remaining tickets after each one it finishes, and ends each session with a handoff saved in its flow folder.
- After a session that went sideways, run `/devflow:wrap`. It reviews the session (`/retro` or `/reflect`), runs `/correct` when the same mistake keeps coming back, and saves a handoff to the flow if work is unfinished.

## Settings

Set these in `/plugin`, under devflow, Configure options. Saying otherwise in your request ("skip the adversarial review") wins for that run.

| Setting | Default | What it does |
|---|---|---|
| Git safety hook | on | Blocks `git push`, `reset --hard`, `clean -f`, `branch -D`, and commands that discard the whole working tree (`checkout .`, `restore .`, `checkout -f`, `switch --discard-changes`). Claude gives you the command to run instead. |
| No code comments | on | Claude adds no comments or docstrings to code it writes or edits, including ones explaining the change, in every session, unless you ask. Existing comments stay unless a change makes them wrong. |
| Multi-model review | risky changes | When the feature flow adds `/interrogate`: on risky changes (auth, data, money, concurrency, migrations, public APIs), always, or never. |
| Small changes | poteto-mode | `poteto-mode`, which uses far more tokens, or `direct`: make the change, run the closest tests, show the diff. |
| Session review | reflect | Which review `/devflow:wrap` runs: `retro` or `reflect`. |

## Contributing

The plugin itself lives in `plugin/`, which is all that installing it copies. The tests stay at the repo root: `node --test` runs them for the git guard, the helper CLI and its hooks. Add a guard case for any command it should block or let through.

## Credits

devflow is an orchestration layer: the skills it runs are [Matt Pocock's](https://github.com/mattpocock/skills) ([MIT](https://github.com/mattpocock/skills/blob/main/LICENSE)) and Lauren Tan's pstack, originally in [cursor/plugins](https://github.com/cursor/plugins) and mirrored at [backnotprop/pstack](https://github.com/backnotprop/pstack) ([MIT](https://github.com/backnotprop/pstack/blob/main/LICENSE)). devflow doesn't copy them: its marketplace installs the ones it needs from their repos.

## License

MIT
