import { render } from "@solidjs/testing-library";
import { createRoot, createSignal, flush } from "solid-js";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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

/**
 * jsdom never lays out elements, so offsetTop/offsetLeft/offsetParent and
 * clientTop/clientLeft all read as 0/0/null by default; stub them to drive
 * axisInset's walk.
 */
function stubOffset(
  element: HTMLElement,
  offset: Partial<{
    offsetTop: number;
    offsetLeft: number;
    offsetParent: Element | null;
    clientTop: number;
    clientLeft: number;
  }>,
) {
  for (const [key, value] of Object.entries(offset)) {
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

describe("createScroll SSR safety", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns safe initial values instead of erroring when document is unavailable", async () => {
    vi.stubGlobal("document", undefined);
    // A compute-phase error with no error handler isn't thrown synchronously;
    // Solid's effect runtime retries it on the next flush and logs it via
    // console.error, so a bare try/catch around createScroll() would not
    // observe it either way.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    let scroll!: ReturnType<typeof createScroll>;
    const dispose = createRoot((disposeRoot) => {
      scroll = createScroll();
      return disposeRoot;
    });
    await tick();

    expect(scroll.scrollY.get()).toBe(0);
    expect(scroll.scrollYProgress.get()).toBe(0);
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
    dispose();
  });
});

describe("createScroll resize", () => {
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

  // motion-dom caches a single ResizeObserver instance the first time resize()
  // is called and never recreates it, so every test in this block must share
  // the one stub registered here; a per-test stub's callback would never be
  // the one motion-dom actually holds.
  let reportResize: (target: Element) => void;
  beforeAll(() => {
    reportResize = stubResizeObserver();
  });
  afterAll(() => vi.unstubAllGlobals());

  afterEach(() => document.body.replaceChildren());

  it("remeasures when the container's box changes with no scroll event at all", async () => {
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

  it("remeasures when the target's box changes independently of the container", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    let targetEl!: HTMLElement;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({ container: node, target: () => targetEl });
      return (
        <div ref={setNode}>
          <div ref={(el) => (targetEl = el)} />
        </div>
      );
    });
    const element = container.querySelector("div") as HTMLElement;
    stubBox(element, { clientHeight: 100 });
    stubBox(targetEl, { clientHeight: 300 });
    element.scrollTop = 100;
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick();
    expect(scroll.scrollYProgress.get()).toBeCloseTo(0.5);

    // Shrink only the target's own box; no scroll event, no container resize.
    stubBox(targetEl, { clientHeight: 200 });
    reportResize(targetEl);
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(1);
  });
});

describe("createScroll trackContentSize", () => {
  afterEach(() => document.body.replaceChildren());

  it("catches content growing the scroll range with no resize or scroll event", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({ container: node, trackContentSize: true });
      return <div ref={setNode} />;
    });
    const element = container.querySelector("div") as HTMLElement;
    stubBox(element, { clientHeight: 100, scrollHeight: 300 });
    element.scrollTop = 200;
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(1);

    // Content grows the scrollable range; no resize or scroll event fires.
    stubBox(element, { clientHeight: 100, scrollHeight: 500 });
    await tick(250);
    expect(scroll.scrollYProgress.get()).toBe(0.5);
  });
});

describe("createScroll offset resolution", () => {
  afterEach(() => document.body.replaceChildren());

  it("resolves target inset through a single offsetParent hop", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    let targetEl!: HTMLElement;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({
        container: node,
        target: () => targetEl,
        // Non-default range so the resolved inset alone drives progress.
        offset: [
          [0, 0],
          [0.5, 0],
        ],
      });
      return (
        <div ref={setNode}>
          <div ref={(el) => (targetEl = el)} />
        </div>
      );
    });
    const element = container.querySelector("div") as HTMLElement;
    element.style.position = "relative";
    stubBox(element, { clientHeight: 100 });
    stubBox(targetEl, { clientHeight: 100 });

    // target's offsetParent is container itself: inset is its own offsetTop.
    stubOffset(targetEl, { offsetTop: 50, offsetParent: element });

    // points are [50, 100]; walk scrollTop across that range.
    element.scrollTop = 50;
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(0);

    element.scrollTop = 75;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    expect(scroll.scrollYProgress.get()).toBeCloseTo(0.5);

    element.scrollTop = 100;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(1);
  });

  it("resolves target inset by summing an intermediate ancestor's offset", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    let wrapperEl!: HTMLElement;
    let targetEl!: HTMLElement;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({
        container: node,
        target: () => targetEl,
        // Non-default range so the resolved inset alone drives progress.
        offset: [
          [0, 0],
          [0.5, 0],
        ],
      });
      return (
        <div ref={setNode}>
          <div ref={(el) => (wrapperEl = el)}>
            <div ref={(el) => (targetEl = el)} />
          </div>
        </div>
      );
    });
    const element = container.querySelector("div") as HTMLElement;
    element.style.position = "relative";
    stubBox(element, { clientHeight: 100 });
    stubBox(targetEl, { clientHeight: 100 });

    // A positioned wrapper sits between target and container (the
    // wrapper/card/sticky-section case): both hops' offsetTop are summed.
    stubOffset(wrapperEl, { offsetTop: 20, offsetParent: element });
    stubOffset(targetEl, { offsetTop: 30, offsetParent: wrapperEl });

    element.scrollTop = 75;
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick();

    // inset 50 (20 + 30); points are [50, 100], so scrollTop 75 lands progress at 0.5.
    expect(scroll.scrollYProgress.get()).toBeCloseTo(0.5);
  });

  it("subtracts an intermediate positioned ancestor's own border from the target inset", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    let wrapperEl!: HTMLElement;
    let targetEl!: HTMLElement;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({
        container: node,
        target: () => targetEl,
        offset: [
          [0, 0],
          [0.5, 0],
        ],
      });
      return (
        <div ref={setNode}>
          <div ref={(el) => (wrapperEl = el)}>
            <div ref={(el) => (targetEl = el)} />
          </div>
        </div>
      );
    });
    const element = container.querySelector("div") as HTMLElement;
    element.style.position = "relative";
    stubBox(element, { clientHeight: 100 });
    stubBox(targetEl, { clientHeight: 100 });

    // A 10px-bordered container and a 5px-bordered positioned wrapper sit
    // between target and the document (the wrapper/card/sticky-section
    // case). Both wrapper and target are flush against their respective
    // offsetParent's padding edge (offsetTop 0 each) - offsetTop already
    // excludes each element's OWN border once, but a naive sum still drops
    // wrapper's border unless it is added back explicitly.
    stubOffset(element, { clientTop: 10 });
    stubOffset(wrapperEl, {
      offsetTop: 0,
      offsetParent: element,
      clientTop: 5,
    });
    stubOffset(targetEl, { offsetTop: 0, offsetParent: wrapperEl });

    element.scrollTop = 30;
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick();

    // inset is 5 (wrapper's own border, correctly preserved); points are
    // [5, 55], so scrollTop 30 lands progress at 0.5.
    expect(scroll.scrollYProgress.get()).toBeCloseTo(0.5);
  });

  it("resolves target inset through a single offsetParent hop on the x axis", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    let targetEl!: HTMLElement;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({
        container: node,
        target: () => targetEl,
        // Non-default range so the resolved inset alone drives progress.
        offset: [
          [0, 0],
          [0.5, 0],
        ],
      });
      return (
        <div ref={setNode}>
          <div ref={(el) => (targetEl = el)} />
        </div>
      );
    });
    const element = container.querySelector("div") as HTMLElement;
    element.style.position = "relative";
    stubBox(element, { clientWidth: 100 });
    stubBox(targetEl, { clientWidth: 100 });

    // Same setup as the y-axis hop test, mirrored onto the x axis.
    stubOffset(targetEl, { offsetLeft: 50, offsetParent: element });

    element.scrollLeft = 75;
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick();

    // points are [50, 100]; scrollLeft 75 lands progress at 0.5.
    expect(scroll.scrollXProgress.get()).toBeCloseTo(0.5);
  });
});

describe("createScroll static container", () => {
  afterEach(() => document.body.replaceChildren());

  it("resolves target inset correctly when container has position: static", async () => {
    let scroll!: ReturnType<typeof createScroll>;
    let targetEl!: HTMLElement;
    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      scroll = createScroll({
        container: node,
        target: () => targetEl,
        offset: [
          [0, 0],
          [0.5, 0],
        ],
      });
      return (
        <div ref={setNode}>
          <div ref={(el) => (targetEl = el)} />
        </div>
      );
    });
    const element = container.querySelector("div") as HTMLElement;
    // container is left position: static (jsdom's default) - never anyone's
    // offsetParent, so target's own offsetParent chain skips straight past
    // it. A walk that requires landing on `container` exactly would measure
    // from the wrong origin here; measuring each element's own document
    // offset independently and subtracting does not depend on that.
    stubBox(element, { clientHeight: 100 });
    stubBox(targetEl, { clientHeight: 100 });
    stubOffset(element, { offsetTop: 500, offsetParent: null });
    stubOffset(targetEl, { offsetTop: 550, offsetParent: null });

    element.scrollTop = 50;
    element.dispatchEvent(new Event("scroll"));
    flush();
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(0);

    element.scrollTop = 75;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    expect(scroll.scrollYProgress.get()).toBeCloseTo(0.5);

    element.scrollTop = 100;
    element.dispatchEvent(new Event("scroll"));
    await tick();
    expect(scroll.scrollYProgress.get()).toBe(1);
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
