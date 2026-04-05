export interface RuntimeConfig {
  apiKey: string;
  model: string;
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  modelOverride?: string,
): RuntimeConfig {
  const apiKey = env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to your environment or .env file.");
  }

  const override = modelOverride?.trim();
  const envModel = env.GEMINI_MODEL?.trim();

  return {
    apiKey,
    model: override || envModel || "gemma-4-31b-it",
  };
}
