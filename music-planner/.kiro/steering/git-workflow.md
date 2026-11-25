# Git Workflow

Applies to spec-driven work (requirements, design and tasks under `.kiro/specs/<spec-name>/`).

## Branch per spec

- Before the first task of a spec runs, create a new branch from the branch that is currently checked out. Do not switch to `main` first.
- Name the branch `<type>/<spec-name>`, where `<type>` is `feat` for feature specs, `fix` for bugfix specs and `chore` for anything else. Example: `feat/edit-service-modal`.
- If the branch already exists, check it out and continue. Do not recreate it.
- Immediately after creating the branch, commit the spec files (`requirements.md` or `bugfix.md`, `design.md`, `tasks.md` and `.config.kiro`) as the first commit, for example `docs(spec): add edit-service-modal spec`.
- Do not commit unrelated changes that were already in the working tree. Stage files by name.

## Commit after every task

- When a task finishes (tests for that task pass), commit its changes before the next task starts. One task, one commit.
- Include the updated `tasks.md` status in the commit.
- Parent tasks that complete only by their children completing do not need a separate commit.
- If a task fails, do not commit its partial work. Report the failure instead.
- Stage specific files, not `git add -A` or `git add .`.
- Never push, force-push, amend, rebase, or modify git config unless the user asks.

## Commit messages: Conventional Commits

Format: `<type>(<scope>): <description>`

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `style`, `build`, `ci`, `chore`.
- Scope is optional. Use the area touched, such as `api`, `app`, `migrations`, `spec`, or a feature name.
- Description: imperative mood, lower case, no trailing period, 72 characters or fewer.
- Choose the type from what the task changes: new behavior is `feat`, a bug correction is `fix`, tests only is `test`, spec documents only is `docs`.
- Add a body when it helps, separated by a blank line, explaining why. Reference the spec and task, for example `Spec: edit-service-modal, task 4.1`.
- Mark breaking changes with `!` after the type or scope and a `BREAKING CHANGE:` footer.
- A migration that changes stored data should say so in the body.

Examples:

- `docs(spec): add sunday-services-right-column spec`
- `feat(app): place sunday services in the right column`
- `test(app): add property tests for buildServiceRows`
- `fix(api): convert schedule dates to the congregation timezone`
