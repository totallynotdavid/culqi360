import { useAction } from "@solidjs/router";
import { onSettled } from "solid-js";

import {
  type AuthFunnelClientEventPayload,
  type AuthFunnelScreen,
} from "~/domain/observability/auth-funnel";
import { trackAuthClientEventMutation } from "~/features/auth/data/analytics-mutations";

export function useAuthPageView(screen: AuthFunnelScreen): void {
  const trackAuthClientEvent = useAction(trackAuthClientEventMutation);

  onSettled(() => {
    const event = {
      kind: "screen_viewed",
      screen,
    } satisfies AuthFunnelClientEventPayload;

    void trackAuthClientEvent(event);
  });
}
