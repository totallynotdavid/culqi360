import { type JSX } from "@solidjs/web";
import { createEffect, createUniqueId, onCleanup } from "solid-js";

interface PopChildProps {
  children: JSX.Element;
  isPresent: boolean;
  anchorX?: "left" | "right";
  anchorY?: "top" | "bottom";
  root?: HTMLElement | ShadowRoot;
  pop?: boolean;
}

interface Size {
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  direction: string;
}

export function PopChild(props: PopChildProps) {
  const id = createUniqueId();
  let containerRef: HTMLDivElement | undefined;
  let styleTag: HTMLStyleElement | undefined;

  const removeInjectedStyle = () => {
    if (containerRef) {
      containerRef.removeAttribute("data-motion-pop-id");
    }
    if (styleTag && styleTag.parentNode) {
      styleTag.parentNode.removeChild(styleTag);
    }
    styleTag = undefined;
  };

  const measure = (): Size | null => {
    if (!containerRef) {
      return null;
    }
    const parent = containerRef.offsetParent;
    const parentWidth =
      parent instanceof HTMLElement ? parent.offsetWidth || 0 : 0;
    const parentHeight =
      parent instanceof HTMLElement ? parent.offsetHeight || 0 : 0;
    const computedStyle = getComputedStyle(containerRef);
    const width = parseFloat(computedStyle.width);
    const height = parseFloat(computedStyle.height);
    const top = containerRef.offsetTop;
    const left = containerRef.offsetLeft;
    const right = parentWidth - width - left;
    const bottom = parentHeight - height - top;
    const direction = computedStyle.direction;
    return { width, height, top, left, right, bottom, direction };
  };

  createEffect(
    () => ({
      pop: props.pop,
      isPresent: props.isPresent,
      anchorX: props.anchorX,
      anchorY: props.anchorY,
      root: props.root,
    }),
    ({ pop, isPresent, anchorX, anchorY, root }) => {
      if (typeof document === "undefined") {
        return;
      }
      if (pop === false) {
        return;
      }
      if (!containerRef) {
        return;
      }

      removeInjectedStyle();

      if (isPresent) {
        return;
      }

      const measured = measure();
      if (!measured || !measured.width || !measured.height) {
        return;
      }

      const isRTL = measured.direction === "rtl";
      const x =
        (anchorX ?? "left") === "left"
          ? isRTL
            ? `right: ${measured.right}px`
            : `left: ${measured.left}px`
          : isRTL
            ? `left: ${measured.left}px`
            : `right: ${measured.right}px`;
      const y =
        (anchorY ?? "top") === "bottom"
          ? `bottom: ${measured.bottom}px`
          : `top: ${measured.top}px`;

      containerRef.dataset.motionPopId = id;
      styleTag = document.createElement("style");
      const parent = root ?? document.head;
      parent.appendChild(styleTag);
      styleTag.textContent = `
[data-motion-pop-id="${id}"] {
  position: absolute !important;
  width: ${measured.width}px !important;
  height: ${measured.height}px !important;
  ${x} !important;
  ${y} !important;
}`;
    },
  );

  onCleanup(removeInjectedStyle);

  return <div ref={(el) => (containerRef = el)}>{props.children}</div>;
}
