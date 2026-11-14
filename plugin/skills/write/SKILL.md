---
name: write
description: The writing standard for what gets written down, such as plans, specs, ADRs, pull request bodies, commit messages and docs. Write so a tired engineer understands on the first read, and cut the patterns that mark text as machine-written.
argument-hint: "[text or file to write or edit]"
disable-model-invocation: true
---

# Write

Write it clean the first time. Then scan the draft against [patterns.md](patterns.md) and rewrite what you find, keeping the meaning.

## Three rules above the rest

- **Cut every word that does no work.** If the sentence survives without it, the word goes.
- **Use the short, everyday word.** "Use", not "utilize". "Help", not "facilitate".
- **When a rule makes a sentence worse, leave the sentence alone.** A sentence that obeys every rule and reads like a machine wrote it has failed.

## Sentences

- Use the real name. Write the actual symbol, file, flag or command, not a description of it. Don't invent jargon.
- Say who does what: "the compiler checks", not "is checked".
- Talk to the reader as "you", in the present tense.
- Write instructions as commands. Put the condition before the instruction: "To delete the document, click Delete."
- Put the common case first and exceptions after.
- Never "simply", "easy" or "quickly" in a procedure.
- Be specific. Not "schema changes can cause issues" but "a column rename fails the build".
- Vary sentence length. Short sentences land a point. A longer one carries a fact with its condition.
- Have a view where the text weighs a trade-off. Say what you make of it.

## Structure

- Lead with the point: the decision, the result or the answer.
- Headings carry the point, in sentence case.
- Numbered lists for sequences, bullets for parallel items, a table for items with several attributes. Introduce a list with a full sentence.
- Code, commands and file names go in code font.
- Link with words that say where the link goes.

**Done when** the text passes a scan of the pattern list and a reader new to the work could act on it without asking a question.
