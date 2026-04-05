import { describe, expect, it, vi } from "vitest";

import { CONVENTIONAL_COMMITS_V1_0_0_SPECIFICATION } from "../src/conventionalCommitsSpecification.js";
import { DEFAULT_GEMMA_MODEL, GeminiCommitGenerator } from "../src/geminiCommitGenerator.js";

describe("GeminiCommitGenerator", () => {
  it("requests structured output from Gemma 4 31B and formats the result", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "feat",
        scope: "cli",
        description: "generate conventional commits from staged changes",
        body: "Summarize git diff content and print a compliant message.",
        breaking: false,
        footers: [
          {
            token: "Refs",
            value: "#108",
          },
        ],
        breakingChange: null,
      }),
    });

    const generator = new GeminiCommitGenerator(
      {
        models: {
          generateContent,
        },
      },
      { model: DEFAULT_GEMMA_MODEL },
    );

    const message = await generator.generate({
      statusSummary: "M  src/cli.ts",
      diffStat: " src/cli.ts | 10 ++++++++++",
      diff: "diff --git a/src/cli.ts b/src/cli.ts",
    });

    expect(message).toBe(
      [
        "feat(cli): generate conventional commits from staged changes",
        "",
        "Summarize git diff content and print a compliant message.",
        "",
        "Refs: #108",
      ].join("\n"),
    );

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_GEMMA_MODEL,
        config: expect.objectContaining({
          responseMimeType: "application/json",
          responseJsonSchema: expect.any(Object),
          systemInstruction: expect.stringContaining(CONVENTIONAL_COMMITS_V1_0_0_SPECIFICATION),
        }),
      }),
    );
  });

  it("does not truncate the diff before sending it to Gemini", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "docs",
        scope: null,
        description: "capture the full staged diff in the prompt",
        body: null,
        breaking: false,
        footers: null,
        breakingChange: null,
      }),
    });
    const generator = new GeminiCommitGenerator(
      {
        models: {
          generateContent,
        },
      },
      { model: DEFAULT_GEMMA_MODEL },
    );
    const largeDiff = `diff --git a/README.md b/README.md\n${"x".repeat(70000)}END-MARKER`;

    await generator.generate({
      statusSummary: "M  README.md",
      diffStat: " README.md | 1 +",
      diff: largeDiff,
    });

    const request = generateContent.mock.calls[0]?.[0];

    expect(request.contents).toContain(largeDiff);
    expect(request.contents).not.toContain("[diff truncated after");
  });

  it("throws when Gemini returns an invalid payload", async () => {
    const generator = new GeminiCommitGenerator(
      {
        models: {
          generateContent: vi.fn().mockResolvedValue({ text: "{\"type\":\"feat\"}" }),
        },
      },
      { model: DEFAULT_GEMMA_MODEL },
    );

    await expect(
      generator.generate({
        statusSummary: "M  src/cli.ts",
        diffStat: " src/cli.ts | 10 ++++++++++",
        diff: "diff --git a/src/cli.ts b/src/cli.ts",
      }),
    ).rejects.toThrow(/structured commit payload/i);
  });
});
