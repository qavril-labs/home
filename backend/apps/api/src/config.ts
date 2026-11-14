export interface AppConfig {
  readonly databaseUrl: string;
  readonly platformKey: string;
  readonly port: number;
  readonly host: string;
  readonly corsOrigins: readonly string[];
  readonly trustProxy: boolean;
  readonly leadWebhookUrl?: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const platformKey = required(env, "PLATFORM_ADMIN_KEY");
  if (platformKey.length < 32) {
    throw new Error("PLATFORM_ADMIN_KEY must be at least 32 characters");
  }
  return {
    databaseUrl: required(env, "DATABASE_URL"),
    platformKey,
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? "127.0.0.1",
    corsOrigins: (env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    trustProxy: env.TRUST_PROXY === "true",
    leadWebhookUrl: env.LEAD_WEBHOOK_URL || undefined,
  };
}
