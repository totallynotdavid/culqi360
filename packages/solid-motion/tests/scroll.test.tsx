import { createRoot, createSignal, flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMotionValue,
  createTime,
  createVelocity,
} from "../src";

async function tick(ms = 80) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createVelocity", () => {
  it("tracks a source's velocity and decays to zero once it stops changing", async () => {
    let x!: ReturnType<typeof createMotionValue<number>>;
    let velocity!: ReturnType<typeof createVelocity>;
    const dispose = createRoot((disposeRoot) => {
      x = createMotionValue(0);
      velocity = createVelocity(x);
      return disposeRoot;
    });

    expect(velocity.get()).toBe(0);

    // MotionValue samples time once per synchronous block, so wait for a frame
    // before the first write.
    await tick();
    x.set(100);
    // Check before the source's velocity becomes stale.
    await tick(20);
    expect(velocity.get()).toBeGreaterThan(0);

    await tick(150);
    expect(velocity.get()).toBe(0);

    dispose();
  });
});

describe("createTime", () => {
  it("counts milliseconds from its own creation and stops on disposal", async () => {
    let value!: ReturnType<typeof createTime>;
    const dispose = createRoot((disposeRoot) => {
      value = createTime();
      return disposeRoot;
    });

    expect(value.get()).toBe(0);
    await tick();
    const beforeDispose = value.get();
    expect(beforeDispose).toBeGreaterThan(0);

    dispose();
    await tick();
    expect(value.get()).toBe(beforeDispose);
  });
});
