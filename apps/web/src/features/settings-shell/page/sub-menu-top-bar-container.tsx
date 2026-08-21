import { Title } from "@solidjs/meta";
import type { JSX } from "@solidjs/web";
import type { ParentProps } from "solid-js";

import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";
import { PageCardLayout } from "~/components/ui/layout/page-card/page-card-layout";
import { useNavigationDrawerState } from "~/features/navigation-drawer/state/navigation-drawer-provider";

import { Breadcrumb } from "./breadcrumb";
import type { BreadcrumbItem, MobileBackAction } from "./breadcrumb-model";

interface SubMenuTopBarContainerProps extends ParentProps {
  breadcrumbItems: BreadcrumbItem[];
  mobileBackAction: MobileBackAction;
  title?: string | JSX.Element;
  actionButton?: JSX.Element;
}

export function SubMenuTopBarContainer(props: SubMenuTopBarContainerProps) {
  const { isMobile } = useNavigationDrawerState();

  const documentTitle = () => {
    const current = props.breadcrumbItems.at(-1)?.label;
    return current ? `${current} - Ajustes` : "Ajustes";
  };

  return (
    <>
      <Title>{documentTitle()}</Title>
      <PageCardLayout
        header={
          <PageCardHeader
            breadcrumb={
              <Breadcrumb
                items={props.breadcrumbItems}
                mobileBackAction={props.mobileBackAction}
                isMobile={isMobile()}
              />
            }
            title={props.title}
            actionButton={props.actionButton}
            centerTitle
          />
        }
      >
        {props.children}
      </PageCardLayout>
    </>
  );
}
