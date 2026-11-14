---
name: prototype
description: Build throwaway code that answers one design question, either a logic model to click through or several UI variations to compare. For "does this state model hold up" and "what should this look like".
argument-hint: "[the question to answer]"
disable-model-invocation: true
---

# Prototype

A prototype is throwaway code that answers one question. The question decides its shape, so write the question down first.

## Pick the shape

- **Does this logic or state model hold up?** Follow [logic.md](logic.md). You can usually run this one yourself and read the answer.
- **What should this look like?** Follow [ui.md](ui.md). This one is for the user to look at.

If the question could be either, go by the surrounding code: a backend module means logic, a page or component means UI. State the choice at the top of the prototype.

## Rules for both

1. **Marked as throwaway.** Put it next to the code it is for, with a name nobody could mistake for production.
2. **One step to run.** A file to open or one command from the project's task runner.
3. **No persistence.** State lives in memory. If the question is about storage, use a scratch database or file named so it is clearly disposable.
4. **No polish.** No tests, no abstractions, no error handling beyond what makes it run.
5. **State on show.** After every action or variant switch, show the full relevant state.

## When it has answered

Record the verdict in the decision list: the question, the answer, and any snippet that states the decision better than prose can, such as a reducer, a state table or a type. Move what was validated into the real code, rewritten properly. Then delete the prototype. Don't keep it on a branch.

**Done when** the question has a recorded answer and no prototype file is left in the working tree.
