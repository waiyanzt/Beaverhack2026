# Product Completeness Standard

## Rule

Every feature must be manageable in practice, not just present in code.

A feature is incomplete if it only adds hidden capability without a supported way for users, operators, or maintainers to configure, review, verify, or operate it.

---

## Required Management Path

If a feature adds backend, service, automation, or operational capability, it must include at least one realistic management path.

Valid management paths include:

- renderer UI
- status panel
- settings panel
- logs view
- CLI command
- documented local API
- documented config file
- documented operational workflow

Hidden service logic alone is not enough.

---

## Examples

### Complete

A model-provider feature includes:

- provider service
- typed config
- schema validation
- secure API-key storage
- settings UI
- connection test button
- failure logs
- docs update

### Incomplete

A model-provider feature only adds:

- provider service file
- hardcoded API call
- no settings
- no connection test
- no docs
- no logs

---

## Beaverhack2026 Application

For this project, complete features should generally include:

- typed service implementation
- typed IPC/API contract
- Zod validation
- user-facing status or management UI
- structured logs
- safe defaults
- tests for non-trivial logic
- updated docs

---

## Feature-Specific Expectations

### Model Providers

Must include:

- provider config
- secret handling
- health check
- provider selection path
- failure reporting
- fallback behavior if configured

### OBS Integration

Must include:

- connection status
- connect/disconnect controls
- error state
- current scene visibility
- confirmation flow for risky actions

### VTube Studio Integration

Must include:

- connection status
- authentication flow
- hotkey list visibility
- manual hotkey test path
- action logs

### Capture

Must include:

- user toggles
- permission handling
- capture status
- privacy-safe defaults
- clear indication of what is being captured

### Automation

Must include:

- start/stop control
- autonomy level setting
- recent action history
- blocked action visibility
- cooldown behavior
- safe mode