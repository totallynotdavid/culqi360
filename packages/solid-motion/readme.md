# Solid Motion

`@crm/solid-motion` is a small Solid 2 animation layer backed by Motion's
maintained DOM animation engine. It keeps the declarative API familiar while
owning the lifecycle and presence behavior needed by Solid.

## API

- `motion` creates animated HTML and SVG elements.
- `AnimatePresence` keeps keyed, removed items mounted until their exit
  animations finish.
- `useReducedMotion` exposes the browser preference as a Solid accessor.
- `MotionConfig` sets shared animation configuration for its descendants.

## Usage

```tsx
import { createSignal } from "solid-js";
import { AnimatePresence, motion, useReducedMotion } from "@crm/solid-motion";

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }}
>
  Fades in on mount
</motion.div>;

const [items, setItems] = createSignal([{ id: "one" }]);

<AnimatePresence each={items()} getKey={(item) => item.id}>
  {(item) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {item().id}
    </motion.div>
  )}
</AnimatePresence>;

const reducedMotion = useReducedMotion();
```

Motion props are reactive. The package supports target and variant definitions,
transitions, initial values, exit animations, reduced motion, and the `sync` and
`wait` presence modes. Initial values are rendered as inline styles, including
transforms such as `y: 20`.

`AnimatePresence` is intentionally controlled by an `each` collection. This
gives Solid a stable key boundary and avoids trying to recover removed children
from arbitrary JSX. Use `item()` inside the child function because the item is
an accessor that stays current when an existing key receives new data.

## Architecture

The package has four deliberately small layers:

- `motion.tsx` owns the Solid component lifecycle, prop forwarding, DOM refs,
  and animation cancellation.
- `resolve.ts` turns targets, variant names, arrays, and custom data into one
  target before execution.
- `styles.ts` owns the initial-style SSR path and target-to-CSS conversion.
- `presence.tsx` owns keyed diffing, nested registration, and the `safeToRemove`
  boundary used by exit animations.

The `motion` dependency is used only for target execution. It does not own the
Solid component tree, and the old framework-specific feature tree is not
vendored into this package.

## Layout animations

Layout projection, gestures, drag constraints, and Motion's React-specific
feature tree are deliberately outside this package. They can be added as
Solid-owned features later without coupling the core lifecycle to a framework
adapter copied from Motion React.

## Development

The application compiles this package's `.tsx` source directly. Run from
`packages/solid-motion`:

```sh
bun run test
bunx tsc --noEmit -p tsconfig.json
```

Motion is used as a dependency for DOM target execution. The Solid component,
context, reduced-motion, and presence layers are owned by this package.
