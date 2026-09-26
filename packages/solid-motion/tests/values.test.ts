import { afterEach, describe, expect, it, vi } from "vitest";

import { createValueStore } from "../src/values";

describe("ValueStore", () => {
  afterEach(() => document.body.replaceChildren());

  it("returns running controls and stops them when the value starts again", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const store = createValueStore(element, { opacity: 0 }, new Map());

    try {
      const first = store.animate("opacity", 1, { duration: 10 });
      expect(first).toBeDefined();
      if (!first) throw new Error("expected controls for the first animation");

      expect(first.finished).toBeInstanceOf(Promise);
      expect(first.stop).toEqual(expect.any(Function));
      expect(first.state).toBe("running");
      const stopFirst = vi.spyOn(first, "stop");

      const second = store.animate("opacity", 0, { duration: 10 });

      expect(second).toBeDefined();
      if (!second)
        throw new Error("expected controls for the second animation");
      expect(second.state).toBe("running");
      expect(stopFirst).toHaveBeenCalledOnce();
    } finally {
      store.dispose();
    }
  });
});
