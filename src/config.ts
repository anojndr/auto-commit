export interface GitAuthorConfig {
  name: string;
  email: string;
}

export interface RuntimeConfig {
  apiKey: string;
  model: string;
  gitAuthor?: GitAuthorConfig;
}

function readOptionalEnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  modelOverride?: string,
): RuntimeConfig {
  const apiKey = readOptionalEnvValue(env, "GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to your environment or .env file.");
  }

  const override = modelOverride?.trim();
  const envModel = readOptionalEnvValue(env, "GEMINI_MODEL");
  const gitAuthorName = readOptionalEnvValue(env, "GIT_AUTHOR_NAME");
  const gitAuthorEmail = readOptionalEnvValue(env, "GIT_AUTHOR_EMAIL");

  if ((gitAuthorName && !gitAuthorEmail) || (!gitAuthorName && gitAuthorEmail)) {
    throw new Error("GIT_AUTHOR_NAME and GIT_AUTHOR_EMAIL must both be set to configure the git author.");
  }

  const gitAuthor = gitAuthorName && gitAuthorEmail
    ? {
        name: gitAuthorName,
        email: gitAuthorEmail,
      }
    : undefined;

  return {
    apiKey,
    model: override || envModel || "gemma-4-31b-it",
    ...(gitAuthor ? { gitAuthor } : {}),
  };
}
