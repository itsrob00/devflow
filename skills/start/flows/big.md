# Big flow

When resuming, don't make a new `wayfinder` map or a new `figure-it-out` framing or playbook: pick up the existing one where the handoff says.

1. **Plan.**
   - The way there isn't clear yet (open decisions, unknown scope): `wayfinder`. It maps the work as decision tickets and resolves them one at a time. When the map clears, continue with Feature step 3 (`to-spec`, then `to-tickets`) from `feature.md` in this folder.
   - The way is clear but long (a migration, a sweep across many call sites, a multi-part change): `figure-it-out`. It designs the playbook and runs it.
   - When the map, playbook or tickets hold more than one ticket that is only a grilling session (questions for the user, with no code, research or prototype to do), merge them into one ticket that asks all their questions in one session. Keep a grilling ticket apart only when its questions depend on a ticket that isn't a grilling one finishing first. Say which tickets you merged.
2. **Log decisions.** `show-me-your-work` from the start, so a reviewer can trust the result later. Its trail review asks for a different model family, which Claude Code doesn't have: every model it runs is Claude. Spawn that reviewer on the `judgment and prose` model from the pstack models file (omit `model` for `inherit-parent` or `auto`), never on a model the user didn't configure. In the Attention section write `reviewed by <model> (fresh context; Claude Code has no other model family)`, and report a fallback only if a spawn actually failed, with its error.
3. **After each ticket.** When a ticket is done (a `wayfinder` decision ticket, a `figure-it-out` playbook step, or a build ticket from `to-tickets`), show the user what's left before starting the next one. Read the list from the map, playbook or tickets, not from memory, and print every ticket in order, including any the work added:

   ```
   Big: <job> · 3 of 7 done
   ✓ 1. <ticket>
   ✓ 2. <ticket>
   ✓ 3. <ticket>   (just finished)
   → 4. <ticket>   (next)
     5. <ticket>
     6. <ticket>
     7. <ticket>
   ```

   Mark a ticket blocked when it waits on another or on the user, and say on what. When none are left, say so and continue: Feature step 3 after a `wayfinder` map clears, otherwise **Finish** in the start skill.
4. **End of each session.** `handoff` with what the next session is for. Start the file with the flow (Big), the step and ticket to continue from, the `wayfinder` map or `figure-it-out` playbook and decision log paths, the remaining-tickets list from step 3, and any settings the user changed, so the next session needs nothing else to start. Tell the user the file path and to start the next session with `/devflow:start resume <path>`.
