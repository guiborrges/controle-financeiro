---
name: optimize-performance
description: "Improve a measurable performance outcome using a reproducible baseline, an explicit evaluator, bounded hypotheses, reversible changes, and regression evidence. Use for latency, throughput, memory, CPU, startup time, output size, or cost; use simplify-code for readability and maintainability cleanup."
---

# Optimize Performance

Improve a measurable performance outcome using an evaluator as the authority.
Keep the optimization loop in the current conversation, active plan, and native
tools; do not create hidden workflow state.

## Routing Boundary

- Use this skill when the primary outcome has a numeric or otherwise machine-checkable performance target.
- When a task also contains readability or maintainability cleanup, establish the performance result first; use `simplify-code` later for a separately scoped cleanup pass.
- If there is no reproducible evaluator or measurable target, do not invent one or claim optimization; use `plan` to define the missing contract first.
- Do not absorb general refactoring, architecture redesign, or correctness fixes unless the declared performance hypothesis requires that exact change.

## Performance Contract

Before editing, record:

- performance dimension and user-visible objective;
- workload, dataset, fixtures, and correctness invariants;
- baseline measurement and target threshold;
- evaluator command, sample count, warm-up, timeout, and environment/hardware assumptions;
- regression tests, allowed mutations, and iteration/rollback limits.

The baseline must be reproducible. If it cannot be reproduced, the status is
`BLOCKED`, not `PASS`.

## Contract

- Define the evaluator command, baseline, target, and pass/fail rule before editing.
- Do not call an optimization successful because ordinary tests pass if the declared evaluator fails.
- Change one performance cause at a time and keep each patch reversible.
- Run the evaluator and relevant regression tests after every meaningful candidate.
- Report `PASS`, `FAIL`, or `BLOCKED` with the command and evidence.
- Complete only after a passing evaluator result, regression evidence, and a final objective audit.

## Optimization Discipline

- State one falsifiable bottleneck hypothesis before each candidate change.
- Change one performance cause at a time and keep each candidate reversible.
- Run the evaluator and relevant regression tests after every meaningful candidate.
- Do not game the benchmark by weakening correctness, coverage, workload realism, or failure handling.
- Treat ordinary tests as necessary regression evidence, never as a substitute for the declared evaluator.
- Separate measurement noise, environment limitations, fixture drift, and real regressions in the report.

## Workflow

1. State the performance objective and what must not regress.
2. Inspect the current implementation and reproduce the baseline evaluator before editing when possible.
3. Define:
   - evaluator command;
   - baseline measurement;
   - target threshold;
   - relevant regression tests;
   - environment and dataset assumptions.
4. Use `update_plan` to record the objective, evaluator contract, hypothesis, and iteration boundary.
5. For work that spans multiple turns, use `create_goal` when no active goal exists. Use `get_goal` before resuming or finalizing.
6. Apply the smallest change that targets the measured bottleneck.
7. Run the evaluator and regression tests. Record the result in the active plan or normal repo artifact when one exists.
8. If the result fails, inspect the evidence and either make the next bounded change or report the blocker. Do not vary unrelated code to chase a number.
9. Stop after a small bounded number of unsuccessful iterations unless new evidence changes the diagnosis.
10. Before completion, rerun the evaluator from a clean enough state, verify the objective and regression criteria, then call `update_goal({status: "complete"})` only when the native goal is genuinely complete.

If the measured bottleneck is resolved but the remaining work is only code
clarity, stop this workflow and hand off to `simplify-code` with a new scope.

## Evaluator Rules

- Prefer a deterministic command with a stable input and output format.
- Keep warm-up, sample count, timeout, hardware, and environment assumptions explicit when they affect the result.
- Distinguish a real regression from an environment limitation, flaky measurement, or missing fixture.
- A benchmark that cannot reproduce the baseline is `BLOCKED`, not `PASS`.
- Preserve useful measurements even when the optimization is rejected.

## Completion Report

```text
 OPTIMIZE PERFORMANCE REPORT
Objective: [measurable objective]
Evaluator: [command]
Baseline: [measurement and environment]
Target: [pass/fail rule]

Iterations:
- [change] -> [measurement] -> PASS/FAIL/BLOCKED -> [evidence]

Regression tests: PASS/FAIL/BLOCKED
Final evaluator: PASS/FAIL/BLOCKED
Remaining risks: [none or concise list]
```

Do not claim durable completion, benchmark improvement, or goal completion
without fresh evaluator evidence.
