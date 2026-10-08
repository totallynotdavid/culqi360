import type {
  SidePanelNavigationEntry,
  SidePanelPageDefinition,
  SidePanelPageState,
} from "../types/side-panel-page";
import type { SidePanelState } from "../types/side-panel-state";

export type SidePanelAction =
  | { type: "open-panel"; page: SidePanelPageDefinition }
  | { type: "close-panel" }
  | { type: "close-animation-complete" }
  | { type: "navigate-to"; page: SidePanelPageDefinition; resetStack?: boolean }
  | { type: "go-back" }
  | { type: "navigate-to-stack-index"; index: number }
  | { type: "set-search-text"; text: string };

export type SidePanelStatePatch = Partial<
  Pick<
    SidePanelState,
    "isOpen" | "isClosing" | "stack" | "pageStateById" | "searchText"
  >
>;

function isSameNavigationEntry(
  left: SidePanelNavigationEntry,
  right: SidePanelNavigationEntry,
) {
  return left.page === right.page && left.pageId === right.pageId;
}

function retainPageStateForStack(
  pageStateById: Record<string, SidePanelPageState>,
  stack: SidePanelNavigationEntry[],
) {
  const retained: Record<string, SidePanelPageState> = {};

  for (const entry of stack) {
    const pageState = pageStateById[entry.pageId];

    if (!pageState) {
      continue;
    }

    retained[entry.pageId] = pageState;
  }

  return retained;
}

export function reduceSidePanelPatch(
  state: SidePanelState,
  action: SidePanelAction,
): SidePanelStatePatch | null {
  switch (action.type) {
    case "open-panel": {
      const currentEntry = state.stack.at(-1);
      const nextEntry = action.page.entry;
      const nextState = action.page.state;

      if (currentEntry && isSameNavigationEntry(currentEntry, nextEntry)) {
        return {
          isOpen: true,
          isClosing: false,
          searchText: "",
          pageStateById: {
            ...state.pageStateById,
            [nextEntry.pageId]: nextState,
          },
        };
      }

      return {
        isOpen: true,
        isClosing: false,
        searchText: "",
        stack: [nextEntry],
        pageStateById: {
          [nextEntry.pageId]: nextState,
        },
      };
    }

    case "close-panel":
      if (!state.isOpen && !state.isClosing) {
        return null;
      }

      return {
        isOpen: false,
        isClosing: true,
        searchText: "",
      };

    // Keep the current page mounted until the close animation finishes.
    case "close-animation-complete":
      return {
        isClosing: false,
        stack: [],
        pageStateById: {},
        searchText: "",
      };

    case "navigate-to": {
      const nextEntry = action.page.entry;
      const nextState = action.page.state;

      if (action.resetStack) {
        return {
          isOpen: true,
          isClosing: false,
          stack: [nextEntry],
          pageStateById: {
            [nextEntry.pageId]: nextState,
          },
        };
      }

      return {
        isOpen: true,
        isClosing: false,
        stack: [...state.stack, nextEntry],
        pageStateById: {
          ...state.pageStateById,
          [nextEntry.pageId]: nextState,
        },
      };
    }

    case "go-back": {
      if (state.stack.length <= 1) {
        return {
          isOpen: false,
          isClosing: true,
          searchText: "",
        };
      }

      const nextStack = state.stack.slice(0, -1);

      return {
        stack: nextStack,
        pageStateById: retainPageStateForStack(state.pageStateById, nextStack),
      };
    }

    case "navigate-to-stack-index": {
      const boundedIndex = Math.max(
        0,
        Math.min(action.index, state.stack.length - 1),
      );
      const nextStack = state.stack.slice(0, boundedIndex + 1);

      return {
        stack: nextStack,
        pageStateById: retainPageStateForStack(state.pageStateById, nextStack),
      };
    }

    case "set-search-text":
      return { searchText: action.text };

    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled side panel action: ${String(exhaustive)}`);
    }
  }
}
