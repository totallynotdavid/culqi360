---
name: ui-audit
description:
  "Audit or plan product UI structure. Use when reviewing navigation,
  information hierarchy, action density, onboarding flow, or screen-level
  complexity before making design or frontend changes."
---

## workflow

1. Identify the screen entrypoint and the primary user task on that screen.
2. List the visible navigation, actions, and data blocks above the fold.
3. Separate primary actions from secondary actions and supporting information.
4. Check whether labels, layout, and visual weight match that priority.
5. Return findings as concrete issues with file locations and a direct fix.

## audit checks

- Navigation: one clear primary path through the screen.
- Action density: primary actions are few and visually dominant.
- Information hierarchy: supporting detail does not compete with the main task.
- Label consistency: one term per concept across the surface.
- Onboarding flow: the next action is obvious for a first-time user.
- Optional modules: secondary content can move behind menus, drawers, or
  progressive disclosure.

## output format

- issue
- location
- evidence
- recommended change

## review rubric

- Task focus: the screen supports one main job at a time.
- Hierarchy: visual weight matches action priority.
- Consistency: labels and interaction patterns do not drift.
- Density: the first screen is readable without hiding key controls.
- Changeability: the recommendation points to a specific component, route, or
  layout boundary.

## fail conditions

- Mixing product strategy with screen-level audit findings.
- Returning general advice without naming the affected UI surface.
- Proposing new features when simplification would solve the problem.
- Judging hierarchy without first listing the visible actions and modules.
