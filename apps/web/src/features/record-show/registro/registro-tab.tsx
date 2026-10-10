import { Show } from "solid-js";

import type {
  CommercialScopeBinding,
  RecordContext,
} from "~/features/record-show/model/record-context";
import { CreateFieldsSection } from "~/features/record-show/sections/fields";
import { WidgetStack } from "~/features/widgets/widget-layout";

import styles from "~/features/record-show/tabs/home.module.css";

function draftCommercialScope(context: RecordContext): CommercialScopeBinding {
  if (context.kind !== "draft") {
    throw new Error("The registro tab needs a draft record context");
  }

  return context.commercialScope;
}

export function RegistroTab(props: { context: RecordContext }) {
  return (
    <Show when={props.context.kind === "draft"}>
      <div class={styles.homeContent}>
        <WidgetStack>
          <CreateFieldsSection
            commercialScope={draftCommercialScope(props.context)}
          />
        </WidgetStack>
      </div>
    </Show>
  );
}
