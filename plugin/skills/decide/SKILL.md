---
name: decide
description: Settle the open design decisions for a task. Finds facts itself, takes the decisions it can recommend with confidence, and asks the user once for the ones that are theirs. Run as a full interview when the user asks to be grilled.
argument-hint: "[the task or plan to decide on]"
disable-model-invocation: true
---

# Decide

Settle what has to be decided before the work can be planned, and take as little of the user's time as the decisions allow.

## 1. Map

List the open decisions for this task and what each depends on. This list is for you, so don't walk the user through it. Name two things first, because they shape the rest:

- **The destination.** What being finished looks like.
- **Out of scope.** What this work will not do.

## 2. Find facts

A question with an answer is never the user's to answer. Look it up in the code or the docs. If it needs running, build the quickest throwaway that shows it and read the result. Start any reading that takes a while in the background, all at once, and carry on with the decisions that don't wait on it.

## 3. Sort

A decision is **yours** when you can recommend an answer with confidence and it is cheap to change later.

A decision is **the user's** when any of these is true:

- It changes the scope or what the product does.
- It is costly to undo.
- It is a matter of preference.
- It has no clear best answer.

## 4. Settle

Take each decision that is yours. Record it with its reason.

## 5. Ask once

Put the user's decisions in one round.

- At most five questions. With more than five, ask the five whose answers change the most, settle the rest with your recommendation, and mark those in the list as "decided for you, was yours to make".
- Give each question your recommended answer first, worded so that "yes" accepts it.
- Ask them as multiple-choice questions where the agent supports it (Claude Code's `AskUserQuestion`).

Ask again only if an answer opens a new decision that is also the user's.

A decision that only building can reveal goes on a **decide later** list. It comes back when the work reaches it, together with any others that are ready.

## 6. Record

- **The decision list.** Every decision goes in `decisions.md` in the flow's folder, one line each: the decision, why, a pointer to the evidence, and whether the user or you made it. The file is append-only. A changed decision gets a new line that says which one it replaces. With no flow, keep the list in the conversation.
- **Glossary and ADRs.** Follow [records.md](records.md). Write them without asking.

## 7. Hand over

Give the plan four things: what the user answered, what you settled, what is out of scope, and what is left to decide later.

**Done when** every decision on the map is answered, settled or on the decide later list, and each has its line in the decision list.

## The full interview

When the user asks to be grilled, skip step 3 and treat every decision as theirs. Ask in rounds: each round holds every question whose prerequisites are settled, numbered, each with your recommended answer. Still find the facts yourself. Stop when no decision is left, or when the user says to take your recommendations for the rest.
