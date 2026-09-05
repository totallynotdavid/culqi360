import {
  copyBoxInto,
  createBox,
  type IProjectionNode,
  type Measurements,
} from "motion-dom";

/** Projection lifecycle supplied by an element. */
export interface LayoutHost {
  /** Builds the node once its element is connected and its parent is known. */
  create(parent: IProjectionNode | undefined): IProjectionNode;
  /** Whether changes should apply immediately. */
  instant(): boolean;
}

const nodes = new WeakMap<HTMLElement, IProjectionNode>();
const hosts = new WeakMap<IProjectionNode, LayoutHost>();
const mounted = new Set<IProjectionNode>();
const pending = new Map<HTMLElement, LayoutHost>();
/** Nodes that relevant mutations may have moved since the last commit. */
const touched = new Set<IProjectionNode>();
/** Elements whose inline style this package writes on the animation frame. */
const painted = new WeakSet<Element>();
let scheduled = false;
let watcher: MutationObserver | undefined;

/** Defers node creation until the element is connected and its parent is known. */
export function adoptLayoutNode(element: HTMLElement, host: LayoutHost): void {
  pending.set(element, host);
  scheduleCommit();
}

export function dropLayoutNode(element: HTMLElement): void {
  pending.delete(element);

  const node = nodes.get(element);
  if (!node) return;

  nodes.delete(element);
  hosts.delete(node);
  mounted.delete(node);
  touched.delete(node);
  if (mounted.size === 0) watcher?.disconnect();

  // A follow node may share its animation through `resumingFrom`; only the lead
  // owns the animation and should stop it.
  const stack = node.getStack();
  if (!stack || node.isLead()) node.currentAnimation?.stop();

  node.unmount();
  scheduleCommit();
}

/**
 * Declares that this package owns the element's inline style. The watcher reads
 * inline style as a layout signal, and every animated element rewrites its own
 * on every frame; without the claim each paint would schedule a commit and end
 * the very animation that painted it.
 */
export function claimInlineStyle(element: Element): void {
  painted.add(element);
}

export function releaseInlineStyle(element: Element): void {
  painted.delete(element);
}

function scheduleCommit() {
  if (scheduled) return;
  scheduled = true;
  // Run after Solid's DOM writes and before paint. The projection engine flushes
  // its frame in the same checkpoint.
  queueMicrotask(commit);
}

/** Uses each node's previous measurement as the next update's snapshot. */
function commit() {
  scheduled = false;
  // Consume pending records so node mounting does not schedule a second commit
  // after this update has already been processed.
  absorb(watcher?.takeRecords() ?? []);

  const existing = anyRoot();
  if (existing) {
    beginUpdate(existing);
    for (const node of mounted) snapshot(node);
  }
  touched.clear();

  // Snapshot before mounting pending nodes so shared elements use the outgoing
  // member's previous box.
  mountPending();

  const root = anyRoot();
  if (!root) return;
  beginUpdate(root);
  root.didUpdate();
}

function snapshot(node: IProjectionNode) {
  if (node.snapshot || !node.instance || !node.layout) return;

  // An instant change has no snapshot, so the projection engine creates no
  // layout animation.
  if (hosts.get(node)?.instant()) {
    node.isLayoutDirty = true;
    return;
  }

  const { currentAnimation, layout, target } = node;

  // Do not restart an in-flight animation unless a relevant mutation indicates
  // that the node moved again.
  if (currentAnimation && !touched.has(node)) return;

  node.snapshot =
    currentAnimation && target ? inFlightBox(layout, target) : layout;
  node.isLayoutDirty = true;
  node.shouldResetTransform = true;
}

/**
 * Where a node that is already animating sits on screen, as the measurement the
 * next animation starts from. `layout` is the destination the running animation
 * was given, so handing that over makes the element jump to the destination and
 * animate away from there. `target` is that box with the animation's current
 * delta applied, which is the frame the element is painting.
 */
function inFlightBox(
  layout: Measurements,
  target: Measurements["layoutBox"],
): Measurements {
  // `notifyLayoutUpdate` rewrites the snapshot box for position-only and
  // size-only animations, so hand it copies rather than the live target.
  return { ...layout, layoutBox: copyOf(target), measuredBox: copyOf(target) };
}

function copyOf(box: Measurements["layoutBox"]): Measurements["layoutBox"] {
  const copy = createBox();
  copyBoxInto(copy, box);
  return copy;
}

function mountPending() {
  if (pending.size === 0) return;

  // Mount ancestors before descendants so projection parents are available.
  const elements = [...pending.keys()].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );

  for (const element of elements) {
    const host = pending.get(element);
    pending.delete(element);
    if (!host || !element.isConnected) continue;

    const node = host.create(projectionParent(element));
    nodes.set(element, node);
    hosts.set(node, host);
    mounted.add(node);
    if (mounted.size === 1) watch();

    node.mount(element);
    node.isPresent = true;
    // The first measurement establishes the baseline; without a snapshot there
    // is no enter animation.
    node.isLayoutDirty = true;
  }
}

/** Watches document mutations that can move a projecting element. */
function watch() {
  watcher ??= new MutationObserver(onMutations);
  // `attributeFilter` cannot express `data-*`, so every attribute change is
  // delivered and `movesLayout` decides which ones count.
  watcher.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
}

function onMutations(records: MutationRecord[]) {
  if (absorb(records)) scheduleCommit();
}

/**
 * Marks the nodes each record may have moved. Reports whether any record was a
 * layout change at all, because the rest are this package painting a frame.
 */
function absorb(records: MutationRecord[]): boolean {
  let moving = false;

  for (const record of records) {
    if (!movesLayout(record)) continue;
    moving = true;
    for (const node of mounted) {
      if (movedBy(node, record)) touched.add(node);
    }
  }

  return moving;
}

/** Whether a mutation is one that changes layout rather than paint. */
function movesLayout(record: MutationRecord): boolean {
  if (record.type !== "attributes") return true;

  const name = record.attributeName;
  if (!name) return false;
  // On an element this package animates, inline style is the frame it just
  // painted, not a layout change the app made.
  if (name === "style") return !painted.has(record.target as Element);

  return name === "class" || name === "hidden" || name.startsWith("data-");
}

/** Whether a mutation inside or above the node could have moved it. */
function movedBy(node: IProjectionNode, record: MutationRecord): boolean {
  const element = node.instance as HTMLElement | undefined;
  if (!element) return false;
  // Ancestors count as much as descendants: a container laying its children out
  // differently is what a class or style change on it usually means.
  return element.contains(record.target) || record.target.contains(element);
}

function projectionParent(element: HTMLElement): IProjectionNode | undefined {
  let ancestor = element.parentElement;
  while (ancestor) {
    const node = nodes.get(ancestor);
    if (node?.instance) return node;
    ancestor = ancestor.parentElement;
  }
  return undefined;
}

/** Returns the shared projection root. */
function anyRoot(): IProjectionNode | undefined {
  for (const node of mounted) return node.root;
  return undefined;
}

function beginUpdate(root: IProjectionNode) {
  if (!root.isUpdating) root.startUpdate();
}
