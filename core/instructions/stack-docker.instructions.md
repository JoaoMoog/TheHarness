---
applyTo: "**/Dockerfile*,**/*.dockerfile,**/docker-compose*.yml,**/docker-compose*.yaml,**/compose*.yml,**/compose*.yaml,**/.dockerignore"
description: Container image and compose conventions. Activates only in repositories that contain Docker files.
---

# Docker

## Image

Pin the base image to a specific version, never to a floating latest tag. Use
multi-stage builds so compilers and dev dependencies never reach the final
image.

Order layers from least to most frequently changed: dependency manifests and
install first, application source last. Copying the whole context before
installing dependencies invalidates the cache on every edit.

Use a dockerignore file. Without it the build context includes the git
directory, installed packages, and whatever else is lying around.

## Runtime

Run as a non-root user, declared after the install steps.

Never bake a secret into an image - not in an environment variable, not in a
build step, not in a layer you delete afterwards, because the layer is still in
the history. Use build secrets or inject at runtime.

Define a healthcheck so the orchestrator knows the difference between running
and working.

Use the exec form for the entrypoint and command so the process receives signals
and can shut down cleanly.

## Compose

Compose files are for local development. Do not put production credentials in
one, and do not let it become the production deployment description by accident.

Name volumes explicitly. Anonymous volumes accumulate silently until a disk
fills.
