# AGENTS.md

This repository is designed for long-running coding-agent work. The goal is not to maximize raw code output.
The goal is to leave the repo in a state where the next session can continue without guessing.

## Project Overview

Tragón — Platform that automates order taking for restaurants.
Django 5.2.x + PostgreSQL + Astro 7.x + Django Channels + Redis + S3 + Docker.

## Startup Workflow

Before writing code:

1. Confirm the working directory with `pwd`.
2. Read `PROGRESS.md` for the latest verified state and next step.
3. Read `ARCHITECTURE.md` for the high-level design and rationale behind the current implementation.
4. Read all technical boundaries in `.kiro/steering/constraints.md`.
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
- `.kiro/steering/constraints.md`: project-specific technical boundaries
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

## Output Optimization

- Do not explain code philosophy or architectural choices.
- Output only the specific line modifications or newly created files.
- If a change breaks any verification loop, roll back the files using Git immediately.
