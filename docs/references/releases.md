# Releases

This repository now uses a tag-driven GitHub release flow.

## Release Strategy

- merge verified changes into the release branch
- bump versions intentionally
- create a semantic version tag such as `v0.2.0`
- push the tag
- let GitHub Actions build desktop artifacts and attach them to the release

## Release Checklist

1. Confirm `README.md`, `SPEC.md`, and relevant docs reflect the actual shipped behavior.
2. Run:

```bash
pnpm lint
pnpm test
pnpm build
```

3. Update versions in:

- `package.json`
- `electron/package.json`

4. Commit the release prep.
5. Create and push the tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## GitHub Automation

The release workflow in `.github/workflows/release.yml`:

- runs on version tags and manual dispatch
- installs workspace dependencies with pnpm
- builds Linux and Windows artifacts
- uploads the generated installer/package files
- generates the GitHub release body from commit subjects instead of pull request metadata
- publishes or updates the matching GitHub release

## Artifact Expectations

Current packaging targets:

- Linux `AppImage`
- Windows portable build

If new platforms are added, update both `electron/electron-builder.yml` and the GitHub workflow.

## Current Packaging Note

`electron/scripts/run-electron-builder.cjs` now stages a temporary clean packaging directory, installs runtime dependencies there with npm, and runs `electron-builder` against that isolated tree. This avoids the workspace `pnpm` dependency-collector issue while keeping `pnpm build` as the standard root verification command.

## Release Notes

Published release notes are commit-based.

- For subsequent tags, the workflow lists non-merge commit subjects since the previous tag.
- For the first tag, the workflow lists non-merge commit subjects reachable from the tagged commit.
- Pull request titles and authors are not used.
