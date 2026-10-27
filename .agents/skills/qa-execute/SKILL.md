---
name: qa-execute
description: "Execute a frozen QA manifest with minimal context, machine-checked assertions, bounded tools, and evidence-only reporting"
---

# QA Execute

Run a pre-authored QA manifest after implementation. This skill is an executor, not
a planner, test designer, debugger, or fixer.

## Operating contract

- Accept only a frozen QA manifest and the minimum target/environment information needed to execute it.
- Do not read the full product plan, implementation reasoning, source code, or unapproved test changes.
- Do not change acceptance criteria, tests, source files, dependencies, or fixtures.
- Do not repair failures. Report them to the owning implementation lane.
- Treat command exit codes and explicit assertions as authoritative; do not infer PASS from success-looking text.
- Use bounded timeouts, explicit cleanup, and no production or destructive side effects without separate authorization.

The manifest must have been designed before implementation. If it is missing a
precondition, expected signal, cleanup rule, or permission boundary, return `BLOCKED`
instead of inventing one.

## Manifest contract

Each test entry must define:

| Field | Requirement |
| --- | --- |
| `id` | Stable unique test identifier |
| `kind` | `command`, `api`, `browser`, or `computer-use` |
| `preconditions` | Environment, service, fixture, auth, and data requirements |
| `steps` or `command` | Exact bounded actions to execute |
| `expect` | Machine-checkable exit code, status, schema, selector, or checkpoint |
| `timeout` | Maximum duration for the test and each unbounded operation |
| `cleanup` | Explicit process, fixture, data, and temporary-artifact cleanup |
| `mutation_policy` | Usually `read-only`; any allowed mutation must be named |

The manifest should also include a version and digest or another immutable identity.
Do not execute a partially specified or changed manifest without reporting the gap.

## Tool selection

Use the least interpretive tool that can prove the assertion:

1. **Command** — use `exec_command`; record exit code, duration, and bounded output.
2. **API** — use a fixed request runner or `exec_command` with exact method, URL,
   headers, body, status, schema, and side-effect assertions. Do not print secrets.
3. **Browser** — prefer Playwright or another deterministic browser surface with
   fixed route, viewport, selectors, actions, and DOM/accessibility assertions.
4. **Computer-use** — use only when browser or direct tooling cannot exercise the
   target. Follow fixed actions and screenshot/checkpoint assertions; do not improvise
   a free-form interaction or declare visual success without a rubric.

Deterministic command, typecheck, lint, and API checks do not need model reasoning.
When a small native sub-agent is used for browser or computer-use execution, pass it
only the relevant manifest entries and tool instructions. Do not pass the full plan.

## Execution procedure

1. Validate the manifest identity, required fields, permissions, and target preconditions.
2. Capture relevant environment and worktree baseline without exposing secrets or modifying unrelated work.
3. Start only the explicitly named local target or test service, with bounded lifetime.
4. Execute each test exactly as specified. Do not add scenarios or weaken assertions.
5. Compare actual evidence with every declared expectation.
6. Run declared cleanup even after failure; report incomplete cleanup as a separate failure.
7. Emit the compact result summary and retain detailed logs, screenshots, or traces only as named evidence artifacts.

Run independent read-only tests in parallel only when their targets, ports, fixtures,
and cleanup cannot conflict. Serialize tests that share mutable state.

## Result semantics

Use exactly one result per test:

- `PASS` — every declared assertion passed and cleanup completed;
- `FAIL` — the target ran and an assertion, exit code, or cleanup requirement failed;
- `BLOCKED` — a required precondition, permission, dependency, or safe execution boundary was unavailable;
- `FLAKY` — bounded reruns produced inconsistent results; include every observed result.

Never convert `BLOCKED` or `FLAKY` into `PASS`. A non-zero exit code is `FAIL` even
when output contains `SUCCESS`, `PASS`, or another positive phrase.

## Output contract

Return a compact report in this shape:

```markdown
# QA Execute Report

Manifest: <version/id/digest>
Target: <name and environment>
Overall: PASS | FAIL | BLOCKED | FLAKY

| Test ID | Kind | Result | Exit/status | Duration | Evidence |
| --- | --- | --- | --- | --- | --- |

## Failures and blockers
- Test ID: exact failed assertion, observed signal, and likely classification

## Cleanup
- Processes, fixtures, data, and temporary artifacts removed or retained

## Evidence
- Compact command output, API response summary, screenshot, trace, or log path
```

Do not include speculative root-cause analysis in the executor report. Return the
evidence and let the implementation or review lane decide what to change.

## Stop conditions

Stop and report when:

- the manifest is incomplete, altered, or inconsistent;
- a test would require an unauthorized destructive, credentialed, or production action;
- a command exceeds its timeout or leaves an unbounded child process;
- a browser/computer-use assertion is subjective or lacks a declared rubric;
- cleanup cannot be completed safely.

The executor ends after the manifest is run or a clear blocker is reported. It does
not retry until success, create hidden state, invoke continuation hooks, or launch
another workflow runtime.
