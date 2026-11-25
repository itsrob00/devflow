# Baseline

These apply even when a repo documents nothing. Each is a labelled judgement call, such as "possible feature envy", never a hard violation. A documented repo standard always wins.

## Code smells

- **Mysterious name.** A name that doesn't say what the thing does or holds. Rename it. If no honest name comes, the design is unclear.
- **Duplicated code.** The same logic in more than one hunk. Extract the shared shape.
- **Feature envy.** A method that uses another object's data more than its own. Move it to the data.
- **Data clumps.** The same few fields travelling together. Bundle them into one type.
- **Primitive obsession.** A string or number standing in for a domain concept. Give the concept a type.
- **Repeated switches.** The same branching on the same type in several places. Use one map or polymorphism.
- **Shotgun surgery.** One logical change scattered across many files. Gather what changes together.
- **Divergent change.** One module edited for unrelated reasons. Split it.
- **Speculative generality.** Abstractions, parameters or hooks for needs the plan doesn't have. Delete them.
- **Message chains.** Long `a.b().c().d()` navigation. Hide the walk behind one method.
- **Middle man.** A class or function that mostly delegates. Call the real target.
- **Refused bequest.** A subclass that ignores most of what it inherits. Use composition.

## Structure

- **Shallow module.** A large interface hiding little.
- **Leaked decision.** One representation or policy repeated across modules.
- **Pass-through.** A layer that forwards the same arguments and adds nothing.
- **Split ownership.** More than one module writing the same state.
- **A second way.** The diff adds another way to do something the repo already does one way, or a new use of something deprecated or a workaround. Agents copy what they see, so this spreads.
- **Hard to trace.** A reader can't answer "where does this come from" and "what can change it" in under a minute. Cut a layer or shrink the state.
