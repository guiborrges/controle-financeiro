---
name: simplify-code
description: "Simplify existing code without changing behavior by removing duplication, dead code, needless abstraction, masking fallbacks, and unclear boundaries. Use for cleanup, refactor, deslop, or maintainability work; use optimize-performance when the primary outcome is a measurable performance gain."
---

# Simplify Code

Simplify existing code with a regression-tests-first, smell-by-smell workflow that
preserves observable behavior and raises signal quality. “Slop” is a diagnosis
label, not permission for a broad rewrite.

## Routing Boundary

- Use `optimize-performance` when the primary requested outcome is a measurable change in latency, throughput, memory, CPU, startup time, output size, or cost.
- When a task has both a performance target and cleanup work, run `optimize-performance` first; follow with a separately scoped `simplify-code` pass only when the cleanup has its own acceptance criteria.
- Use `code-review` for assessment-only work, and use `plan` before behavior, API, architecture, or cross-cutting changes.
- Do not claim performance improvement from this skill. Incidental measurement may be reported as evidence, but it is not an optimization result.

## When to Use

Use this skill when:
- A code path works but feels bloated, noisy, repetitive, or over-abstracted
- A user asks to “cleanup”, “refactor”, or “deslop” AI-generated output
- Follow-up implementation left duplicate code, dead code, weak boundaries, missing tests, fallback-like code, or unnecessary wrapper layers
- You need a disciplined cleanup workflow without broad rewrites

## Scoped File Lists

- This skill can accept a **file list scope** instead of a whole feature area.
- When the caller provides a changed-files list, keep the cleanup strictly bounded to those files.
- When used after another implementation workflow, run it only on that workflow's explicitly owned files unless the user broadens the scope.

## Invariants and Non-goals

- Preserve the requested behavior, public contracts, error semantics, security properties, and data boundaries.
- Keep the scope to the requested files or owned diff; do not use cleanup as permission to redesign unrelated architecture or add dependencies.
- Do not remove a compatibility path merely because it looks awkward; first classify whether it is masking failure or a documented, tested fail-safe.
- If the only sound fix changes behavior or crosses a subsystem boundary, stop the cleanup pass and hand the finding to `plan` or the owning workflow.

## Procedure

1. **Lock behavior with regression tests first**
   - Identify the behavior that must not change
   - Add or run targeted regression tests before editing cleanup candidates
   - If behavior is currently untested, create the narrowest test coverage needed first
   - For fallback-like code, cover the primary path and any preserved compatibility/fail-safe fallback before cleanup

2. **Create a cleanup plan before code**
   - List the specific smells to remove
   - Bound the pass to the requested files/scope
   - If a file list scope is provided, keep the pass restricted to that changed-files list
   - Include fallback findings, classifications, and escalation status in the plan
   - Order fixes from safest/highest-signal to riskiest
   - Do not start coding until the cleanup plan is explicit

   The plan must state the preserved behavior, scope in/out, smell order, test
   evidence, and the condition that would stop or hand off the cleanup.

3. **Inventory fallback-like code before editing**
   - Search the requested scope for fallback-like detection signals: quick hacks, temporary workaround, temporary fallback, just bypass, just skip, fallback if it fails, swallowed errors, silent defaults, broad compatibility shims, and duplicate alternate execution paths
   - Classify each finding before changing it:
     - **Masking fallback slop** — hides errors or evidence, bypasses the primary contract, suppresses tests or validation, swallows failures, silently defaults, or adds untested alternate paths
     - **Grounded compatibility/fail-safe fallback** — is scoped to an external/version/fail-safe boundary, documents the rationale, preserves failure evidence, and has regression tests for both the primary and fallback behavior
   - Prefer root-cause repair, deletion, boundary repair, or explicit failure behavior before preserving fallback paths
   - For broad, ambiguous, cross-layer, or architectural fallback-like code, invoke `$plan --consensus` for consensus resolution before edits
   - If already inside an active plan or another workflow, do not start a nested planning workflow; record the finding and attach it to the active plan or handoff instead

4. **Categorize issues before editing**
   - **Fallback-like code** — masking fallbacks, workaround branches, bypasses, swallowed errors, silent defaults, broad shims, alternate execution paths
   - **Duplication** — repeated logic, copy-paste branches, redundant helpers
   - **Dead code** — unused code, unreachable branches, stale flags, debug leftovers
   - **Needless abstraction** — pass-through wrappers, speculative indirection, single-use helper layers
   - **Boundary violations** — hidden coupling, leaky responsibilities, wrong-layer imports or side effects
   - **UI/design slop** — review visual outputs as context-sensitive signals, not absolute bans; preserve intentional brand, design-system, accessibility, or product-context exceptions when the rationale is clear
     - Korean body text that is too small: challenge 11-12px body copy; Korean body text generally needs 14px or larger unless a dense, accessible system explicitly supports smaller text
     - Gratuitous depth: avoid putting box shadows on every logo, surface, card, icon, background, and step block when hierarchy or affordance does not need it
     - Repetitive content scaffolding: trim repeated eyebrow + title + description + paragraph stacks, filler explanation text, and generic emoji badges that do not add meaning
     - Default AI palettes: question blue/purple defaults such as #3B82F6 when there is no brand, semantic, or system rationale
     - Over-perfect grids: avoid reflexive uniform 3-column or 4-column card grids when the product context would benefit from rhythm, asymmetry, carousel cuts, bento composition, or varied emphasis
     - Extreme gradients: tone down "AI demo" gradients unless the brand or campaign intentionally calls for that intensity
   - **Missing tests** — behavior not locked, weak regression coverage, gaps around edge cases

5. **Execute passes one smell at a time**
   - **Fallback-like code resolution gate** — remove masking fallback slop, repair root causes, or escalate ambiguous cases before continuing
   - **Pass 1: Dead code deletion**
   - **Pass 2: Duplicate removal**
   - **Pass 3: Naming/error handling cleanup**
   - **Pass 4: Test reinforcement**
   - Re-run targeted verification after each pass
   - Avoid bundling unrelated refactors into the same edit set

   Do not combine a cleanup pass with an unmeasured performance change. If a
   simplification is expected to improve performance, record that as a hypothesis
   and hand the measurable claim to `optimize-performance`.

6. **Run quality gates**
   - Regression tests stay green
   - Lint passes
   - Typecheck passes
   - Relevant unit/integration tests pass
   - Static/security scan passes when available
   - Diff stays minimal and scoped
   - No new abstractions or dependencies unless explicitly required

7. **Finish with an evidence-dense report**
   - Changed files
   - Simplifications made
   - Fallback findings, classifications, and escalation status
   - Tests/diagnostics/build checks run
   - UI/design reviewer checklist findings when visual/UI files were in scope
   - Remaining risks
   - Residual follow-ups or consciously deferred cleanup

## Completion Gate

Complete only when all of the following are true:

- the requested behavior and contracts remain intact;
- the diff is limited to the approved scope;
- targeted regression tests and relevant quality checks pass;
- every preserved fallback is classified and its evidence is recorded;
- no unmeasured performance or architecture claim is presented as a result.

## Output Format

```text
AI SLOP CLEANUP REPORT
======================

Scope: [files or feature area]
Behavior Lock: [targeted regression tests added/run]
Cleanup Plan: [bounded smells and order]
Fallback Findings: [none, or finding -> masking fallback slop / grounded compatibility/fail-safe fallback -> escalation status]
UI/Design Findings: [none/N/A, or signal -> action taken/deferred -> intentional exception rationale]

Passes Completed:
- Fallback-like code resolution gate - [root-cause repair, explicit failure behavior, preserved grounded fallback, or plan handoff]
1. Pass 1: Dead code deletion - [concise fix]
2. Pass 2: Duplicate removal - [concise fix]
3. Pass 3: Naming/error handling cleanup - [concise fix]
4. Pass 4: Test reinforcement - [concise fix]

Quality Gates:
- Regression tests: PASS/FAIL
- Lint: PASS/FAIL
- Typecheck: PASS/FAIL
- Tests: PASS/FAIL
- Static/security scan: PASS/FAIL or N/A

Changed Files:
- [path] - [simplification]

Fallback Review:
- Findings: [fallback-like findings detected]
- Classification: [masking fallback slop | grounded fallback]
- Escalation Status: [none | raised to active plan or handoff | no escalation]

Remaining Risks:
- [none or short deferred item]
```

## Scenario Examples

**Good:** The user says `continue` after tests already lock behavior and the next smell pass is clear. Continue with the next bounded cleanup pass.

**Good:** The user narrows the scope to a specific file after planning. Keep the regression-tests-first workflow, but apply the new scope locally.

**Bad:** Start rewriting architecture before protecting behavior with tests.

**Bad:** Collapse multiple smell categories into one large refactor with no intermediate verification.

**Bad:** Keep a `fallback if it fails` branch that silently defaults after a swallowed error instead of fixing the root cause or making failure explicit.

**Good:** A version-specific compatibility shim is narrow, documented, preserves error evidence, has primary and fallback regression tests, and is reported as a grounded compatibility/fail-safe fallback.
