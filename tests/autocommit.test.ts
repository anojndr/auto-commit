import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildAutocommitArgv } from "../src/autocommit.js";

const TESTS_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(TESTS_DIRECTORY, "..");

describe("buildAutocommitArgv", () => {
  it("uses commit mode against the current directory and stages changes", () => {
    expect(buildAutocommitArgv([])).toEqual(["commit", "--cwd", ".", "--add"]);
  });

  it("forwards additional CLI arguments after the preset flags", () => {
    expect(buildAutocommitArgv(["--model", "gemini-2.5-pro"])).toEqual([
      "commit",
      "--cwd",
      ".",
      "--add",
      "--model",
      "gemini-2.5-pro",
    ]);
  });
});

describe("package bin aliases", () => {
  it("publishes the autocommit alias", async () => {
    const packageJson = JSON.parse(await readFile(resolve(REPOSITORY_ROOT, "package.json"), "utf8")) as {
      bin?: Record<string, string>;
    };

    expect(packageJson.bin?.autocommit).toBe("./dist/autocommit.js");
  });
});
