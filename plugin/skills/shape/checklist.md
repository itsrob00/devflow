# Shape checklist

## Deep modules

Aim for a lot of behaviour behind a small interface.

- **The deletion test.** Imagine deleting the module. If the complexity vanishes, it was a pass-through. If it reappears in every caller, the module earns its place.
- **One adapter is a guess, two is a seam.** Don't add an interface until something really varies across it.
- **Accept dependencies, return results.** A function that takes what it needs and returns what it made can be tested through its own interface.
- **The interface is the test surface.** If a test has to reach past it, the module is the wrong shape.

## Red flags

- **Shallow module.** A large interface hiding little. Callers coordinate several calls to do one thing, or options expose internal stages.
- **Leaked decision.** The same representation, policy or wire detail appears in more than one module, so changing it needs coordinated edits. Transport and storage types re-exported through a public surface are leaks.
- **Organised by execution order.** Modules named load, validate, transform and save repeat one set of rules across every stage. Group by what the code knows, not by when it runs.
- **Pass-through.** A method that forwards the same arguments to another of the same shape. Remove it unless it adds policy or adaptation.
- **Split ownership.** More than one module writes the same state or keeps its own copy. Give each piece of state one owner.

## Coding checks

- **Data shape first.** The core types are settled before the logic that uses them.
- **Model the domain.** A state machine, a typed model or a lookup table in place of scattered booleans and repeated conditionals. Don't force one where plain code is already clear.
- **Illegal states can't be written.** Give ids and units their own types where the language allows. Derive types from the schema that owns them.
- **Validate at the edges.** Parse external data (requests, config, files, environment) into typed values where it enters. Inside, trust the types and keep logic in pure functions.
- **Safe to run twice.** A command or lifecycle step reads the current state and applies only the difference, so a retry or a crash halfway does no harm.
- **Would we build it this way from scratch?** If the new requirement had been there from the start, would the design look like this? If not, say what would differ and whether it is worth doing now.
