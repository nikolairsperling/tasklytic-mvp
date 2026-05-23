export const missingSessionSecretMessage = "SESSION_SECRET fehlt. Bitte in der .env setzen und Server neu starten.";

export function getSessionSecret(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error("SESSION_SECRET_MISSING");
  }

  if (secret.length < 32) {
    throw new Error("SESSION_SECRET_TOO_SHORT");
  }

  return secret;
}

export function isSessionSecretConfigured(env: NodeJS.ProcessEnv = process.env) {
  try {
    getSessionSecret(env);
    return true;
  } catch {
    return false;
  }
}

export function warnOrFailForSessionSecret(env: NodeJS.ProcessEnv = process.env) {
  try {
    getSessionSecret(env);
  } catch (error) {
    if (env.NODE_ENV === "production" && !env.SESSION_SECRET?.trim()) {
      throw new Error("FATAL: SESSION_SECRET missing");
    }

    if (env.NODE_ENV === "production") {
      throw error;
    }

    console.warn(missingSessionSecretMessage);
  }
}
