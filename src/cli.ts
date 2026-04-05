#!/usr/bin/env node

import { GoogleGenAI } from "@google/genai";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { loadRuntimeConfig, type RuntimeConfig } from "./config.js";
import { loadCliEnvironment } from "./environment.js";
import { GeminiCommitGenerator, DEFAULT_GEMMA_MODEL, type GitContext } from "./geminiCommitGenerator.js";
import { collectGitContext, commitWithMessage } from "./git.js";

export interface CommitMessageGenerator {
  generate(context: GitContext): Promise<string>;
}

export interface CliDependencies {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdout: {
    write(chunk: string): boolean | void;
  };
  stderr: {
    write(chunk: string): boolean | void;
  };
  loadConfig: (env: NodeJS.ProcessEnv, modelOverride?: string) => RuntimeConfig;
  createGenerator: (config: RuntimeConfig) => CommitMessageGenerator;
  collectGitContext: (cwd: string, options: { autoStage: boolean }) => Promise<GitContext>;
  commitWithMessage: (cwd: string, message: string) => Promise<void>;
}

const DEFAULT_DEPENDENCIES: CliDependencies = {
  cwd: process.cwd(),
  env: process.env,
  stdout: process.stdout,
  stderr: process.stderr,
  loadConfig: loadRuntimeConfig,
  createGenerator: (config) =>
    new GeminiCommitGenerator(new GoogleGenAI({ apiKey: config.apiKey }), {
      model: config.model || DEFAULT_GEMMA_MODEL,
    }),
  collectGitContext,
  commitWithMessage,
};

const HELP_TEXT = [
  "Usage: auto-commit [commit|generate] [options]",
  "",
  "Commands:",
  "  commit    Generate a Conventional Commit message and create the commit.",
  "  generate  Print a Conventional Commit message without creating the commit.",
  "",
  "Options:",
  "  --add         Stage all changes before generating the commit message.",
  "  --cwd <path>  Run against a specific git repository. Defaults to the current directory.",
  `  --model <id>  Override the default hosted model. Defaults to ${DEFAULT_GEMMA_MODEL}.`,
  "  -h, --help    Show this help text.",
  "",
  "Environment:",
  "  GEMINI_API_KEY must be set in the environment or a local .env file.",
].join("\n");

function writeLine(stream: CliDependencies["stdout"] | CliDependencies["stderr"], message: string): void {
  stream.write(`${message}\n`);
}

function resolveCommand(argv: string[]): { command: "commit" | "generate"; optionArgs: string[] } {
  if (argv.length === 0 || argv[0]?.startsWith("-")) {
    return {
      command: "commit",
      optionArgs: argv,
    };
  }

  const [command, ...optionArgs] = argv;

  if (command !== "commit" && command !== "generate") {
    throw new Error(`Unknown command "${command}". Use "commit" or "generate".`);
  }

  return { command, optionArgs };
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = DEFAULT_DEPENDENCIES,
): Promise<number> {
  const { command, optionArgs } = resolveCommand(argv);
  const parsed = parseArgs({
    args: optionArgs,
    options: {
      add: {
        type: "boolean",
        default: false,
      },
      cwd: {
        type: "string",
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
      model: {
        type: "string",
      },
    },
    allowPositionals: false,
    strict: true,
  });

  if (parsed.values.help) {
    writeLine(dependencies.stdout, HELP_TEXT);
    return 0;
  }

  const cwd = resolve(parsed.values.cwd ?? dependencies.cwd);
  const config = dependencies.loadConfig(dependencies.env ?? process.env, parsed.values.model);
  const generator = dependencies.createGenerator(config);
  const gitContext = await dependencies.collectGitContext(cwd, {
    autoStage: parsed.values.add ?? false,
  });
  const message = await generator.generate(gitContext);

  if (command === "generate") {
    writeLine(dependencies.stdout, message);
    return 0;
  }

  await dependencies.commitWithMessage(cwd, message);
  writeLine(dependencies.stdout, message);

  return 0;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  loadCliEnvironment({
    cwd: process.cwd(),
    env: process.env,
    moduleUrl: import.meta.url,
  });

  try {
    process.exitCode = await runCli(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeLine(DEFAULT_DEPENDENCIES.stderr, message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
