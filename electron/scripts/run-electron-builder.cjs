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
const npmExecPath = process.env.npm_execpath;

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

function runNpm(args, cwd) {
  if (typeof npmExecPath === "string" && npmExecPath.endsWith(".js")) {
    return spawnSync(process.execPath, [npmExecPath, ...args], {
      cwd,
      stdio: "inherit",
      env: sharedEnv,
    });
  }

  if (process.platform === "win32") {
    const comspec = process.env.comspec || "cmd.exe";
    return spawnSync(comspec, ["/d", "/s", "/c", "npm", ...args], {
      cwd,
      stdio: "inherit",
      env: sharedEnv,
    });
  }

  return spawnSync("npm", args, {
    cwd,
    stdio: "inherit",
    env: sharedEnv,
  });
}

try {
  cpSync(join(projectDir, "dist"), join(tempProjectDir, "dist"), { recursive: true });
  if (existsSync(join(projectDir, "resources"))) {
    cpSync(join(projectDir, "resources"), join(tempProjectDir, "resources"), { recursive: true });
  }
  cpSync(join(projectDir, "package.json"), join(tempProjectDir, "package.json"));
  cpSync(join(projectDir, "electron-builder.yml"), join(tempProjectDir, "electron-builder.yml"));

  const installResult = runNpm(["install", "--omit=dev", "--no-package-lock"], tempProjectDir);

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
