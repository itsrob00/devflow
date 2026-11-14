---
name: shape
description: Sketch the types, signatures and module boundaries of a change before any code is written, and screen the design for structural mistakes. For changes that add types or cross a module boundary.
argument-hint: "[the change to shape]"
disable-model-invocation: true
---

# Shape

Decide the shape of a change before writing it. Use this when the change adds types or crosses a module boundary. Skip it for code that stays inside one function.

## 1. Sketch

Write the types, function signatures and module boundaries with empty bodies. Start from the data: name its shape first, then what reads and writes it. Use the repo's glossary terms for names.

## 2. Second candidate

For a decision that is costly to undo (a public interface, a stored format, who owns a piece of state), sketch a second design that differs in structure, not in detail. Compare the two on how much each hides behind how small an interface, and choose.

## 3. Screen

Check the chosen sketch against [checklist.md](checklist.md). A red flag is a reason to revise the sketch or to say why it stands.

## 4. Into the plan

Put the chosen sketch in the plan. When there was a second candidate, add one line on what it was and why it lost.

## 5. Hold the line

The sketch is the contract for the build. When building shows the sketch was wrong, change the sketch, and record the deviation and its reason in the decision list. Don't absorb it silently.

**Done when** every new type and every function that crosses a module boundary has a signature in the sketch, and each red flag is either cleared or answered in one line.
