import {
  type Accessor,
  type ParentProps,
  createContext,
  useContext,
} from "solid-js";

const SidePanelPageInstanceContext = createContext<Accessor<string>>();

type PageInstanceProviderProps = ParentProps<{
  pageId: string;
}>;

export function PageInstanceProvider(props: PageInstanceProviderProps) {
  const pageId = () => props.pageId;

  return (
    <SidePanelPageInstanceContext value={pageId}>
      {props.children}
    </SidePanelPageInstanceContext>
  );
}

export function usePageInstanceId(): Accessor<string> {
  const pageId = useContext(SidePanelPageInstanceContext);

  if (pageId === undefined) {
    throw new Error("usePageInstanceId must be used inside side panel router");
  }

  return pageId;
}
