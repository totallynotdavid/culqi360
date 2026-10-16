import type { ExtensionCallMetricEvent } from "@crm/contracts/extension";

import type { Transaction } from "./database";

export function enqueueEvent(
  tx: Transaction,
  type: string,
  payload: Record<string, unknown>,
): Promise<number> {
  return tx.enqueue({ kind: "event", id: crypto.randomUUID(), type, payload });
}

/** The `event` name is checked against the contract the server accepts. */
export function enqueueCallMetric(
  tx: Transaction,
  payload: {
    event: ExtensionCallMetricEvent;
    sessionId: string;
    [key: string]: unknown;
  },
): Promise<number> {
  return enqueueEvent(tx, "call.metric", payload);
}
