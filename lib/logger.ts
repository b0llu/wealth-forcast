type LogLevel = "info" | "warn" | "error" | "debug";

const debugEnabled =
  process.env.DEBUG_LOGS === "1" || process.env.NODE_ENV !== "production";

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (level === "debug" && !debugEnabled) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {})
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
