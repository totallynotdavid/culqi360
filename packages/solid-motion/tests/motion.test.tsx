import { render } from "@solidjs/testing-library";
import { type JSX } from "@solidjs/web";
import { createContext, createSignal, flush, useContext } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnimatePresence,
  AnimatePresenceList,
  createMotion,
  createInView,
  createMotionValue,
  MotionConfig,
  motion,
  stagger,
} from "../src";
import { buildInitialRender } from "../src/initial";

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

  it("paints exactly the initial style the server would have emitted", () => {
    const target = {
      opacity: 0,
      x: 10,
      scale: 0.9,
      // Two-word properties, because the style is handed to a JSX `style` prop
      // and `setProperty` ignores a camelCase name without complaining. Both of
      // these were dropped from the markup while the animation applied them.
      pointerEvents: "none",
      transformOrigin: "0% 100%",
      "--tint": "red",
      transitionEnd: { rotate: 45 },
    };
    const { container } = render(() => <motion.div initial={target} />);
    const element = container.querySelector("div") as HTMLElement;

    // The server has no element, so the two paths are separate code. Them
    // disagreeing is a hydration flash, and they have disagreed before: the
    // raw-value path used to drop the `transitionEnd` the style path kept.
    const painted = buildInitialRender(target, "div");
    for (const [key, value] of Object.entries(painted.style)) {
      expect(String(element.style.getPropertyValue(key))).toBe(String(value));
    }
    expect(element.style.transform).toBe(
      "translateX(10px) scale(0.9) rotate(45deg)",
    );
    expect(element.style.getPropertyValue("pointer-events")).toBe("none");
  });

  it("renders a keyframe array at the value the element is born with", () => {
    // A CSS builder has no reading of an array: handed `[0, 100]` it emitted
    // `transform: none` and an opacity of the literal string "0,1", and the
    // server sent that markup before the animation corrected it a frame later.
    const { container } = render(() => (
      <motion.div initial={{ x: [40, 100], opacity: [0, 1] }} />
    ));
    const entering = container.querySelector("div") as HTMLElement;
    expect(entering.style.opacity).toBe("0");
    expect(entering.style.transform).toBe("translateX(40px)");
  });

  it("renders the last keyframe when the entrance is blocked", () => {
    // `initial={false}` means the element is born where the animation it is
    // not playing would have ended, so the far end of the sequence is what
    // describes it.
    const { container } = render(() => (
      <motion.div initial={false} animate={{ x: [40, 100], opacity: [0, 1] }} />
    ));
    const settled = container.querySelector("div") as HTMLElement;
    expect(settled.style.opacity).toBe("1");
    expect(settled.style.transform).toBe("translateX(100px)");
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

describe("AnimatePresenceList", () => {
  afterEach(() => document.body.replaceChildren());

  it("keeps an exiting child mounted until its animation settles", async () => {
    const onStart = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const [items, setItems] = createSignal([{ id: "one" }]);
    const { container } = render(() => (
      <AnimatePresenceList each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: 0 }}
            onAnimationStart={onStart}
            onAnimationComplete={onComplete}
            transition={{ duration: 0.1 }}
            data-id={item().id}
          />
        )}
      </AnimatePresenceList>
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
      <AnimatePresenceList
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
      </AnimatePresenceList>
    ));

    const element = container.querySelector("div") as HTMLElement;
    expect(element.style.opacity).not.toBe("0");
  });

  it("reports duplicate keys without taking the reactive system down", () => {
    const reported = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { container } = render(() => (
      <AnimatePresenceList
        each={[{ id: "same" }, { id: "same" }]}
        getKey={(item) => item.id}
      >
        {(item) => <motion.div data-id={item().id} />}
      </AnimatePresenceList>
    ));

    expect(reported).toHaveBeenCalled();
    // One row per distinct key, and the page still works.
    expect(container.querySelectorAll('[data-id="same"]')).toHaveLength(1);
    reported.mockRestore();
  });

  it("keeps a surviving row's data current without recreating it", async () => {
    const [items, setItems] = createSignal([{ id: "one", label: "first" }]);
    const { container } = render(() => (
      <AnimatePresenceList each={items()} getKey={(item) => item.id}>
        {(item) => <motion.div data-id={item().id}>{item().label}</motion.div>}
      </AnimatePresenceList>
    ));

    const element = container.querySelector('[data-id="one"]') as HTMLElement;
    setItems([{ id: "one", label: "second" }]);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(element.textContent).toBe("second");
    // Same node: new data must not cost a remount.
    expect(container.querySelector('[data-id="one"]')).toBe(element);
  });

  it("holds an exiting row at its old position instead of moving it", async () => {
    const [items, setItems] = createSignal([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    const { container } = render(() => (
      <AnimatePresenceList each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            data-id={item().id}
          />
        )}
      </AnimatePresenceList>
    ));
    const order = () =>
      [...container.querySelectorAll("[data-id]")].map((node) =>
        node.getAttribute("data-id"),
      );

    // Drop the middle row. While it animates out it must stay in the middle,
    // not slide to the end of the list.
    setItems([{ id: "a" }, { id: "c" }]);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(order()).toEqual(["a", "b", "c"]);
  });

  it("removes an item immediately when no exit target is defined", async () => {
    const [items, setItems] = createSignal([{ id: "one" }]);
    const { container } = render(() => (
      <AnimatePresenceList each={items()} getKey={(item) => item.id}>
        {(item) => <motion.div data-id={item().id} />}
      </AnimatePresenceList>
    ));

    setItems([]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('[data-id="one"]')).toBeNull();
  });
});

const Theme = createContext("unset");

describe("AnimatePresence", () => {
  afterEach(() => document.body.replaceChildren());

  it("keeps a conditional subtree mounted while it animates out", async () => {
    const [open, setOpen] = createSignal(true);
    const { container } = render(() => (
      <AnimatePresence when={open()}>
        {() => (
          <motion.div
            class="panel"
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>
    ));
    expect(container.querySelector(".panel")).toBeTruthy();

    // Solid disposes a conditional branch the instant its condition flips, so
    // a boundary reacting to the child disappearing would find the motion
    // element's cleanup already done. The boundary owning the root is what
    // buys this window.
    setOpen(false);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 60));
    const exiting = container.querySelector(".panel") as HTMLElement;
    expect(exiting).toBeTruthy();
    expect(Number(exiting.style.opacity)).toBeLessThan(1);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(container.querySelector(".panel")).toBeNull();
  });

  it("runs the outgoing and incoming subtrees together when the key changes", async () => {
    const [page, setPage] = createSignal("a");
    const { container } = render(() => (
      <AnimatePresence when={page()}>
        {(name) => (
          <motion.div
            class={`page-${name}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>
    ));

    // The entrance has to land first. Swapping in the same tick leaves the
    // outgoing element still sitting at its `initial` opacity of 0, which is
    // exactly what `exit` asks for, so there is nothing to animate and it
    // leaves at once. Motion resolves it against the element's current values
    // and behaves the same way.
    await new Promise((resolve) => setTimeout(resolve, 200));

    setPage("b");
    flush();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(container.querySelector(".page-a")).toBeTruthy();
    expect(container.querySelector(".page-b")).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(container.querySelector(".page-a")).toBeNull();
    expect(container.querySelector(".page-b")).toBeTruthy();
  });

  it("builds the subtree inside the context surrounding the boundary", () => {
    // The whole design rests on `createRoot` inheriting the current owner, so
    // a subtree the boundary builds still sees the app's providers. If that
    // ever stopped holding, every context read below a boundary would quietly
    // fall back to its default.
    const { container } = render(() => (
      <Theme value="dark">
        <AnimatePresence when={true}>
          {() => <motion.div class="panel" data-theme={useContext(Theme)} />}
        </AnimatePresence>
      </Theme>
    ));

    const panel = container.querySelector(".panel") as HTMLElement;
    expect(panel.dataset.theme).toBe("dark");
  });

  it("revives a subtree that returns mid-exit rather than building a second", async () => {
    const [open, setOpen] = createSignal(true);
    const { container } = render(() => (
      <AnimatePresence when={open()}>
        {() => (
          <motion.div
            class="panel"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>
    ));

    setOpen(false);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 60));

    setOpen(true);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 40));

    // Checked here rather than at the end. Building a second subtree beside the
    // one still leaving also settles on a single panel once the first finishes
    // exiting, so only the overlap catches it.
    expect(container.querySelectorAll(".panel")).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(container.querySelectorAll(".panel")).toHaveLength(1);
  });
});

describe("exit cancellation", () => {
  afterEach(() => document.body.replaceChildren());

  it("keeps a re-entering child mounted instead of letting the stale exit remove it", async () => {
    const [items, setItems] = createSignal([{ id: "one" }]);
    const { container } = render(() => (
      <AnimatePresenceList each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            data-id={item().id}
          />
        )}
      </AnimatePresenceList>
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
      <AnimatePresenceList each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: fade() }}
            transition={{ duration: 0.1 }}
            data-id={item().id}
          />
        )}
      </AnimatePresenceList>
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
      <AnimatePresenceList each={items()} getKey={(item) => item.id}>
        {(item) => (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 5 }}
            data-id={item().id}
          />
        )}
      </AnimatePresenceList>
    ));

    setItems([]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.querySelector('[data-id="one"]')).toBeTruthy();

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.querySelector('[data-id="one"]')).toBeNull();
  });
});

describe("value-level diffing", () => {
  afterEach(() => document.body.replaceChildren());

  it("leaves an in-flight value alone when a different key changes", async () => {
    const [opacity, setOpacity] = createSignal(1);
    const { container } = render(() => (
      <motion.div
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: opacity(), x: 200 }}
        transition={{ duration: 0.4, ease: "linear" }}
      />
    ));
    const element = container.querySelector("div") as HTMLElement;

    await new Promise((resolve) => setTimeout(resolve, 200));
    const midpoint = readTranslateX(element);
    expect(midpoint).toBeGreaterThan(20);

    // Only `opacity` changed. Restarting the pass wholesale would stop `x` and
    // re-ease it from wherever it happens to be, so it would fall behind.
    setOpacity(0.5);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(readTranslateX(element)).toBeGreaterThan(midpoint + 40);
  });

  it("returns a key to its base value once the target stops naming it", async () => {
    const [shifted, setShifted] = createSignal(true);
    const { container } = render(() => (
      <motion.div
        initial={{ opacity: 1 }}
        animate={shifted() ? { opacity: 1, x: 100 } : { opacity: 1 }}
        transition={{ duration: 0.1 }}
      />
    ));
    const element = container.querySelector("div") as HTMLElement;

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(readTranslateX(element)).toBe(100);

    // This is what makes a gesture releasable: when the layer that contributed
    // `x` stops contributing it, `x` has to go somewhere rather than staying
    // where it was left.
    setShifted(false);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(readTranslateX(element)).toBe(0);
  });

  it("keeps a keyframe sequence running through an unrelated value change", async () => {
    const [x, setX] = createSignal(0);
    const { container } = render(() => (
      <motion.div
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: [0, 1], x: x() }}
        transition={{ duration: 0.4, ease: "linear" }}
      />
    ));
    const element = container.querySelector("div") as HTMLElement;

    await new Promise((resolve) => setTimeout(resolve, 220));
    const midpoint = Number(element.style.opacity);
    expect(midpoint).toBeGreaterThan(0.3);

    // Reading `x()` inside the target rebuilds the whole object, so an equal
    // but freshly allocated `[0, 1]` arrives on this pass. Compared by
    // identity it looks like a new target and the sequence restarts from its
    // first keyframe, which is what per-value diffing exists to prevent.
    setX(50);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(Number(element.style.opacity)).toBeGreaterThan(midpoint);
  });
});

/**
 * jsdom performs no layout, so every box measures zero. Reporting a natural
 * height only while the inline height is `auto` is exactly the question the
 * resolver asks the DOM, which makes the measurement path testable without
 * pretending jsdom lays anything out.
 */
function stubNaturalHeight(element: HTMLElement, natural: number) {
  element.getBoundingClientRect = () => {
    const inline = element.style.height;
    const height =
      inline === "auto" || inline === "" ? natural : parseFloat(inline) || 0;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: height,
      width: 200,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

describe("MotionConfig", () => {
  afterEach(() => document.body.replaceChildren());

  const settled = (target: Record<string, unknown>) => (
    <MotionConfig skipAnimations>
      <motion.div initial={{ opacity: 0 }} animate={target} />
    </MotionConfig>
  );

  it("skips animations whichever transition wins", async () => {
    // The element-level case worked all along. The other two did not: a target
    // carrying its own transition replaces the element's, so a flag folded
    // into the element's transition upstream was dropped exactly when a
    // variant or an inline `exit={{ ..., transition }}` was in play.
    const own = render(() => (
      <MotionConfig skipAnimations>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
        />
      </MotionConfig>
    ));
    const target = render(() =>
      settled({ opacity: 1, transition: { duration: 2 } }),
    );
    const variant = render(() => (
      <MotionConfig skipAnimations>
        <motion.div
          initial="hidden"
          animate="shown"
          variants={{
            hidden: { opacity: 0 },
            shown: { opacity: 1, transition: { duration: 2 } },
          }}
        />
      </MotionConfig>
    ));

    await new Promise((resolve) => setTimeout(resolve, 80));
    for (const { container } of [own, target, variant]) {
      const element = container.querySelector("div") as HTMLElement;
      expect(element.style.opacity).toBe("1");
    }
  });
});

describe("measured keyframes", () => {
  afterEach(() => document.body.replaceChildren());

  it("animates height towards a measured auto and lands on auto", async () => {
    const [open, setOpen] = createSignal(false);
    const { container } = render(() => (
      <motion.div
        initial={{ height: 0 }}
        animate={open() ? { height: "auto" } : { height: 0 }}
        transition={{ duration: 0.3, ease: "linear" }}
      >
        <p>content</p>
      </motion.div>
    ));
    const element = container.querySelector("div") as HTMLElement;
    stubNaturalHeight(element, 120);

    setOpen(true);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Mid-flight it is a number, which is the whole point: `0px` to `auto` is
    // not an interpolation any engine can perform without measuring first.
    const midpoint = parseFloat(element.style.height);
    expect(midpoint).toBeGreaterThan(0);
    expect(midpoint).toBeLessThan(120);

    // And it has to land on `auto`, not on the pixel height it measured, or
    // the element stops responding to its own content.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(element.style.height).toBe("auto");

    // Measuring strips scale and rotate first so they cannot skew the box, and
    // asks whether each one exists rather than creating it. Creating them
    // hands the element a `transform: none` it never asked for, over the top
    // of whatever its stylesheet was doing.
    expect(element.style.transform).toBe("");

    setOpen(false);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(element.style.height).toBe("0px");
  });
});

describe("style values", () => {
  afterEach(() => document.body.replaceChildren());

  it("paints a caller-owned value at first render", () => {
    const x = createMotionValue(25);
    const { container } = render(() => <motion.div style={{ x }} />);

    // Binding a value that already holds a number records it in motion's shared
    // style state but schedules no repaint, so the composite would sit at
    // `none` until something else moved. The inline style is what closes that.
    const element = container.querySelector("div") as HTMLElement;
    expect(element.style.transform).toBe("translateX(25px)");
  });

  it("animates the caller's own value rather than a copy of it", async () => {
    const x = createMotionValue(0);
    render(() => (
      <motion.div
        style={{ x }}
        animate={{ x: 200 }}
        transition={{ duration: 0.1 }}
      />
    ));

    await new Promise((resolve) => setTimeout(resolve, 250));
    // Reading the animation back out is the whole point of handing a value in.
    expect(x.get()).toBe(200);
  });

  it("drives a transform from a signal while plain css stays reactive", async () => {
    const [x, setX] = createSignal(10);
    const [background, setBackground] = createSignal("red");
    const { container } = render(() => (
      <motion.div style={{ x, background: background() }} />
    ));
    const element = container.querySelector("div") as HTMLElement;

    expect(element.style.transform).toBe("translateX(10px)");
    expect(element.style.background).toBe("red");

    setX(80);
    setBackground("blue");
    flush();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(element.style.transform).toBe("translateX(80px)");
    expect(element.style.background).toBe("blue");
  });

  it("springs towards a signal instead of jumping to it", async () => {
    const [target, setTarget] = createSignal(0);
    const x = createMotionValue(target, { stiffness: 200, damping: 20 });
    render(() => <motion.div style={{ x }} />);

    setTarget(100);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Mid-flight: a value that mirrored its source would already read 100.
    const midpoint = Number(x.get());
    expect(midpoint).toBeGreaterThan(0);
    expect(midpoint).toBeLessThan(60);

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(Number(x.get())).toBeCloseTo(100, 0);
  });
});

describe("createMotion", () => {
  afterEach(() => document.body.replaceChildren());

  it("animates an element the caller renders, initial style included", async () => {
    const { container } = render(() => {
      const anim = createMotion(() => ({
        initial: { opacity: 0, x: 0 },
        animate: { opacity: 1, x: 100 },
        transition: { duration: 0.1 },
      }));
      // A literal element, not a Dynamic: `class` stays a compiled setter.
      return <span class="leaf" style={anim.style} ref={anim.ref} />;
    });

    const element = container.querySelector("span.leaf") as HTMLElement;
    expect(element.style.opacity).toBe("0");

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(element.style.opacity).toBe("1");
    expect(readTranslateX(element)).toBe(100);
  });

  it("responds to a gesture without a component boundary", async () => {
    const { container } = render(() => {
      const anim = createMotion(() => ({
        whileHover: { scale: 1.5 },
        transition: { duration: 0.05 },
      }));
      return <span style={anim.style} ref={anim.ref} />;
    });

    const element = container.querySelector("span") as HTMLElement;
    element.dispatchEvent(
      new PointerEvent("pointerenter", {
        pointerType: "mouse",
        isPrimary: true,
        bubbles: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(readScale(element)).toBe(1.5);
  });
});

function readTranslateX(element: HTMLElement): number {
  const match = /translateX\((-?[\d.]+)px\)/.exec(element.style.transform);
  return match ? Number(match[1]) : 0;
}

describe("gestures", () => {
  afterEach(() => document.body.replaceChildren());

  const pointer = (type: string) =>
    new PointerEvent(type, {
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      bubbles: true,
    });

  it("raises on hover and releases back to base", async () => {
    const { container } = render(() => (
      <motion.div whileHover={{ scale: 1.5 }} transition={{ duration: 0.05 }} />
    ));
    const element = container.querySelector("div") as HTMLElement;

    element.dispatchEvent(pointer("pointerenter"));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(readScale(element)).toBe(1.5);

    // Releasing only works because the layer that contributed `scale` stopping
    // contributing sends `scale` back to the value it was bound at.
    element.dispatchEvent(pointer("pointerleave"));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(readScale(element)).toBe(1);
  });

  it("stacks press above hover", async () => {
    const { container } = render(() => (
      <motion.div
        whileHover={{ scale: 1.2 }}
        whilePress={{ scale: 0.8 }}
        transition={{ duration: 0.05 }}
      />
    ));
    const element = container.querySelector("div") as HTMLElement;

    element.dispatchEvent(pointer("pointerenter"));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(readScale(element)).toBe(1.2);

    element.dispatchEvent(pointer("pointerdown"));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(readScale(element)).toBe(0.8);
  });
});

function readScale(element: HTMLElement): number {
  const match = /scale\(([\d.]+)\)/.exec(element.style.transform);
  return match ? Number(match[1]) : 1;
}

describe("variant propagation", () => {
  afterEach(() => document.body.replaceChildren());

  const fade = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

  it("cascades the parent label to children and staggers them", async () => {
    const [state, setState] = createSignal("hidden");
    const { container } = render(() => (
      <motion.div
        animate={state()}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.2 } },
        }}
      >
        <motion.span
          data-i="0"
          variants={fade}
          initial="hidden"
          transition={{ duration: 0.05 }}
        />
        <motion.span
          data-i="1"
          variants={fade}
          initial="hidden"
          transition={{ duration: 0.05 }}
        />
        <motion.span
          data-i="2"
          variants={fade}
          initial="hidden"
          transition={{ duration: 0.05 }}
        />
      </motion.div>
    ));
    const opacityOf = (index: number) =>
      (container.querySelector(`[data-i="${index}"]`) as HTMLElement).style
        .opacity;

    setState("visible");
    flush();

    // Halfway through the stagger the last child has not been released yet.
    await new Promise((resolve) => setTimeout(resolve, 320));
    expect(opacityOf(0)).toBe("1");
    expect(opacityOf(2)).toBe("0");

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(opacityOf(2)).toBe("1");
  });

  it("lets a child's own prop win over the inherited label", async () => {
    const { container } = render(() => (
      <motion.div animate="visible" variants={{ visible: {} }}>
        <motion.span
          data-i="inherits"
          variants={fade}
          initial="hidden"
          transition={{ duration: 0.05 }}
        />
        <motion.span
          data-i="overrides"
          variants={fade}
          initial="hidden"
          animate="hidden"
          transition={{ duration: 0.05 }}
        />
      </motion.div>
    ));

    await new Promise((resolve) => setTimeout(resolve, 200));
    const opacityOf = (name: string) =>
      (container.querySelector(`[data-i="${name}"]`) as HTMLElement).style
        .opacity;
    expect(opacityOf("inherits")).toBe("1");
    expect(opacityOf("overrides")).toBe("0");
  });
});

describe("whileInView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  /** jsdom has no IntersectionObserver, so the wiring is what gets tested. */
  function stubObserver() {
    const state: {
      callback?: IntersectionObserverCallback;
      options?: IntersectionObserverInit;
      unobserved: Element[];
    } = { unobserved: [] };

    class StubObserver {
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        state.callback = callback;
        state.options = options;
      }
      observe() {}
      unobserve(element: Element) {
        state.unobserved.push(element);
      }
      disconnect() {}
    }

    vi.stubGlobal("IntersectionObserver", StubObserver);
    return {
      state,
      report: (target: Element, isIntersecting: boolean) =>
        state.callback?.(
          [{ target, isIntersecting } as IntersectionObserverEntry],
          null as unknown as IntersectionObserver,
        ),
    };
  }

  it("follows the element in and out of view", async () => {
    const observer = stubObserver();
    const { container } = render(() => (
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.05 }}
      />
    ));
    const element = container.querySelector("div") as HTMLElement;
    await new Promise((resolve) => setTimeout(resolve, 250));

    observer.report(element, true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(element.style.opacity).toBe("1");

    observer.report(element, false);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(element.style.opacity).toBe("0");
  });

  it("stops observing after the first entry when once is set", async () => {
    const observer = stubObserver();
    const { container } = render(() => (
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: "all" }}
        transition={{ duration: 0.05 }}
      />
    ));
    const element = container.querySelector("div") as HTMLElement;
    await new Promise((resolve) => setTimeout(resolve, 250));

    // `viewport` configures the observer; it is not an attribute. Leaving it
    // out of the forwarded set rendered `viewport="[object Object]"` into the
    // markup, which the server emitted too.
    expect(element.hasAttribute("viewport")).toBe(false);
    expect(observer.state.options?.threshold).toBe(1);

    observer.report(element, true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(observer.state.unobserved).toContain(element);

    // Leaving the viewport must not take it back: that is what `once` means.
    observer.report(element, false);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(element.style.opacity).toBe("1");
  });

  it("reports visibility on its own, with no animation attached", async () => {
    const observer = stubObserver();
    let inView!: () => boolean;

    const { container } = render(() => {
      const [node, setNode] = createSignal<HTMLElement>();
      inView = createInView(node, { margin: "400px" });
      return <div ref={setNode} />;
    });
    const element = container.querySelector("div") as HTMLElement;
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(observer.state.options?.rootMargin).toBe("400px");
    expect(inView()).toBe(false);

    observer.report(element, true);
    flush();
    expect(inView()).toBe(true);

    observer.report(element, false);
    flush();
    expect(inView()).toBe(false);
  });

  it("writes an svg child's geometry as attributes, never as style", async () => {
    // `x1` is not a CSS property in any browser, so the whole SVG path was
    // inert: the initial target painted nothing and the animation wrote a
    // style declaration the renderer ignored.
    const [wide, setWide] = createSignal(false);

    const { container } = render(() => (
      <svg viewBox="0 0 100 100">
        <motion.line
          initial={{ x1: 0, x2: 0 }}
          animate={{ x2: wide() ? 100 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </svg>
    ));

    const line = container.querySelector("line") as SVGLineElement;
    expect(line.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(line.getAttribute("x1")).toBe("0");
    expect(line.getAttribute("style")).toBe(null);

    setWide(true);
    flush();

    // Sampled mid-flight, not at the end: an implementation that jumped
    // straight to the target would satisfy an end-state assertion.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const midway = Number(line.getAttribute("x2"));
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(100);
    expect(line.getAttribute("style")).toBe(null);

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(line.getAttribute("x2")).toBe("100");
  });

  it("draws a path on by animating its dash pair", async () => {
    const { container } = render(() => (
      <svg viewBox="0 0 100 100">
        <motion.path
          d="M0 0 L100 100"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3 }}
        />
      </svg>
    ));

    const path = container.querySelector("path") as SVGPathElement;
    // `pathLength="1"` normalises the path so the dash pair is a fraction, and
    // the element has to be born undrawn or it flashes complete.
    expect(path.getAttribute("pathLength")).toBe("1");
    expect(path.getAttribute("stroke-dasharray")).toBe("0 1");

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(path.getAttribute("stroke-dasharray")).toBe("1 0");
  });

  it("holds children back until the parent is done, with beforeChildren", async () => {
    const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const [shown, setShown] = createSignal(false);

    const { container } = render(() => (
      <motion.div
        variants={variants}
        initial="hidden"
        animate={shown() ? "visible" : "hidden"}
        transition={{ duration: 0.2, when: "beforeChildren" }}
      >
        <motion.div variants={variants} transition={{ duration: 0.2 }} />
      </motion.div>
    ));

    const [parent, child] = [
      ...container.querySelectorAll("div"),
    ] as HTMLElement[];
    expect(parent.style.opacity).toBe("0");
    expect(child.style.opacity).toBe("0");

    setShown(true);
    flush();

    // The parent is underway and the child has not started. Asserting the end
    // state would pass either way, since both arrive eventually.
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(Number(parent.style.opacity)).toBeGreaterThan(0.2);
    expect(child.style.opacity).toBe("0");

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(parent.style.opacity).toBe("1");
    expect(child.style.opacity).toBe("1");
  });

  it("holds the parent back until its children are done, with afterChildren", async () => {
    const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const [shown, setShown] = createSignal(true);

    const { container } = render(() => (
      <motion.div
        variants={variants}
        initial="visible"
        animate={shown() ? "visible" : "hidden"}
        transition={{ duration: 0.2, when: "afterChildren" }}
      >
        <motion.div variants={variants} transition={{ duration: 0.2 }} />
      </motion.div>
    ));

    const [parent, child] = [
      ...container.querySelectorAll("div"),
    ] as HTMLElement[];
    expect(parent.style.opacity).toBe("1");

    setShown(false);
    flush();

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(Number(child.style.opacity)).toBeLessThan(0.8);
    expect(parent.style.opacity).toBe("1");

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(parent.style.opacity).toBe("0");
    expect(child.style.opacity).toBe("0");
  });

  it("keeps a sequenced exit inside its presence boundary until it is done", async () => {
    // The gate lives inside `run`, so a pass waiting its turn is still the
    // current pass and still owns the boundary's hold. Anything that gated
    // *before* calling `run` would let the count reach zero mid-exit and the
    // subtree would vanish before it animated.
    const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const [shown, setShown] = createSignal(true);

    const { container } = render(() => (
      <AnimatePresence when={shown()}>
        {() => (
          <motion.div
            variants={variants}
            initial="visible"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2, when: "beforeChildren" }}
          >
            <motion.div variants={variants} transition={{ duration: 0.2 }} />
          </motion.div>
        )}
      </AnimatePresence>
    ));

    setShown(false);
    flush();

    await new Promise((resolve) => setTimeout(resolve, 120));
    const [parent, child] = [
      ...container.querySelectorAll("div"),
    ] as HTMLElement[];
    expect(container.querySelectorAll("div").length).toBe(2);
    expect(Number(parent.style.opacity)).toBeLessThan(0.9);
    expect(child.style.opacity).toBe("1");

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(container.querySelectorAll("div").length).toBe(0);
  });

  it("staggers children with a stagger() delay function, not just the constant form", async () => {
    // `stagger()` is motion's own recommended replacement for
    // staggerChildren/staggerDirection, and it returns a plain function. A
    // cast that quietly assumed delayChildren was always a number would let
    // this compile and then coerce the function to its source text at
    // runtime, so the assertion has to be on the actual delay a middle child
    // gets, not just "it eventually reaches 1".
    const variants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    };

    const { container } = render(() => (
      <motion.div
        variants={variants}
        initial="hidden"
        animate="visible"
        transition={{ delayChildren: stagger(0.1) }}
      >
        <motion.div variants={variants} transition={{ duration: 0.01 }} />
        <motion.div variants={variants} transition={{ duration: 0.01 }} />
        <motion.div variants={variants} transition={{ duration: 0.01 }} />
      </motion.div>
    ));

    const [, first, second, third] = [
      ...container.querySelectorAll("div"),
    ] as HTMLElement[];

    // Sampled once per stagger step: the first child is already done by the
    // time the second has even started, which a garbled string delay (or one
    // that ignored the function and stayed at 0 for everyone) would not
    // produce.
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(first.style.opacity).toBe("1");
    expect(second.style.opacity).toBe("0");
    expect(third.style.opacity).toBe("0");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(second.style.opacity).toBe("1");
    expect(third.style.opacity).toBe("0");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(third.style.opacity).toBe("1");
  });

  it("staggers children on the very first mount, not only on a later transition", async () => {
    // Registering a sibling used to happen from an effect apply callback,
    // watching `element()`. Solid settles every effect's compute function to a
    // fixpoint before committing any of their applies, so on the entrance
    // pass every sibling's compute ran before any of them had registered:
    // `children.size` read 0 for all three and the stagger never staggered.
    // Registration now happens synchronously from `ref`, which runs during
    // the render walk, strictly before that compute phase starts.
    const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

    const { container } = render(() => (
      <motion.div
        variants={variants}
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.1 }}
      >
        <motion.div variants={variants} transition={{ duration: 0.01 }} />
        <motion.div variants={variants} transition={{ duration: 0.01 }} />
      </motion.div>
    ));

    const [, first, second] = [
      ...container.querySelectorAll("div"),
    ] as HTMLElement[];

    // Sampled well inside the 100ms gap between the two children's delays:
    // the defect reached both by now, since neither was ever delayed at all.
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(first.style.opacity).toBe("1");
    expect(second.style.opacity).toBe("0");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(second.style.opacity).toBe("1");
  });

  it("unregisters a removed child, so a stale sibling does not inflate the count", async () => {
    // A stale entry cannot be seen through index alone: `staggerDirection: -1`
    // uses the total count too (`span = (length - 1) * staggerChildren`), so a
    // leaked entry changes every sibling's delay, not just a reordered one.
    // The unregister function `register` returns has to actually run on
    // disposal for this to hold; it is wired up with `runWithOwner` because a
    // bare `onCleanup` called from a ref callback is silently discarded there
    // and never runs (confirmed by Solid's own `NO_OWNER_CLEANUP` dev warning
    // while building this fix).
    const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const [showTransient, setShowTransient] = createSignal(true);

    const { container } = render(() => (
      <motion.div
        variants={variants}
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.1, staggerDirection: -1 }}
      >
        {showTransient() && (
          <motion.div
            data-i="transient"
            variants={variants}
            transition={{ duration: 0.01 }}
          />
        )}
        <motion.div
          data-i="kept"
          variants={variants}
          transition={{ duration: 0.01 }}
        />
      </motion.div>
    ));

    await new Promise((resolve) => setTimeout(resolve, 5));
    setShowTransient(false);
    flush();
    await new Promise((resolve) => setTimeout(resolve, 5));
    setShowTransient(true);
    flush();

    const transient = container.querySelector(
      '[data-i="transient"]',
    ) as HTMLElement;

    // Two real children remain: span is one stagger step, so the freshly
    // re-added transient (index 0, reverse direction) waits exactly that one
    // step. A leaked first instance makes it three children's worth of span,
    // doubling the wait, so this window catches it without pinning the exact
    // extra delay.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(transient.style.opacity).toBe("1");
  });
});
