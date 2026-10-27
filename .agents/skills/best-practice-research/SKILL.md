---
name: best-practice-research
description: "Conduct bounded, source-backed best-practice research using official external evidence and repo-local facts"
---

# Best-Practice Research

Produce a cited, reusable answer about current guidance, standards, upstream
behavior, or version-aware practice. Keep external evidence, repo-local facts, and
the resulting recommendation visibly separate.

## Use when

- The user asks for best practices, official recommendations, standards, or current guidance.
- A plan needs authoritative external evidence for an already chosen technology.
- Version, release, API, lifecycle, migration, or safety behavior may have changed.

## Do not use when

- The answer is fully repo-local; inspect it directly with `rg` and `exec_command`.
- The task is dependency adoption, replacement, upgrade, or comparison; treat that as a separate decision analysis.
- The research output itself must pass a repeated validator; use `autoresearch`.
- The user only wants implementation against already-grounded requirements.

## Source and tool policy

1. Use `rg`, `exec_command`, and repository files for local facts, versions, and constraints.
2. Use `web__run` for current external evidence. Prefer official documentation,
   upstream source, release notes, standards, and maintainer guidance.
3. Include a direct source URL for every material external claim.
4. Record version/date context and flag stale, conflicting, or version-mismatched evidence.
5. Do not use an external model advisor as an evidence source.
6. Gather the smallest evidence set that can support the recommendation.

## Workflow

1. Classify the question as conceptual, implementation, migration/version,
   standards/compliance, or mixed local and external research.
2. Inspect repo-local facts when they affect the answer.
3. Retrieve current external evidence when correctness depends on it.
4. Synthesize the recommendation while separating evidence, inference, and unknowns.
5. State what the research does not decide and hand off only the evidence needed by
   the caller or `plan --consensus`.

Do not silently turn research into architecture or implementation authority. A
research result can constrain a plan, but the plan owns the final decision.

## Output contract

```markdown
## Best-Practice Research: <question>

### Direct Recommendation

### Evidence Used
- Repo-local: <path or command> — <fact>
- Official/upstream: <URL> — <fact>

### Version / Date Context

### Evidence vs Inference
- Evidence:
- Inference:
- Unknown:

### Boundaries / Non-goals

### Handoff
<planning or implementation implications>
```

## Stop rules

- Stop when the recommendation is source-backed and reusable by the caller.
- Stop when remaining research would only polish wording rather than change the decision.
- Stop and report a blocker when authoritative evidence is unavailable or contradictory.
- Do not create hidden state, a research ledger, a runtime artifact directory, or a second session narrative.

Research task:
{{ARGUMENTS}}
