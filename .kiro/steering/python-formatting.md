# Python Formatting

All Python code in this repository MUST be formatted with **ruff**.

## Configuration

Use `ruff format` for formatting and `ruff check` for linting.

The `pyproject.toml` should include:

```toml
[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W"]
```

## Rules

- Run `ruff format .` before committing any Python file.
- Run `ruff check .` to verify no lint errors exist.
- CI/CD pipelines should fail if ruff check reports errors.
- Import sorting is handled by ruff (isort-compatible with `I` rule).
