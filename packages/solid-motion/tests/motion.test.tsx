import { render } from "@solidjs/testing-library";
import { type JSX } from "@solidjs/web";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimatePresence, motion } from "../src";

describe("motion", () => {
  afterEach(() => document.body.replaceChildren());

  it("renders an intrinsic element with pass-through attrs and children", () => {
    const { container } = render(() => (
      <motion.div class="card" data-x="1">
        hello
      </motion.div>
    ));

    const element = container.querySelector("div.card") as HTMLElement;
    expect(element).toBeTruthy();
    expect(element.dataset.x).toBe("1");
    expect(element.textContent).toBe("hello");
  });

  it("renders initial opacity and transform values as inline style", () => {
    const { container } = render(() => (
      <motion.div initial={{ opacity: 0, y: 20 }}>x</motion.div>
    ));

    const element = container.querySelector("div") as HTMLElement;
    expect(element.style.opacity).toBe("0");
    expect(element.style.transform).toContain("translateY(20px)");
  });

  it("resolves named variants with custom data", () => {
    const { container } = render(() => (
      <motion.div
        custom={20}
        initial="hidden"
        variants={{
          hidden: (distance: number) => ({ y: distance, opacity: 0 }),
        }}
      />
    ));

    const element = container.querySelector("div") as HTMLElement;
    expect(element.style.opacity).toBe("0");
    expect(element.style.transform).toContain("translateY(20px)");
  });

  it("wraps a custom component with motion.create", () => {
    function Badge(props: { children?: JSX.Element; class?: string }) {
      return <span {...props} />;
    }

    const MotionBadge = motion.create(Badge);
    const { container } = render(() => (
      <MotionBadge class="badge" initial={{ opacity: 0 }}>
        ready
      </MotionBadge>
    ));

    const element = container.querySelector("span.badge") as HTMLElement;
    expect(element.textContent).toBe("ready");
    expect(element.style.opacity).toBe("0");
  });

  it("preserves callback refs in a nested Solid 2 ref tree", () => {
    const firstRef = vi.fn<(element: unknown) => void>();
    const secondRef = vi.fn<(element: unknown) => void>();

    const { container } = render(() => (
      <motion.div ref={[[firstRef], secondRef]}>ready</motion.div>
    ));

    const element = container.querySelector("div");
    expect(firstRef).toHaveBeenCalledWith(element);
    expect(secondRef).toHaveBeenCalledWith(element);
  });
});

describe("AnimatePresence", () => {
  afterEach(() => document.body.replaceChildren());

  it("keeps an exiting child mounted until its animation settles", async () => {
    const onStart = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const [items, setItems] = createSignal([{ id: "one" }]);
    const { container } = render(() => (
      <AnimatePresence each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: 0 }}
            onAnimationStart={onStart}
            onAnimationComplete={onComplete}
            transition={{ duration: 0.1 }}
            data-id={item().id}
          />
        )}
      </AnimatePresence>
    ));

    expect(container.querySelector('[data-id="one"]')).toBeTruthy();
    setItems([]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onStart).toHaveBeenCalled();
    expect(container.querySelector('[data-id="one"]')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(container.querySelector('[data-id="one"]')).toBeNull();
    expect(onComplete).toHaveBeenCalled();
  });

  it("passes initial=false from the boundary to its first child", () => {
    const { container } = render(() => (
      <AnimatePresence
        each={[{ id: "one" }]}
        getKey={(item) => item.id}
        initial={false}
      >
        {() => (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0 }}
          />
        )}
      </AnimatePresence>
    ));

    const element = container.querySelector("div") as HTMLElement;
    expect(element.style.opacity).not.toBe("0");
  });

  it("removes an item immediately when no exit target is defined", async () => {
    const [items, setItems] = createSignal([{ id: "one" }]);
    const { container } = render(() => (
      <AnimatePresence each={items()} getKey={(item) => item.id}>
        {(item) => <motion.div data-id={item().id} />}
      </AnimatePresence>
    ));

    setItems([]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('[data-id="one"]')).toBeNull();
  });
});

describe("exit cancellation", () => {
  afterEach(() => document.body.replaceChildren());

  it("keeps a re-entering child mounted instead of letting the stale exit remove it", async () => {
    const [items, setItems] = createSignal([{ id: "one" }]);
    const { container } = render(() => (
      <AnimatePresence each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            data-id={item().id}
          />
        )}
      </AnimatePresence>
    ));

    setItems([]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.querySelector('[data-id="one"]')).toBeTruthy();

    // Re-entry supersedes the exit. Motion never settles a cancelled
    // animation's `finished`, so the only thing that can release the boundary's
    // hold is the controller reporting that this pass lost.
    setItems([{ id: "one" }]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(container.querySelector('[data-id="one"]')).toBeTruthy();

    // Exiting a second time is what proves the first hold was released rather
    // than merely ignored: a leaked hold never lets the count reach zero, and
    // this item would stay on screen forever.
    setItems([]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(container.querySelector('[data-id="one"]')).toBeNull();
  });

  it("still leaves when a second exit pass supersedes the first", async () => {
    const [items, setItems] = createSignal([{ id: "one" }]);
    const [fade, setFade] = createSignal(0);
    const { container } = render(() => (
      <AnimatePresence each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: fade() }}
            transition={{ duration: 0.1 }}
            data-id={item().id}
          />
        )}
      </AnimatePresence>
    ));

    setItems([]);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // A second exit pass while the item is still leaving. Each pass carries its
    // own hold: release the wrong one and the count touches zero mid-exit and
    // the item is torn out early; release none and it never leaves at all.
    setFade(0.5);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.querySelector('[data-id="one"]')).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(container.querySelector('[data-id="one"]')).toBeNull();
  });

  it("releases the boundary when an exiting child is disposed mid-animation", async () => {
    const [items, setItems] = createSignal([{ id: "one" }]);
    const { container, unmount } = render(() => (
      <AnimatePresence each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 5 }}
            data-id={item().id}
          />
        )}
      </AnimatePresence>
    ));

    setItems([]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.querySelector('[data-id="one"]')).toBeTruthy();

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.querySelector('[data-id="one"]')).toBeNull();
  });
});
