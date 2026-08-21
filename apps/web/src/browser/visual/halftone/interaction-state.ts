import type { HalftonePose } from "./state";

export type HalftoneInteractionState = {
  activePointerId: number | null;
  autoElapsed: number;
  dragging: boolean;
  hoverStrength: number;
  mouseX: number;
  mouseY: number;
  pointerInside: boolean;
  pointerVelocityX: number;
  pointerVelocityY: number;
  pointerX: number;
  pointerY: number;
  rotateElapsed: number;
  rotationVelocityX: number;
  rotationVelocityY: number;
  rotationVelocityZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  smoothedMouseX: number;
  smoothedMouseY: number;
  targetRotationX: number;
  targetRotationY: number;
  velocityX: number;
  velocityY: number;
};

export const createHalftoneInteractionState = (
  initialPose?: Partial<HalftonePose>,
): HalftoneInteractionState => ({
  activePointerId: null,
  autoElapsed: initialPose?.autoElapsed ?? 0,
  dragging: false,
  hoverStrength: 0,
  mouseX: 0.5,
  mouseY: 0.5,
  pointerInside: false,
  pointerVelocityX: 0,
  pointerVelocityY: 0,
  pointerX: 0,
  pointerY: 0,
  rotateElapsed: initialPose?.rotateElapsed ?? 0,
  rotationVelocityX: 0,
  rotationVelocityY: 0,
  rotationVelocityZ: 0,
  rotationX: initialPose?.rotationX ?? 0,
  rotationY: initialPose?.rotationY ?? 0,
  rotationZ: initialPose?.rotationZ ?? 0,
  smoothedMouseX: 0.5,
  smoothedMouseY: 0.5,
  targetRotationX: initialPose?.targetRotationX ?? 0,
  targetRotationY: initialPose?.targetRotationY ?? 0,
  velocityX: 0,
  velocityY: 0,
});
