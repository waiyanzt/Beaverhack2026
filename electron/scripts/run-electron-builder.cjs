const { spawnSync } = require("node:child_process");

const builderCli = require.resolve("electron-builder/out/cli/cli.js");

const nodeOptions = process.env.NODE_OPTIONS?.includes("--no-deprecation")
  ? process.env.NODE_OPTIONS
  : process.env.NODE_OPTIONS
    ? `${process.env.NODE_OPTIONS} --no-deprecation`
    : "--no-deprecation";

const result = spawnSync(process.execPath, [builderCli], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_NO_WARNINGS: "1",
    NODE_OPTIONS: nodeOptions,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
