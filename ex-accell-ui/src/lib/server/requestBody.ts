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
  if (!request.body) return JSON.parse('');
  // The declared length can be missing or wrong, so the bytes are counted as they arrive and the read stops at the limit
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
