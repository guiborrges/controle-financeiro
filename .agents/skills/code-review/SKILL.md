---
name: code-review
description: "Run a comprehensive code review"
---

# Code Review Skill

Conduct a thorough code review for quality, security, and maintainability with severity-rated feedback.

## When to Use

This skill activates when:
- User requests "review this code", "code review"
- Before merging a pull request
- After implementing a major feature
- User wants quality assessment

When native subagents are available and the review is large or independent enough to benefit from parallelism, use two bounded lanes. Otherwise perform the two perspectives sequentially in the same conversation. Keep the ownership and final synthesis rules identical:

1. **Identify Changes**
   - Run `git diff` to find changed files
   - Determine scope of review (specific files or entire PR)

2. **Run Review Perspectives**
   - **`code-reviewer` lane** - owns spec compliance, security, code quality, performance, and maintainability findings
   - **`architect` lane** - owns the devil's-advocate / design-tradeoff perspective
   - Native subagents may run the lanes in parallel; same-conversation review should run them as two explicit passes

3. **Review Categories**
   - **Security** - Hardcoded secrets, injection risks, XSS, CSRF
   - **Code Quality** - Function size, complexity, nesting depth
   - **Performance** - Algorithm efficiency, N+1 queries, caching
   - **Best Practices** - Naming, documentation, error handling
   - **Maintainability** - Duplication, coupling, testability

4. **Severity Rating**
   - **CRITICAL** - Security vulnerability (must fix before merge)
   - **HIGH** - Bug or major code smell (should fix before merge)
   - **MEDIUM** - Minor issue (fix when possible)
   - **LOW** - Style/suggestion (consider fixing)

5. **Architectural Status Contract**
   - **CLEAR** - No unresolved architectural blocker was found
   - **WATCH** - Non-blocking design/tradeoff concern that must appear in the final synthesis
   - **BLOCK** - Unresolved design concern that prevents a merge-ready verdict

6. **Specific Recommendations**
   - File:line locations for each issue
   - Concrete fix suggestions
   - Code examples where applicable

7. **Final Synthesis**
   - Combine the `code-reviewer` recommendation and the architect status into one final verdict
   - Deterministic merge gating rules:
     - If architect status is **BLOCK**, final recommendation is **REQUEST CHANGES**
     - Else if `code-reviewer` recommendation is **REQUEST CHANGES**, final recommendation is **REQUEST CHANGES**
     - Else if architect status is **WATCH**, final recommendation is **COMMENT**
     - Else final recommendation follows the `code-reviewer` lane
   - The final report must make architect blockers impossible to miss

## Review Lane Prompts

Code-reviewer perspective:

```text
CODE REVIEW TASK

Review code changes for quality, security, and maintainability.

This is the code/spec/security lane. Do not absorb architectural ownership.

Scope: [git diff or specific files]

Review Checklist:
- Security vulnerabilities (OWASP Top 10)
- Code quality (complexity, duplication)
- Performance issues (N+1, inefficient algorithms)
- Best practices (naming, documentation, error handling)
- Maintainability (coupling, testability)

Output: Code review report with:
- Files reviewed count
- Issues by severity (CRITICAL, HIGH, MEDIUM, LOW)
- Specific file:line locations
- Fix recommendations
- Approval recommendation (APPROVE / REQUEST CHANGES / COMMENT)"
```

Architect perspective:

```text
ARCHITECTURE / DEVIL'S-ADVOCATE REVIEW TASK

Review the same code changes from the architecture/tradeoff perspective.

Scope: [git diff or specific files]

Focus:
- System boundaries and interfaces
- Hidden coupling or long-term maintainability risks
- Tradeoff tension the main reviewer might miss
- Strongest counterargument against approving as-is

Output:
- Architectural Status: CLEAR / WATCH / BLOCK
- File:line evidence for each concern
- Concrete tradeoff or design recommendation"
```

Run both perspectives, in parallel only when independent native subagents are justified, then synthesize them with the deterministic rules above.

## Independent Validation (Optional)

An independent native reviewer may cross-check the primary review when the change is security-sensitive, architecturally complex, unfamiliar, or otherwise high-stakes.

### Protocol
1. **Form your OWN review FIRST** - Complete the review independently
2. **Cross-check for validation** - Compare findings with the independent native reviewer
3. **Critically evaluate** - Never blindly adopt external findings
4. **Graceful fallback** - If an independent reviewer is unavailable, complete the review with a second same-conversation pass and label the limitation

### When to Consult
- Security-sensitive code changes
- Complex architectural patterns
- Unfamiliar codebases or languages
- High-stakes production code

### When to Skip
- Simple refactoring
- Well-understood patterns
- Time-critical reviews
- Small, isolated changes

### Tool Usage
Do not invoke external advisor CLIs or create a second session solely for validation.

## Output Format

```
CODE REVIEW REPORT
==================

Files Reviewed: 8
Total Issues: 12
Architectural Status: WATCH

CRITICAL (0)
-----------
(none)

HIGH (0)
--------
(none)

MEDIUM (7)
----------
1. src/api/auth.ts:42
   Issue: Email normalization logic is duplicated instead of reusing the shared helper
   Risk: Validation rules can drift between authentication paths
   Fix: Route both paths through the shared normalization helper

2. src/components/UserProfile.tsx:89
   Issue: Derived permissions are recalculated on every render
   Risk: Avoidable work during profile refreshes
   Fix: Memoize the derived permissions list or compute it upstream

3. src/utils/validation.ts:15
   Issue: Form-layer and server-layer validation messages are defined separately
   Risk: User-facing validation guidance can become inconsistent
   Fix: Share one validation message helper across both call sites

LOW (5)
-------
...

ARCHITECTURE WATCHLIST
----------------------
- src/review/orchestrator.ts:88
  Concern: Review result synthesis relies on implicit ordering rather than an explicit blocker contract
  Status: WATCH
  Recommendation: Define deterministic merge gating before expanding reviewers

SYNTHESIS
---------
- code-reviewer recommendation: COMMENT
- architect status: WATCH
- final recommendation: COMMENT

RECOMMENDATION: COMMENT

Track WATCH concerns as explicit remaining risk; WATCH is non-blocking unless its evidence also establishes a delivery-blocking finding.
```

## Review Checklist

The `code-reviewer` lane checks:

### Security
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs sanitized
- [ ] SQL/NoSQL injection prevention
- [ ] XSS prevention (escaped outputs)
- [ ] CSRF protection on state-changing operations
- [ ] Authentication/authorization properly enforced

### Code Quality
- [ ] Functions < 50 lines (guideline)
- [ ] Cyclomatic complexity < 10
- [ ] No deeply nested code (> 4 levels)
- [ ] No duplicate logic (DRY principle)
- [ ] Clear, descriptive naming

### Performance
- [ ] No N+1 query patterns
- [ ] Appropriate caching where applicable
- [ ] Efficient algorithms (avoid O(n²) when O(n) possible)
- [ ] No unnecessary re-renders (React/Vue)

### Best Practices
- [ ] Error handling present and appropriate
- [ ] Logging at appropriate levels
- [ ] Documentation for public APIs
- [ ] Tests for critical paths
- [ ] No commented-out code

## Architect Lane Checklist

The `architect` lane checks:

- [ ] Boundary or interface changes are explicit
- [ ] New coupling/tradeoff risks are surfaced
- [ ] Long-horizon maintainability concerns are evidence-backed
- [ ] Architectural status is one of `CLEAR`, `WATCH`, or `BLOCK`
- [ ] Any `BLOCK` concern cites the reason merge-ready status should be withheld

## Approval Criteria

**APPROVE** - `code-reviewer` returns APPROVE and architect status is `CLEAR`
**REQUEST CHANGES** - `code-reviewer` returns REQUEST CHANGES or architect status is `BLOCK`
**COMMENT** - `code-reviewer` returns COMMENT with architect status `CLEAR`, architect status is `WATCH`, or only LOW/MEDIUM improvements remain


## Scenario Examples

**Good:** The user says `continue` after the workflow already has a clear next step. Continue the current branch of work instead of restarting or re-asking the same question.

**Good:** The user changes only the output shape or downstream delivery step (for example `make a PR`). Preserve earlier non-conflicting workflow constraints and apply the update locally.

**Bad:** The user says `continue`, and the workflow restarts discovery or stops before the missing verification/evidence is gathered.

## Workflow Boundary

`code-review` is read-only. It reports findings and a merge-readiness verdict; the
caller decides whether and how to implement fixes. A larger workflow may use the
report as its next planning input, but this skill does not start an execution loop
or promise automatic fixes.

## Best Practices

- **Review early** - Catch issues before they compound
- **Review often** - Small, frequent reviews better than huge ones
- **Address CRITICAL/HIGH first** - Fix security and bugs immediately
- **Consider context** - Some "issues" may be intentional trade-offs
- **Learn from reviews** - Use feedback to improve coding practices
