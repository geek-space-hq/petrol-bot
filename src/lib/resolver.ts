export async function resolveOrNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    const resolved = await promise;
    return resolved;
  } catch (err) {
    return null;
  }
}
