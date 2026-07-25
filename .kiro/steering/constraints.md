# Constraints

## Ownership

- This file MUST NOT be modified by any agent. Only a human may edit it.
- Agents MUST only read this file and MAY suggest changes when explicitly asked by the user.

## Git

- Agents MUST NOT execute `git push` under any circumstances. Only a human may push to remote.

## Language

- Anything the end user (client, restaurant owner, driver) can see or read directly MUST be written in Spanish. This includes UI text, labels, buttons, error messages shown to the user, notification messages, and menu content (categories, products, sections).
- Anything the end user does NOT see MUST be written in English. This includes code, comments, variable/function names, database schema (tables/fields), API field names, commit messages, and internal documentation (requirements, design, tasks).
- User-facing content MUST NOT be written in English, and internal/technical artifacts MUST NOT be written in Spanish.
