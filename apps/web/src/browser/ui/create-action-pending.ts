import type { Action } from "@solidjs/router";
import { createOptimistic, type Accessor } from "solid-js";

/**
 * In-flight flag for an action invoked programmatically.
 *
 * This is the composition the router 2 migration guide prescribes — an
 * optimistic primitive written from `onSubmit` — not a replacement for one.
 * Router 2 dropped `useSubmission`, and a `Submission` is now only recorded
 * once it settles, so there is no pending entry to read. `createOptimistic`
 * fills that gap exactly: the write is tentative for the surrounding
 * transaction and reverts when the action settles, on both the success and
 * the failure path, so no caller needs a `finally`.
 *
 * Forms do not need this. `<form action={...} method="post">` carries
 * `aria-busy` for the duration of the submit and button.module.css keys the
 * busy treatment off that attribute.
 *
 * `onSubmit` fires for every invocation of the action, including ones started
 * by other components, so pass `matches` wherever one row or one tab must
 * light up alone. It receives the action's first argument, which is what every
 * caller here narrows on.
 */
export function createActionPending<T extends unknown[], U>(
  action: Action<T, U>,
  matches?: (input: T[0]) => boolean,
): Accessor<boolean> {
  const [pending, setPending] = createOptimistic(false);

  action.onSubmit((...input) => {
    if (!matches || matches(input[0])) {
      setPending(true);
    }
  });

  return pending;
}
