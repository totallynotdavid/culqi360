import { useAction } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Button } from "~/components/ui/input/button";
import { FileInput } from "~/components/ui/input/file-input";
import { Select } from "~/components/ui/input/select";
import { TextInput } from "~/components/ui/input/text-input";
import { actionErrorMessage } from "~/contracts/errors";
import {
  describeDocKind,
  describeFulfillmentAction,
  describeFulfillmentStep,
  describeProductKind,
} from "~/contracts/workflow/fulfillment-labels";
import type {
  LeadDetailFulfillmentUnitView,
  LeadDetailFulfillmentView,
  LeadDetailView,
} from "~/contracts/workflow/views";
import {
  PRODUCT_KINDS,
  type FulfillmentAction,
  type FulfillmentDocKind,
  type ProductKind,
  isFulfillmentAction,
  isProductKind,
} from "~/contracts/workflow/vocabulary";
import {
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";
import { requestFulfillmentDownloadToken } from "~/rpc/workflow/commands/fulfillment";

import {
  chooseFulfillmentProductMutation,
  recordFulfillmentSerialMutation,
  registerFulfillmentPaymentLinkMutation,
  registerFulfillmentSaleMutation,
  rejectFulfillmentStepMutation,
  uploadFulfillmentDocumentMutation,
  uploadFulfillmentPaymentProofMutation,
  validateFulfillmentPaymentMutation,
} from "../../../data/command-mutations";
import { revalidateWorkflowLead } from "../../../data/revalidate-workflow";

import styles from "./fulfillment.module.css";

type Unit = LeadDetailFulfillmentUnitView;

const OWNER_LABELS: Record<string, string> = {
  executive: "el ejecutivo",
  back_office: "back office",
  supervisor: "el supervisor",
};

const OWNER_BADGE: Record<string, string> = {
  executive: "Ejecutivo",
  back_office: "Back office",
  supervisor: "Supervisor",
};

const DOCUMENT_ACTIONS = new Set<FulfillmentAction>([
  "upload_transactions_report",
  "generate_addendum",
  "submit_signed_addendum",
  "compile_signed_pdf",
]);

const DOC_STEP_CONTEXT: Partial<
  Record<
    FulfillmentAction,
    { docKind: FulfillmentDocKind; instruction: string }
  >
> = {
  generate_addendum: {
    docKind: "transactions_report",
    instruction: "Genera la adenda a partir del reporte de transacciones.",
  },
  submit_signed_addendum: {
    docKind: "addendum_unsigned",
    instruction:
      "Envía esta adenda al cliente para firma, luego sube las fotos.",
  },
  compile_signed_pdf: {
    docKind: "addendum_signed_photo",
    instruction: "Compila estas fotos firmadas en un solo PDF.",
  },
};

const PRODUCT_CONSEQUENCE: Record<ProductKind, string> = {
  pos_new: "Equipo nuevo: el cliente paga el POS, se genera un link de pago.",
  pos_refurbished:
    "Equipo reacondicionado: requiere reporte de transacciones y adenda firmada.",
  digital_only:
    "Solo digital: sin equipo ni pago, pasa directo a registro de venta.",
};

function pendingAction(data: LeadDetailView): FulfillmentAction | null {
  const found = data.availableActions.find((action) =>
    action.startsWith("fulfillment:"),
  );
  if (!found) {
    return null;
  }
  const action = found.slice("fulfillment:".length);
  return isFulfillmentAction(action) ? action : null;
}

async function downloadDocument(leadId: string, fileId: string) {
  const token = await requestFulfillmentDownloadToken({ leadId, fileId });
  window.location.href = `/api/files/download/${token.token}`;
}

function docsOfKind(view: LeadDetailFulfillmentView, kind: FulfillmentDocKind) {
  return view.documents.filter((doc) => doc.docKind === kind);
}

function productKindLabel(productKind: string | null): string {
  if (!productKind || !isProductKind(productKind)) {
    return "Producto sin definir";
  }
  return describeProductKind(productKind);
}

function missingUnits(units: Unit[], field: keyof Unit): Unit[] {
  return units.filter((unit) => unit[field] === null);
}

export function FulfillmentPanel(props: { data: LeadDetailView }) {
  const fulfillment = (): LeadDetailFulfillmentView | null =>
    props.data.fulfillment;
  const canReject = (): boolean =>
    props.data.availableActions.includes("fulfillment-reject");

  return (
    <Show
      when={fulfillment()}
      fallback={<p class={styles.waiting}>Entrega no iniciada.</p>}
    >
      {(view) => (
        <div class={styles.panel}>
          <ProgressChecklist view={view()} />

          <Switch fallback={<WaitingBanner view={view()} />}>
            <Match when={pendingAction(props.data)}>
              {(action) => (
                <FulfillmentControl
                  data={props.data}
                  action={action()}
                  view={view()}
                />
              )}
            </Match>
          </Switch>

          <Show when={canReject()}>
            <RejectControl leadId={props.data.lead.id} />
          </Show>

          <Show when={view().units.length > 0}>
            <UnitsMatrix units={view().units} />
          </Show>

          <Show when={view().documents.length > 0}>
            <WidgetCard variant="side-column">
              <WidgetCardHeader>
                <WidgetCardTitle text="Documentos" />
              </WidgetCardHeader>
              <WidgetCardContent>
                <ul class={styles.docList}>
                  <For each={view().documents}>
                    {(doc) => (
                      <li class={styles.docItem}>
                        <span>
                          {describeDocKind(doc.docKind)} · {doc.filename}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void downloadDocument(
                              props.data.lead.id,
                              doc.fileId,
                            )
                          }
                        >
                          Descargar
                        </Button>
                      </li>
                    )}
                  </For>
                </ul>
              </WidgetCardContent>
            </WidgetCard>
          </Show>
        </div>
      )}
    </Show>
  );
}

function ProgressChecklist(props: { view: LeadDetailFulfillmentView }) {
  return (
    <div>
      <ol class={styles.progress}>
        <For each={props.view.steps}>
          {(item) => (
            <li class={styles.progressItem} data-state={item.status}>
              {describeFulfillmentStep(item.step)}
            </li>
          )}
        </For>
      </ol>
      <div class={styles.statusLine}>
        <span class={styles.stepName}>
          {describeFulfillmentStep(props.view.currentStep)}
        </span>
        <Show when={props.view.pendingOwner}>
          {(owner) => (
            <span class={styles.badge}>
              Turno: {OWNER_BADGE[owner()] ?? owner()}
            </span>
          )}
        </Show>
      </div>
      <span class={styles.waiting}>
        {productKindLabel(props.view.productKind)}
      </span>
    </div>
  );
}

function WaitingBanner(props: { view: LeadDetailFulfillmentView }) {
  return (
    <Show when={props.view.pendingOwner}>
      {(owner) => (
        <p class={styles.waitingBanner}>
          Esperando a {OWNER_LABELS[owner()] ?? owner()}:{" "}
          {describeFulfillmentStep(props.view.currentStep)}.
        </p>
      )}
    </Show>
  );
}

function FulfillmentControl(props: {
  data: LeadDetailView;
  action: FulfillmentAction;
  view: LeadDetailFulfillmentView;
}) {
  const leadId = () => props.data.lead.id;
  return (
    <Switch>
      <Match when={props.action === "choose_product"}>
        <ProductChooser data={props.data} />
      </Match>
      <Match when={DOCUMENT_ACTIONS.has(props.action)}>
        <DocumentUpload
          leadId={leadId()}
          action={props.action}
          view={props.view}
        />
      </Match>
      <Match when={props.action === "record_serials"}>
        <SerialEntry leadId={leadId()} units={props.view.units} />
      </Match>
      <Match when={props.action === "register_payment_link"}>
        <PaymentLinkEntry leadId={leadId()} units={props.view.units} />
      </Match>
      <Match when={props.action === "upload_payment_proof"}>
        <PaymentProofUpload leadId={leadId()} units={props.view.units} />
      </Match>
      <Match when={props.action === "validate_payment"}>
        <ValidatePayment leadId={leadId()} units={props.view.units} />
      </Match>
      <Match when={props.action === "register_sale"}>
        <SaleEntry leadId={leadId()} units={props.view.units} />
      </Match>
    </Switch>
  );
}

function useSubmitState() {
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  return { submitting, setSubmitting, error, setError };
}

function CopyButton(props: { value: string }) {
  const [copied, setCopied] = createSignal(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void copy()}
    >
      {copied() ? "Copiado" : "Copiar"}
    </Button>
  );
}

function ProductChooser(props: { data: LeadDetailView }) {
  const choose = useAction(chooseFulfillmentProductMutation);
  const [productKind, setProductKind] = createSignal<ProductKind | "">("");
  const state = useSubmitState();

  const posCount = () =>
    props.data.venues.reduce(
      (sum, venue) => sum + Math.max(1, venue.posQuantity),
      0,
    );

  const unitSummary = () => {
    const kind = productKind();
    if (kind === "") {
      return null;
    }
    if (kind === "digital_only") {
      return "Se creará 1 registro digital.";
    }
    const count = Math.max(1, posCount());
    return `Se crearán ${count} unidad${count === 1 ? "" : "es"}, una por POS.`;
  };

  const productConsequence = () => {
    const kind = productKind();
    if (kind === "") {
      return null;
    }
    return PRODUCT_CONSEQUENCE[kind];
  };

  async function submitProduct() {
    const kind = productKind();
    if (kind === "") {
      return;
    }
    state.setSubmitting(true);
    state.setError(null);
    try {
      await choose({ leadId: props.data.lead.id, productKind: kind });
      revalidateWorkflowLead(props.data.lead.id);
    } catch (caught) {
      state.setError(actionErrorMessage(caught));
    } finally {
      state.setSubmitting(false);
    }
  }

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (
    event,
  ) => {
    event.preventDefault();
    void submitProduct();
  };

  const handleChange: JSX.EventHandler<HTMLSelectElement, Event> = (event) => {
    const next = event.currentTarget.value;
    setProductKind(next === "" || !isProductKind(next) ? "" : next);
  };

  return (
    <form class={styles.control} onSubmit={handleSubmit}>
      <Select label="Producto" value={productKind()} onChange={handleChange}>
        <option value="">Selecciona el producto…</option>
        <For each={PRODUCT_KINDS}>
          {(kind) => <option value={kind}>{describeProductKind(kind)}</option>}
        </For>
      </Select>
      <Show when={productConsequence()}>
        {(consequence) => (
          <>
            <p class={styles.contextNote}>{consequence()}</p>
            <p class={styles.contextNote}>{unitSummary()}</p>
          </>
        )}
      </Show>
      <Show when={state.error()}>
        <p class={styles.errorText}>{state.error()}</p>
      </Show>
      <Button
        type="submit"
        size="sm"
        disabled={state.submitting() || productKind() === ""}
      >
        {describeFulfillmentAction("choose_product")}
      </Button>
    </form>
  );
}

function DocumentUpload(props: {
  leadId: string;
  action: FulfillmentAction;
  view: LeadDetailFulfillmentView;
}) {
  const upload = useAction(uploadFulfillmentDocumentMutation);
  const [file, setFile] = createSignal<File | null>(null);
  const state = useSubmitState();
  const context = () => DOC_STEP_CONTEXT[props.action];

  async function uploadDocument() {
    const selected = file();
    if (!selected) {
      state.setError("Selecciona un archivo.");
      return;
    }
    state.setSubmitting(true);
    state.setError(null);
    try {
      const formData = new FormData();
      formData.set("leadId", props.leadId);
      formData.set("action", props.action);
      formData.set("file", selected);
      await upload(formData);
      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      state.setError(actionErrorMessage(caught));
    } finally {
      state.setSubmitting(false);
    }
  }

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (
    event,
  ) => {
    event.preventDefault();
    void uploadDocument();
  };

  return (
    <form class={styles.control} onSubmit={handleSubmit}>
      <Show when={context()}>
        {(ctx) => (
          <div class={styles.context}>
            <p class={styles.contextNote}>{ctx().instruction}</p>
            <For each={docsOfKind(props.view, ctx().docKind)}>
              {(doc) => (
                <div class={styles.contextRow}>
                  <span class={styles.contextLabel}>{doc.filename}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void downloadDocument(props.leadId, doc.fileId)
                    }
                  >
                    Descargar
                  </Button>
                </div>
              )}
            </For>
          </div>
        )}
      </Show>
      <FileInput
        onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
      />
      <Show when={state.error()}>
        <p class={styles.errorText}>{state.error()}</p>
      </Show>
      <Button type="submit" size="sm" disabled={state.submitting()}>
        {describeFulfillmentAction(props.action)}
      </Button>
    </form>
  );
}

function UnitTextRows(props: {
  leadId: string;
  units: Unit[];
  placeholder: string;
  verb: string;
  context?: (unit: Unit) => JSX.Element;
  submitOne: (unitId: string, value: string) => Promise<void>;
}) {
  const [values, setValues] = createSignal<Record<string, string>>({});
  const state = useSubmitState();

  function setValue(unitId: string, value: string) {
    setValues((prev) => ({ ...prev, [unitId]: value }));
  }

  async function submitAll() {
    const entries = props.units
      .map((unit) => [unit.id, (values()[unit.id] ?? "").trim()] as const)
      .filter(([, value]) => value.length > 0);
    if (entries.length === 0) {
      return;
    }

    state.setSubmitting(true);
    state.setError(null);
    try {
      await Promise.all(
        entries.map(([unitId, value]) => props.submitOne(unitId, value)),
      );
      // Revalidate once after saving every entered unit.
      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      state.setError(actionErrorMessage(caught));
    } finally {
      state.setSubmitting(false);
    }
  }

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (
    event,
  ) => {
    event.preventDefault();
    void submitAll();
  };

  return (
    <form class={styles.control} onSubmit={handleSubmit}>
      <For each={props.units}>
        {(unit) => (
          <div class={styles.unitEntry}>
            <span class={styles.unitLabel}>{unit.label}</span>
            <Show when={props.context}>{(ctx) => ctx()(unit)}</Show>
            <TextInput
              sizeVariant="sm"
              value={values()[unit.id] ?? ""}
              placeholder={props.placeholder}
              onChange={(value) => setValue(unit.id, value)}
            />
          </div>
        )}
      </For>
      <Show when={state.error()}>
        <p class={styles.errorText}>{state.error()}</p>
      </Show>
      <Button type="submit" size="sm" disabled={state.submitting()}>
        {props.verb}
      </Button>
    </form>
  );
}

function SerialEntry(props: { leadId: string; units: Unit[] }) {
  const record = useAction(recordFulfillmentSerialMutation);
  return (
    <UnitTextRows
      leadId={props.leadId}
      units={missingUnits(props.units, "serial")}
      placeholder="Serial"
      verb={describeFulfillmentAction("record_serials")}
      submitOne={(unitId, serial) =>
        record({ leadId: props.leadId, unitId, serial }).then(() => undefined)
      }
    />
  );
}

function PaymentLinkEntry(props: { leadId: string; units: Unit[] }) {
  const register = useAction(registerFulfillmentPaymentLinkMutation);
  return (
    <UnitTextRows
      leadId={props.leadId}
      units={missingUnits(props.units, "paymentUrl")}
      placeholder="https://pago..."
      verb={describeFulfillmentAction("register_payment_link")}
      context={(unit) => (
        <span class={styles.contextValue}>
          Serial: {unit.serial ?? "sin registrar"}
        </span>
      )}
      submitOne={(unitId, paymentUrl) =>
        register({ leadId: props.leadId, unitId, paymentUrl }).then(
          () => undefined,
        )
      }
    />
  );
}

function SaleEntry(props: { leadId: string; units: Unit[] }) {
  const register = useAction(registerFulfillmentSaleMutation);
  return (
    <UnitTextRows
      leadId={props.leadId}
      units={missingUnits(props.units, "serviceRef")}
      placeholder="Referencia de venta"
      verb={describeFulfillmentAction("register_sale")}
      context={(unit) => (
        <span class={styles.contextValue}>
          Serial: {unit.serial ?? "sin registrar"}
          {unit.paymentValidated ? " · Pago validado" : ""}
        </span>
      )}
      submitOne={(unitId, serviceRef) =>
        register({ leadId: props.leadId, unitId, serviceRef }).then(
          () => undefined,
        )
      }
    />
  );
}

function PaymentProofUpload(props: { leadId: string; units: Unit[] }) {
  const upload = useAction(uploadFulfillmentPaymentProofMutation);

  async function submitFile(unitId: string, file: File) {
    const formData = new FormData();
    formData.set("leadId", props.leadId);
    formData.set("unitId", unitId);
    formData.set("file", file);
    await upload(formData);
    revalidateWorkflowLead(props.leadId);
  }

  return (
    <div class={styles.control}>
      <For each={missingUnits(props.units, "paymentProofFileId")}>
        {(unit) => (
          <div class={styles.unitEntry}>
            <span class={styles.unitLabel}>{unit.label}</span>
            {/* Back office registers payment links; executives need them before proof upload. */}
            <Show
              when={unit.paymentUrl}
              fallback={
                <span class={styles.contextValue}>Sin link de pago aún.</span>
              }
            >
              {(url) => (
                <div class={styles.contextRow}>
                  <a
                    class={styles.contextLink}
                    href={url()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {url()}
                  </a>
                  <CopyButton value={url()} />
                </div>
              )}
            </Show>
            <UnitFileControl
              verb={describeFulfillmentAction("upload_payment_proof")}
              onSubmit={(file) => submitFile(unit.id, file)}
            />
          </div>
        )}
      </For>
    </div>
  );
}

function ValidatePayment(props: { leadId: string; units: Unit[] }) {
  const validate = useAction(validateFulfillmentPaymentMutation);
  const state = useSubmitState();

  async function validatePayment() {
    state.setSubmitting(true);
    state.setError(null);
    try {
      await validate({ leadId: props.leadId });
      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      state.setError(actionErrorMessage(caught));
    } finally {
      state.setSubmitting(false);
    }
  }

  return (
    <div class={styles.control}>
      <p class={styles.contextNote}>
        Revisa cada comprobante antes de validar. Si alguno es incorrecto,
        recházalo para que el ejecutivo lo reenvíe.
      </p>
      <For each={props.units}>
        {(unit) => (
          <div class={styles.contextRow}>
            <span class={styles.contextLabel}>{unit.label}</span>
            <Show
              when={unit.paymentProofFileId}
              fallback={
                <span class={styles.contextValue}>Sin comprobante</span>
              }
            >
              {(fileId) => (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void downloadDocument(props.leadId, fileId())}
                >
                  Ver comprobante
                </Button>
              )}
            </Show>
          </div>
        )}
      </For>
      <Show when={state.error()}>
        <p class={styles.errorText}>{state.error()}</p>
      </Show>
      <Button
        type="button"
        size="sm"
        disabled={state.submitting()}
        onClick={() => void validatePayment()}
      >
        {describeFulfillmentAction("validate_payment")}
      </Button>
    </div>
  );
}

function RejectControl(props: { leadId: string }) {
  const reject = useAction(rejectFulfillmentStepMutation);
  const [reason, setReason] = createSignal("");
  const state = useSubmitState();

  async function submitReject() {
    if (!reason().trim()) {
      state.setError("Indica el motivo de la devolución.");
      return;
    }
    state.setSubmitting(true);
    state.setError(null);
    try {
      await reject({ leadId: props.leadId, reason: reason().trim() });
      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      state.setError(actionErrorMessage(caught));
    } finally {
      state.setSubmitting(false);
    }
  }

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (
    event,
  ) => {
    event.preventDefault();
    void submitReject();
  };

  return (
    <form class={styles.rejectBox} onSubmit={handleSubmit}>
      <TextInput
        sizeVariant="sm"
        value={reason()}
        placeholder="Motivo de la devolución"
        onChange={setReason}
      />
      <Show when={state.error()}>
        <p class={styles.errorText}>{state.error()}</p>
      </Show>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={state.submitting()}
      >
        Rechazar y devolver
      </Button>
    </form>
  );
}

function UnitFileControl(props: {
  verb: string;
  onSubmit: (file: File) => Promise<void>;
}) {
  const [file, setFile] = createSignal<File | null>(null);
  const state = useSubmitState();

  async function submitFile() {
    const selected = file();
    if (!selected) {
      return;
    }
    state.setSubmitting(true);
    state.setError(null);
    try {
      await props.onSubmit(selected);
    } catch (caught) {
      state.setError(actionErrorMessage(caught));
    } finally {
      state.setSubmitting(false);
    }
  }

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (
    event,
  ) => {
    event.preventDefault();
    void submitFile();
  };

  return (
    <form class={styles.unitRow} onSubmit={handleSubmit}>
      <div class={styles.unitGrow}>
        <FileInput
          onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
        />
      </div>
      <Button type="submit" size="sm" disabled={state.submitting()}>
        {props.verb}
      </Button>
      <Show when={state.error()}>
        <p class={styles.errorText}>{state.error()}</p>
      </Show>
    </form>
  );
}

function paymentStatus(unit: Unit): string {
  if (unit.paymentValidated) {
    return "Validado";
  }
  if (unit.paymentProofFileId) {
    return "Comprobante recibido";
  }
  if (unit.paymentUrl) {
    return "Link enviado";
  }
  return "Pendiente";
}

function UnitsMatrix(props: { units: Unit[] }) {
  return (
    <table class={styles.matrix}>
      <thead>
        <tr>
          <th>Unidad</th>
          <th>Serial</th>
          <th>Pago</th>
          <th>Venta</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.units}>
          {(unit) => (
            <tr data-state={unit.serviceRef ? "done" : "current"}>
              <td>{unit.label}</td>
              <td>{unit.serial ?? "Sin registrar"}</td>
              <td>{paymentStatus(unit)}</td>
              <td>{unit.serviceRef ? "✓ Registrada" : "Pendiente"}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
