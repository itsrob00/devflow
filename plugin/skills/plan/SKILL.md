---
name: plan
description: Write what will be built and how it will be proven, cut a big job into tickets, then show the plan and wait once for the user's go. Runs after the open decisions are settled.
argument-hint: "[the work to plan]"
disable-model-invocation: true
---

# Plan

Turn what is already known into a plan the user can approve in one read. Don't interview. Everything here comes from the task, the code and the decisions already made.

Write the plan to `plan.md` in the flow's folder, in this order.

## 1. Done means

One or two checks that will show the work is finished, each something you can run or observe. For a migration or a sweep, capture the starting state now, so the check reads as old against new.

## 2. What changes

Say it first in the user's terms: what someone will be able to do or see afterwards. Then the modules and interfaces involved, and the design sketch if there is one. Use the glossary's terms. No file paths and no code, except a snippet from a prototype that states a decision better than prose can.

Add a short list of acceptance criteria, each a behaviour that can be checked.

## 3. Test seams

Name where the behaviour will be tested: the public interface each test goes through. Prefer a seam that already exists, and as few as possible.

## 4. Decisions

List what the user answered, what was settled for them, what is out of scope, and what is left to decide later.

## 5. Size

- **Fits one session:** the plan is complete. It is built directly.
- **Needs more than one context's worth of work:** it is a big job. Say so, and cut it into tickets.

### Tickets, for a big job

- **Vertical slices.** Each ticket cuts a narrow, complete path through every layer it needs, and can be verified by itself.
- **One context each.** A ticket is sized for one fresh subagent.
- **Blocking edges.** Each ticket lists the tickets that must finish before it can start. A ticket with none can start at once.
- **Prefactor first.** Changes that make the work easier come before the work.
- **Wide mechanical changes** (a rename across the codebase, a retyped shared symbol) go as expand, migrate in batches, then contract, so every ticket lands green.
- **Simple or complex.** Mark each ticket. Simple tickets are mechanical and fully specified. Complex ones need design judgement, touch concurrency, or cross several modules.

Each ticket holds what it makes work from the user's point of view, its acceptance criteria and its blockers. No file paths.

Publish the plan and the tickets as [tracker.md](tracker.md) says.

## 6. The verification skill

If the repo has no skill that drives the running app to prove a change, say so in the plan and include building one as the first piece of work. The user's go then covers it.

## 7. Stop

Show the plan and wait for the user's go. This is the one stop in the flow.

- Keep what you show to one screen: done means, what changes, the decisions, and for a big job the ticket list with blockers and each ticket's simple or complex mark.
- A reply that changes the plan updates it and counts as the go, unless the change opens a new decision that is the user's.
- After the go, nothing else waits on the user except a decision that is theirs or an action that cannot be undone.

**Done when** the plan is saved, every ticket of a big job is published with its blockers, and the user has given the go.
