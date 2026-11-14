# Testing

## What a good test is

A test is a claim about what the code does for its users: a caller, an end user, another service. It drives the code through the interface those users use and asserts what they can observe: return values, errors, state they can read back, and effects on outside systems.

Judge each test against two imagined edits:

- **Break the behaviour.** Make the code return a wrong value or skip an effect. If the test still passes, it proves nothing.
- **Change the internals.** Restructure the code and keep every observable result. If the test now fails, it is pinned to the implementation.

Keep a test that catches the first edit and survives the second. Rewrite or delete the rest.

## Where tests go

Tests live at the seams named in the plan: public interfaces, never internals. If the right seam turns out to be different, change it and record why.

## What to avoid

- **Coupled to the implementation.** Mocking internal collaborators, testing private methods, or checking through a side channel such as querying the database directly.
- **Passing by construction.** An expected value computed the way the code computes it. Expected values come from an independent source: a known literal, a worked example, the plan.
- **All tests first.** Writing every test and then every implementation tests what you imagined. Go one test, one implementation, and let each cycle inform the next.

## The loop

- **Red before green.** See the test fail for the right reason before writing the code.
- **Only enough code to pass.** No speculative features.
- **No refactoring inside the loop.** Reshaping belongs to the review that follows.

## Mocks

Mock only at a system boundary you don't own: a third-party API, the clock, the network. What a mocked external service receives is behaviour, because that service observes it. A call to an internal helper is not.
