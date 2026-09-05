import { render } from "@solidjs/testing-library";
import { createRoot, createSignal, flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMotionValue,
  createScroll,
  createTime,
  createVelocity,
} from "../src";

function stubBox(
  element: HTMLElement,
  box: Partial<
    Record<
      "clientHeight" | "clientWidth" | "scrollHeight" | "scrollWidth",
      number
    >
  >,
) {
  for (const [key, value] of Object.entries(box)) {
    Object.defineProperty(element, key, { value, configurable: true });
  }
}

async function tick(ms = 80) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createScroll", () => {
  afterEach(() => document.body.replaceChildren());

  it("tracks a container's scroll position through its configured offset range", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({
        container: node,
        // Use a non-default range to verify offset resolution.
        offset: [
          [0, 0],
          [0.5, 0],
        ],
      });
      return <div ref={setNode} />;
    });
    const element = container.querySelector("div") as HTMLElement;
    // Refresh the mount measurement after replacing jsdom's zero-size layout.
    stubBox(element, { clientHeight: 200, scrollHeight: 1000 });
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick(250);

    expect(scroll.scrollY.get()).toBe(0);
    expect(scroll.scrollYProgress.get()).toBe(0);

    element.scrollTop = 250;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    expect(scroll.scrollY.get()).toBe(250);
    expect(scroll.scrollYProgress.get()).toBeCloseTo(0.5);

    element.scrollTop = 500;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(1);

    element.scrollTop = 800;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(1);
  });

  it("stops tracking once the owning scope is disposed", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    const { container, unmount } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({ container: node });
      return <div ref={setNode} />;
    });
    const element = container.querySelector("div") as HTMLElement;
    stubBox(element, { clientHeight: 100, scrollHeight: 300 });
    flush();
    await tick();

    element.scrollTop = 100;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    const trackedProgress = scroll.scrollYProgress.get();
    expect(trackedProgress).toBeGreaterThan(0);

    unmount();

    element.scrollTop = 300;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(trackedProgress);
  });
});

describe("createScroll resize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  /** jsdom lacks ResizeObserver, so provide the callback used by resize. */
  function stubResizeObserver() {
    let report: ResizeObserverCallback | undefined;
    class StubResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        report = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    return (target: Element) =>
      report?.(
        [{ target } as ResizeObserverEntry],
        null as unknown as ResizeObserver,
      );
  }

  it("remeasures when the container's box changes with no scroll event at all", async () => {
    const reportResize = stubResizeObserver();
    let scroll!: ReturnType<typeof createScroll>;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({ container: node });
      return <div ref={setNode} />;
    });
    const element = container.querySelector("div") as HTMLElement;
    // Refresh the initial measurement after replacing jsdom's zero-size layout.
    stubBox(element, { clientHeight: 100, scrollHeight: 300 });
    element.scrollTop = 200;
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(1);

    // Change only the scrollable range; no scroll event is dispatched.
    stubBox(element, { clientHeight: 100, scrollHeight: 500 });
    reportResize(element);
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(0.5);
  });
});

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
