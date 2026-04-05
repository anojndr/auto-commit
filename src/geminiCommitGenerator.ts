import { formatConventionalCommit, type CommitDraft } from "./conventionalCommit.js";
import { CONVENTIONAL_COMMITS_V1_0_0_SPECIFICATION } from "./conventionalCommitsSpecification.js";

export const DEFAULT_GEMMA_MODEL = "gemma-4-31b-it";

export interface GitContext {
  statusSummary: string;
  diffStat: string;
  diff: string;
}

export interface GeminiClientLike {
  models: {
    generateContent(request: {
      model: string;
      contents: string;
      config?: {
        temperature?: number;
        responseMimeType?: string;
        responseJsonSchema?: unknown;
        systemInstruction?: string;
      };
    }): Promise<{
      text: string | undefined;
    }>;
  };
}

export interface GeminiCommitGeneratorOptions {
  model?: string;
}

const COMMIT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "scope", "description", "breaking", "body", "footers", "breakingChange"],
  properties: {
    type: {
      type: "string",
      description: "A Conventional Commit type noun such as feat, fix, docs, chore, revert, or another type allowed by the specification.",
    },
    scope: {
      anyOf: [
        { type: "string" },
        { type: "null" },
      ],
      description: "An optional noun describing the section of the codebase, or null when omitted.",
    },
    description: {
      type: "string",
      description: "A short summary of the code changes that immediately follows the type/scope prefix.",
    },
    breaking: {
      type: "boolean",
      description: "True when the commit should include ! immediately before the colon in the header, otherwise false.",
    },
    body: {
      anyOf: [
        { type: "string" },
        { type: "null" },
      ],
      description: "Optional free-form body grounded in the diff. Use null when no body is needed.",
    },
    footers: {
      anyOf: [
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["token", "value"],
            properties: {
              token: {
                type: "string",
                description: "A footer token such as Refs or Reviewed-by. BREAKING-CHANGE is synonymous with BREAKING CHANGE.",
              },
              value: {
                type: "string",
                description: "The footer value, which may span multiple lines.",
              },
            },
          },
        },
        { type: "null" },
      ],
      description: "Optional footers backed by the diff. Use null when there are no meaningful footers.",
    },
    breakingChange: {
      anyOf: [
        { type: "string" },
        { type: "null" },
      ],
      description: "When present, render this as the BREAKING CHANGE footer value. Use null when omitted.",
    },
  },
} as const;

function buildPrompt(context: GitContext): string {
  return [
    "Generate one Conventional Commit draft for the staged git changes.",
    "Follow the provided Conventional Commits 1.0.0 specification exactly.",
    "Choose the single best commit type and only include details grounded in the diff.",
    "Return JSON that satisfies the provided schema and do not wrap it in markdown.",
    "",
    "Staged status:",
    context.statusSummary || "(empty)",
    "",
    "Diff stat:",
    context.diffStat || "(empty)",
    "",
    "Unified diff:",
    context.diff,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCommitDraft(payload: string): CommitDraft {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Error(`Gemini did not return valid JSON: ${(error as Error).message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error("Gemini did not return a structured commit payload.");
  }

  const type = parsed.type;
  const scope = parsed.scope;
  const description = parsed.description;
  const breaking = parsed.breaking;
  const body = parsed.body;
  const footers = parsed.footers;
  const breakingChange = parsed.breakingChange;

  if (typeof type !== "string" || typeof description !== "string") {
    throw new Error("Gemini did not return a structured commit payload.");
  }

  if (!(scope === null || typeof scope === "string")) {
    throw new Error("Gemini did not return a structured commit payload.");
  }

  if (typeof breaking !== "boolean") {
    throw new Error("Gemini did not return a structured commit payload.");
  }

  if (!(body === null || typeof body === "string")) {
    throw new Error("Gemini did not return a structured commit payload.");
  }

  if (!(breakingChange === null || typeof breakingChange === "string")) {
    throw new Error("Gemini did not return a structured commit payload.");
  }

  if (!(footers === null || Array.isArray(footers))) {
    throw new Error("Gemini did not return a structured commit payload.");
  }

  const normalizedFooters =
    footers?.map((footer) => {
      if (!isRecord(footer) || typeof footer.token !== "string" || typeof footer.value !== "string") {
        throw new Error("Gemini did not return a structured commit payload.");
      }

      return {
        token: footer.token,
        value: footer.value,
      };
    }) ?? null;

  return {
    type,
    scope,
    description,
    breaking,
    body,
    footers: normalizedFooters,
    breakingChange,
  };
}

export class GeminiCommitGenerator {
  readonly #client: GeminiClientLike;
  readonly #model: string;

  constructor(client: GeminiClientLike, options: GeminiCommitGeneratorOptions = {}) {
    this.#client = client;
    this.#model = options.model ?? DEFAULT_GEMMA_MODEL;
  }

  async generate(context: GitContext): Promise<string> {
    const response = await this.#client.models.generateContent({
      model: this.#model,
      contents: buildPrompt(context),
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: COMMIT_RESPONSE_SCHEMA,
        systemInstruction: [
          "You are generating git commit messages.",
          "Use the following Conventional Commits 1.0.0 specification verbatim.",
          "",
          CONVENTIONAL_COMMITS_V1_0_0_SPECIFICATION,
        ].join("\n"),
      },
    });

    const text = response.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return formatConventionalCommit(parseCommitDraft(text));
  }
}
