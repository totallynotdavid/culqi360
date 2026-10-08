---
name: css-layout
description:
  "Debug or design CSS layout behavior. Use when a UI has sizing, overflow,
  alignment, positioning, or responsive layout problems. Covers flow, flexbox,
  grid, containing blocks, and minimal-fix selection."
---

## workflow

1. Identify the active layout algorithm on the parent: flow, flexbox, grid, or
   positioned.
2. Check the containing block, explicit sizes, min and max constraints, and
   overflow settings.
3. Inspect how children participate in that algorithm.
4. Fix the problem in the current algorithm before switching to a different one.
5. Re-check keyboard order and responsive behavior after the fix.

## decision rules

- Use flexbox for one-axis distribution and centering.
- Use grid for two-axis placement and repeated tracks.
- Use positioned layout for overlays and anchored elements.
- Stay in normal flow when the layout is simple and document-driven.
- Prefer `fr`, intrinsic sizing, and logical properties over rigid percentages
  when gaps or writing direction matter.

## common checks

- Overflow in flow: check `width: 100%`, margins, and long unbroken content.
- Percentage height: verify that the parent has an explicit height.
- Flex items: inspect shrink, grow, basis, and min-width or min-height
  constraints.
- Grid overflow: replace percentage tracks with `fr` when gaps are involved.
- Absolute positioning: verify the containing block and stacking context.
- Centering: choose a layout-based fix before using offset hacks.

## review rubric

- Algorithm clarity: the chosen fix matches the active layout mode.
- Constraint awareness: the fix accounts for container size, intrinsic size, and
  overflow.
- Minimality: the fix changes the fewest layout rules needed.
- Accessibility: visual order and keyboard order still match.
- Resilience: the fix still works when content grows or shrinks.

## fail conditions

- Switching layout modes without checking the current algorithm first.
- Using percentages without a defined reference size.
- Solving overflow by hiding it before understanding the cause.
- Reordering items visually in a way that breaks keyboard or reading order.
