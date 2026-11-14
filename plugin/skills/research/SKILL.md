---
name: research
description: Investigate a question against primary sources in the background and save cited findings to one file. For docs or API facts a decision waits on, and reading that would crowd the main context.
argument-hint: "[question]"
disable-model-invocation: true
---

# Research

Start a background subagent with a fresh context so you keep working while it reads. Give it the question and these three rules:

1. Use primary sources: official docs, source code, specs, first-party APIs. Follow each claim back to the source that owns it, not to a write-up about it.
2. Write the findings to one Markdown file, with the source beside each claim. Say plainly what could not be confirmed.
3. Save the file in the flow's folder. With no flow, or when the user wants the notes kept, save it where the repo already keeps such notes and say where.

Questions that don't depend on each other each get their own subagent, all started at once.

**Done when** the file exists, every claim in it names its source, and you have read it yourself before using it.
