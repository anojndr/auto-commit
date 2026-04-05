import { describe, expect, it } from "vitest";

import {
  formatConventionalCommit,
  isConventionalCommitMessage,
} from "../src/conventionalCommit.js";

describe("formatConventionalCommit", () => {
  it("formats a valid conventional commit with body and footers", () => {
    const message = formatConventionalCommit({
      type: "feat",
      scope: "cli",
      description: "generate commit messages from staged changes",
      body: "Use Gemma 4 31B to summarize the staged diff.",
      breaking: true,
      footers: [
        {
          token: "Refs",
          value: "#42",
        },
      ],
      breakingChange: "the CLI now requires a git repository path",
    });

    expect(message).toBe(
      [
        "feat(cli)!: generate commit messages from staged changes",
        "",
        "Use Gemma 4 31B to summarize the staged diff.",
        "",
        "BREAKING CHANGE: the CLI now requires a git repository path",
        "Refs: #42",
      ].join("\n"),
    );
    expect(isConventionalCommitMessage(message)).toBe(true);
  });

  it("rejects malformed commit content", () => {
    expect(() =>
      formatConventionalCommit({
        type: "feat",
        scope: "cli)",
        description: "bad scope",
      }),
    ).toThrow(/scope/i);
  });

  it("detects invalid commit headers", () => {
    expect(isConventionalCommitMessage("not a valid commit")).toBe(false);
  });

  it("allows breaking changes to be indicated with ! and no BREAKING CHANGE footer", () => {
    const message = formatConventionalCommit({
      type: "feat",
      description: "send an email to the customer when a product is shipped",
      breaking: true,
    });

    expect(message).toBe("feat!: send an email to the customer when a product is shipped");
    expect(isConventionalCommitMessage(message)).toBe(true);
  });

  it("accepts the specification examples verbatim", () => {
    expect(
      isConventionalCommitMessage(
        [
          "fix: prevent racing of requests",
          "",
          "Introduce a request id and a reference to latest request. Dismiss",
          "incoming responses other than from latest request.",
          "",
          "Remove timeouts which were used to mitigate the racing issue but are",
          "obsolete now.",
          "",
          "Reviewed-by: Z",
          "Refs: #123",
        ].join("\n"),
      ),
    ).toBe(true);

    expect(
      isConventionalCommitMessage(
        [
          "feat!: drop support for Node 6",
          "",
          "BREAKING CHANGE: use JavaScript features not available in Node 6.",
        ].join("\n"),
      ),
    ).toBe(true);

    expect(
      isConventionalCommitMessage(
        [
          "feat: allow provided config object to extend other configs",
          "",
          "BREAKING CHANGE: `extends` key in config file is now used for extending other config files",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  it("supports additional commit types and multiline footer values", () => {
    const message = formatConventionalCommit({
      type: "deps",
      description: "upgrade runtime packages",
      footers: [
        {
          token: "Refs",
          value: "#123\n#456",
        },
      ],
    });

    expect(message).toBe(
      [
        "deps: upgrade runtime packages",
        "",
        "Refs: #123",
        "#456",
      ].join("\n"),
    );
    expect(isConventionalCommitMessage(message)).toBe(true);
    expect(
      isConventionalCommitMessage(
        [
          "feat: change environment precedence",
          "",
          "BREAKING-CHANGE: environment variables now take precedence over config files",
          "Refs #123",
        ].join("\n"),
      ),
    ).toBe(true);
  });
});
