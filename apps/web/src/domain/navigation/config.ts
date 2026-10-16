import type { TileColor } from "~/shared/ui/tile-color";

export type RouteIcon =
  | "search"
  | "settings"
  | "team"
  | "inventory"
  | "leads"
  | "rate-simulator"
  | "home"
  | "audit"
  | "capacity"
  | "profile"
  | "schedule"
  | "monitoring"
  | "dashboards";

export type SidebarSection = "primary" | "secondary";

export interface SidebarChild {
  href: string;
  label: string;
  order: number;
}

export interface SidebarEntry {
  id: string;
  href: string;
  activePrefixes: string[];
  label: string;
  navLabel?: string;
  icon: RouteIcon;
  tileColor?: TileColor;
  section: SidebarSection;
  order: number;
  group?: string;
  children?: SidebarChild[];
}

export interface HeaderDescriptor {
  label: string;
  icon: RouteIcon;
  tileColor?: TileColor;
}

interface PageHeaderRule {
  match: string | RegExp;
  header: HeaderDescriptor;
}

// Put specific routes before broader matches.
export const PAGE_HEADERS = [
  {
    match: /^\/records\/[^/]+$/,
    header: { label: "Registros", icon: "leads", tileColor: "blue" },
  },
  {
    match: "/home",
    header: { label: "Inicio", icon: "home", tileColor: "blue" },
  },
  {
    match: "/schedule",
    header: { label: "Agenda", icon: "schedule", tileColor: "purple" },
  },
  {
    match: "/records",
    header: { label: "Registros", icon: "leads", tileColor: "blue" },
  },
  {
    match: "/inquiries",
    header: { label: "Consultas", icon: "search", tileColor: "yellow" },
  },
  {
    match: "/rate-simulator",
    header: {
      label: "Simulador de tasas",
      icon: "rate-simulator",
      tileColor: "green",
    },
  },
  {
    match: "/me/assignments",
    header: {
      label: "Mis contactos",
      icon: "leads",
      tileColor: "blue",
    },
  },
  {
    match: "/me/capacity",
    header: {
      label: "Mi capacidad",
      icon: "capacity",
      tileColor: "turquoise",
    },
  },
  {
    match: "/inventory",
    header: {
      label: "Inventario",
      icon: "inventory",
      tileColor: "orange",
    },
  },
  {
    match: "/fulfillment",
    header: {
      label: "Entregas",
      icon: "inventory",
      tileColor: "orange",
    },
  },
  {
    match: "/team/requests",
    header: {
      label: "Solicitudes",
      icon: "team",
      tileColor: "turquoise",
    },
  },
  {
    match: "/team",
    header: {
      label: "Capacidad del equipo",
      icon: "team",
      tileColor: "turquoise",
    },
  },
  {
    match: "/monitoring",
    header: {
      label: "Monitoreo",
      icon: "monitoring",
      tileColor: "yellow",
    },
  },
  {
    match: /^\/dashboards\/merchant-gpv(?:\/.*)?$/,
    header: {
      label: "GPV de comercios",
      icon: "dashboards",
    },
  },
  {
    match: "/settings/profile",
    header: {
      label: "Perfil",
      icon: "profile",
    },
  },
  {
    match: "/settings/capacity-policies",
    header: {
      label: "Políticas comerciales",
      icon: "settings",
    },
  },
  {
    match: "/settings/event-logs",
    header: {
      label: "Registro de eventos",
      icon: "settings",
    },
  },
] satisfies PageHeaderRule[];

export const SIDEBAR_ENTRIES = [
  {
    id: "home",
    href: "/home",
    activePrefixes: ["/home"],
    label: "Inicio",
    icon: "home",
    tileColor: "blue",
    section: "primary",
    order: 1,
  },
  {
    id: "schedule",
    href: "/schedule",
    activePrefixes: ["/schedule"],
    label: "Agenda",
    icon: "schedule",
    tileColor: "purple",
    section: "primary",
    order: 2,
  },
  {
    id: "records",
    href: "/records",
    activePrefixes: ["/records"],
    label: "Registros",
    icon: "leads",
    tileColor: "blue",
    section: "secondary",
    order: 1,
    group: "Comercial",
  },
  {
    id: "inquiries",
    href: "/inquiries",
    activePrefixes: ["/inquiries"],
    label: "Consultas",
    icon: "search",
    tileColor: "yellow",
    section: "secondary",
    order: 2,
    group: "Comercial",
  },
  {
    id: "rate-simulator",
    href: "/rate-simulator",
    activePrefixes: ["/rate-simulator"],
    label: "Simulador de tasas",
    icon: "rate-simulator",
    tileColor: "green",
    section: "secondary",
    order: 3,
    group: "Comercial",
  },
  {
    id: "my-assignments",
    href: "/me/assignments",
    activePrefixes: ["/me/assignments"],
    label: "Mis contactos",
    icon: "leads",
    tileColor: "blue",
    section: "secondary",
    order: 4,
    group: "Comercial",
  },
  {
    id: "my-capacity",
    href: "/me/capacity",
    activePrefixes: ["/me/capacity"],
    label: "Mi capacidad",
    icon: "capacity",
    tileColor: "turquoise",
    section: "secondary",
    order: 5,
    group: "Comercial",
  },
  {
    id: "inventory",
    href: "/inventory",
    activePrefixes: ["/inventory"],
    label: "Inventario",
    icon: "inventory",
    tileColor: "orange",
    section: "secondary",
    order: 6,
    group: "Operaciones",
  },
  {
    id: "team",
    href: "/team",
    activePrefixes: ["/team"],
    label: "Equipo",
    icon: "team",
    tileColor: "turquoise",
    section: "secondary",
    order: 7,
    group: "Operaciones",
    children: [
      { href: "/team", label: "Capacidad", order: 1 },
      { href: "/team/requests", label: "Solicitudes", order: 2 },
    ],
  },
  {
    id: "fulfillment",
    href: "/fulfillment",
    activePrefixes: ["/fulfillment"],
    label: "Entregas",
    icon: "inventory",
    tileColor: "orange",
    section: "secondary",
    order: 8,
    group: "Operaciones",
  },
  {
    id: "dashboards",
    href: "/dashboards/merchant-gpv",
    activePrefixes: ["/dashboards"],
    label: "GPV de comercios",
    icon: "dashboards",
    tileColor: "green",
    section: "secondary",
    order: 9,
    group: "Negocio",
  },
  {
    id: "monitoring",
    href: "/monitoring",
    activePrefixes: ["/monitoring"],
    label: "Monitoreo",
    icon: "monitoring",
    tileColor: "yellow",
    section: "secondary",
    order: 10,
    group: "Administración",
  },
] satisfies SidebarEntry[];
