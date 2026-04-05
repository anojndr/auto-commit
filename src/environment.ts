import { config as loadDotEnv, type DotenvConfigOptions } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface LoadCliEnvironmentOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  moduleUrl?: string;
}

export function resolveDotEnvPaths(options: LoadCliEnvironmentOptions = {}): string[] {
  const cwd = resolve(options.cwd ?? process.cwd());
  const modulePath = fileURLToPath(options.moduleUrl ?? import.meta.url);
  const toolRoot = resolve(dirname(modulePath), "..");

  return Array.from(
    new Set([
      resolve(cwd, ".env"),
      resolve(toolRoot, ".env"),
    ]),
  );
}

export function loadCliEnvironment(options: LoadCliEnvironmentOptions = {}): void {
  const dotenvOptions: DotenvConfigOptions = {
    path: resolveDotEnvPaths(options),
    processEnv: options.env ?? process.env,
    quiet: true,
    override: false,
  };

  loadDotEnv(dotenvOptions);
}
