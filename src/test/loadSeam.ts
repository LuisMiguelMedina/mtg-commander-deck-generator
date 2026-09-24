/**
 * Resolve a fase-1 port that does not exist yet.
 * Acceptance tests use this so a missing module fails the assertion
 * (received undefined) instead of aborting the file at collect time.
 * Not a production seam — do not import from app code.
 */
export async function tryLoadSeam(
  specifier: string,
): Promise<Record<string, unknown> | null> {
  try {
    return (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      /cannot find module|failed to resolve|does not exist|err_module_not_found|unknown module|failed to load|enoent/i
        .test(message)
    ) {
      return null;
    }
    throw err;
  }
}
