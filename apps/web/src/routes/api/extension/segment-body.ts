/**
 * Reads at most `limit` bytes plus whatever the chunk that crosses it carries,
 * then stops reading. The caller rejects a body longer than `limit`, so an
 * oversize upload costs one chunk of memory instead of the whole body.
 */
export async function readBodyUpTo(
  request: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  // Leaving the loop early cancels the stream.
  for await (const chunk of request.body ?? []) {
    chunks.push(chunk);
    total += chunk.byteLength;
    if (total > limit) {
      break;
    }
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
