# Commands

## Workspace

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`

## Electron Package

- `pnpm --filter @autuber/electron dev`
- `pnpm --filter @autuber/electron build`
- `pnpm --filter @autuber/electron lint`
- `pnpm --filter @autuber/electron test`
- `pnpm --filter @autuber/electron test:model-smoke`

## Release

- `git tag vX.Y.Z`
- `git push origin vX.Y.Z`

## Existing Manual Utilities

- `bash electron/tests/standalone/model-provider-audio-curl.sh [path-to-mp4]`
- `pnpm --filter @autuber/electron exec tsx tests/standalone/obs-vacancy-e2e.ts "<scene-name>" "<source-name>"`
