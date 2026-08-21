import { type JSX } from "@solidjs/web";
import { Show, type Accessor } from "solid-js";

interface PresentProps<T> {
  when: T | null | undefined;
  fallback?: JSX.Element;
  children: (value: Accessor<T>) => JSX.Element;
}

// Solid's Show checks truthiness, but 0, false, and "" are present values here.
// Box values after a null check so its type guard and runtime behavior agree.
export function Present<T>(props: PresentProps<T>): JSX.Element {
  return (
    <Show
      when={props.when == null ? null : { value: props.when }}
      fallback={props.fallback}
    >
      {(box) => props.children(() => box().value)}
    </Show>
  );
}
