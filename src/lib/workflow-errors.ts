export function logWorkflowServerError(route: string, error: unknown, session?: { user?: unknown } | null) {
  const details = getWorkflowErrorDetails(error);

  console.error("[workflow]", {
    route,
    message: details.message,
    stack: details.stack,
    user: session?.user ?? null
  });
}

export function getWorkflowErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: "Error",
    message: String(error || "Unbekannter Fehler"),
    stack: undefined
  };
}

export function workflowLoadErrorResponse(error?: unknown, status = 500) {
  const details = error === undefined ? undefined : getWorkflowErrorDetails(error);
  return Response.json(
    {
      error: "Workflow konnte nicht geladen werden.",
      details
    },
    { status }
  );
}
