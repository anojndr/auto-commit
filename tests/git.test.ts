import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { collectGitContext, commitWithMessage } from "../src/git.js";

const execFileAsync = promisify(execFile);
const createdDirectories: string[] = [];

async function createRepository() {
  const repoDir = await mkdtemp(join(tmpdir(), "auto-commit-test-"));
  createdDirectories.push(repoDir);

  await execFileAsync("git", ["init"], { cwd: repoDir });
  await execFileAsync("git", ["config", "user.name", "Auto Commit Test"], { cwd: repoDir });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: repoDir });

  await writeFile(join(repoDir, "README.md"), "# Auto Commit\n", "utf8");
  await execFileAsync("git", ["add", "README.md"], { cwd: repoDir });
  await execFileAsync("git", ["commit", "-m", "chore: initial commit"], { cwd: repoDir });

  return repoDir;
}

afterEach(async () => {
  await Promise.all(
    createdDirectories.splice(0).map(async (directory) => {
      await execFileAsync("rm", ["-rf", directory]);
    }),
  );
});

describe("collectGitContext", () => {
  it("returns staged git context", async () => {
    const repoDir = await createRepository();

    await writeFile(join(repoDir, "README.md"), "# Auto Commit\n\nAdds more detail.\n", "utf8");
    await execFileAsync("git", ["add", "README.md"], { cwd: repoDir });

    const context = await collectGitContext(repoDir);

    expect(context.statusSummary).toContain("M  README.md");
    expect(context.diffStat).toContain("README.md");
    expect(context.diff).toContain("+Adds more detail.");
  });

  it("returns the full staged diff without truncation", async () => {
    const repoDir = await createRepository();
    const largeContent = `${Array.from({ length: 4000 }, (_, index) => `line-${index}-${"x".repeat(24)}`).join("\n")}\nEND-OF-DIFF-MARKER\n`;

    await writeFile(join(repoDir, "large.txt"), largeContent, "utf8");
    await execFileAsync("git", ["add", "large.txt"], { cwd: repoDir });

    const context = await collectGitContext(repoDir);

    expect(context.diff).toContain("END-OF-DIFF-MARKER");
    expect(context.diff).not.toContain("[diff truncated after");
  });

  it("throws when there are no staged changes", async () => {
    const repoDir = await createRepository();

    await expect(collectGitContext(repoDir)).rejects.toThrow(/no staged changes/i);
  });
});

describe("commitWithMessage", () => {
  it("creates a commit with a multi-line message", async () => {
    const repoDir = await createRepository();

    await writeFile(join(repoDir, "README.md"), "# Auto Commit\n\nAdds more detail.\n", "utf8");
    await execFileAsync("git", ["add", "README.md"], { cwd: repoDir });

    const message = [
      "docs: update readme",
      "",
      "Explain how the generated commit tool works.",
      "",
      "Refs: #7",
    ].join("\n");

    await commitWithMessage(repoDir, message);

    const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%B"], {
      cwd: repoDir,
    });

    expect(stdout.trimEnd()).toBe(message);
    expect(await readFile(join(repoDir, "README.md"), "utf8")).toContain("Adds more detail.");
  });

  it("creates a commit with the configured author identity", async () => {
    const repoDir = await createRepository();

    await execFileAsync("git", ["config", "--unset", "user.name"], { cwd: repoDir });
    await execFileAsync("git", ["config", "--unset", "user.email"], { cwd: repoDir });

    await writeFile(join(repoDir, "README.md"), "# Auto Commit\n\nUses configured author.\n", "utf8");
    await execFileAsync("git", ["add", "README.md"], { cwd: repoDir });

    await commitWithMessage(repoDir, "chore: use configured author", {
      author: {
        name: "Auto Commit Bot",
        email: "bot@example.com",
      },
    });

    const { stdout } = await execFileAsync("git", ["log", "-1", "--pretty=%an <%ae>%n%cn <%ce>%n%B"], {
      cwd: repoDir,
    });

    const [authorLine, committerLine, ...messageLines] = stdout.trimEnd().split("\n");

    expect(authorLine).toBe("Auto Commit Bot <bot@example.com>");
    expect(committerLine).toBe("Auto Commit Bot <bot@example.com>");
    expect(messageLines.join("\n")).toBe("chore: use configured author");
  });
});
