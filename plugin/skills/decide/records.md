# Glossary and ADRs

## GLOSSARY.md

One `GLOSSARY.md` at the repo root holds the project's own terms. Create it when the first term is settled, not before.

- Add or update a term the moment it is settled. Don't batch them.
- When the user's wording clashes with the glossary or with the code, pick the glossary's term and note it. Ask only when their words and the code contradict each other in a way that changes the design.
- A definition is one or two sentences that say what the thing is. No implementation detail.
- Where several words exist for one concept, choose one and list the rest under `_Avoid_`.
- Only terms specific to this project. General programming words stay out.

```md
**Order**:
A customer's request to buy one or more items.
_Avoid_: Purchase, transaction
```

## ADRs

ADRs live in `docs/adr/`, numbered in sequence: `0001-slug.md`, `0002-slug.md`. Create the folder with the first one.

Write an ADR only when all three are true:

1. **Hard to reverse.** Changing your mind later has a real cost.
2. **Surprising without context.** A future reader will wonder why it was done this way.
3. **A real trade-off.** There were genuine alternatives and one was chosen for a reason.

An ADR is a title that states the decision and one to three sentences on the context, the decision and why. Add the rejected options or the consequences only when they are worth remembering.
