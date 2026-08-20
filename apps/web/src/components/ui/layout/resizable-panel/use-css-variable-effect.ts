import { createEffect, type Accessor } from "solid-js";

export function useCssVariableEffect(
  cssVariableName: string,
  value: Accessor<string | number>,
) {
  createEffect(() => {
    document.documentElement.style.setProperty(
      cssVariableName,
      String(value()),
    );
  });
}
