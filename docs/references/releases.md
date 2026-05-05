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
- installs `electron/` packaging dependencies with npm for the desktop packaging step
- builds Linux and Windows artifacts
- uploads the generated installer/package files
- publishes or updates the matching GitHub release

The release drafter workflow keeps an evolving draft release body based on merged pull requests and labels.

## Artifact Expectations

Current packaging targets:

- Linux `AppImage`
- Windows portable build

If new platforms are added, update both `electron/electron-builder.yml` and the GitHub workflow.

## Current Packaging Note

Local `pnpm build` is still affected by an `electron-builder` pnpm dependency-collector issue in this environment. The GitHub release workflow uses an npm install inside `electron/` for packaging so tagged releases are not blocked on that upstream collector path.

## Suggested Labels For Release Notes

- `feature`
- `fix`
- `docs`
- `design`
- `chore`

These labels map into release note sections through `.github/release-drafter.yml`.
