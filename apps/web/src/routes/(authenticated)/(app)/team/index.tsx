import { useNavigate } from "@solidjs/router";
import { createMemo, createSignal, Loading } from "solid-js";

import CircleQuestionMark from "~/components/icons/circle-question-mark";
import List from "~/components/icons/list";
import Mail from "~/components/icons/mail";
import Plus from "~/components/icons/plus";
import UserRound from "~/components/icons/user-round";
import { SearchInput } from "~/components/ui/input/search-input";
import type { ManagedExecutiveView } from "~/contracts/capacity";
import { DataGrid } from "~/features/data-grid/components/grid";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { managedExecutivesQuery } from "~/rpc/capacity/managed-executives";
import { capitalize } from "~/shared/text";

import styles from "./team-page.module.css";

const TEAM_COLUMNS = [
  {
    key: "fullName",
    label: "Ejecutivo",
    icon: UserRound,
    minWidth: 200,
    sticky: true,
    renderCell: (executive) => executive.fullName,
  },
  {
    key: "email",
    label: "Correo",
    icon: Mail,
    minWidth: 220,
    grow: true,
    renderCell: (executive) => executive.email,
  },
  {
    key: "searchStatus",
    label: "Búsquedas",
    icon: CircleQuestionMark,
    width: 110,
    renderCell: (executive) =>
      `${executive.searchStatus.committed}/${
        executive.searchStatus.policy.monthlyLimit +
        executive.searchStatus.granted
      }`,
  },
  {
    key: "leadStatus",
    label: "Clientes",
    icon: List,
    width: 100,
    renderCell: (executive) =>
      `${executive.leadStatus.activeAssignments}/${executive.leadStatus.policy.bufferTarget}`,
  },
  {
    key: "refills",
    label: "Refills",
    icon: Plus,
    width: 90,
    renderCell: (executive) => executive.leadStatus.remaining,
  },
  {
    key: "executiveCategory",
    label: "Categoría",
    icon: UserRound,
    width: 120,
    renderCell: (executive) =>
      executive.executiveCategory
        ? capitalize(executive.executiveCategory)
        : null,
  },
] satisfies ReadonlyArray<DataGridColumn<ManagedExecutiveView>>;

export default function TeamPage() {
  const navigate = useNavigate();
  const executives = createMemo(() => managedExecutivesQuery());
  const [filter, setFilter] = createSignal("");
  const filtered = createMemo(() => {
    const value = filter().trim().toLowerCase();
    const rows = executives();

    if (!value) {
      return rows;
    }

    return rows.filter((executive) =>
      `${executive.fullName} ${executive.email}`.toLowerCase().includes(value),
    );
  });
  const openExecutive = (executive: ManagedExecutiveView) => {
    navigate(`/settings/members/${executive.id}?tab=capacity`);
  };

  const renderGrid = (
    rows: ReadonlyArray<ManagedExecutiveView>,
    emptyState: string,
  ) => (
    <DataGrid
      ariaLabel="Equipo"
      columns={TEAM_COLUMNS}
      emptyState={emptyState}
      onRowOpen={openExecutive}
      rowId={(row) => row.id}
      rowOpenIndicator="route"
      source={{ rows }}
    />
  );

  return (
    <div class={styles.page}>
      <div class={styles.searchRow}>
        <SearchInput
          value={filter()}
          onValueChange={setFilter}
          placeholder="Buscar ejecutivo..."
          aria-label="Buscar ejecutivo"
        />
      </div>

      {/* Scoped here so the roster loads under the search box rather than
          replacing the whole page with the app-level fallback. */}
      <Loading fallback={renderGrid([], "Cargando ejecutivos...")}>
        {renderGrid(filtered(), "No hay ejecutivos visibles.")}
      </Loading>
    </div>
  );
}
