import { z } from "zod";
import { classifyError } from "@/lib/error-diagnostics";

export function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    if (issue?.code === "too_big" && issue.path.includes("ids") && issue.maximum === 20) {
      return "Maximal 20 Leads pro Lauf erlaubt.";
    }
    const messages = error.issues.map((entry) => entry.message).filter(Boolean);
    return messages.length > 0 ? messages.join(" ") : fallback;
  }

  if (error instanceof Error && error.message) {
    const message = error.message.trim();
    if (isUnsafeErrorMessage(message)) {
      return classifyError(error, fallback).message;
    }
    return message;
  }

  return fallback;
}

function isUnsafeErrorMessage(message: string): boolean {
  return /Prisma|Invalid `prisma|Foreign key constraint|Unique constraint|Raw query|Command failed|Load failed|ChunkLoadError|Failed to find Server Action/i.test(message)
    || message.includes("\n")
    || message.length > 300;
}

export function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

export function errorJson(error: unknown, fallback: string, requestId?: string) {
  const classified = classifyError(error, fallback);
  return {
    error: classified.message,
    errorCode: classified.code,
    requestId
  };
}
