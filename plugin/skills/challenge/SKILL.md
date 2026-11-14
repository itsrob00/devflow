---
name: challenge
description: Adversarial review. Fresh subagents try to break a change or a design, and only findings proven by a run survive. For risky changes such as auth, payments, data migrations or deletion, concurrency and public APIs.
argument-hint: "[branch, diff or design]"
disable-model-invocation: true
---

# Challenge

Adversaries try to break the work. A finding counts only when a run proves it. This reports findings. It does not fix them.

## 1. Frame

The scope is what the user names, or else the current branch's diff from the default branch, including uncommitted changes. State the intent in two or three lines of your own, from the plan, the commits and the user's request. If the intent is unclear, ask.

## 2. Send the adversaries

Start two fresh subagents at once, each in its own worktree holding the scope, on the agent's strong model. Give each the scope, the intent and this brief:

> Break this change. Prove each finding with a run against the real code: a failing test, a repro script, or command output that shows the wrong behaviour. For a design, run a prototype or probe the current code. Report each finding with a title, the exact command, the output it printed, and the output the intent requires. Leave out anything you did not run: style, naming, structure, and risks that need a future change to matter. No findings is a valid result.

## 3. Verify

Rerun each finding's command yourself. Keep it when the output shows the failure and the failure breaks the intent. Drop the rest. Merge findings that share a cause. Remove the worktrees.

## 4. Report

- **Intent.** Your restatement.
- **Findings.** For each: the command, its output, and how it breaks the intent. Say "no verified findings" when none survive.
- **Dropped.** How many per adversary, and why.

Inside a flow, fix each verified finding and rerun its command to show it now passes.

**Done when** every reported finding has a command you reran yourself, and the worktrees are gone.
