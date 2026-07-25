# AGENTS.md

This repository is designed for long-running coding-agent work. The goal is not to maximize raw code output.
The goal is to leave the repo in a state where the next session can continue without guessing.

## Project Overview

Tragón — Platform that automates order taking for restaurants.
Django 5.2.x + PostgreSQL + Astro 7.x + Django Channels + Redis + S3 + Docker.

Authentication: JWT (Simple JWT) for restaurant owners. No auth for clients placing orders.
Formatting: ruff (Python).

## Startup Workflow

Before writing code:

1. Confirm the working directory with `pwd`.
2. Read `PROGRESS.md` for the latest verified state and next step.
3. Read `ARCHITECTURE.md` for the high-level design and rationale behind the current implementation.
4. Read all technical boundaries in `CONSTRAINTS.md`.
5. Review recent commits with `git log --oneline -5`.
6. Run `./init.sh`.

If baseline verification is already failing, fix that first. Do not stack new feature work on top of a broken starting state.

## Working Rules

- Work on one feature at a time.
- Do not mark a feature complete just because code was added.
- Keep changes within the selected feature scope unless a blocker forces a narrow supporting fix.
- Do not silently change verification rules during implementation.
- Prefer durable repo artifacts over chat summaries.

## Required Artifacts

- `PROGRESS.md`: session log and current verified status
- `ARCHITECTURE.md`: high-level design and rationale behind the current implementation
- `CONSTRAINTS.md`: project-specific technical boundaries and verification loops
- `init.sh`: standard startup and verification path

## End Of Session

Before ending a session:

1. Update `PROGRESS.md`.
2. Record any unresolved risk or blocker.
3. Commit with a descriptive message once the work is in a safe state.
4. Leave the repo clean enough for the next session to run `./init.sh` immediately.

## Version Control & Atomic Commits

- **Trigger:** Create a local Git commit immediately after a single file or specific feature passes all verification loops.
- **Isolation:** Stage files selectively using `git add <file_path>`. Never use `git add .` unless all changes belong to the same atomic feature.
- **Format:** Use lowercase conventional commits. Examples: `feat(backend): add restaurant model`, `fix(frontend): resolve cart state`.

### Branch Convention

Every task or group of related tasks lives on its own branch. Branch names follow this format:

```
feat/TRA-<NN>/<short-description>
fix/TRA-<NN>/<short-description>
test/TRA-<NN>/<short-description>
```

Where `<NN>` is the zero-padded task number from `tasks.md` (e.g. `01`, `02`, `07`). Use the prefix that matches the nature of the work:
- `feat/` — new functionality
- `fix/` — bug fix or correction
- `test/` — property tests or test-only tasks

**Rules:**
- Create the branch before writing any code for that task: `git checkout -b feat/TRA-01/backend-setup`.
- One branch per top-level task (e.g. task 1, task 2, task 4). Sub-tasks (2.1, 2.2, ...) all live on the same branch as their parent.
- Merge to `main` only after the task's verification loop passes (tests green, no lint errors).
- Delete the branch locally after merging: `git branch -d feat/TRA-01/backend-setup`.
- Never push directly to `main`.

## Output Optimization

- Do not explain code philosophy or architectural choices.
- Output only the specific line modifications or newly created files.
- If a change breaks any verification loop, roll back the files using Git immediately.
