import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadRuntimeConfig } from "../src/config.js";
import { loadCliEnvironment, resolveDotEnvPaths } from "../src/environment.js";

const createdDirectories: string[] = [];

async function createTempDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  createdDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    createdDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("resolveDotEnvPaths", () => {
  it("includes the current directory and the tool root .env paths", () => {
    const paths = resolveDotEnvPaths({
      cwd: "/work/repo",
      moduleUrl: "file:///home/sweetpotet/auto-commit/dist/cli.js",
    });

    expect(paths).toEqual([
      "/work/repo/.env",
      "/home/sweetpotet/auto-commit/.env",
    ]);
  });
});

describe("loadCliEnvironment", () => {
  it("loads GEMINI_API_KEY from the tool directory even when invoked elsewhere", async () => {
    const invocationCwd = await createTempDirectory("auto-commit-cwd-");
    const toolRoot = await createTempDirectory("auto-commit-tool-");

    await writeFile(join(toolRoot, ".env"), "GEMINI_API_KEY=tool-key\n", "utf8");

    const env: NodeJS.ProcessEnv = {};

    loadCliEnvironment({
      cwd: invocationCwd,
      env,
      moduleUrl: `file://${join(toolRoot, "dist", "cli.js")}`,
    });

    expect(loadRuntimeConfig(env).apiKey).toBe("tool-key");
  });

  it("loads the optional git author identity from .env", async () => {
    const invocationCwd = await createTempDirectory("auto-commit-cwd-");
    const toolRoot = await createTempDirectory("auto-commit-tool-");

    await writeFile(
      join(toolRoot, ".env"),
      ["GEMINI_API_KEY=tool-key", "GIT_AUTHOR_NAME=Auto Commit Bot", "GIT_AUTHOR_EMAIL=bot@example.com"].join("\n"),
      "utf8",
    );

    const env: NodeJS.ProcessEnv = {};

    loadCliEnvironment({
      cwd: invocationCwd,
      env,
      moduleUrl: `file://${join(toolRoot, "dist", "cli.js")}`,
    });

    expect(loadRuntimeConfig(env).gitAuthor).toEqual({
      name: "Auto Commit Bot",
      email: "bot@example.com",
    });
  });
});

describe("loadRuntimeConfig", () => {
  it("requires both git author variables when either one is set", () => {
    expect(() =>
      loadRuntimeConfig({
        GEMINI_API_KEY: "tool-key",
        GIT_AUTHOR_NAME: "Auto Commit Bot",
      }),
    ).toThrow(/GIT_AUTHOR_NAME and GIT_AUTHOR_EMAIL/i);
  });
});
