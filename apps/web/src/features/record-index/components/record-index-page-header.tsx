import { Dynamic } from "@solidjs/web";
import { Show } from "solid-js";

import { AppHeaderActions } from "~/components/layout/app-header/app-header-actions";
import { TintedIconTile } from "~/components/ui/display/tinted-icon-tile/tinted-icon-tile";
import { Button } from "~/components/ui/input/button";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";

import type {
  RecordIndexCreateAction,
  RecordIndexPresentationDefinition,
} from "../model/definition";

export function RecordIndexPageHeader(props: {
  object: RecordIndexPresentationDefinition["object"];
  createAction?: RecordIndexCreateAction;
}) {
  return (
    <PageCardHeader
      icon={
        <TintedIconTile Icon={props.object.icon} color={props.object.color} />
      }
      title={props.object.label}
      actionButton={
        <>
          <Show when={props.createAction}>
            {(action) => (
              <Button
                variant="primary"
                accent="blue"
                size="sm"
                aria-label={`Crear ${props.object.label}`}
                onClick={() => action().onClick()}
              >
                <Show when={action().icon}>
                  {(icon) => <Dynamic component={icon()} size={14} />}
                </Show>
                {action().label}
              </Button>
            )}
          </Show>
          <AppHeaderActions />
        </>
      }
    />
  );
}
