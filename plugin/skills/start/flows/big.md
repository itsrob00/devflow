# Big flow

When resuming, continue the existing `wayfinder` map or `figure-it-out` playbook where the handoff says; don't make a new one.

1. **Plan.**
   - The way isn't clear (open decisions, unknown scope): `wayfinder`. It maps the work as decision tickets and resolves them one at a time. When the map clears, continue with Feature step 3 (`to-spec`, then `to-tickets`) in `feature.md` in this folder.
   - The way is clear but long (a migration, a sweep across many call sites, a multi-part change): `figure-it-out`. It designs the playbook and runs it.
   - Merge tickets that are only a grilling session (questions for the user, no code, research or prototype) into one ticket that asks all their questions in one session. Keep one apart only when its questions depend on a non-grilling ticket finishing first. Say which tickets you merged.
2. **Log decisions.** `show-me-your-work` from the start. Its trail review asks for a different model family, but Claude Code runs only Claude. Spawn that reviewer on the `judgment and prose` model from the pstack models file (omit `model` for `inherit-parent` or `auto`), never on a model the user didn't configure. In the Attention section write `reviewed by <model> (fresh context; Claude Code has no other model family)`. Report a fallback only if a spawn actually failed, with its error.
3. **After each ticket** (a `wayfinder` decision ticket, a `figure-it-out` playbook step, or a `to-tickets` build ticket), show the user what's left before starting the next. Read the list from the map, playbook or tickets, not from memory, and print every ticket in order, including any the work added:

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
4. **End of each session.** `handoff` with what the next session is for, saved as `.devflow/flows/<id>/handoff.md` (replacing the one there), not the temp folder `handoff` names. Start the file with the flow (Big), the step and ticket to continue from, the map or playbook and decision log paths, the remaining-tickets list from step 3, and any settings the user changed. Save the step with `devflow flow set <id> step=...` and tell the user to start the next session with `/devflow:start`.
