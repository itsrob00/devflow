# Building a verification skill

A verification skill is a project-local skill, `verify-<app>`, that tells any agent how to launch this app, drive it like a user and capture proof. Write it to the project's skill folder for the agent in use.

## 1. Learn from the repo, not the user

Answer these from the code and docs. Ask only what can't be observed.

- **Surface.** What a user touches: a web UI, a CLI, a desktop app, an API, a library. Pick the primary one and note the rest.
- **Run.** How it starts locally, from the repo's own documented command. Ports, environment, seed data, sign-in.
- **Drive.** How an agent can operate it. Prefer what the repo already has: browser tests, scripts, endpoints. Otherwise a browser driver for web, a terminal session for a CLI, plain HTTP for a service.
- **Observe.** What evidence it gives: screenshots, transcripts, responses, logs, exit codes, stored state.
- **Isolate.** Whether two instances can run side by side. If not, the skill must say so.

If the checkout doesn't build or start, fix that or report it exactly before writing anything.

## 2. Write the skill

`verify-<app>/SKILL.md`, with a name and a description that says what the app is and when to use the skill, and these sections, each with the real commands from this repo:

- **Launch.** The exact command, how to tell the app is usable and not merely running, and how to stop it.
- **Health check.** One read-only command that says whether this instance is worth driving.
- **Drive.** The recipe with real selectors or commands. Prefer stable handles such as labels, data attributes and route paths. A drive of more than a few steps goes in a script beside the skill, so a later run repeats it with one command.
- **Evidence.** What to capture and where it goes.
- **Cleanup.** How to remove what a run created. Stop what you started, never by process name. Evidence survives cleanup.

## 3. Start the feature map

Create `verify-<app>/features/` with one file for the feature being proved now: what it is, how to reach it, how to drive it, and what end state proves it works. Later runs add the features they touch.

## 4. Prove the skill

Run its own instructions once, end to end: launch, health check, drive the one feature, capture evidence, clean up. Confirm the evidence is still there afterwards. A verification skill that was never run is a draft.
