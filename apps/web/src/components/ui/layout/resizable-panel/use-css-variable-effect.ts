import { createEffect, onSettled, type Accessor } from "solid-js";

export function useCssVariableEffect(
  cssVariableName: string,
  value: Accessor<string | number>,
) {
  onSettled(() => {
    createEffect(
      () => String(value()),
      (next) => {
        document.documentElement.style.setProperty(cssVariableName, next);
      },
    );
  });
}
