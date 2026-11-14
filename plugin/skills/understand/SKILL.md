---
name: understand
description: Read the code around a task or question and say how it works, where a change belongs and what could bite. For unfamiliar code before changing it, and for "how does X work" or "why is X this way".
argument-hint: "[task or question]"
disable-model-invocation: true
---

# Understand

Build a working picture of the code a task touches before anything is decided or written.

## 1. Scope

Say in one line what you take the task or question to cover. Don't ask. The user can redirect.

## 2. Read

- **Narrow** (one function, one module, one small utility): read it yourself in one pass.
- **Wide** (a subsystem across several modules or services, a cross-cutting feature): split it into two to four angles. Give each angle to a fresh subagent that only reads and reports files, functions and flow. Merge the reports yourself, and where two disagree, read the code and settle it.

When in doubt, treat it as narrow.

If the repo has a `GLOSSARY.md` or ADRs under `docs/adr/` that touch the area, read them and use their terms. If it has neither, carry on without comment.

## 3. History, only when it matters

Read the history for a regression, or before changing code that looks deliberate: a guard, a retry, a threshold, a workaround.

- `git blame -L <start>,<end> <file>` for who last touched it.
- `git log --follow -p -- <file>` for how it got this way, through renames.
- The pull request and issue each commit links, read with the tracker's CLI.

Stop when you can say what the code was protecting, or that the history doesn't say.

## 4. Answer

Inside a flow, give three or four lines for the plan: how it works, where the change belongs, what could bite.

Asked directly, give a fuller explanation and drop any part that doesn't apply:

- **Overview.** What it is and what it does, in a paragraph.
- **Key ideas.** The few types or concepts the rest depends on.
- **How it works.** The flow, step by step, naming files and functions. Add a diagram when several parts talk to each other.
- **Where things live.** The files worth opening first.
- **What could bite.** Surprises, hidden coupling, things that look wrong and aren't.

Keep what you read apart from what you infer. "The loader retries three times" is read. "Probably because the API is flaky" is inferred, and says so. A search that finds nothing is an answer. Never invent a caller, an API or a reason.

**Done when** you can name the file and function where the change belongs, or have answered the question, and every claim is marked as read or inferred.
