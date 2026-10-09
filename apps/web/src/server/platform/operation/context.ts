/**
 * The instant an operation happened, read once at the edge that started it.
 * Each layer's context satisfies this interface structurally. Do not time a
 * duration with it.
 */
export interface OperationContext {
  readonly operationAt: Date;
}

/**
 * A job run. `operationAt` is the instant the batch containing this job was
 * claimed, shared by every job in that batch.
 */
export interface JobContext extends OperationContext {
  readonly abortSignal: AbortSignal;
}
