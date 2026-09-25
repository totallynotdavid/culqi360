import { revalidate, useAction, useSearchParams } from "@solidjs/router";
import { createSignal, Errored, Loading, Show } from "solid-js";

import { Spinner } from "~/components/feedback/spinner/spinner";
import Building2 from "~/components/icons/building-2";
import CalendarDays from "~/components/icons/calendar-days";
import CircleQuestionMark from "~/components/icons/circle-question-mark";
import Info from "~/components/icons/info";
import Target from "~/components/icons/target";
import { Badge } from "~/components/ui/display/badge";
import { Button } from "~/components/ui/input/button";
import { TextInput } from "~/components/ui/input/text-input";
import { parseWireError } from "~/contracts/errors";
import type { InquiryListRowView } from "~/contracts/workflow/views";
import { formatAppDate } from "~/domain/time/app-time";
import { DataGrid } from "~/features/data-grid/components/grid";
import { createGridSource } from "~/features/data-grid/model/create-grid-source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { useSidePanel } from "~/features/side-panel/state/use-side-panel";
import { createLeadRecordCreateSidePanelPage } from "~/features/side-panel/types/side-panel-page";
import { createInquiryMutation } from "~/features/workflow/data/command-mutations";
import { inquiryListQuery } from "~/rpc/workflow/inquiry-list";
import { capitalize } from "~/shared/text";

import { inquiryStateLabel } from "./display";

import styles from "./inquiries-page.module.css";

export function InquiriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { source } = createGridSource(
    () => inquiryListQuery(),
    (data) => ({ rows: data.rows }),
  );
  const createInquiry = useAction(createInquiryMutation);
  const { openPanel } = useSidePanel();

  const initialRuc =
    typeof searchParams.ruc === "string" ? searchParams.ruc : "";
  const [ruc, setRuc] = createSignal(initialRuc);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (submitting()) {
      return;
    }

    const value = ruc().trim();
    if (!/^\d{11}$/.test(value)) {
      setErrorMessage("El RUC debe tener 11 dígitos.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await createInquiry({ ruc: value });
      revalidate(inquiryListQuery.key);
      setRuc("");
      setSearchParams({ ruc: undefined });
    } catch (submitError) {
      setErrorMessage(parseWireError(submitError).message);
    } finally {
      setSubmitting(false);
    }
  }

  function openRegistration(row: InquiryListRowView) {
    openPanel(
      createLeadRecordCreateSidePanelPage({
        ruc: row.ruc,
        inquiryId: row.id,
      }),
    );
  }

  const columns = [
    {
      key: "ruc",
      label: "RUC",
      icon: CircleQuestionMark,
      width: 140,
      sticky: true,
      renderCell: (row) => row.ruc,
    },
    {
      key: "legalName",
      label: "Razón social",
      icon: Building2,
      minWidth: 220,
      grow: true,
      renderCell: (row) => row.legalName,
    },
    {
      key: "state",
      label: "Consulta",
      icon: Info,
      width: 130,
      renderCell: (row) => (
        <Badge variant={row.state === "PENDING" ? "outline" : "secondary"}>
          {inquiryStateLabel(row.state)}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Estado",
      icon: Info,
      width: 140,
      renderCell: (row) =>
        row.status ? (
          <Badge variant="outline">{capitalize(row.status)}</Badge>
        ) : null,
    },
    {
      key: "priority",
      label: "Prioridad",
      icon: Target,
      width: 120,
      renderCell: (row) =>
        row.priority ? (
          <Badge variant="secondary">{capitalize(row.priority)}</Badge>
        ) : null,
    },
    {
      key: "createdAt",
      label: "Consultado",
      icon: CalendarDays,
      width: 130,
      renderCell: (row) => formatAppDate(row.createdAt),
    },
    {
      key: "answeredAt",
      label: "Respondido",
      icon: CalendarDays,
      width: 130,
      renderCell: (row) =>
        row.answeredAt === null ? null : formatAppDate(row.answeredAt),
    },
    {
      key: "actions",
      label: "Acciones",
      icon: CircleQuestionMark,
      width: 150,
      renderCell: (row) => (
        <Show when={row.registrable}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openRegistration(row)}
          >
            Registrar
          </Button>
        </Show>
      ),
    },
  ] satisfies ReadonlyArray<DataGridColumn<InquiryListRowView>>;

  return (
    <div class={styles.page}>
      <div class={styles.toolbar}>
        <form class={styles.form} onSubmit={(event) => void submit(event)}>
          <TextInput
            value={ruc()}
            onInput={(event) => {
              setRuc(event.currentTarget.value);
              setErrorMessage(null);
            }}
            placeholder="RUC del cliente (11 dígitos)"
            inputmode="numeric"
            maxlength={11}
            aria-label="RUC a consultar"
            sizeVariant="md"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={submitting()}
          >
            Consultar estado
          </Button>
        </form>

        <Show when={errorMessage()}>
          {(message) => <p class={styles.error}>{message()}</p>}
        </Show>
      </div>

      <Loading fallback={<Spinner size="lg" />}>
        <Errored
          fallback={
            <p class={styles.error}>No se pudieron cargar las consultas.</p>
          }
        >
          <DataGrid
            ariaLabel="Consultas de disponibilidad"
            columns={columns}
            emptyState="Aún no has consultado ningún RUC."
            rowId={(row) => row.id}
            source={source()}
          />
        </Errored>
      </Loading>
    </div>
  );
}
