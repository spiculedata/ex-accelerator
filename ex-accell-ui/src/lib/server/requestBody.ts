// Reading a JSON request body without letting one request fill memory with an enormous one.

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`The request is larger than ${Math.round(maxBytes / 1024)}KB.`);
    this.name = 'BodyTooLargeError';
  }
}

/** Parses a JSON body of at most `maxBytes`. Throws BodyTooLargeError when it is bigger, SyntaxError when it is not JSON. */
export async function readJsonLimited(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new BodyTooLargeError(maxBytes);
  const text = await request.text();
  // The declared length can be missing or wrong, so the text is measured as well
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new BodyTooLargeError(maxBytes);
  return JSON.parse(text);
}
