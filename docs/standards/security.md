# Security Standard

Security expectations for AuTuber are defined in [AGENTS.md](../../AGENTS.md) and expanded in [SPEC.md](../../SPEC.md).

Key rules:

- renderer code uses the preload bridge only
- secrets stay in the main process
- privileged calls validate inputs at runtime
