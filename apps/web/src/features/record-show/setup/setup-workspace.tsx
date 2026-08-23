import { useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";

import BrowserMaximize from "~/components/icons/browser-maximize";
import LinkIcon from "~/components/icons/link";
import Package from "~/components/icons/package";
import { Button } from "~/components/ui/input/button";
import { Radio, RadioGroup } from "~/components/ui/input/radio";
import { TextInput } from "~/components/ui/input/text-input";
import { Toggle } from "~/components/ui/input/toggle";
import { actionErrorMessage } from "~/contracts/errors";
import type {
  LeadDetailVenueView,
  LeadDetailView,
} from "~/contracts/workflow/views";
import {
  COLLECTION_MODES,
  type CollectionMode,
  type ProductScope,
} from "~/contracts/workflow/vocabulary";
import {
  FieldInputValue,
  FieldRow,
  FieldTable,
} from "~/features/widgets/field-table";
import {
  WidgetCardActions,
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";
import { WidgetStack } from "~/features/widgets/widget-layout";
import {
  addVenueAccountsMutation,
  createVenueMutation,
  saveDigitalPolicyMutation,
  updateVenueMutation,
} from "~/features/workflow/data/command-mutations";
import { revalidateWorkflowLead } from "~/features/workflow/data/revalidate-workflow";

import { AccountsForm } from "./components/accounts-form";
import { VenueCard } from "./components/venue-card";
import { VenueForm } from "./components/venue-form";
import { useAccountsFormState } from "./model/accounts-form-state";
import { buildAccountsSubmitInput } from "./model/accounts-submit-input";
import {
  useVenueFormState,
  type VenueFormValues,
} from "./model/venue-form-state";
import { buildVenueSubmitInput } from "./model/venue-submit-input";

import styles from "./setup-workspace.module.css";

const MODALIDAD_COBRO_LABELS: Record<CollectionMode, string> = {
  SUSCRIPCIONES: "Suscripciones",
  ONE_CLIC: "One Click",
  CARGO_UNICO: "Cargo único",
};

export function SetupWorkspace(props: { data: LeadDetailView }) {
  const canAddVenue = () => props.data.lead.stage === "SETUP";
  const canAddAccounts = () => props.data.lead.stage === "SETUP";
  const canEditDigitalPolicy = () => props.data.lead.stage === "SETUP";
  const canEditVenue = () =>
    props.data.availableActions.includes("update-venue");
  const [editingVenueId, setEditingVenueId] = createSignal<string | null>(null);

  return (
    <WidgetStack>
      <Show when={canEditDigitalPolicy()}>
        <DigitalPolicyPanel
          leadId={props.data.lead.id}
          linkScope={props.data.profile.linkScope}
          linkUrl={props.data.profile.linkUrl}
          onlineScope={props.data.profile.onlineScope}
          onlineUrl={props.data.profile.onlineUrl}
          onlineCollectionMode={props.data.profile.onlineCollectionMode}
        />
      </Show>

      <Show when={canAddVenue()}>
        <VenueCreatePanel
          leadId={props.data.lead.id}
          linkScope={props.data.profile.linkScope}
          onlineScope={props.data.profile.onlineScope}
        />
      </Show>

      <Show
        when={props.data.venues.length > 0}
        fallback={
          <Show when={!canAddVenue()}>
            <WidgetCard>
              <WidgetCardContent>
                <div class={styles.emptyState}>No hay sedes registradas</div>
              </WidgetCardContent>
            </WidgetCard>
          </Show>
        }
      >
        <For each={props.data.venues}>
          {(venue) => (
            <Show
              when={editingVenueId() === venue.id}
              fallback={
                <>
                  <VenueCard
                    venue={venue}
                    canEdit={canEditVenue()}
                    onEdit={() => setEditingVenueId(venue.id)}
                  />
                  <Show when={canAddAccounts() && !venue.solesAccount}>
                    <AccountsFormPanel
                      leadId={props.data.lead.id}
                      venue={venue}
                    />
                  </Show>
                </>
              }
            >
              <VenueEditPanel
                leadId={props.data.lead.id}
                venue={venue}
                linkScope={props.data.profile.linkScope}
                onlineScope={props.data.profile.onlineScope}
                onClose={() => setEditingVenueId(null)}
              />
            </Show>
          )}
        </For>
      </Show>
    </WidgetStack>
  );
}

function DigitalPolicyPanel(props: {
  leadId: string;
  linkScope: ProductScope;
  linkUrl: string | null;
  onlineScope: ProductScope;
  onlineUrl: string | null;
  onlineCollectionMode: CollectionMode | null;
}) {
  const saveDigitalPolicy = useAction(saveDigitalPolicyMutation);
  const [linkEnabled, setLinkEnabled] = createSignal(
    props.linkScope !== "none",
  );
  const [linkScope, setLinkScope] = createSignal<"shared" | "per_venue">(
    props.linkScope === "per_venue" ? "per_venue" : "shared",
  );
  const [linkUrl, setLinkUrl] = createSignal(props.linkUrl ?? "");
  const [onlineEnabled, setOnlineEnabled] = createSignal(
    props.onlineScope !== "none",
  );
  const [onlineScope, setOnlineScope] = createSignal<"shared" | "per_venue">(
    props.onlineScope === "per_venue" ? "per_venue" : "shared",
  );
  const [onlineUrl, setOnlineUrl] = createSignal(props.onlineUrl ?? "");
  const [onlineCollectionMode, setOnlineCollectionMode] = createSignal<
    CollectionMode | ""
  >(props.onlineCollectionMode ?? "");
  const [submitting, setSubmitting] = createSignal(false);
  const [digitalPolicyErrorMessage, setDigitalPolicyErrorMessage] =
    createSignal<string | null>(null);

  const resolvedLinkScope = () => (linkEnabled() ? linkScope() : "none");
  const resolvedOnlineScope = () => (onlineEnabled() ? onlineScope() : "none");

  function validate(): string | null {
    const selectedLinkScope = resolvedLinkScope();
    const selectedOnlineScope = resolvedOnlineScope();

    if (selectedLinkScope === "shared" && !linkUrl().trim()) {
      return "URL de CulqiLink es requerida cuando la modalidad es compartida";
    }

    if (selectedOnlineScope === "shared" && !onlineUrl().trim()) {
      return "URL de CulqiOnline es requerida cuando la modalidad es compartida";
    }

    if (selectedOnlineScope === "shared" && !onlineCollectionMode()) {
      return "Modalidad de cobro es obligatoria cuando CulqiOnline es compartido";
    }

    return null;
  }

  async function handleSave(event: SubmitEvent) {
    event.preventDefault();

    const validationError = validate();

    if (validationError) {
      setDigitalPolicyErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    setDigitalPolicyErrorMessage(null);

    try {
      const selectedLinkScope = resolvedLinkScope();
      const selectedOnlineScope = resolvedOnlineScope();
      const collectionMode = onlineCollectionMode();

      await saveDigitalPolicy({
        leadId: props.leadId,
        linkScope: selectedLinkScope,
        linkUrl: selectedLinkScope === "shared" ? linkUrl().trim() : null,
        onlineScope: selectedOnlineScope,
        onlineUrl: selectedOnlineScope === "shared" ? onlineUrl().trim() : null,
        onlineCollectionMode:
          selectedOnlineScope === "shared" && collectionMode
            ? collectionMode
            : null,
      });

      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      setDigitalPolicyErrorMessage(actionErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WidgetCard>
      <WidgetCardHeader>
        <WidgetCardTitle text="Política digital" />
      </WidgetCardHeader>

      <WidgetCardContent>
        <form onSubmit={(event) => void handleSave(event)}>
          <FieldTable>
            <FieldRow label="Activar CulqiLink" icon={LinkIcon}>
              <FieldInputValue>
                <Toggle
                  ariaLabel="Activar CulqiLink"
                  value={linkEnabled()}
                  onChange={(checked) => setLinkEnabled(checked)}
                />
              </FieldInputValue>
            </FieldRow>

            <Show when={linkEnabled()}>
              <FieldRow label="Modalidad CulqiLink" icon={LinkIcon}>
                <FieldInputValue>
                  <RadioGroup>
                    <Radio
                      name="linkScope"
                      label="URL compartida"
                      checked={linkScope() === "shared"}
                      onChange={() => setLinkScope("shared")}
                    />
                    <Radio
                      name="linkScope"
                      label="URL por local"
                      checked={linkScope() === "per_venue"}
                      onChange={() => setLinkScope("per_venue")}
                    />
                  </RadioGroup>
                </FieldInputValue>
              </FieldRow>

              <Show when={linkScope() === "shared"}>
                <FieldRow label="URL CulqiLink" icon={LinkIcon}>
                  <FieldInputValue>
                    <TextInput
                      sizeVariant="sm"
                      type="url"
                      value={linkUrl()}
                      onChange={setLinkUrl}
                      placeholder="URL CulqiLink"
                    />
                  </FieldInputValue>
                </FieldRow>
              </Show>
            </Show>

            <FieldRow label="Activar CulqiOnline" icon={BrowserMaximize}>
              <FieldInputValue>
                <Toggle
                  ariaLabel="Activar CulqiOnline"
                  value={onlineEnabled()}
                  onChange={(checked) => {
                    setOnlineEnabled(checked);
                    if (!checked) {
                      setOnlineCollectionMode("");
                    }
                  }}
                />
              </FieldInputValue>
            </FieldRow>

            <Show when={onlineEnabled()}>
              <FieldRow label="Modalidad CulqiOnline" icon={BrowserMaximize}>
                <FieldInputValue>
                  <RadioGroup>
                    <Radio
                      name="onlineScope"
                      label="URL compartida"
                      checked={onlineScope() === "shared"}
                      onChange={() => setOnlineScope("shared")}
                    />
                    <Radio
                      name="onlineScope"
                      label="URL por local"
                      checked={onlineScope() === "per_venue"}
                      onChange={() => {
                        setOnlineScope("per_venue");
                        setOnlineCollectionMode("");
                      }}
                    />
                  </RadioGroup>
                </FieldInputValue>
              </FieldRow>

              <Show when={onlineScope() === "shared"}>
                <FieldRow label="URL CulqiOnline" icon={BrowserMaximize}>
                  <FieldInputValue>
                    <TextInput
                      sizeVariant="sm"
                      type="url"
                      value={onlineUrl()}
                      onChange={setOnlineUrl}
                      placeholder="URL CulqiOnline"
                    />
                  </FieldInputValue>
                </FieldRow>

                <FieldRow label="Modalidad de cobro" icon={Package}>
                  <FieldInputValue>
                    <RadioGroup>
                      <For each={COLLECTION_MODES}>
                        {(value) => (
                          <Radio
                            name="onlineCollectionMode"
                            value={value}
                            label={MODALIDAD_COBRO_LABELS[value]}
                            checked={onlineCollectionMode() === value}
                            onChange={() => setOnlineCollectionMode(value)}
                          />
                        )}
                      </For>
                    </RadioGroup>
                  </FieldInputValue>
                </FieldRow>
              </Show>
            </Show>
          </FieldTable>

          <Show when={digitalPolicyErrorMessage()}>
            {(msg) => <p class={styles.error}>{msg()}</p>}
          </Show>

          <WidgetCardActions>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={submitting()}
            >
              Guardar política digital
            </Button>
          </WidgetCardActions>
        </form>
      </WidgetCardContent>
    </WidgetCard>
  );
}

function VenueCreatePanel(props: {
  leadId: string;
  linkScope: ProductScope;
  onlineScope: ProductScope;
}) {
  const createVenue = useAction(createVenueMutation);
  const form = useVenueFormState();
  const [showForm, setShowForm] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [venueCreateErrorMessage, setVenueCreateErrorMessage] = createSignal<
    string | null
  >(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    const parsed = buildVenueSubmitInput(form, {
      linkScope: props.linkScope,
      onlineScope: props.onlineScope,
    });

    if (!parsed.ok) {
      setVenueCreateErrorMessage(parsed.error);
      return;
    }

    setSubmitting(true);
    setVenueCreateErrorMessage(null);

    try {
      await createVenue({ leadId: props.leadId, ...parsed.value });
      revalidateWorkflowLead(props.leadId);
      form.reset();
      setShowForm(false);
    } catch (caught) {
      setVenueCreateErrorMessage(actionErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Show
      when={showForm()}
      fallback={
        <WidgetCard>
          <WidgetCardHeader>
            <WidgetCardTitle text="Sedes" />
          </WidgetCardHeader>
          <WidgetCardContent>
            <WidgetCardActions align="start">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowForm(true)}
              >
                + Agregar sede
              </Button>
            </WidgetCardActions>
          </WidgetCardContent>
        </WidgetCard>
      }
    >
      <VenueForm
        title="Agregar sede"
        submitLabel="Guardar sede"
        form={form}
        linkScope={props.linkScope}
        onlineScope={props.onlineScope}
        submitting={submitting()}
        errorMessage={venueCreateErrorMessage()}
        onSubmit={(event) => void handleSubmit(event)}
      />
    </Show>
  );
}

function VenueEditPanel(props: {
  leadId: string;
  venue: LeadDetailVenueView;
  linkScope: ProductScope;
  onlineScope: ProductScope;
  onClose: () => void;
}) {
  const updateVenue = useAction(updateVenueMutation);
  const form = useVenueFormState(toVenueFormValues(props.venue));
  const [submitting, setSubmitting] = createSignal(false);
  const [venueEditErrorMessage, setVenueEditErrorMessage] = createSignal<
    string | null
  >(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    const parsed = buildVenueSubmitInput(form, {
      linkScope: props.linkScope,
      onlineScope: props.onlineScope,
    });

    if (!parsed.ok) {
      setVenueEditErrorMessage(parsed.error);
      return;
    }

    setSubmitting(true);
    setVenueEditErrorMessage(null);

    try {
      await updateVenue({
        leadId: props.leadId,
        venueId: props.venue.id,
        ...parsed.value,
      });
      revalidateWorkflowLead(props.leadId);
      props.onClose();
    } catch (caught) {
      setVenueEditErrorMessage(actionErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VenueForm
      title={`Editar sede: ${props.venue.tradeName}`}
      submitLabel="Guardar cambios"
      form={form}
      linkScope={props.linkScope}
      onlineScope={props.onlineScope}
      submitting={submitting()}
      errorMessage={venueEditErrorMessage()}
      secondaryAction={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={submitting()}
          onClick={props.onClose}
        >
          Cancelar
        </Button>
      }
      onSubmit={(event) => void handleSubmit(event)}
    />
  );
}

function toVenueFormValues(venue: LeadDetailVenueView): VenueFormValues {
  return {
    tradeName: venue.tradeName,
    posQuantity: String(venue.posQuantity),
    linkUrl: venue.linkUrl ?? "",
    onlineUrl: venue.onlineUrl ?? "",
    onlineCollectionMode: venue.onlineCollectionMode ?? "",
    address: venue.address,
    addressReference: venue.addressReference,
    district: venue.district,
    province: venue.province,
    department: venue.department,
  };
}

function AccountsFormPanel(props: {
  leadId: string;
  venue: LeadDetailVenueView;
}) {
  const addAccounts = useAction(addVenueAccountsMutation);
  const form = useAccountsFormState();
  const [submitting, setSubmitting] = createSignal(false);
  const [accountsErrorMessage, setAccountsErrorMessage] = createSignal<
    string | null
  >(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    const parsed = buildAccountsSubmitInput(form);

    if (!parsed.ok) {
      setAccountsErrorMessage(parsed.error);
      return;
    }

    setSubmitting(true);
    setAccountsErrorMessage(null);

    try {
      await addAccounts({
        leadId: props.leadId,
        venueId: props.venue.id,
        ...parsed.value,
      });

      revalidateWorkflowLead(props.leadId);
      form.reset();
    } catch (caught) {
      setAccountsErrorMessage(actionErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AccountsForm
      venueName={props.venue.tradeName}
      form={form}
      submitting={submitting()}
      errorMessage={accountsErrorMessage()}
      onSubmit={(event) => void handleSubmit(event)}
    />
  );
}
