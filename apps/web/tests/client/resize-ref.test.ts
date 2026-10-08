import { createRoot, flush } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createResizeRef } from "~/browser/ui/resize-ref";

// The helper only stores the element and reads `contentRect`, so stand-ins are
// enough and the test needs no DOM.
function fakeElement(): Element {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {} as Element;
}

function entryOfWidth(width: number): ResizeObserverEntry {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { contentRect: { width } } as ResizeObserverEntry;
}

class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];

  observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  unobserve(): void {
    return undefined;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  // A test delivers the entries a browser would.
  report(...widths: number[]): void {
    this.callback(widths.map(entryOfWidth), this);
  }
}

// Mounts a consumer the way a component does: the ref is created under an
// owner, and Solid calls it later with no owner.
function mount(onResize: (entry: ResizeObserverEntry) => void) {
  return createRoot((dispose) => ({
    ref: createResizeRef(onResize),
    dispose,
  }));
}

describe("createResizeRef", () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("observes the element the ref receives", () => {
    const element = fakeElement();
    const { ref, dispose } = mount(() => undefined);

    ref(element);
    flush();

    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(FakeResizeObserver.instances[0].observed).toHaveLength(1);
    expect(FakeResizeObserver.instances[0].observed[0]).toBe(element);
    dispose();
  });

  it("observes nothing until the ref receives an element", () => {
    const { dispose } = mount(() => undefined);

    flush();

    expect(FakeResizeObserver.instances).toHaveLength(0);
    dispose();
  });

  it("disconnects the observer when the owner is disposed", () => {
    const { ref, dispose } = mount(() => undefined);
    ref(fakeElement());
    flush();

    expect(FakeResizeObserver.instances[0].disconnected).toBe(false);

    dispose();

    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
  });

  it("reports the latest entry of a batch", () => {
    const widths: number[] = [];
    const { ref, dispose } = mount((entry) =>
      widths.push(entry.contentRect.width),
    );
    ref(fakeElement());
    flush();

    FakeResizeObserver.instances[0].report(10, 20);

    expect(widths).toEqual([20]);
    dispose();
  });
});
