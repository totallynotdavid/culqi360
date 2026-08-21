import type { Action } from "@solidjs/router";
import { createOptimistic, type Accessor } from "solid-js";

/**
 * Whether any invocation of `action` is in flight.
 *
 * Router 2 records a `Submission` only once it settles, so pending state comes
 * from `onSubmit` instead. The write is optimistic: it reverts when the action
 * settles, on both the success and the failure path, so there is no `finally`
 * to keep in sync.
 *
 * Forms do not need this. `<form action={...} method="post">` carries
 * `aria-busy` for the duration of the submit and button.module.css keys the
 * busy treatment off that attribute.
 */
export function createActionPending<T extends unknown[], U>(
  action: Action<T, U>,
): Accessor<boolean> {
  const [pending, setPending] = createOptimistic(false);

  action.onSubmit(() => setPending(true));

  return pending;
}

/**
 * What the in-flight invocation of `action` is acting on — its first argument —
 * or `undefined` while the action is idle.
 *
 * Use this wherever more than one thing on screen can start the same action.
 * `onSubmit` fires for every invocation, including ones started elsewhere, so
 * the alternative is a boolean per row, each with its own subscription, to
 * express one piece of state.
 */
export function createActionTarget<T extends unknown[], U>(
  action: Action<T, U>,
): Accessor<T[0] | undefined> {
  const [target, setTarget] = createOptimistic<T[0] | undefined>();

  action.onSubmit((...input) => setTarget(() => input[0]));

  return target;
}
