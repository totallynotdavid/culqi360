import type { JSX } from "@solidjs/web";

import Activity from "~/components/icons/activity";
import CalendarClock from "~/components/icons/calendar-clock";
import CalendarDays from "~/components/icons/calendar-days";
import CircleCheckBig from "~/components/icons/circle-check-big";
import CircleQuestionMark from "~/components/icons/circle-question-mark";
import Timer from "~/components/icons/loader-circle";
import Lock from "~/components/icons/lock";
import UserRound from "~/components/icons/user-round";
import { Badge } from "~/components/ui/display/badge";
import type {
  EventLogRecord,
  EventLogTable,
} from "~/contracts/event-logs/event-log";
import { summarizeFieldChanges } from "~/contracts/events";
import { formatAppDateTime } from "~/domain/time/app-time";
import type { DataGridIcon } from "~/features/data-grid/model/types";

import { EventLogJsonCell } from "../components/event-log-json-cell";

export type EventLogFilterField =
  | "eventType"
  | "actorUserId"
  | "status"
  | "onlyHighRisk"
  | "dateRange";

export type EventLogColumn = {
  id: string;
  label: string;
  icon: DataGridIcon;
  minWidth: number;
  defaultWidth: number;
  renderCell: (record: EventLogRecord) => JSX.Element;
};

export type EventLogSource = {
  table: EventLogTable;
  label: string;
  eventTypeLabel: string;
  columns: readonly EventLogColumn[];
  filters: readonly EventLogFilterField[];
};

const timestampColumn: EventLogColumn = {
  id: "timestamp",
  label: "Hora",
  icon: CalendarDays,
  minWidth: 120,
  defaultWidth: 180,
  renderCell: (record) => formatAppDateTime(record.timestamp),
};

const detailsColumn: EventLogColumn = {
  id: "properties",
  label: "Detalles",
  icon: CircleQuestionMark,
  minWidth: 200,
  defaultWidth: 360,
  renderCell: (record) => <EventLogJsonCell value={record.properties} />,
};

const domainSource = {
  table: "DOMAIN_EVENT",
  label: "Eventos de dominio",
  eventTypeLabel: "Acción",
  filters: ["eventType", "actorUserId", "onlyHighRisk", "dateRange"],
  columns: [
    timestampColumn,
    {
      id: "event",
      label: "Acción",
      icon: Activity,
      minWidth: 160,
      defaultWidth: 220,
      renderCell: (record) => record.event,
    },
    {
      id: "entity",
      label: "Entidad",
      icon: CircleQuestionMark,
      minWidth: 120,
      defaultWidth: 180,
      renderCell: (record) =>
        record.table === "DOMAIN_EVENT"
          ? `${record.entity.type}#${record.entity.id}`
          : null,
    },
    {
      id: "actor",
      label: "Actor",
      icon: UserRound,
      minWidth: 100,
      defaultWidth: 150,
      renderCell: (record) =>
        record.table === "DOMAIN_EVENT"
          ? (record.actorUserId ?? "Sistema")
          : null,
    },
    {
      id: "changes",
      label: "Cambios",
      icon: CircleQuestionMark,
      minWidth: 200,
      defaultWidth: 320,
      renderCell: (record) =>
        record.table === "DOMAIN_EVENT" && record.changes.length > 0
          ? summarizeFieldChanges(record.changes)
          : null,
    },
    detailsColumn,
  ],
} satisfies EventLogSource;

const actionSource = {
  table: "ACTION_LOG",
  label: "Registros de acción",
  eventTypeLabel: "Acción",
  filters: ["eventType", "actorUserId", "status", "dateRange"],
  columns: [
    timestampColumn,
    {
      id: "event",
      label: "Acción",
      icon: Activity,
      minWidth: 180,
      defaultWidth: 260,
      renderCell: (record) => record.event,
    },
    {
      id: "status",
      label: "Estado",
      icon: CircleCheckBig,
      minWidth: 90,
      defaultWidth: 120,
      renderCell: (record) =>
        record.table === "ACTION_LOG" ? (
          <Badge variant={record.status === "ok" ? "success" : "destructive"}>
            {record.status}
          </Badge>
        ) : null,
    },
    {
      id: "duration",
      label: "Duración",
      icon: Timer,
      minWidth: 90,
      defaultWidth: 110,
      renderCell: (record) =>
        record.table === "ACTION_LOG" ? `${record.durationMs} ms` : null,
    },
    {
      id: "actor",
      label: "Actor",
      icon: UserRound,
      minWidth: 100,
      defaultWidth: 150,
      renderCell: (record) =>
        record.table === "ACTION_LOG"
          ? (record.actorUserId ?? "Sistema")
          : null,
    },
    detailsColumn,
  ],
} satisfies EventLogSource;

const authSource = {
  table: "AUTH_EVENT",
  label: "Autenticación",
  eventTypeLabel: "Evento",
  filters: ["eventType", "dateRange"],
  columns: [
    timestampColumn,
    {
      id: "event",
      label: "Evento",
      icon: Activity,
      minWidth: 180,
      defaultWidth: 240,
      renderCell: (record) => record.event,
    },
    {
      id: "screen",
      label: "Pantalla",
      icon: CircleQuestionMark,
      minWidth: 120,
      defaultWidth: 160,
      renderCell: (record) =>
        record.table === "AUTH_EVENT" ? record.screen : null,
    },
    {
      id: "method",
      label: "Método",
      icon: Lock,
      minWidth: 110,
      defaultWidth: 150,
      renderCell: (record) =>
        record.table === "AUTH_EVENT" ? record.method : null,
    },
    {
      id: "outcome",
      label: "Resultado",
      icon: CalendarClock,
      minWidth: 110,
      defaultWidth: 150,
      renderCell: (record) =>
        record.table === "AUTH_EVENT" ? (
          <Badge
            variant={
              record.outcome.includes("fail")
                ? "destructive"
                : record.outcome.includes("success")
                  ? "success"
                  : "outline"
            }
          >
            {record.outcome}
          </Badge>
        ) : null,
    },
    detailsColumn,
  ],
} satisfies EventLogSource;

export const EVENT_LOG_SOURCES: readonly EventLogSource[] = [
  domainSource,
  actionSource,
  authSource,
];

const sourceByTable = {
  DOMAIN_EVENT: domainSource,
  ACTION_LOG: actionSource,
  AUTH_EVENT: authSource,
} satisfies Record<EventLogTable, EventLogSource>;

export function getEventLogSource(table: EventLogTable): EventLogSource {
  return sourceByTable[table];
}
