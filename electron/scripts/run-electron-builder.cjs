const { spawnSync } = require("node:child_process");
const { cpSync, existsSync, mkdirSync, rmSync } = require("node:fs");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const builderCli = require.resolve("electron-builder/out/cli/cli.js");
const projectDir = process.cwd();
const tempProjectDir = mkdtempSync(join(tmpdir(), "autuber-electron-builder-"));
const tempReleaseDir = join(tempProjectDir, "release");
const sourceReleaseDir = join(projectDir, "release");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const nodeOptions = process.env.NODE_OPTIONS?.includes("--no-deprecation")
  ? process.env.NODE_OPTIONS
  : process.env.NODE_OPTIONS
    ? `${process.env.NODE_OPTIONS} --no-deprecation`
    : "--no-deprecation";

const sharedEnv = {
  ...process.env,
  NODE_NO_WARNINGS: "1",
  NODE_OPTIONS: nodeOptions,
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
};
delete sharedEnv.npm_config_recursive;
delete sharedEnv.NPM_CONFIG_RECURSIVE;

try {
  cpSync(join(projectDir, "dist"), join(tempProjectDir, "dist"), { recursive: true });
  if (existsSync(join(projectDir, "resources"))) {
    cpSync(join(projectDir, "resources"), join(tempProjectDir, "resources"), { recursive: true });
  }
  cpSync(join(projectDir, "package.json"), join(tempProjectDir, "package.json"));
  cpSync(join(projectDir, "electron-builder.yml"), join(tempProjectDir, "electron-builder.yml"));

  const installResult = spawnSync(
    npmCommand,
    ["install", "--omit=dev", "--no-package-lock"],
    {
      cwd: tempProjectDir,
      stdio: "inherit",
      env: sharedEnv,
    },
  );

  if (installResult.error) {
    throw installResult.error;
  }

  if ((installResult.status ?? 1) !== 0) {
    process.exit(installResult.status ?? 1);
  }

  const buildResult = spawnSync(process.execPath, [builderCli], {
    cwd: tempProjectDir,
    stdio: "inherit",
    env: sharedEnv,
  });

  if (buildResult.error) {
    throw buildResult.error;
  }

  if ((buildResult.status ?? 1) !== 0) {
    process.exit(buildResult.status ?? 1);
  }

  rmSync(sourceReleaseDir, { recursive: true, force: true });
  mkdirSync(sourceReleaseDir, { recursive: true });
  cpSync(tempReleaseDir, sourceReleaseDir, { recursive: true });
} finally {
  rmSync(tempProjectDir, { recursive: true, force: true });
}
process.exit(0);
