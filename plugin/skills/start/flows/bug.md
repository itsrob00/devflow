# Bug flow

1. **History.** For a regression where how the code got this way matters (a recent change, a reverted fix, a deliberate threshold): `why`.
2. **Diagnose and fix.** `diagnosing-bugs`. Its regression test (phase 5) replaces a separate `tdd` pass.
3. **Check.** `blast-radius` on the fix, with its safety fact proven by running code or marked unproven.
4. **Prove.** For a bug a user can see, reproduce the original scenario with the project's `verify-*` skill and show it now passes. With no `verify-*` skill, offer to build one as the feature flow's Prove step does.
5. **Commit** with a message that names the root cause. If the fix goes up as a PR, save `devflow flow set <id> pr=<branch>`; the flow is marked done when it merges. If `diagnosing-bugs` found no good seam for a regression test, say so in the report: the code's structure keeps the bug from being locked down.
