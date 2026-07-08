/** Parse a fetch Response body as JSON, with a clear error when the body is empty or invalid. */
export async function parseResponseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? 'Server returned an empty response.'
        : `Request failed (${res.status}) with an empty response body.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? 'Server returned a non-JSON response.'
        : `Request failed (${res.status}) with a non-JSON response body.`,
    );
  }
}
