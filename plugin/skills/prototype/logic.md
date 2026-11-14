# Logic prototype

For questions about business logic, state transitions or data shape: things that look fine on paper and only feel wrong when pushed through real cases.

1. **State the question** at the top, in one paragraph.
2. **Isolate the logic** in one small pure module: a reducer, a state machine, or a few functions over a plain data type. Pick the one that fits the question. Nothing in it touches the page or the terminal, so it can be lifted into the real code later.
3. **Push it through the awkward cases.** The happy path, a tricky edge case, and something that should be illegal.
   - If you can judge the answer yourself, write a short script that runs the cases and prints the state after each step. Run it and read the result.
   - If the user has to feel it, build one self-contained HTML file with no framework and no server. Show the current state as labelled fields, one button per action, and a few guided scenarios, all in the domain's own words.
4. **Read the answer.** The useful moments are "that shouldn't be possible" and "I assumed that would differ". Those are faults in the idea, which is what the prototype is for.

Don't add tests, don't wire it to the real database, and don't generalise past the one question.
