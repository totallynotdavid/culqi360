import { captureException } from "@sentry/bun";

import { createMaintenanceRuntime } from "~/server/composition/maintenance-runtime";
import { dbUrl } from "~/server/platform/database/db";
import {
  createPgListener,
  type PgListenerHandler,
} from "~/server/platform/database/notifications/listener";
import { serverInfrastructure } from "~/server/platform/infrastructure";
import { JOB_TABLE_CHANNELS } from "~/server/platform/jobs/registry";
import type { QueueRunner } from "~/server/platform/jobs/types";
import type { OperationContext } from "~/server/platform/operation/context";
import { createLogger } from "~/shared/observability/runtime-logger";

const WORKER_ID = `bg-${process.pid}`;

// Polling recovers jobs missed when LISTEN/NOTIFY fails.
const POLL_FLOOR_MS = 1_000;
const ACCOUNT_EXPIRY_INTERVAL_MS = 60_000;
const EXPIRY_NOTIFICATION_INTERVAL_MS = 24 * 60 * 60_000;
const RESERVATION_SWEEP_INTERVAL_MS = 60_000;
// Worst-case lateness of finalizing an idle recording, on top of the idle
// timeout itself.
const RECORDING_SWEEP_INTERVAL_MS = 60_000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const logger = createLogger("background-jobs", { workerId: WORKER_ID });

interface QueueWaker {
  readonly wake: () => void;
  readonly stop: () => Promise<void>;
}

interface ScheduledTask {
  stop(): Promise<void>;
}

function makeWaker(run: () => Promise<void>): QueueWaker {
  let stopped = false;
  let active: Promise<void> | null = null;
  let followUpRequested = false;

  const schedule = (): void => {
    if (stopped || active) {
      return;
    }

    followUpRequested = false;
    active = run()
      .catch((error: unknown) => {
        logger.error("queue_run_failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        captureException(error);
      })
      .finally(() => {
        active = null;

        if (followUpRequested) {
          schedule();
        }
      });
  };

  return {
    wake: () => {
      if (stopped) {
        return;
      }

      followUpRequested = true;
      schedule();
    },
    stop: async () => {
      stopped = true;
      followUpRequested = false;
      await active;
    },
  };
}

function startScheduledTick(
  label: string,
  intervalMs: number,
  run: (context: OperationContext) => Promise<void>,
): ScheduledTask {
  let stopped = false;
  let running = false;
  let active: Promise<void> | null = null;

  const execute = async (): Promise<void> => {
    if (stopped || running) {
      return;
    }

    running = true;

    try {
      // clock-boundary: scheduled tick. Each firing is its own inbound event,
      // so every row this sweep touches carries the same instant.
      await run({ operationAt: new Date() });
    } catch (error: unknown) {
      logger.error("scheduled_tick_failed", {
        tick: label,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      captureException(error);
    } finally {
      running = false;
      active = null;
    }
  };

  const trigger = () => {
    if (stopped || running) {
      return;
    }

    active = execute();
  };

  trigger();
  const timer = setInterval(trigger, intervalMs);

  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await active;
    },
  };
}

export function startMaintenanceWorker(): { stop(): Promise<void> } {
  logger.info("background_jobs_initializing", { workerId: WORKER_ID });

  const runtime = createMaintenanceRuntime(serverInfrastructure);

  const recordsImportQueue =
    runtime.maintenance.createRecordsImportQueue(WORKER_ID);

  const gpvSnapshotQueue = runtime.merchantStats.imports.createQueue(WORKER_ID);

  const enrichmentQueue = runtime.clientSearch.createEnrichmentQueue(WORKER_ID);
  const notificationQueues = runtime.notifications.createQueues(WORKER_ID);

  const queuesByChannel: Record<string, QueueRunner[]> = {
    [JOB_TABLE_CHANNELS.workflow_integration_jobs]: [recordsImportQueue],
    [JOB_TABLE_CHANNELS.gpv_snapshot_jobs]: [gpvSnapshotQueue],
    [JOB_TABLE_CHANNELS.company_registry_record]: [enrichmentQueue],
    [JOB_TABLE_CHANNELS.notification_intents]: [notificationQueues.expansion],
    [JOB_TABLE_CHANNELS.notification_deliveries]: [notificationQueues.dispatch],
    [JOB_TABLE_CHANNELS.whatsapp_inbound_events]: [
      notificationQueues.whatsappInbound,
    ],
    [JOB_TABLE_CHANNELS.outbound_whatsapp_messages]: [
      notificationQueues.outboundWhatsApp,
    ],
  };

  const wakers = new Map<string, QueueWaker>();
  const channels: Record<string, PgListenerHandler[]> = {};

  for (const [channel, queues] of Object.entries(queuesByChannel)) {
    const wake = makeWaker(async () => {
      await Promise.all(queues.map((queue) => queue.drain()));
    });

    wakers.set(channel, wake);
    channels[channel] = [wake.wake];
  }

  const wakeAll = () => {
    for (const wake of wakers.values()) {
      wake.wake();
    }
  };

  const stopAccountExpiry = startScheduledTick(
    "account-expiry",
    ACCOUNT_EXPIRY_INTERVAL_MS,
    runtime.maintenance.accountLifecycle.expireAccounts,
  );
  const stopExpiryNotification = startScheduledTick(
    "expiry-notification",
    EXPIRY_NOTIFICATION_INTERVAL_MS,
    runtime.maintenance.accountLifecycle.notifyExpiringAccounts,
  );
  const stopReservationSweep = startScheduledTick(
    "reservation-sweep",
    RESERVATION_SWEEP_INTERVAL_MS,
    runtime.maintenance.leadReservation.sweepReservations,
  );
  const stopRecordingSweep = startScheduledTick(
    "extension-recording-sweep",
    RECORDING_SWEEP_INTERVAL_MS,
    async (context) => {
      const swept = await runtime.maintenance.sweepExtensionRecordings(context);
      if (swept.interruptedRecordings > 0 || swept.endedCalls > 0) {
        logger.info("extension_recordings_swept", { ...swept });
      }
    },
  );
  const stopSessionCleanup = startScheduledTick(
    "session-cleanup",
    SESSION_CLEANUP_INTERVAL_MS,
    runtime.maintenance.cleanupSessions,
  );

  const pollTimer = setInterval(wakeAll, POLL_FLOOR_MS);

  const listener = createPgListener(dbUrl, channels);

  listener.start();

  wakeAll();

  let stopPromise: Promise<void> | null = null;

  async function stop(): Promise<void> {
    if (stopPromise) {
      return stopPromise;
    }

    stopPromise = (async () => {
      clearInterval(pollTimer);
      const queueStops = [
        recordsImportQueue.stop(),
        gpvSnapshotQueue.stop(),
        enrichmentQueue.stop(),
        notificationQueues.expansion.stop(),
        notificationQueues.dispatch.stop(),
        notificationQueues.whatsappInbound.stop(),
        notificationQueues.outboundWhatsApp.stop(),
      ];
      const scheduledTaskStops = [
        stopAccountExpiry.stop(),
        stopExpiryNotification.stop(),
        stopReservationSweep.stop(),
        stopRecordingSweep.stop(),
        stopSessionCleanup.stop(),
      ];

      await listener.stop();
      await Promise.all([
        ...queueStops,
        ...scheduledTaskStops,
        ...[...wakers.values()].map((waker) => waker.stop()),
      ]);
    })();

    return stopPromise;
  }

  return {
    stop,
  };
}
