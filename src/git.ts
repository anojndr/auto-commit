import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { GitAuthorConfig } from "./config.js";
import type { GitContext } from "./geminiCommitGenerator.js";

const execFileAsync = promisify(execFile);

export interface CommitWithMessageOptions {
  author?: GitAuthorConfig;
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 100 * 1024 * 1024,
    });

    return stdout.trimEnd();
  } catch (error) {
    const execError = error as Error & { stderr?: string };
    const details = execError.stderr?.trim() || execError.message;
    throw new Error(`git ${args.join(" ")} failed: ${details}`);
  }
}

export async function collectGitContext(
  cwd: string,
  options: { autoStage?: boolean } = {},
): Promise<GitContext> {
  await runGit(cwd, ["rev-parse", "--show-toplevel"]);

  if (options.autoStage) {
    await runGit(cwd, ["add", "--all"]);
  }

  const stagedFiles = await runGit(cwd, ["diff", "--cached", "--name-only"]);

  if (!stagedFiles.trim()) {
    throw new Error("No staged changes found. Stage files first or pass --add.");
  }

  const [statusSummary, diffStat, diff] = await Promise.all([
    runGit(cwd, ["status", "--short"]),
    runGit(cwd, ["diff", "--cached", "--stat", "--no-color"]),
    runGit(cwd, ["diff", "--cached", "--no-color", "--unified=3"]),
  ]);

  return {
    statusSummary,
    diffStat,
    diff,
  };
}

export async function commitWithMessage(
  cwd: string,
  message: string,
  options: CommitWithMessageOptions = {},
): Promise<void> {
  if (!message.trim()) {
    throw new Error("Cannot create a git commit with an empty message.");
  }

  const tempDirectory = await mkdtemp(join(tmpdir(), "auto-commit-message-"));
  const commitFile = join(tempDirectory, "COMMIT_EDITMSG");

  try {
    await writeFile(commitFile, message, "utf8");
    const args = ["-c", "commit.cleanup=verbatim"];

    if (options.author) {
      args.push("-c", `user.name=${options.author.name}`, "-c", `user.email=${options.author.email}`);
    }

    args.push("commit");

    if (options.author) {
      args.push("--author", `${options.author.name} <${options.author.email}>`);
    }

    args.push("--file", commitFile);

    await runGit(cwd, args);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
