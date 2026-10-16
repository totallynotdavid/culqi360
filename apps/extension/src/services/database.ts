import type {
  CallRow,
  ChunkRow,
  QueueJob,
  QueueRow,
  RecordingRow,
} from "@/src/domain/model";

export const DATABASE_NAME = "crm_extension" as const;
const DATABASE_VERSION = 1;

interface MetaValues {
  nextSequence: number;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  /** Set once the v1 queue is in this database, so a crash cannot import it twice. */
  importedV1: boolean;
}

interface StoreRows {
  calls: CallRow;
  recordings: RecordingRow;
  chunks: ChunkRow;
  queue: QueueRow;
  meta: { key: keyof MetaValues; value: MetaValues[keyof MetaValues] };
}

type StoreName = keyof StoreRows;

const STORE_NAMES: StoreName[] = [
  "calls",
  "recordings",
  "chunks",
  "queue",
  "meta",
];

/**
 * Every operation of one transaction. A function handed to `commit` or `read`
 * may only await these: awaiting anything else lets IndexedDB auto-commit the
 * transaction before the next request.
 */
export interface Transaction {
  get<S extends StoreName>(
    store: S,
    key: IDBValidKey,
  ): Promise<StoreRows[S] | undefined>;
  getAll<S extends StoreName>(
    store: S,
    range?: IDBKeyRange,
  ): Promise<StoreRows[S][]>;
  count(store: StoreName, range?: IDBKeyRange): Promise<number>;
  put<S extends StoreName>(store: S, value: StoreRows[S]): Promise<void>;
  delete(store: StoreName, key: IDBValidKey | IDBKeyRange): Promise<void>;
  getMeta<K extends keyof MetaValues>(
    key: K,
  ): Promise<MetaValues[K] | undefined>;
  setMeta<K extends keyof MetaValues>(
    key: K,
    value: MetaValues[K],
  ): Promise<void>;
  /** `dueAt` holds the job back until then; it is due now by default. */
  enqueue(job: QueueJob, dueAt?: number): Promise<number>;
}

export function chunkRange(recordingId: string): IDBKeyRange {
  return IDBKeyRange.bound(
    [recordingId, 0],
    [recordingId, Number.MAX_SAFE_INTEGER],
  );
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexeddb request failed"));
  });
}

function wrap(transaction: IDBTransaction): Transaction {
  const store = (name: StoreName) => transaction.objectStore(name);

  const tx: Transaction = {
    get: (name, key) => settle(store(name).get(key)),
    getAll: (name, range) => settle(store(name).getAll(range)),
    count: (name, range) => settle(store(name).count(range)),
    put: async (name, value) => {
      await settle(store(name).put(value));
    },
    delete: async (name, key) => {
      await settle(store(name).delete(key));
    },
    // IndexedDB cannot relate a key to its value type; setMeta is the only writer.
    getMeta: async <K extends keyof MetaValues>(key: K) =>
      (await tx.get("meta", key))?.value as MetaValues[K] | undefined,
    setMeta: (key, value) => tx.put("meta", { key, value }),
    enqueue: async (job, dueAt) => {
      const sequence = (await tx.getMeta("nextSequence")) ?? 1;
      await tx.setMeta("nextSequence", sequence + 1);
      const createdAt = Date.now();
      await tx.put("queue", {
        sequence,
        job,
        createdAt,
        attempts: 0,
        nextAttemptAt: dueAt ?? createdAt,
        lastError: null,
      });
      return sequence;
    },
  };
  return tx;
}

function createSchema(database: IDBDatabase): void {
  database.createObjectStore("calls", { keyPath: "id" });
  database.createObjectStore("recordings", { keyPath: "id" });
  database.createObjectStore("chunks", { keyPath: ["recordingId", "seq"] });
  database.createObjectStore("queue", { keyPath: "sequence" });
  database.createObjectStore("meta", { keyPath: "key" });
}

let connection: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => createSchema(request.result);
    request.onsuccess = () => {
      const database = request.result;
      const forget = () => {
        connection = null;
        database.close();
      };
      database.onclose = forget;
      database.onversionchange = forget;
      resolve(database);
    };
    request.onerror = () => {
      connection = null;
      reject(request.error ?? new Error("failed to open indexeddb"));
    };
  });
  return connection;
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAMES, mode);
  const finished = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("indexeddb transaction aborted"));
  });

  let result: T;
  try {
    result = await work(wrap(transaction));
  } catch (error: unknown) {
    transaction.abort();
    await finished.catch(() => undefined);
    throw error;
  }
  await finished;
  return result;
}

let lastCommit: Promise<unknown> = Promise.resolve();

/**
 * Runs `work` in one readwrite transaction over every store. Commits in this
 * context run one at a time, and a throw rolls the whole transaction back.
 * IndexedDB serializes the same across the worker and the offscreen document.
 */
export function commit<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  const result = lastCommit.then(() => run("readwrite", work));
  lastCommit = result.catch(() => undefined);
  return result;
}

/** Runs `work` in one snapshot, without waiting for pending commits. */
export function read<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  return run("readonly", work);
}
