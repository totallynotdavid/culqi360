import { type JSX } from "@solidjs/web";
import { createSignal } from "solid-js";

import { useResizablePanel } from "~/components/ui/layout/resizable-panel/use-resizable-panel";

import {
  SIDE_PANEL_WIDTH_CONSTRAINTS,
  SIDE_PANEL_WIDTH_VAR,
} from "../state/side-panel-width";
import { useSidePanel } from "../state/use-side-panel";
import { ResizeGapFrame } from "./resize-gap";
import { PanelShell } from "./shell";
import { WidthEffect } from "./width-effect";

import styles from "./desktop-frame.module.css";

type DesktopSidePanelFrameProps = {
  isInteractive: boolean;
  renderContent?: () => JSX.Element;
  shouldRenderChildren: boolean;
};

export function DesktopSidePanelFrame(props: DesktopSidePanelFrameProps) {
  const { isOpen, panelWidth, setPanelWidth, closePanel } = useSidePanel();
  const [isResizing, setIsResizing] = createSignal(false);

  const onPointerDown = useResizablePanel({
    side: "left",
    constraints: SIDE_PANEL_WIDTH_CONSTRAINTS,
    getCurrentWidth: panelWidth,
    onWidthChange: setPanelWidth,
    onCollapse: closePanel,
    onResizeStart: () => setIsResizing(true),
    onResizeEnd: () => setIsResizing(false),
    cssVariableName: SIDE_PANEL_WIDTH_VAR,
    dragThresholdPx: 4,
  });

  return (
    <div class={styles.root}>
      <WidthEffect />
      <ResizeGapFrame
        isOpen={isOpen()}
        onPointerDown={props.isInteractive ? onPointerDown : undefined}
      />
      <PanelShell
        isInteractive={props.isInteractive}
        isResizing={isResizing()}
        renderContent={props.renderContent}
        shouldRenderChildren={props.shouldRenderChildren}
      />
    </div>
  );
}
