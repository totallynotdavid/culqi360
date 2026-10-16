import type { ExecutivePresenceStatus } from "@crm/contracts/extension";

import type { CallRow } from "@/src/domain/model";
import { isLiveCall } from "@/src/domain/model";
import { commit, type Transaction } from "@/src/services/database";
import { enqueueCallMetric, enqueueEvent } from "@/src/services/events";
import type { ClaimedHandoff } from "@/src/services/external-auth";

function enqueuePresence(
  tx: Transaction,
  presenceStatus: ExecutivePresenceStatus,
  call: CallRow,
  updatedAt: number,
): Promise<number> {
  return enqueueEvent(tx, "executive.presence", {
    presenceStatus,
    assignmentId: call.assignmentId,
    contactId: call.contactId,
    callSessionId: call.id,
    updatedAt,
  });
}

/** The current call is the newest one the server handed over. */
export async function latestCall(tx: Transaction): Promise<CallRow | null> {
  const calls = await tx.getAll("calls");
  return calls.reduce<CallRow | null>(
    (latest, call) =>
      latest === null || call.receivedAt > latest.receivedAt ? call : latest,
    null,
  );
}

async function previousCallEndedAt(tx: Transaction): Promise<number | null> {
  const calls = await tx.getAll("calls");
  const ended = calls.flatMap((call) => (call.endedAt ? [call.endedAt] : []));
  return ended.length === 0 ? null : Math.max(...ended);
}

async function requireCall(
  tx: Transaction,
  phases: CallRow["phase"][],
  action: string,
): Promise<CallRow> {
  const call = await latestCall(tx);
  if (!call) {
    throw new Error("no assigned call");
  }
  if (!phases.includes(call.phase)) {
    throw new Error(`call cannot ${action} from ${call.phase}`);
  }
  return call;
}

async function assertNoLiveCall(tx: Transaction): Promise<void> {
  if (isLiveCall(await latestCall(tx))) {
    throw new Error("a call is already active");
  }
}

/** Stores the call a claimed handoff opened. A second claim changes nothing. */
export function receiveHandoff(claimed: ClaimedHandoff): Promise<void> {
  return commit(async (tx) => {
    if (await tx.get("calls", claimed.callId)) {
      return;
    }
    await assertNoLiveCall(tx);

    const { claims } = claimed;
    const receivedAt = Date.now();
    const call: CallRow = {
      id: claimed.callId,
      assignmentId: claims.assignmentId,
      contactId: claims.contactId,
      phone: claims.phone,
      clientName: claims.clientName,
      organizationLabel: claims.organizationLabel,
      receivedAt,
      startedAt: null,
      connectedAt: null,
      endedAt: null,
      phase: "ready",
      outcome: null,
      notes: null,
    };
    await tx.put("calls", call);
    await enqueuePresence(tx, "ready", call, receivedAt);
  });
}

export function startCall(): Promise<void> {
  return commit(async (tx) => {
    const ready = await requireCall(tx, ["ready"], "start");
    const now = Date.now();
    const previousEnd = await previousCallEndedAt(tx);

    const call: CallRow = { ...ready, phase: "dialing", startedAt: now };
    await tx.put("calls", call);
    await enqueueEvent(tx, "call.lifecycle", {
      event: "started",
      sessionId: call.id,
      assignmentId: call.assignmentId,
      contactId: call.contactId,
      phone: call.phone,
      at: now,
    });
    await enqueuePresence(tx, "dialing", call, now);
    if (previousEnd !== null) {
      await enqueueCallMetric(tx, {
        event: "between_calls",
        sessionId: call.id,
        idleSeconds: Math.round((now - previousEnd) / 1000),
        fromEndedAt: previousEnd,
        startedAt: now,
      });
    }
  });
}

export function connectCall(): Promise<void> {
  return commit(async (tx) => {
    const dialing = await requireCall(tx, ["dialing"], "connect");
    const now = Date.now();

    const call: CallRow = { ...dialing, phase: "active", connectedAt: now };
    await tx.put("calls", call);
    await enqueueEvent(tx, "call.lifecycle", {
      event: "connected",
      sessionId: call.id,
      at: now,
    });
    await enqueuePresence(tx, "active", call, now);
  });
}

export function endCall(input: {
  outcome?: string;
  notes?: string;
}): Promise<void> {
  return commit(async (tx) => {
    const live = await requireCall(tx, ["dialing", "active"], "end");
    const now = Date.now();

    const call: CallRow = {
      ...live,
      phase: "ended",
      endedAt: now,
      outcome: input.outcome ?? null,
      notes: input.notes ?? null,
    };
    await tx.put("calls", call);
    await enqueueEvent(tx, "call.lifecycle", {
      event: "ended",
      sessionId: call.id,
      outcome: input.outcome,
      notes: input.notes ?? null,
      at: now,
    });
    await enqueueCallMetric(tx, {
      event: "duration",
      sessionId: call.id,
      durationSeconds: call.connectedAt
        ? Math.max(0, Math.round((now - call.connectedAt) / 1000))
        : 0,
      connectedAt: call.connectedAt,
      endedAt: now,
    });
    await enqueuePresence(tx, "wrap_up", call, now);
  });
}
