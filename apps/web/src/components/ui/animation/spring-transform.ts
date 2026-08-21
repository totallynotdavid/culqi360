import { createEffect, type Accessor } from "solid-js";

import { prefersReducedMotion } from "./animate";

const SPRING = {
  stiffness: 300,
  damping: 20,
  mass: 1,
} as const;

const NORMALIZED_TARGET = 100;
const REST_SPEED = 2;
const REST_DELTA = 0.5;
const DURATION_STEP_MS = 50;

type TransformAnimation = {
  cancel: () => void;
};

type CancelAnimation = () => void;

type TransformTarget =
  | {
      kind: "scale";
      value: number;
    }
  | {
      kind: "translateX";
      value: number;
    };

const activeAnimations = new WeakMap<Element, TransformAnimation>();
const normalizedSpringConstants = createSpringConstants(NORMALIZED_TARGET);
const springDurationMs = calculateSpringDuration();

export function springTransform(
  transform: Accessor<string>,
): (element: Element) => void {
  return (element: Element) => {
    // The effect phase's return value is its cleanup, so a new transform
    // cancels the in-flight animation before starting the next one.
    createEffect(transform, (next) => animateSpringTransform(element, next));
  };
}

function animateSpringTransform(
  element: Element,
  transform: string,
): CancelAnimation {
  if (typeof window === "undefined") {
    return noop;
  }
  if (typeof HTMLElement === "undefined") {
    return noop;
  }
  if (!(element instanceof HTMLElement)) {
    return noop;
  }

  const target = parseTransformTarget(transform);
  if (!target) {
    return noop;
  }

  const activeAnimation = activeAnimations.get(element);
  activeAnimation?.cancel();
  activeAnimations.delete(element);

  if (prefersReducedMotion()) {
    applyTransformTarget(element, target);
    return noop;
  }

  const origin = readCurrentTransformValue(element, target.kind);
  if (origin === target.value) {
    return noop;
  }

  const animation = animateSpring({
    origin,
    target,
    onUpdate: (value) => {
      applyTransformTarget(element, { ...target, value });
    },
    onComplete: () => {
      applyTransformTarget(element, target);
      activeAnimations.delete(element);
    },
  });

  activeAnimations.set(element, animation);

  return () => {
    animation.cancel();
    activeAnimations.delete(element);
  };
}

function parseTransformTarget(transform: string): TransformTarget | null {
  const scale = /^scale\((-?\d+(?:\.\d+)?)\)$/.exec(transform);
  if (scale?.[1]) {
    return { kind: "scale", value: Number(scale[1]) };
  }

  const translateX = /^translateX\((-?\d+(?:\.\d+)?)px\)$/.exec(transform);
  if (translateX?.[1]) {
    return { kind: "translateX", value: Number(translateX[1]) };
  }

  return null;
}

function readCurrentTransformValue(
  element: HTMLElement,
  kind: TransformTarget["kind"],
): number {
  const transform = getComputedStyle(element).transform;
  if (transform === "none") {
    return kind === "scale" ? 1 : 0;
  }

  const matrix = new DOMMatrixReadOnly(transform);

  if (kind === "scale") {
    return Math.hypot(matrix.a, matrix.b) || 1;
  }

  return matrix.m41;
}

function applyTransformTarget(element: HTMLElement, target: TransformTarget) {
  if (target.kind === "scale") {
    element.style.transform = `scale(${formatNumber(target.value)})`;
    return;
  }

  element.style.transform = `translateX(${formatNumber(target.value)}px)`;
}

function animateSpring(input: {
  origin: number;
  target: TransformTarget;
  onUpdate: (value: number) => void;
  onComplete: () => void;
}): TransformAnimation {
  const delta = input.target.value - input.origin;
  const startMs = performance.now();
  let cancelled = false;
  let rafId: number | undefined;

  const tick = (now: DOMHighResTimeStamp) => {
    if (cancelled) {
      return;
    }

    const elapsedMs = now - startMs;
    if (elapsedMs >= springDurationMs) {
      input.onComplete();
      return;
    }

    input.onUpdate(input.origin + delta * normalizedSpringProgress(elapsedMs));
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    cancel: () => {
      cancelled = true;
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
    },
  };
}

function calculateSpringDuration(): number {
  let durationMs = 0;
  let state = normalizedSpringState(durationMs);

  while (!state.done && durationMs < 20_000) {
    durationMs += DURATION_STEP_MS;
    state = normalizedSpringState(durationMs);
  }

  return durationMs;
}

function normalizedSpringProgress(elapsedMs: number): number {
  return normalizedSpringState(elapsedMs).value / NORMALIZED_TARGET;
}

function normalizedSpringState(elapsedMs: number): {
  value: number;
  done: boolean;
} {
  const value = resolveSpringValue(elapsedMs);
  const velocity = resolveSpringVelocity(elapsedMs);

  return {
    value,
    done:
      Math.abs(velocity) <= REST_SPEED &&
      Math.abs(NORMALIZED_TARGET - value) <= REST_DELTA,
  };
}

function resolveSpringValue(elapsedMs: number): number {
  const envelope = Math.exp(
    -normalizedSpringConstants.dampingRatio *
      normalizedSpringConstants.omega0 *
      elapsedMs,
  );

  return (
    NORMALIZED_TARGET -
    envelope *
      (normalizedSpringConstants.coefficient *
        Math.sin(normalizedSpringConstants.omegaD * elapsedMs) +
        NORMALIZED_TARGET *
          Math.cos(normalizedSpringConstants.omegaD * elapsedMs))
  );
}

function resolveSpringVelocity(elapsedMs: number): number {
  const envelope = Math.exp(
    -normalizedSpringConstants.dampingRatio *
      normalizedSpringConstants.omega0 *
      elapsedMs,
  );

  return (
    envelope *
    ((normalizedSpringConstants.dampingRatio *
      normalizedSpringConstants.omega0 *
      normalizedSpringConstants.coefficient +
      NORMALIZED_TARGET * normalizedSpringConstants.omegaD) *
      Math.sin(normalizedSpringConstants.omegaD * elapsedMs) +
      (normalizedSpringConstants.dampingRatio *
        normalizedSpringConstants.omega0 *
        NORMALIZED_TARGET -
        normalizedSpringConstants.coefficient *
          normalizedSpringConstants.omegaD) *
        Math.cos(normalizedSpringConstants.omegaD * elapsedMs)) *
    1000
  );
}

function createSpringConstants(delta: number) {
  const omega0 = Math.sqrt(SPRING.stiffness / SPRING.mass) / 1000;
  const dampingRatio =
    SPRING.damping / (2 * Math.sqrt(SPRING.stiffness * SPRING.mass));
  const omegaD = omega0 * Math.sqrt(1 - dampingRatio * dampingRatio);

  return {
    omega0,
    omegaD,
    dampingRatio,
    coefficient: (dampingRatio * omega0 * delta) / omegaD,
  };
}

function formatNumber(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function noop() {}
