# Bug flow

1. **History.** When it's a regression and how the code got this way matters (a recent change, a reverted fix, a deliberate threshold): `why`.
2. **Diagnose and fix.** `diagnosing-bugs`. It builds a loop that goes red on this bug, tests hypotheses, writes the regression test before the fix at a real seam, fixes it, and cleans up. Don't add a separate `tdd` pass; that test is part of its phase 5.
3. **Check.** `blast-radius` on the fix, with its safety fact proven by running code or marked unproven.
4. **Prove.** For a bug a user can see, reproduce the original scenario with the project's `verify-*` skill and show it now passes.
5. **Commit** with a message that names the root cause. If `diagnosing-bugs` found no good seam for a regression test, say so in the report: the code's structure is keeping the bug from being locked down.
