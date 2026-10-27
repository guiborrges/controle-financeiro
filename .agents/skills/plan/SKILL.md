---
name: plan
description: "Native planning workflow with general, consensus, and strict high-risk modes"
---

# Plan

Plan creates an actionable, evidence-backed work plan in the current conversation
and current plan document. It does not own a second session, hidden state store, or
execution runtime.

## Modes

| Mode | Use | Result |
| --- | --- | --- |
| General | The request is ordinary and specific enough to plan | A right-sized implementation plan |
| Consensus | Independent architecture and critic review are warranted | Planner → Architect → Critic plan |
| Strict | The change is large or high-risk | Metis → Momus → Oracle plan |

If the request is ambiguous rather than merely under-planned, use `deep-interview`
first. Do not repeat a complete requirements interview inside Plan.

## Do not use

- Do not plan a trivial, obvious one-file change when direct execution is safer and clearer.
- Do not implement source code in a planning-only run.
- Do not treat a plan document as consensus evidence by itself.
- Do not ask the user for facts that repository inspection can establish.

When the user supplies an existing plan for assessment, remain in General mode and
return a review-only verdict. Do not create a separate review mode.

## Shared planning contract

Every plan must contain:

- Requirements summary
- Desired outcome
- Scope in and scope out
- Assumptions and decision boundaries
- Acceptance criteria that can be tested or observed
- Right-sized implementation steps with file references
- Risks and mitigations
- Verification steps
- Stop or rollback conditions
- Unresolved blockers and residual risk, if any

Claims about an existing repository should cite concrete files, symbols, commands,
or other evidence. Acceptance criteria must describe observable behavior rather than
implementation activity alone.

## Verification and test contract

Complete the verification contract before implementation begins. Scale its depth to
risk: General mode may keep it small, while Consensus and Strict modes require a
complete adversarial contract for the planned behavior.

For every acceptance criterion, define:

- a stable test ID and the requirement it proves;
- test level: unit, integration, API, browser, computer-use, or end-to-end;
- preconditions, fixtures, exact command or action sequence, timeout, and cleanup;
- an observable expected signal or test oracle, including exit codes and response/schema assertions;
- normal, boundary, malformed, authorization, interruption, failure, rollback, and concurrency scenarios when relevant;
- the TDD test artifact to author before source implementation, including the expected initial failure;
- execution owner, allowed mutations, evidence artifact, and residual unknowns.

Do not use prose such as “test thoroughly” as a test contract. A downstream executor
must be able to run the contract without reading the full plan, implementation
reasoning, or source code. The contract may identify a test file or fixture, but the
executor must treat those artifacts as frozen and read-only.

The plan owns test design; it does not run the tests or silently modify source code.
After the contract is approved, author the TDD tests before implementation, then use
`qa-execute` for low-context execution and evidence collection.

## General mode

1. Restate the target result, constraints, and stop condition.
2. Inspect the repository and relevant existing conventions.
3. Produce the smallest plan that satisfies the request.
4. Include verification proportional to risk.
5. Stop after emitting the plan unless the user explicitly requests execution.

## Consensus mode

Consensus mode is the native replacement for the former standalone consensus
workflow. It is not the default for every plan. Use it when independent challenge materially lowers
architectural or safety risk.

The main model owns the plan document. Native sub-agents may be used because this
mode explicitly requires independent roles, but they must run sequentially:

1. **Planner** creates the initial plan and Consensus-DR summary.
2. **Architect** reviews the plan and supplies a steelman counterargument, real tradeoff tension, and architectural findings.
3. **Critic** reviews only after Architect completes and checks alternatives, risks, testability, and verification.

The Consensus-DR summary contains:

- 3–5 principles;
- top decision drivers;
- at least two viable options with bounded pros and cons;
- invalidation rationale when only one option remains;
- pre-mortem and expanded unit/integration/e2e/observability plan for deliberate high-risk review.

If Critic does not approve, revise the plan and repeat the same sequential loop up to
five iterations. If approval is still not reached, stop with the best plan plus the
unresolved objections. Do not silently execute an unapproved plan.

The final consensus plan must include an ADR:

- Decision
- Drivers
- Alternatives considered
- Why chosen
- Consequences
- Follow-ups

## Strict mode and risk trigger

Use `--strict` instead of ordinary consensus when any of these apply:

- authentication or security boundary changes;
- database migration or data integrity risk;
- destructive or difficult-to-reverse operation;
- production incident or external production action;
- compliance, PII, or credential handling;
- public API or protocol breakage;
- multiple subsystem boundaries with independent acceptance tracks;
- unclear rollback or materially competing interpretations.

Do not run `--consensus` and `--strict` serially for the same change. Strict planning
is the high-rigor superset for that change.

## Context and persistence

Use the current conversation and current plan document as the working context. Use
`update_plan` for visible phase progress when the task is multi-step. If durable
documentation is requested, write a normal repository document at a user-approved
path. Do not create hidden workflow state, ledgers, or runtime-specific artifacts.

## Handoff

Plan stops after producing its result. It may recommend:

- direct implementation for ordinary work;
- a native goal when the user explicitly wants long-running goal tracking;
- native sub-agents for independent implementation lanes;
- `qa-execute` or an equivalent frozen-manifest verification pass when risk warrants it.

Planning does not silently start implementation.

Original task:
{{ARGUMENTS}}
