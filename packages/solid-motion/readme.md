# Solid Motion

`@crm/solid-motion` is a Solid-native animation package built directly on
[`motion-dom`](https://motion.dev). It is not a port of Motion React or
Motion Vue. There is no `VisualElement`, props proxy, or framework adapter.
Solid's own reactive graph drives animation state: a `createEffect` diffs the
active target against the live value map and starts per-value `motion-dom`
animations directly.

Peer dependencies: `solid-js` and `@solidjs/web`, both `^2.0.0-rc.1`.

```tsx
import { motion } from "@crm/solid-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>
  Fades and slides in on mount
</motion.div>;
```

## `motion.*`

`motion` is a proxy. Accessing `motion.div`, `motion.button`, `motion.line`, or
any other intrinsic tag lazily creates an animated version of that element.
Every non-motion prop (`class`, `onClick`, `children`, …) passes straight
through. `motion.create(Component)` wraps a custom component similarly.

```tsx
const Card = (props: { title: string }) => <div>{props.title}</div>;
const MotionCard = motion.create(Card);
```

Rendering `motion.line`, `motion.path`, or any other SVG tag animates SVG
geometry correctly. See [SVG animation](#svg-animation) below. The element
receives its initial style, or SVG attributes, inline during server rendering
and the client's first paint. Nothing is applied after mount, so hydration
does not flash.

The component form adds a component boundary and a runtime prop spread. For a
leaf animation under a long list, [`createMotion`](#createmotion) skips both.

## Animation props

These are `MotionOptions`, accepted by both `motion.*` and `createMotion`.
Animation props are read from a thunk, so values resolved from signals are
re-diffed. The `initial` target is the exception: it is resolved once because
it describes the first paint.

- `initial`: The target the element starts at. `initial={false}` (or a `false`
  from an enclosing `AnimatePresence`) skips the entrance animation for a
  subtree that was already on screen.
- `animate`: The target while the element is present. This is the only
  layer that is always active.
- `exit`: The target while a `hold`-based presence boundary animates the
  element out. See [Presence](#presence-animatepresence--animatepresencelist).
  `exit` sits above `animate`, rather than replacing it. A key owned by
  `animate` but omitted from `exit` keeps its animated value while leaving. A
  key named only in `exit` uses its own `transition`, if declared.
- `whileHover` / `whilePress` / `whileFocus` / `whileInView`: See
  [Gestures](#gestures).
- `custom`: Arbitrary data handed to a variant function. If absent, it falls
  back to the nearest ancestor's `custom`, then to the enclosing presence
  boundary's value. This lets a list item drive its own per-row variant from a
  value set at the top.
- `variants`: A `VariantMap`, so any of the layers above can be a string
  label instead of an inline target. See
  [Variants, stagger and orchestration](#variants-stagger-and-orchestration).
- `transition`: A `Transition` (re-exported from `motion-dom`) applied to
  whichever layer is active. Falls back to `MotionConfig`'s `transition` when
  omitted.
- `style`: Plain CSS, except entries may be a `MotionValue` or a Solid
  accessor. Motion-owned keys are written on the animation frame instead of
  through Solid's DOM diffing. Naming the same key in `animate`, `initial`, or
  another target updates the caller's value in place, so it can be read back.
- `onAnimationStart(definition)` / `onAnimationComplete(definition)` /
  `onUpdate(latest)`: Plain callbacks, not reactive.

A target may also be a list of variant labels
(`animate={["hidden", "visible"]}`), resolved against `variants` and merged
left to right, with later entries winning per key. Inline targets cannot be
mixed into that array; `AnimationDefinition` only accepts `string[]` alongside
a single label, a single inline target, or `false`. A value inside an inline
target can itself be a keyframe array (`animate={{ opacity: [0, 1] }}`). For
`height`, `width`, and other pairs with
incompatible start and end units (`0` to `"auto"`, `"none"`, or `"100%"`),
the package measures the element and animates between the resulting numbers.
This measurement path applies to HTML elements only. SVG uses its attribute
path instead.

## `createMotion`

```tsx
import { createMotion } from "@crm/solid-motion";

function CollapsibleRow(props: { open: boolean }) {
  const motionHandle = createMotion(() => ({
    animate: { height: props.open ? "auto" : 0 },
    transition: { duration: 0.2 },
  }));

  return (
    <div class="row" style={motionHandle.style} ref={motionHandle.ref} />
  );
}
```

`createMotion(options, tag?)` is the primitive behind `motion.div`. It contains
the whole engine without a component boundary. It takes a thunk of
`MotionOptions` and an optional tag name. The tag only decides whether the
initial paint uses style or SVG attributes. It returns a `MotionHandle`:

- `style`: The inline style the element must be born with. Merge it over any
  style of your own. The motion target must win the first paint.
- `attrs`: The same, for SVG geometry attributes. Empty for HTML.
- `ref`: Attach it to the element. It runs the animation lifecycle and
  registers variant children for stagger.
- `scope`: What this element offers descendants when it names a variant
  label, or `null`. It exists so `motion.div` can provide it through context
  for its own children; the scope type itself is internal and not exported,
  so a leaf animation never needs it and a custom wrapper cannot plug into it
  directly.

Use `createMotion` instead of `motion.div` when an element sits under a long,
frequently updating list. The primitive keeps `class`, `onClick`, and every
other attribute on Solid's compiled setters instead of a runtime spread.

## `createMotionValue`

```tsx
import { createMotionValue, motion } from "@crm/solid-motion";

// Follows the source immediately.
const scale = createMotionValue(1);

// Springs toward source changes.
const x = createMotionValue(
  () => targetX(),
  { stiffness: 300, damping: 30 },
);

<motion.div style={{ x, scale }} />;
```

`createMotionValue(source, transition?)` creates a `MotionValue` that lives
outside Solid's render path: writes land straight on the element on the
animation frame, so nothing re-renders when it moves. `source` can be a
constant, a Solid accessor, or another `MotionValue`. With a `transition`,
source changes retarget a spring from its current position and velocity
instead of restarting it. The value is destroyed automatically when its
owning scope is cleaned up.

Bind it to an element through `style`, and it stays reactive there like any
other bound style entry (see `style` above). Solid does not need `useTransform`
or `useMotionTemplate`: a derived value is just an accessor. Use the
re-exported [`transform`](#re-exported-helpers-stagger-transform) for range
mapping, as in `style={{ opacity: () => fade(scroll()) }}`. Use a template
literal for the template form.

## Gestures

`whileHover`, `whilePress`, and `whileFocus` each define a target that applies
only while that state is active.

```tsx
<motion.button
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  whileHover={{ scale: 1.05 }}
  whilePress={{ scale: 0.95 }}
  whileFocus={{ outline: "2px solid var(--accent)" }}
/>
```

Hover and press use `motion-dom`'s gesture recognizers rather than
hand-written `pointerenter`/`pointerdown` listeners. Hover filters polyfilled
touch events and defers its end while a press is in flight, so a button does
not flicker when the pointer slips off mid-click. Press filters secondary and
multi-touch pointers, ends during the capture phase, and also fires from
Enter on a keyboard. `whileFocus` gates on `:focus-visible`, so a mouse click
does not trigger a focus style. A missing prop attaches no listener. An
element without `whileHover` pays nothing for hover handling.

`whileInView` applies while the element is in the viewport, tuned by a
sibling `viewport` prop:

```tsx
<motion.div
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.5 }}
  transition={{ duration: 0.3 }}
/>
```

`viewport: { once, root, margin, amount }`: `once` unobserves after the
element has entered, rather than re-checking a flag. `root` and `margin` map to
`IntersectionObserver`'s `root` and `rootMargin`. `amount` is `"some"` (any
part visible), `"all"`, or a 0–1 threshold.

`createInView(element, viewport?)` exposes the same observer as a plain
boolean accessor, with no animation attached. It is useful for an
infinite-scroll sentinel, a lazily mounted chart, or an impression tracker
that has nothing to do with motion:

```tsx
const [node, setNode] = createSignal<HTMLElement>();
const inView = createInView(node, { once: true });

<div ref={setNode}>{inView() ? <Chart /> : null}</div>;
```

## Presence: `AnimatePresence` / `AnimatePresenceList`

Both keep a subtree mounted while its `exit` animation plays and unmount it
once every animated element inside has released its hold. A hold is used
instead of a promise because a cancelled `motion-dom` animation's `finished`
promise never settles.

`AnimatePresence` is the single/keyed form. Control it with a `when` value
rather than a conditional child. Solid disposes a branch as soon as its
condition flips, before a boundary can notice it. The boundary must build and
own the subtree itself so it can hold the outgoing element:

```tsx
import { AnimatePresence, motion } from "@crm/solid-motion";

<AnimatePresence when={selectedId()}>
  {(id) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {id}
    </motion.div>
  )}
</AnimatePresence>;
```

`when` doubles as the identity key: falsy renders nothing, and changing it
to a different truthy value swaps, with the outgoing and incoming subtrees
animating at the same time by default (`mode="wait"` holds the newcomer back
until the outgoing one is fully gone). Returning to a key still mid-exit
revives that subtree instead of building a second one beside it.

`AnimatePresenceList` is the keyed-list form:

```tsx
import { AnimatePresenceList, motion } from "@crm/solid-motion";

<AnimatePresenceList each={items()} getKey={(item) => item.id}>
  {(item) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {item().label}
    </motion.div>
  )}
</AnimatePresenceList>;
```

The child function receives an accessor, not the raw item. Use `item()` inside
it so a surviving row picks up new data without being recreated. A row removed
from `each` stays mounted at its old position, rather than collapsing to the
end of the list, until its exit animation finishes. Both components accept
`initial={false}` (skip entrance on first render), `custom` (handed down as
each element's inherited `custom`), and `onExitComplete`.

`usePresence()` returns the enclosing boundary's presence context, or `null`
outside one. `createMotion` uses it to resolve the `exit` layer and animation
holds. Most consumers never need it directly.

## `MotionConfig` / `useMotionConfig`

```tsx
import { MotionConfig } from "@crm/solid-motion";

<MotionConfig reducedMotion="user" transition={{ duration: 0.2 }}>
  <App />
</MotionConfig>;
```

Sets shared defaults for descendants. Nested providers merge their values over
inherited configuration:

- `transition`: The fallback `Transition` for any element that names none
  of its own.
- `skipAnimations`: A hard off switch. Every animation started under it jumps
  straight to its target. This applies at the point where every animation is
  created, so it also overrides a target's own `transition`.
- `reducedMotion`: `"never"` (default), `"always"`, or `"user"` (follows the
  OS preference via `useReducedMotion`). This does not disable every animation:
  positional and layout keys jump while opacity and colour still animate,
  matching Motion's reduced-motion contract.

## `useReducedMotion`

```tsx
import { useReducedMotion } from "@crm/solid-motion";

const prefersReducedMotion = useReducedMotion();
```

A Solid accessor for `(prefers-reduced-motion: reduce)`. A single `matchMedia`
listener is installed at module load, not per element. Read it directly only
for your own conditional logic. `MotionConfig reducedMotion="user"` already
wires it into every motion element's animations.

## Variants, stagger, and orchestration

A `variants` map lets `initial`/`animate`/`exit`/the gesture props take a
string label instead of an inline target, optionally as a function of
`custom`:

```tsx
const variants: VariantMap = {
  hidden: { opacity: 0 },
  visible: (custom) => ({
    opacity: 1,
    transition: { delay: (custom as number) * 0.05 },
  }),
};

<motion.div variants={variants} initial="hidden" animate="visible" custom={2} />;
```

`motion.*` types every variant function's parameter as `unknown`, not the
`custom` type a particular instance passes, so a cast is unavoidable there.
`createMotion<TCustom>` (the primitive behind it) does carry a real generic:
call it directly when you want the compiler to check `custom` end to end.

An element whose layer names a label becomes a variant-controlling scope. Its
resolved label propagates to descendants through context, so a child with a
matching `variants` map inherits it without repeating the prop. An inline
target is never inherited. It does not resolve against a child's different
`variants` map, and a child's own prop always wins over inherited state.

Stagger is offered through `transition` on the controlling parent:

```tsx
<motion.div variants={variants} initial="hidden" animate="visible"
  transition={{ staggerChildren: 0.1, staggerDirection: 1 }}
>
  <motion.div variants={variants} />
  <motion.div variants={variants} />
</motion.div>
```

`delayChildren` is the base offset every child gets. `staggerChildren` adds a
per-position increment, and `staggerDirection: -1` reverses which end starts
first. Position is read live from the DOM, so a keyed list reordering rows
staggers correctly without re-registering them.

For non-constant stagger, `delayChildren` also accepts the `stagger()` function
provided by `motion-dom`. It is re-exported from this package, so consumers do
not need to import `motion-dom` directly. A function replaces the constant
form instead of adding to it:

```tsx
import { motion, stagger } from "@crm/solid-motion";

<motion.div variants={variants} initial="hidden" animate="visible"
  transition={{ delayChildren: stagger(0.1) }}
>
  <motion.div variants={variants} />
  <motion.div variants={variants} />
</motion.div>;
```

`transition.when` sequences a controlling element's pass with its children's:

```tsx
transition={{ duration: 0.2, when: "beforeChildren" }}
```

`"beforeChildren"` holds every descendant's pass until the parent's own pass
finishes. `"afterChildren"` holds the parent back until every descendant's
pass finishes. Sequencing composes with presence, so a
`beforeChildren`-sequenced exit stays inside its `AnimatePresence` hold until
it starts.

## SVG animation

`motion.line`, `motion.path`, `motion.circle`, and other SVG tags render in the
SVG namespace. Geometry that CSS cannot animate (`x1`, `x2`, `r`, `viewBox`,
…) is written and animated as attributes, never as style:

```tsx
<svg viewBox="0 0 100 100">
  <motion.line
    initial={{ x1: 0, x2: 0 }}
    animate={{ x2: 100 }}
    transition={{ duration: 0.3 }}
  />
</svg>
```

`pathLength` animates a path drawing itself by driving the `stroke-dasharray`
pair behind the scenes:

```tsx
<motion.path
  d="M0 0 L100 100"
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 0.3 }}
/>
```

`opacity`, `transform`, `fill`, and other CSS-animatable properties still go
through `style` on an SVG element, as they do on HTML. A custom component
(`motion.create(MyComponent)`) is always assumed to render HTML. Only a
literal SVG tag name is known before the element exists.

## Re-exported helpers: `stagger`, `transform`

Both functions are re-exported from `motion-dom`, so consumers of this
package's orchestration or value APIs do not need a direct `motion-dom`
dependency:

- `stagger(duration, options?)`: Builds the per-child delay function
  `delayChildren` takes. See [stagger](#variants-stagger-and-orchestration)
  above.
- `transform(inputRange, outputRange, options?)`: The pure range-mapping
  interpolator behind Motion's `useTransform`. In Solid, a derived value is
  just an accessor over it, not a second value kept in sync by a subscription:

  ```tsx
  import { motion, transform } from "@crm/solid-motion";

  const fade = transform([0, 200], [0, 1]);
  <motion.div style={{ opacity: () => fade(scrollY()) }} />;
  ```

## Not yet in this package

`layout`/`layoutId` (layout projection), scroll-linked values
(`createScroll`/`createVelocity`/`createTime`), and
`createAnimate`/`createWillChange` are not part of this package. They are not
exported from `src/index.tsx`. Check that export list before relying on any of
these names.

Drag (`drag`, `dragControls`) and recovery of arbitrary removed children are
also out of scope. Presence requires an explicit `when` or `each` boundary.
Adding drag or arbitrary-child recovery would require the `VisualElement`
machinery this package does not use. See `todo.txt` item 26 if the scope
changes.

## Development

The application compiles this package's `.tsx` source directly, so there is no
build step. Run these commands from `packages/solid-motion`:

```sh
bun run test
bunx tsc --noEmit -p tsconfig.json
```

`packages/solid-motion/todo.txt` is the architecture and decision record:
every non-obvious design choice above, and why alternatives were rejected, is
written up there in more detail than belongs in this file.
