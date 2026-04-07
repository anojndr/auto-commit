#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { main } from "./cli.js";

const DEFAULT_AUTOCOMMIT_ARGV = ["commit", "--cwd", ".", "--add"] as const;

export function buildAutocommitArgv(argv: string[]): string[] {
  return [...DEFAULT_AUTOCOMMIT_ARGV, ...argv];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(buildAutocommitArgv(process.argv.slice(2)));
}
