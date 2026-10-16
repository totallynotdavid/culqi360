import { createHash, randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import {
  EXTENSION_EVENTS_PATH,
  EXTENSION_RECORDINGS_PATH,
  EXTENSION_SEGMENT_CHANNEL_LAYOUT,
  EXTENSION_SEGMENT_CHANNELS_HEADER,
  EXTENSION_SEGMENT_MAX_BYTES,
  EXTENSION_SEGMENT_STARTED_AT_HEADER,
  EXTENSION_SESSION_CLAIM_PATH,
  EXTENSION_SESSION_REFRESH_PATH,
  isCloseRecordingRequest,
  isCreateRecordingRequest,
  type CloseRecordingResponse,
  type ExtensionHandoffClaims,
} from "@crm/contracts/extension";

export interface ReceivedEvent {
  id: string;
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
  authorization: string | null;
}

export interface StoredSegment {
  seq: number;
  bytes: Buffer;
  contentType: string;
  channels: string;
  startedAt: number;
}

export interface ReceivedRecording {
  id: string;
  callId: string;
  status: "open" | "complete";
  interrupted: boolean;
  segments: Map<number, StoredSegment>;
}

export interface ReceivedClose {
  recordingId: string;
  manifest: { segments: number; bytes: number; interrupted: boolean };
  answer: CloseRecordingResponse;
}

export interface RequestLogEntry {
  method: string;
  path: string;
  status: number | "dropped";
}

/**
 * Stands in for the web app's extension routes with the semantics the receiver
 * defines: server-minted ids, single-use handoff tokens, idempotent segment
 * `PUT`, and a close that answers `complete` only when 0..n-1 are stored.
 * Every body it returns is checked with the contract's own guards by the
 * extension, so a shape drift fails there.
 */
export interface Receiver {
  origin: string;
  events: ReceivedEvent[];
  /** Ids of the calls minted at claim, in order. */
  callIds: string[];
  recordings: Map<string, ReceivedRecording>;
  closes: ReceivedClose[];
  requests: RequestLogEntry[];
  /** A signed-looking token. The server, not the extension, verifies it. */
  issueHandoff(claims?: Partial<ExtensionHandoffClaims>): string;
  /** Answers the next `times` requests whose "METHOD path" matches. */
  failNext(match: RegExp, status: number, times: number): void;
  /** Closes the socket without answering the next `times` matching requests. */
  dropNext(match: RegExp, times: number): void;
  /**
   * Holds the next matching request unanswered until the returned function is
   * called.
   */
  holdNext(match: RegExp): () => void;
  /** Drops every scripted failure and every lying acknowledgement. */
  clearFaults(): void;
  /** Answers 200 for exactly these segment numbers but stores nothing. */
  acknowledgeWithoutStoring(seqs: number[]): void;
  /** Accepts this bearer token, as if issued by an earlier claim. */
  allowSessionToken(sessionToken: string, installationId: string): void;
  close(): Promise<void>;
}

interface Fault {
  match: RegExp;
  status: number | "drop";
  remaining: number;
}

interface Hold {
  match: RegExp;
  released: Promise<void>;
}

interface Session {
  installationId: string;
}

interface Claimed {
  installationId: string;
  callId: string;
  sessionToken: string;
  refreshToken: string;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJson(body: Buffer): unknown {
  try {
    return body.length === 0 ? {} : JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function encodePart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function bearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function createReceiver(): Promise<Receiver> {
  const events: ReceivedEvent[] = [];
  const callIds: string[] = [];
  const recordings = new Map<string, ReceivedRecording>();
  const closes: ReceivedClose[] = [];
  const requests: RequestLogEntry[] = [];
  const faults: Fault[] = [];
  const holds: Hold[] = [];
  const lyingSeqs = new Set<number>();
  const sessions = new Map<string, Session>();
  const refreshTokens = new Map<string, Session>();
  const issued = new Map<string, Claimed | null>();
  const calls = new Map<string, Session>();
  let origin = "";

  function json(
    res: ServerResponse,
    status: number,
    body: unknown,
    log: RequestLogEntry,
  ): void {
    const payload = JSON.stringify(body);
    log.status = status;
    res.writeHead(status, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  function fail(
    res: ServerResponse,
    log: RequestLogEntry,
    status: number,
    code: string,
  ): void {
    json(res, status, { error: code, code }, log);
  }

  function takeFault(key: string): Fault | undefined {
    const fault = faults.find(
      (candidate) => candidate.remaining > 0 && candidate.match.test(key),
    );
    if (fault) {
      fault.remaining -= 1;
    }
    return fault;
  }

  // Resolves at once unless a hold matches; a hold applies to one request.
  async function takeHold(key: string): Promise<void> {
    const index = holds.findIndex((hold) => hold.match.test(key));
    const [hold] = index < 0 ? [] : holds.splice(index, 1);
    await hold?.released;
  }

  // A call belongs to the installation that claimed it, not to one session.
  function owns(session: Session, callId: string): boolean {
    return calls.get(callId)?.installationId === session.installationId;
  }

  function sessionFor(req: IncomingMessage): Session | null {
    const token = bearer(req);
    return token ? (sessions.get(token) ?? null) : null;
  }

  function claim(body: unknown, res: ServerResponse, log: RequestLogEntry) {
    if (
      !isRecord(body) ||
      typeof body.handoffToken !== "string" ||
      typeof body.installationId !== "string"
    ) {
      return fail(res, log, 400, "bad_claim");
    }
    if (!issued.has(body.handoffToken)) {
      return fail(res, log, 401, "handoff_invalid");
    }
    const existing = issued.get(body.handoffToken);
    if (existing && existing.installationId !== body.installationId) {
      return fail(res, log, 409, "handoff_claimed_by_other_installation");
    }
    const claimed: Claimed = existing ?? {
      installationId: body.installationId,
      callId: randomUUID(),
      sessionToken: `session-${randomUUID()}`,
      refreshToken: `refresh-${randomUUID()}`,
    };
    if (!existing) {
      callIds.push(claimed.callId);
    }
    issued.set(body.handoffToken, claimed);
    const session = { installationId: claimed.installationId };
    sessions.set(claimed.sessionToken, session);
    refreshTokens.set(claimed.refreshToken, session);
    calls.set(claimed.callId, session);
    return json(
      res,
      200,
      {
        sessionToken: claimed.sessionToken,
        refreshToken: claimed.refreshToken,
        expiresAt: Date.now() + 3_600_000,
        callId: claimed.callId,
      },
      log,
    );
  }

  function refresh(body: unknown, res: ServerResponse, log: RequestLogEntry) {
    const session =
      isRecord(body) && typeof body.refreshToken === "string"
        ? refreshTokens.get(body.refreshToken)
        : undefined;
    if (!session) {
      return fail(res, log, 401, "extension_session_invalid");
    }
    const sessionToken = `session-${randomUUID()}`;
    const refreshToken = `refresh-${randomUUID()}`;
    sessions.set(sessionToken, session);
    refreshTokens.set(refreshToken, session);
    return json(
      res,
      200,
      { sessionToken, refreshToken, expiresAt: Date.now() + 3_600_000 },
      log,
    );
  }

  function ingestEvent(
    req: IncomingMessage,
    body: unknown,
    res: ServerResponse,
    log: RequestLogEntry,
  ) {
    if (
      !isRecord(body) ||
      typeof body.id !== "string" ||
      typeof body.sequence !== "number" ||
      typeof body.type !== "string" ||
      !isRecord(body.payload)
    ) {
      return fail(res, log, 400, "bad_event");
    }
    if (!events.some((event) => event.id === body.id)) {
      events.push({
        id: body.id,
        sequence: body.sequence,
        type: body.type,
        payload: body.payload,
        authorization: req.headers.authorization ?? null,
      });
    }
    return json(res, 200, { ok: true }, log);
  }

  function createRecording(
    session: Session,
    body: unknown,
    res: ServerResponse,
    log: RequestLogEntry,
  ) {
    if (!isCreateRecordingRequest(body)) {
      return fail(res, log, 400, "bad_request");
    }
    if (!owns(session, body.callId)) {
      return fail(res, log, 404, "call_not_found");
    }
    const existing = [...recordings.values()].find(
      (recording) => recording.callId === body.callId,
    );
    const recording = existing ?? {
      id: randomUUID(),
      callId: body.callId,
      status: "open" as const,
      interrupted: false,
      segments: new Map<number, StoredSegment>(),
    };
    recordings.set(recording.id, recording);
    return json(res, 200, { recordingId: recording.id }, log);
  }

  async function putSegment(
    req: IncomingMessage,
    recording: ReceivedRecording,
    seq: number,
    res: ServerResponse,
    log: RequestLogEntry,
  ) {
    const contentType = req.headers["content-type"] ?? "";
    const channels = req.headers[EXTENSION_SEGMENT_CHANNELS_HEADER];
    const startedAt = Number(req.headers[EXTENSION_SEGMENT_STARTED_AT_HEADER]);
    if (
      !Number.isSafeInteger(seq) ||
      seq < 0 ||
      !contentType.toLowerCase().startsWith("audio/") ||
      channels !== EXTENSION_SEGMENT_CHANNEL_LAYOUT ||
      !Number.isSafeInteger(startedAt) ||
      startedAt <= 0
    ) {
      return fail(res, log, 400, "invalid_segment");
    }
    if (recording.status === "complete") {
      return fail(res, log, 409, "recording_closed");
    }
    const bytes = await readBody(req);
    if (bytes.length === 0) {
      return fail(res, log, 400, "segment_empty");
    }
    if (bytes.length > EXTENSION_SEGMENT_MAX_BYTES) {
      return fail(res, log, 413, "segment_too_large");
    }
    if (lyingSeqs.has(seq)) {
      return json(res, 200, { seq, sizeBytes: bytes.length }, log);
    }
    const stored = recording.segments.get(seq);
    if (stored && !stored.bytes.equals(bytes)) {
      return fail(res, log, 409, "segment_conflict");
    }
    recording.segments.set(
      seq,
      stored ?? { seq, bytes, contentType, channels, startedAt },
    );
    return json(res, 200, { seq, sizeBytes: bytes.length }, log);
  }

  function closeRecording(
    recording: ReceivedRecording,
    body: unknown,
    res: ServerResponse,
    log: RequestLogEntry,
  ) {
    if (!isCloseRecordingRequest(body)) {
      return fail(res, log, 400, "bad_manifest");
    }
    const missing: number[] = [];
    let total = 0;
    for (let seq = 0; seq < body.segments; seq += 1) {
      const segment = recording.segments.get(seq);
      if (segment) {
        total += segment.bytes.length;
      } else {
        missing.push(seq);
      }
    }
    if (missing.length > 0) {
      const answer: CloseRecordingResponse = { status: "missing", missing };
      closes.push({ recordingId: recording.id, manifest: body, answer });
      return json(res, 200, answer, log);
    }
    if (total !== body.bytes) {
      return fail(res, log, 409, "recording_manifest_mismatch");
    }
    recording.status = "complete";
    recording.interrupted = body.interrupted;
    const answer: CloseRecordingResponse = {
      status: "complete",
      segments: body.segments,
      bytes: total,
    };
    closes.push({ recordingId: recording.id, manifest: body, answer });
    return json(res, 200, answer, log);
  }

  async function route(req: IncomingMessage, res: ServerResponse) {
    const method = req.method ?? "GET";
    const path = new URL(req.url ?? "/", "http://receiver").pathname;
    const log: RequestLogEntry = { method, path, status: 0 };
    requests.push(log);

    if (method === "GET" && path === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><title>web</title>web");
      log.status = 200;
      return;
    }

    await takeHold(`${method} ${path}`);
    const fault = takeFault(`${method} ${path}`);
    if (fault?.status === "drop") {
      log.status = "dropped";
      req.socket.destroy();
      return;
    }
    if (fault) {
      await readBody(req);
      return fail(res, log, fault.status, "injected");
    }

    if (method === "POST" && path === EXTENSION_SESSION_CLAIM_PATH) {
      return claim(parseJson(await readBody(req)), res, log);
    }
    if (method === "POST" && path === EXTENSION_SESSION_REFRESH_PATH) {
      return refresh(parseJson(await readBody(req)), res, log);
    }

    const session = sessionFor(req);
    if (!session) {
      await readBody(req);
      return fail(res, log, 401, "extension_session_invalid");
    }

    if (method === "POST" && path === EXTENSION_EVENTS_PATH) {
      return ingestEvent(req, parseJson(await readBody(req)), res, log);
    }
    if (method === "POST" && path === EXTENSION_RECORDINGS_PATH) {
      return createRecording(session, parseJson(await readBody(req)), res, log);
    }

    const segment = new RegExp(
      `^${EXTENSION_RECORDINGS_PATH}/([^/]+)/segments/(\\d+)$`,
    ).exec(path);
    if (method === "PUT" && segment) {
      const recording = recordings.get(segment[1] ?? "");
      if (!recording || !owns(session, recording.callId)) {
        await readBody(req);
        return fail(res, log, 404, "recording_not_found");
      }
      return putSegment(req, recording, Number(segment[2]), res, log);
    }

    const close = new RegExp(
      `^${EXTENSION_RECORDINGS_PATH}/([^/]+)/close$`,
    ).exec(path);
    if (method === "POST" && close) {
      const recording = recordings.get(close[1] ?? "");
      if (!recording || !owns(session, recording.callId)) {
        await readBody(req);
        return fail(res, log, 404, "recording_not_found");
      }
      return closeRecording(
        recording,
        parseJson(await readBody(req)),
        res,
        log,
      );
    }

    await readBody(req);
    return fail(res, log, 404, "not_found");
  }

  const server: Server = createServer((req, res) => {
    route(req, res).catch(() => {
      res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("receiver failed to bind");
  }
  origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    events,
    callIds,
    recordings,
    closes,
    requests,
    issueHandoff(claims) {
      const now = Math.floor(Date.now() / 1000);
      const full: ExtensionHandoffClaims = {
        iss: "web",
        aud: "crm-extension",
        sub: `user:${randomUUID()}`,
        authSessionId: randomUUID(),
        branchId: randomUUID(),
        assignmentId: randomUUID(),
        contactId: randomUUID(),
        phone: "+51911111111",
        clientName: "Ana Quispe",
        organizationLabel: "Culqi",
        action: "start_call",
        origin,
        jti: randomUUID(),
        iat: now,
        exp: now + 300,
        ...claims,
      };
      const token = [
        encodePart({ alg: "EdDSA", typ: "JWT" }),
        encodePart(full),
        createHash("sha256").update(randomUUID()).digest("base64url"),
      ].join(".");
      issued.set(token, null);
      return token;
    },
    failNext(match, status, times) {
      faults.push({ match, status, remaining: times });
    },
    dropNext(match, times) {
      faults.push({ match, status: "drop", remaining: times });
    },
    holdNext(match) {
      let release = () => {};
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      holds.push({ match, released });
      return release;
    },
    clearFaults() {
      faults.length = 0;
      lyingSeqs.clear();
    },
    acknowledgeWithoutStoring(seqs) {
      lyingSeqs.clear();
      for (const seq of seqs) {
        lyingSeqs.add(seq);
      }
    },
    allowSessionToken(sessionToken, installationId) {
      sessions.set(sessionToken, { installationId });
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
