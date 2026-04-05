import { describe, expect, it, vi } from "vitest";

import { DEFAULT_GEMMA_MODEL } from "../src/geminiCommitGenerator.js";
import { runCli } from "../src/cli.js";

function createWritableBuffer() {
  let value = "";

  return {
    stream: {
      write(chunk: string) {
        value += chunk;
        return true;
      },
    },
    read() {
      return value;
    },
  };
}

describe("runCli", () => {
  it("prints the generated commit message in generate mode", async () => {
    const stdout = createWritableBuffer();
    const stderr = createWritableBuffer();
    const generate = vi.fn().mockResolvedValue("feat: add automated commit generation");
    const collectGitContext = vi.fn().mockResolvedValue({
      statusSummary: "M  src/cli.ts",
      diffStat: " src/cli.ts | 10 ++++++++++",
      diff: "diff --git a/src/cli.ts b/src/cli.ts",
    });
    const commitWithMessage = vi.fn();

    const exitCode = await runCli(["generate"], {
      cwd: "/repo",
      stdout: stdout.stream,
      stderr: stderr.stream,
      loadConfig: () => ({
        apiKey: "test-key",
        model: DEFAULT_GEMMA_MODEL,
      }),
      createGenerator: () => ({
        generate,
      }),
      collectGitContext,
      commitWithMessage,
    });

    expect(exitCode).toBe(0);
    expect(stdout.read()).toContain("feat: add automated commit generation");
    expect(commitWithMessage).not.toHaveBeenCalled();
  });

  it("creates a git commit in commit mode", async () => {
    const stdout = createWritableBuffer();
    const stderr = createWritableBuffer();
    const generate = vi.fn().mockResolvedValue("fix(cli): handle empty staged diff");
    const collectGitContext = vi.fn().mockResolvedValue({
      statusSummary: "M  src/cli.ts",
      diffStat: " src/cli.ts | 10 ++++++++++",
      diff: "diff --git a/src/cli.ts b/src/cli.ts",
    });
    const commitWithMessage = vi.fn().mockResolvedValue(undefined);

    const exitCode = await runCli(["commit", "--add"], {
      cwd: "/repo",
      stdout: stdout.stream,
      stderr: stderr.stream,
      loadConfig: () => ({
        apiKey: "test-key",
        model: DEFAULT_GEMMA_MODEL,
      }),
      createGenerator: () => ({
        generate,
      }),
      collectGitContext,
      commitWithMessage,
    });

    expect(exitCode).toBe(0);
    expect(collectGitContext).toHaveBeenCalledWith("/repo", { autoStage: true });
    expect(commitWithMessage).toHaveBeenCalledWith("/repo", "fix(cli): handle empty staged diff");
  });
});
