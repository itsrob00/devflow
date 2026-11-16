# Vetting a performance number

Use this for any number you measured: a before and after, a regression claim, a choice between options. Answer each question with evidence from a run, not a guess from reading code.

Before running, write down the claim you expect to make, in the words you would ship, such as "export is 30% faster at the median on the 60,000-row dataset". Read the measurement script and note what it times and what it ignores. Check the machine is quiet with `uptime`. If it isn't, alternate the two sides so both see the same noise, and say so.

1. **Why not double?** Name what limits the result: a core, a lock, the disk, the network, the load generator. Get it from a profile or system counters taken during a run. If you can't say why the number isn't twice as good, you don't know what you measured.
2. **Was it tuned?** Run every side the way production runs it: release builds, production flags, warm or cold caches as production sees them, the same data. One side on defaults means you compared configurations.
3. **Did it break a limit?** Do the arithmetic against disk and network bandwidth and core count. Removing a piece that takes 10% of the run can make it at most about 11% faster. A result past a limit measured something else.
4. **Did it error?** Count failures and check that outputs are correct, not just present. Rejections are often fast.
5. **Does it reproduce?** Run each side at least five times, alternating. Report the median and the range. A gap smaller than the run-to-run variation is no measurable difference.
6. **Does it matter?** Next to a micro result, measure the path a user waits on, with realistic data, and give the micro result as a share of the whole.
7. **Did it even happen?** Confirm the work ran inside the timed region: the request arrived, the rows were written, the result was used. Lazy code and timeouts produce numbers for work that never happened.

For a quick ballpark the user asked for, one run is enough. Still check questions 4 and 7, and say it was one run.

## Report

Lead with the verdict: faster, slower, no measurable difference, or inconclusive. Give the number with its unit, the run count, the range and the limiter, such as "median 41 ms to 33 ms over 7 runs a side, range 32 to 35 ms after, bound by JSON parsing on one core". Call it inconclusive when you can't name the limiter, when a side ran untuned, or when you couldn't check questions 4 and 7.
