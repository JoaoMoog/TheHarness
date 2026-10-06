---
applyTo: ".github/workflows/**,.gitignore,.gitattributes"
description: Preserve local Git work and user-managed publication.
---

# Git workflow

Use the current checkout and preserve staged/unstaged user changes. Do not
stage, commit, push, create PRs, queue pipelines or deploy. Finish with the diff
and actual validation evidence. The user handles publication manually.
Never format and re-stage files from a hook. Pre-commit hooks may inspect the
index when the user commits; they must not modify it.
Destructive Git operations need explicit authorization identifying the target.
