import { type JSX } from "@solidjs/web";
import { Show } from "solid-js";

import Building2 from "~/components/icons/building-2";
import LinkIcon from "~/components/icons/link";
import MapIcon from "~/components/icons/map";
import Moneybag from "~/components/icons/moneybag";
import Package from "~/components/icons/package";
import { Button } from "~/components/ui/input/button";
import type { LeadDetailVenueView } from "~/contracts/workflow/views";
import {
  FieldTable,
  FieldTextValue,
  RecordInlineCell,
} from "~/features/widgets/field-table";
import {
  WidgetCard,
  WidgetCardActions,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

type IconComponent = (props: { size?: number }) => JSX.Element;

function VenueDetailRow(props: {
  label: string;
  icon: IconComponent;
  children: JSX.Element;
}) {
  return (
    <RecordInlineCell label={props.label} icon={props.icon}>
      <FieldTextValue>{props.children}</FieldTextValue>
    </RecordInlineCell>
  );
}

export function VenueCard(props: {
  venue: LeadDetailVenueView;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const venue = () => props.venue;
  return (
    <WidgetCard>
      <WidgetCardHeader>
        <WidgetCardTitle text={venue().tradeName} />
      </WidgetCardHeader>
      <WidgetCardContent>
        <FieldTable>
          <VenueDetailRow label="Cantidad POS" icon={Package}>
            {venue().posQuantity}
          </VenueDetailRow>
          <VenueDetailRow label="Dirección" icon={MapIcon}>
            {venue().address}
          </VenueDetailRow>
          <Show when={venue().addressReference}>
            <VenueDetailRow label="Referencia" icon={MapIcon}>
              {venue().addressReference}
            </VenueDetailRow>
          </Show>
          <VenueDetailRow label="Distrito" icon={MapIcon}>
            {venue().district}
          </VenueDetailRow>
          <VenueDetailRow label="Provincia" icon={MapIcon}>
            {venue().province}
          </VenueDetailRow>
          <VenueDetailRow label="Departamento" icon={MapIcon}>
            {venue().department}
          </VenueDetailRow>
          <Show when={venue().linkUrl}>
            <VenueDetailRow label="URL Culqi Link" icon={LinkIcon}>
              {venue().linkUrl}
            </VenueDetailRow>
          </Show>
          <Show when={venue().onlineUrl}>
            <VenueDetailRow label="URL Culqi Online" icon={LinkIcon}>
              {venue().onlineUrl}
            </VenueDetailRow>
          </Show>
          <Show when={venue().solesAccount} keyed>
            {(soles) => (
              <>
                <VenueDetailRow label="Banco SOLES" icon={Moneybag}>
                  {soles.banco}
                </VenueDetailRow>
                <VenueDetailRow label="Tipo cuenta SOLES" icon={Package}>
                  {soles.tipoCuenta}
                </VenueDetailRow>
                <VenueDetailRow label="Nro cuenta SOLES" icon={Package}>
                  {soles.nroCuenta}
                </VenueDetailRow>
                <Show when={soles.cci}>
                  <VenueDetailRow label="CCI SOLES" icon={Package}>
                    {soles.cci}
                  </VenueDetailRow>
                </Show>
                <VenueDetailRow label="Cuenta de abono" icon={Moneybag}>
                  {soles.isSettlement
                    ? `SOLES (${soles.banco})`
                    : `USD (${venue().dollarAccount?.banco ?? "no registrado"})`}
                </VenueDetailRow>
              </>
            )}
          </Show>
          <Show when={venue().dollarAccount}>
            <>
              <VenueDetailRow label="Banco USD" icon={Moneybag}>
                {venue().dollarAccount?.banco}
              </VenueDetailRow>
              <VenueDetailRow label="Tipo cuenta USD" icon={Package}>
                {venue().dollarAccount?.tipoCuenta}
              </VenueDetailRow>
              <VenueDetailRow label="Nro cuenta USD" icon={Package}>
                {venue().dollarAccount?.nroCuenta}
              </VenueDetailRow>
              <Show when={venue().dollarAccount?.cci}>
                <VenueDetailRow label="CCI USD" icon={Package}>
                  {venue().dollarAccount?.cci}
                </VenueDetailRow>
              </Show>
            </>
          </Show>
          <Show when={!venue().solesAccount}>
            <VenueDetailRow label="Cuentas" icon={Building2}>
              Pendiente de registro
            </VenueDetailRow>
          </Show>
        </FieldTable>
        <Show when={props.canEdit}>
          <WidgetCardActions align="start">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={props.onEdit}
            >
              Editar sede
            </Button>
          </WidgetCardActions>
        </Show>
      </WidgetCardContent>
    </WidgetCard>
  );
}
