import type {
  CloseReason,
  CollectionMode,
  FulfillmentStep,
  LeadPriority,
  LeadStage,
  LeadStatus,
  ProductKind,
  ProductScope,
  SettlementBank,
} from "~/contracts/workflow/vocabulary";
import type { UserId } from "~/domain/ids";

import {
  CAMILA,
  CLAUDIA,
  DIEGO,
  ELENA,
  FERNANDA,
  GABRIEL,
  ISABELLA,
  JOSE,
  JOSEFINA,
  LUCIA,
  MANUEL,
  MARIANA,
  MARINA,
  MATIAS,
  NICOLAS,
  PABLO,
  SOFIA,
} from "./demo-ids";

export const SUPERVISORS = { DIEGO, NICOLAS, MARIANA } as const;
export const BACK_OFFICE = { JOSEFINA, GABRIEL } as const;
export const EXECUTIVES = {
  CAMILA,
  MATIAS,
  LUCIA,
  SOFIA,
  FERNANDA,
  CLAUDIA,
  PABLO,
  ELENA,
  ISABELLA,
  MANUEL,
  MARINA,
  JOSE,
} as const;

// Company registry / organization identity for a lead. Fully synthetic; the
// same record feeds the organizations row, the SUNAT overlay, and any venue.
export interface OrgSpec {
  ruc: string;
  legalName: string;
  address: string;
  district: string;
  province: string;
  department: string;
  activity: { code: string; label: string };
  lineOfBusiness: string;
  registryAgeDays: number;
}

// A back-office availability call that moves a lead out of QUALIFYING. toStage
// is PRICING for a normal review, DISQUALIFIED when the lead is rejected.
export interface ReviewSpec {
  by: UserId;
  reason: string;
  status: LeadStatus;
  priority: LeadPriority;
  toStage: Extract<LeadStage, "PRICING" | "DISQUALIFIED">;
  offsetDays: number;
}

export interface RateProposalSpec {
  round: number;
  paybackPricing: number;
  debitRate: number;
  creditRate: number;
  foreignRate: number;
  fee: number;
  currency: "PEN" | "USD";
  proposedBy: UserId;
  proposedOffsetDays: number;
  outcome: "pending" | "accepted" | "revision_requested";
  decidedOffsetDays?: number;
  acceptedBy?: UserId;
}

export interface VenueAccountSpec {
  currency: "PEN" | "USD";
  bank: SettlementBank;
  accountType: "AHORROS" | "CORRIENTE";
  accountNumber: string;
  cci: string | null;
  isSettlement: boolean;
}

export interface VenueSpec {
  tradeName: string;
  posQuantity: number;
  address: string;
  addressReference: string;
  createdOffsetDays: number;
  createdBy: UserId;
  accounts: VenueAccountSpec[];
  // Only set for a per_venue digital policy: the venue carries its own
  // link/online config instead of the lead-level one.
  linkUrl?: string | null;
  onlineUrl?: string | null;
  onlineCollectionMode?: CollectionMode | null;
}

export interface DigitalPolicySpec {
  linkScope: ProductScope;
  linkUrl: string | null;
  onlineScope: ProductScope;
  onlineUrl: string | null;
  onlineCollectionMode: CollectionMode | null;
  updatedOffsetDays: number;
  updatedBy: UserId;
}

export interface LegalRepSpec {
  dni: string;
  names: string;
  firstSurname: string;
  secondSurname: string;
  email: string;
  phone: string;
  offsetDays: number;
}

export interface LeadCurrent {
  provider: string;
  debitRate: number;
  creditRate: number;
  gpv: number;
  ticket: number;
  settlementBank: SettlementBank;
  posCount: number;
}

// A stage_changed step past PRICING. `from` is the previous stage in the list.
export interface AdvanceSpec {
  to: Extract<LeadStage, "SETUP" | "FULFILLMENT" | "LIVE">;
  offsetDays: number;
}

// Only valid on a lead whose stage is FULFILLMENT or LIVE -- that stage is
// reached exactly when addVenueAccountsCommand creates the order, so `venue`
// is a hard precondition regardless of the eventual productKind. LIVE requires
// targetStep "COMPLETED": that's the only step reaching it flips the lead to
// LIVE (completeFulfillment), so no other value is a reachable LIVE state.
export interface FulfillmentSpec {
  // null only valid when targetStep is "CHOOSE_PRODUCT" (units and product are
  // chosen together, never one without the other).
  productKind: ProductKind | null;
  targetStep: FulfillmentStep;
  // When CHOOSE_PRODUCT completed, for history/timeline ordering. Omit when
  // targetStep is itself "CHOOSE_PRODUCT" (product not chosen yet).
  chosenOffsetDays?: number;
  // Explicit per-unit serial overrides, keyed by unit index. Used to line a
  // unit's serial up with (or deliberately away from) a merchant-stats device
  // serial for the same RUC. Elsewhere a serial is synthesized.
  unitSerials?: Array<string | null>;
}

export interface LeadSpec {
  key: string;
  org: OrgSpec;
  executiveId: UserId;
  createdBy: UserId;
  updatedBy: UserId | null;
  stage: LeadStage;
  status: LeadStatus | null;
  priority: LeadPriority | null;
  createdOffsetDays: number;
  reservationOffsetDays?: number;
  current: LeadCurrent;
  review?: ReviewSpec;
  proposals?: RateProposalSpec[];
  advances?: AdvanceSpec[];
  venue?: VenueSpec;
  fulfillment?: FulfillmentSpec;
  digitalPolicy?: DigitalPolicySpec;
  legalRep?: LegalRepSpec;
  close?: {
    reason: CloseReason;
    note: string | null;
    by: UserId;
    offsetDays: number;
  };
  expiredOffsetDays?: number;
}

const ACTIVITY = {
  wholesale: { code: "4690", label: "VENTA AL POR MAYOR NO ESPECIALIZADA" },
  retail: {
    code: "4711",
    label: "VENTA AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS",
  },
  restaurant: {
    code: "5610",
    label: "ACTIVIDADES DE RESTAURANTES Y DE SERVICIO DE COMIDAS",
  },
  construction: { code: "4100", label: "CONSTRUCCION DE EDIFICIOS" },
  transport: { code: "4923", label: "TRANSPORTE DE CARGA POR CARRETERA" },
  textiles: { code: "4641", label: "VENTA AL POR MAYOR DE PRODUCTOS TEXTILES" },
  pharmacy: {
    code: "4772",
    label: "VENTA AL POR MENOR DE PRODUCTOS FARMACEUTICOS",
  },
  storage: { code: "5210", label: "ALMACENAMIENTO Y DEPOSITO" },
} as const;

// Shared with merchant-stats/generator.ts so a Culqi-reported device serial
// can deterministically match (or deliberately mismatch) a real fulfillment
// unit's serial -- otherwise the GPV attribution ladder's "exact" confidence
// and the "serial_mismatch" quality check have no seeded row that can ever
// reach them. Picking explicit shared literals (rather than reading back
// whatever the merchant generator's RNG happens to produce) keeps the two
// seed stages independent of each other's iteration order.
export const MERCHANT_STATS_SERIAL_LINKS = {
  ANDES: "P3C3250000001001",
  AURORA: "P3C3250000002001",
  // Boreal Norte is the deliberate mismatch: fulfillment recorded one serial,
  // Culqi's export reports a different one for the same device.
  BOREAL_NORTE_FULFILLED: "P3C3250000003001",
  BOREAL_NORTE_CULQI: "P3C3250000003999",
} as const;

// One lead per (stage, status, priority) coverage point, several leads per
// stage, so a fresh seed populates the whole pipeline board and every record
// state a dev would otherwise walk a RUC through by hand. Commercial and venue
// detail is attached to representative leads; the rest carry a valid but light
// footprint (lead + assignment + registration/review events).
export const LEAD_SPECS: LeadSpec[] = [
  // ── QUALIFYING (pre-review; status/priority null) ──────────────────────────
  {
    key: "qualifying-andina",
    org: {
      ruc: "20103615080",
      legalName: "SERVICIOS GENERALES ANDINA SAC",
      address: "CAL. LOS NEGOCIOS NRO. 431 URB. RESIDENCIAL SAN ISIDRO",
      district: "SAN ISIDRO",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Distribucion de suministros de oficina",
      registryAgeDays: 1,
    },
    executiveId: EXECUTIVES.CAMILA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: null,
    stage: "QUALIFYING",
    status: null,
    priority: null,
    createdOffsetDays: 1,
    current: current("BCP", 2.5, 2.9, 45_000, 120, "BCP", 2),
  },
  {
    key: "qualifying-vista",
    org: {
      ruc: "20512345678",
      legalName: "COMERCIAL VISTA ALEGRE EIRL",
      address: "AV. LOS FRUTALES NRO. 210",
      district: "ATE",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Minimarket de abarrotes",
      registryAgeDays: 2,
    },
    executiveId: EXECUTIVES.MANUEL,
    createdBy: SUPERVISORS.MARIANA,
    updatedBy: null,
    stage: "QUALIFYING",
    status: null,
    priority: null,
    createdOffsetDays: 2,
    current: current("INTERBANK", 2.6, 2.95, 22_000, 60, "INTERBANK", 1),
  },
  {
    key: "qualifying-costanera",
    org: {
      ruc: "20487654321",
      legalName: "INVERSIONES COSTANERA SRL",
      address: "MZA. F LOTE 12 URB. LA CAMPIÑA",
      district: "CHORRILLOS",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.restaurant,
      lineOfBusiness: "Restaurante marino",
      registryAgeDays: 3,
    },
    executiveId: EXECUTIVES.SOFIA,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: null,
    stage: "QUALIFYING",
    status: null,
    priority: null,
    createdOffsetDays: 3,
    current: current("BBVA", 2.7, 3.0, 38_000, 95, "BBVA", 2),
  },

  // ── DISQUALIFIED (back office rejected at review) ───────────────────────────
  {
    key: "disqualified-carterizado",
    org: {
      ruc: "20353745400",
      legalName: "TRANSPORTES LIMA NORTE EIRL",
      address: "AV. TUPAC AMARU KM. 14.5",
      district: "COMAS",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.transport,
      lineOfBusiness: "Transporte de carga por carretera",
      registryAgeDays: 3,
    },
    executiveId: EXECUTIVES.PABLO,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: BACK_OFFICE.GABRIEL,
    stage: "DISQUALIFIED",
    status: "CARTERIZADO",
    priority: "SIN RESULTADO",
    createdOffsetDays: 6,
    current: current("NACION", 2.4, 2.85, 30_000, 90, "NACION", 1),
    review: {
      by: BACK_OFFICE.GABRIEL,
      reason: "RUC ya carterizado por otro dealer en la consulta de Culqi",
      status: "CARTERIZADO",
      priority: "SIN RESULTADO",
      toStage: "DISQUALIFIED",
      offsetDays: 5,
    },
  },
  {
    key: "disqualified-sinresultado",
    org: {
      ruc: "20477889900",
      legalName: "SERVICIOS INTEGRALES DEL SUR SAC",
      address: "AV. DANIEL A. CARRION NRO. 850",
      district: "AREQUIPA",
      province: "AREQUIPA",
      department: "AREQUIPA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Distribucion de bebidas",
      registryAgeDays: 4,
    },
    executiveId: EXECUTIVES.MANUEL,
    createdBy: SUPERVISORS.MARIANA,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "DISQUALIFIED",
    status: "SIN RESULTADO",
    priority: "SIN RESULTADO",
    createdOffsetDays: 8,
    current: current("SCOTIABANK", 2.55, 2.9, 18_000, 70, "SCOTIABANK", 1),
    review: {
      by: BACK_OFFICE.JOSEFINA,
      reason: "Sin resultado: el comercio no califica para el producto",
      status: "SIN RESULTADO",
      priority: "SIN RESULTADO",
      toStage: "DISQUALIFIED",
      offsetDays: 6,
    },
  },

  // ── PRICING (available, being quoted) ───────────────────────────────────────
  {
    key: "pricing-p1-norte",
    org: {
      ruc: "20538856674",
      legalName: "DISTRIBUIDORA NORTE PERU SAC",
      address: "CAL. JOSE DE LA RIVA AGUERO NRO. 1023",
      district: "LOS OLIVOS",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Venta al por mayor no especializada",
      registryAgeDays: 7,
    },
    executiveId: EXECUTIVES.LUCIA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "PRICING",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 7,
    current: current("SCOTIABANK", 2.7, 3.05, 95_000, 210, "INTERBANK", 5),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P1",
      "DISPONIBLE",
      "Alto volumen, excelente candidato",
      6,
    ),
    proposals: [
      proposal(1, 0.9, 2.3, "pending", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 4,
      }),
    ],
  },
  {
    key: "pricing-p2-pacifico",
    org: {
      ruc: "20542245671",
      legalName: "INVERSIONES PACIFICO SRL",
      address: "AV. EL SOL NRO. 123 PISO 3",
      district: "CUSCO",
      province: "CUSCO",
      department: "CUSCO",
      activity: ACTIVITY.textiles,
      lineOfBusiness: "Venta al por mayor de productos textiles",
      registryAgeDays: 14,
    },
    executiveId: EXECUTIVES.MATIAS,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "PRICING",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 12,
    current: current("BBVA", 2.6, 3.0, 60_000, 150, "BBVA", 3),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible según la consulta de cartera de Culqi",
      9,
    ),
    proposals: [
      proposal(1, 0.95, 2.4, "pending", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 6,
      }),
    ],
  },
  {
    key: "pricing-stock-mercado",
    org: {
      ruc: "20601234567",
      legalName: "MERCADO CENTRAL EXPRESS SAC",
      address: "JR. AYACUCHO NRO. 456",
      district: "HUANCAYO",
      province: "HUANCAYO",
      department: "JUNIN",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Comercio minorista de abarrotes",
      registryAgeDays: 10,
    },
    executiveId: EXECUTIVES.SOFIA,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: BACK_OFFICE.GABRIEL,
    stage: "PRICING",
    status: "STOCK",
    priority: "P2",
    createdOffsetDays: 11,
    current: current("INTERBANK", 2.65, 2.95, 52_000, 130, "BCP", 2),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P2",
      "STOCK",
      "Cliente con POS en stock, listo para reactivar",
      8,
    ),
    proposals: [
      proposal(1, 0.92, 2.35, "pending", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 5,
      }),
    ],
  },
  {
    key: "pricing-reserved-altura",
    org: {
      ruc: "20609876543",
      legalName: "COMERCIALIZADORA ALTURA SRL",
      address: "AV. LOS INCAS NRO. 1200",
      district: "SAN BORJA",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Distribucion de equipos electronicos",
      registryAgeDays: 9,
    },
    executiveId: EXECUTIVES.ELENA,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: BACK_OFFICE.GABRIEL,
    stage: "PRICING",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 14,
    reservationOffsetDays: 4,
    current: current("INTERBANK", 2.55, 2.95, 70_000, 180, "BCP", 3),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P1",
      "DISPONIBLE",
      "Disponible, listo para proponer tarifa competitiva",
      12,
    ),
    proposals: [
      proposal(1, 1.0, 2.5, "revision_requested", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 9,
        decidedOffsetDays: 8,
      }),
      proposal(2, 0.88, 2.25, "pending", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 6,
      }),
    ],
  },

  // ── SETUP (rate accepted, registering venues) ───────────────────────────────
  {
    key: "setup-p1-logistica",
    org: {
      ruc: "20394809218",
      legalName: "LOGISTICA CENTRAL SA",
      address: "AV. NICOLAS ARRIOLA NRO. 2815",
      district: "LA VICTORIA",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.storage,
      lineOfBusiness: "Almacenamiento y deposito",
      registryAgeDays: 21,
    },
    executiveId: EXECUTIVES.FERNANDA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "SETUP",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 21,
    current: current("BBVA", 2.75, 3.1, 120_000, 260, "SCOTIABANK", 6),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P1",
      "DISPONIBLE",
      "Gran volumen, prioridad alta",
      19,
    ),
    proposals: [
      proposal(1, 0.85, 2.2, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 18,
        decidedOffsetDays: 16,
        acceptedBy: EXECUTIVES.FERNANDA,
      }),
    ],
    advances: [{ to: "SETUP", offsetDays: 16 }],
  },
  {
    key: "setup-p2-boreal",
    org: {
      ruc: "20566778899",
      legalName: "IMPORTACIONES BOREAL EIRL",
      address: "CAL. MORELLI NRO. 181",
      district: "SAN BORJA",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Importacion de accesorios",
      registryAgeDays: 18,
    },
    executiveId: EXECUTIVES.ISABELLA,
    createdBy: SUPERVISORS.MARIANA,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "SETUP",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 19,
    current: current("BCP", 2.7, 3.0, 68_000, 165, "BCP", 3),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, buen potencial digital",
      17,
    ),
    proposals: [
      proposal(1, 0.9, 2.35, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 15,
        decidedOffsetDays: 13,
        acceptedBy: EXECUTIVES.ISABELLA,
      }),
    ],
    advances: [{ to: "SETUP", offsetDays: 13 }],
    digitalPolicy: {
      linkScope: "shared",
      linkUrl: "https://pay.culqi.com/boreal",
      onlineScope: "none",
      onlineUrl: null,
      onlineCollectionMode: null,
      updatedOffsetDays: 12,
      updatedBy: EXECUTIVES.ISABELLA,
    },
  },

  // ── FULFILLMENT (won, provisioning POS) ─────────────────────────────────────
  {
    key: "fulfillment-p1-sierra",
    org: {
      ruc: "20455667788",
      legalName: "DISTRIBUIDORA SIERRA VERDE SAC",
      address: "AV. MARISCAL CASTILLA NRO. 3200",
      district: "EL TAMBO",
      province: "HUANCAYO",
      department: "JUNIN",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Distribucion de productos de consumo",
      registryAgeDays: 26,
    },
    executiveId: EXECUTIVES.CLAUDIA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: EXECUTIVES.CLAUDIA,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 28,
    current: current("BBVA", 2.8, 3.1, 105_000, 240, "INTERBANK", 4),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P1",
      "DISPONIBLE",
      "Comercio consolidado, alta prioridad",
      26,
    ),
    proposals: [
      proposal(1, 0.9, 2.4, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 24,
        decidedOffsetDays: 22,
        acceptedBy: EXECUTIVES.CLAUDIA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 22 },
      { to: "FULFILLMENT", offsetDays: 14 },
    ],
    venue: {
      tradeName: "Sierra Verde El Tambo",
      posQuantity: 3,
      address: "AV. MARISCAL CASTILLA NRO. 3200",
      addressReference: "Frente al mercado modelo",
      createdOffsetDays: 16,
      createdBy: EXECUTIVES.CLAUDIA,
      accounts: [
        {
          currency: "PEN",
          bank: "BCP",
          accountType: "CORRIENTE",
          accountNumber: "194-98765432-0-11",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Refurbished branch, mid-sequence: transactions report and addendum are
    // already uploaded, signature is the executive's pending turn.
    fulfillment: fulfillmentSpec("pos_refurbished", "AWAITING_SIGNATURE", {
      chosenOffsetDays: 12,
    }),
  },
  {
    key: "fulfillment-p1-litoral",
    org: {
      ruc: "20611223344",
      legalName: "COMERCIAL LITORAL PACIFICO SRL",
      address: "AV. BOLOGNESI NRO. 745",
      district: "CHICLAYO",
      province: "CHICLAYO",
      department: "LAMBAYEQUE",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Comercio minorista",
      registryAgeDays: 24,
    },
    executiveId: EXECUTIVES.JOSE,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: EXECUTIVES.JOSE,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 25,
    current: current("SCOTIABANK", 2.72, 3.05, 88_000, 200, "SCOTIABANK", 3),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P1",
      "DISPONIBLE",
      "Disponible en zona norte, buen ticket",
      23,
    ),
    proposals: [
      proposal(1, 0.88, 2.3, "accepted", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 21,
        decidedOffsetDays: 19,
        acceptedBy: EXECUTIVES.JOSE,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 19 },
      { to: "FULFILLMENT", offsetDays: 11 },
    ],
    venue: {
      tradeName: "Litoral Pacifico Chiclayo",
      posQuantity: 1,
      address: "AV. BOLOGNESI NRO. 745",
      addressReference: "Local esquinero, dos cuadras de la plaza",
      createdOffsetDays: 10,
      createdBy: EXECUTIVES.JOSE,
      accounts: [
        {
          currency: "PEN",
          bank: "SCOTIABANK",
          accountType: "CORRIENTE",
          accountNumber: "000-1234567-8",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Digital-only: no hardware unit, only the shared CHOOSE_PRODUCT ->
    // AWAITING_SALE_REGISTRATION -> COMPLETED tail, so it costs zero document
    // rows -- paired here with the onlineScope/onlineCollectionMode coverage.
    fulfillment: fulfillmentSpec("digital_only", "AWAITING_SALE_REGISTRATION", {
      chosenOffsetDays: 9,
    }),
    digitalPolicy: {
      linkScope: "none",
      linkUrl: null,
      onlineScope: "shared",
      onlineUrl: "https://pay.culqi.com/litoral",
      onlineCollectionMode: "ONE_CLIC",
      updatedOffsetDays: 8,
      updatedBy: EXECUTIVES.JOSE,
    },
  },

  // ── LIVE (won, transacting) ─────────────────────────────────────────────────
  {
    key: "live-andes",
    org: {
      ruc: "20219523468",
      legalName: "CONSTRUCTORA ANDES SA",
      address: "AV. BENAVIDES NRO. 1855",
      district: "MIRAFLORES",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.construction,
      lineOfBusiness: "Construccion de edificios residenciales",
      registryAgeDays: 30,
    },
    executiveId: EXECUTIVES.CLAUDIA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: EXECUTIVES.CLAUDIA,
    stage: "LIVE",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 30,
    current: current("BBVA", 2.8, 3.1, 85_000, 245.5, "INTERBANK", 4),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P1",
      "DISPONIBLE",
      "Empresa constructora consolidada con gran volumen potencial",
      29,
    ),
    proposals: [
      proposal(1, 0.95, 2.5, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 27,
        decidedOffsetDays: 25,
        acceptedBy: EXECUTIVES.CLAUDIA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 25 },
      { to: "FULFILLMENT", offsetDays: 22 },
      { to: "LIVE", offsetDays: 20 },
    ],
    venue: {
      tradeName: "Andes Miraflores",
      posQuantity: 3,
      address: "AV. BENAVIDES NRO. 1855",
      addressReference: "Frente al parque central",
      createdOffsetDays: 24,
      createdBy: EXECUTIVES.CLAUDIA,
      accounts: [
        {
          currency: "PEN",
          bank: "BCP",
          accountType: "CORRIENTE",
          accountNumber: "194-12345678-0-21",
          cci: null,
          isSettlement: true,
        },
        {
          currency: "USD",
          bank: "BBVA",
          accountType: "AHORROS",
          accountNumber: "0011-0245-9988776655",
          cci: "01124500998877665522",
          isSettlement: false,
        },
      ],
    },
    // COMPLETED: the primary merchant-stats "exact" match candidate. Only the
    // first unit's serial is pinned -- the rest auto-generate, still COMPLETED.
    fulfillment: fulfillmentSpec("pos_refurbished", "COMPLETED", {
      chosenOffsetDays: 21,
      unitSerials: [MERCHANT_STATS_SERIAL_LINKS.ANDES],
    }),
    digitalPolicy: {
      linkScope: "none",
      linkUrl: null,
      onlineScope: "none",
      onlineUrl: null,
      onlineCollectionMode: null,
      updatedOffsetDays: 28,
      updatedBy: EXECUTIVES.CLAUDIA,
    },
    legalRep: {
      dni: "42715983",
      names: "Daniel",
      firstSurname: "Gutierrez",
      secondSurname: "Paredes",
      email: "daniel.gutierrez@andes.pe",
      phone: "987654321",
      offsetDays: 29,
    },
  },
  {
    key: "live-aurora",
    org: {
      ruc: "20500112233",
      legalName: "SUPERMERCADOS AURORA SAC",
      address: "AV. UNIVERSITARIA NRO. 1801",
      district: "SAN MIGUEL",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Cadena de supermercados",
      registryAgeDays: 34,
    },
    executiveId: EXECUTIVES.MARINA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: EXECUTIVES.MARINA,
    stage: "LIVE",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 34,
    current: current("BCP", 2.78, 3.08, 140_000, 300, "BCP", 5),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P1",
      "DISPONIBLE",
      "Cadena consolidada, altísimo volumen",
      33,
    ),
    proposals: [
      proposal(1, 0.82, 2.15, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 31,
        decidedOffsetDays: 29,
        acceptedBy: EXECUTIVES.MARINA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 29 },
      { to: "FULFILLMENT", offsetDays: 24 },
      { to: "LIVE", offsetDays: 18 },
    ],
    venue: {
      tradeName: "Aurora San Miguel",
      posQuantity: 5,
      address: "AV. UNIVERSITARIA NRO. 1801",
      addressReference: "Interior del centro comercial",
      createdOffsetDays: 26,
      createdBy: EXECUTIVES.MARINA,
      accounts: [
        {
          currency: "PEN",
          bank: "BCP",
          accountType: "CORRIENTE",
          accountNumber: "191-55667788-0-30",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // COMPLETED: secondary merchant-stats "exact" match candidate, pos_new
    // branch (payment link/proof/validation all resolved, not just serials).
    fulfillment: fulfillmentSpec("pos_new", "COMPLETED", {
      chosenOffsetDays: 23,
      unitSerials: [MERCHANT_STATS_SERIAL_LINKS.AURORA],
    }),
    legalRep: {
      dni: "45298761",
      names: "Rosa",
      firstSurname: "Delgado",
      secondSurname: "Vidal",
      email: "rosa.delgado@aurorasm.pe",
      phone: "956231478",
      offsetDays: 33,
    },
  },
  {
    key: "live-boreal-norte",
    org: {
      ruc: "20588990011",
      legalName: "COMERCIAL BOREAL NORTE EIRL",
      address: "AV. GRAU NRO. 990",
      district: "PIURA",
      province: "PIURA",
      department: "PIURA",
      activity: ACTIVITY.pharmacy,
      lineOfBusiness: "Cadena de boticas",
      registryAgeDays: 40,
    },
    executiveId: EXECUTIVES.ELENA,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: EXECUTIVES.ELENA,
    stage: "LIVE",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 40,
    current: current("INTERBANK", 2.76, 3.02, 96_000, 175, "INTERBANK", 4),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P1",
      "DISPONIBLE",
      "Cadena de boticas en el norte, buen volumen",
      39,
    ),
    proposals: [
      proposal(1, 0.9, 2.4, "accepted", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 37,
        decidedOffsetDays: 35,
        acceptedBy: EXECUTIVES.ELENA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 35 },
      { to: "FULFILLMENT", offsetDays: 20 },
      { to: "LIVE", offsetDays: 16 },
    ],
    venue: {
      tradeName: "Boreal Norte Piura",
      posQuantity: 2,
      address: "AV. GRAU NRO. 990",
      addressReference: "Al costado del hospital regional",
      createdOffsetDays: 22,
      createdBy: EXECUTIVES.ELENA,
      accounts: [
        {
          currency: "PEN",
          bank: "INTERBANK",
          accountType: "CORRIENTE",
          accountNumber: "898-3001122334",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // COMPLETED: the deliberate serial-mismatch candidate -- fulfillment's
    // recorded serial deliberately differs from what Culqi's export reports
    // for the same device (merchant-stats/persist.ts sets the Culqi side).
    fulfillment: fulfillmentSpec("pos_refurbished", "COMPLETED", {
      chosenOffsetDays: 19,
      unitSerials: [MERCHANT_STATS_SERIAL_LINKS.BOREAL_NORTE_FULFILLED],
    }),
    legalRep: {
      dni: "41876523",
      names: "Manuel",
      firstSurname: "Chavez",
      secondSurname: "Reyes",
      email: "manuel.chavez@borealnorte.pe",
      phone: "978123456",
      offsetDays: 39,
    },
  },

  // ── EXPIRED (reservation lapsed) ────────────────────────────────────────────
  {
    key: "expired-comercial-andina",
    org: {
      ruc: "20103176060",
      legalName: "COMERCIAL ANDINA EIRL",
      address: "AV. INDUSTRIAL NRO. 620 URB. PERU",
      district: "LIMA",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Venta al por mayor de combustibles",
      registryAgeDays: 22,
    },
    executiveId: EXECUTIVES.MATIAS,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "EXPIRED",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 22,
    current: current("BBVA", 2.6, 3.0, 40_000, 110, "BBVA", 2),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, reserva otorgada al ejecutivo",
      20,
    ),
    proposals: [
      proposal(1, 0.95, 2.45, "pending", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 16,
      }),
    ],
    expiredOffsetDays: 3,
  },
  {
    key: "expired-costa-azul",
    org: {
      ruc: "20522334455",
      legalName: "INVERSIONES COSTA AZUL SRL",
      address: "AV. SANTA ROSA NRO. 412",
      district: "TRUJILLO",
      province: "TRUJILLO",
      department: "LA LIBERTAD",
      activity: ACTIVITY.restaurant,
      lineOfBusiness: "Restaurante turistico",
      registryAgeDays: 19,
    },
    executiveId: EXECUTIVES.SOFIA,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: BACK_OFFICE.GABRIEL,
    stage: "EXPIRED",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 19,
    current: current("SCOTIABANK", 2.65, 2.98, 33_000, 85, "SCOTIABANK", 1),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P2",
      "DISPONIBLE",
      "Disponible con reserva, seguimiento pendiente",
      17,
    ),
    expiredOffsetDays: 2,
  },

  // ── CLOSED_LOST (executive closed the quotation) ────────────────────────────
  {
    key: "closed-lost-rate",
    org: {
      ruc: "20499001122",
      legalName: "DISTRIBUIDORA HORIZONTE SAC",
      address: "AV. VENEZUELA NRO. 2450",
      district: "BREÑA",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Distribucion de productos de limpieza",
      registryAgeDays: 15,
    },
    executiveId: EXECUTIVES.LUCIA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: EXECUTIVES.LUCIA,
    stage: "CLOSED_LOST",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 17,
    current: current("BCP", 2.7, 3.05, 55_000, 140, "BCP", 2),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, negociación de tarifa",
      15,
    ),
    proposals: [
      proposal(1, 1.0, 2.6, "revision_requested", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 12,
        decidedOffsetDays: 10,
      }),
      proposal(2, 0.95, 2.45, "revision_requested", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 8,
        decidedOffsetDays: 6,
      }),
    ],
    close: {
      reason: "RATE",
      note: "El cliente pedía una tarifa por debajo del piso",
      by: EXECUTIVES.LUCIA,
      offsetDays: 4,
    },
  },
  {
    key: "closed-lost-other-channel",
    org: {
      ruc: "20455112299",
      legalName: "COMERCIAL DEL VALLE EIRL",
      address: "AV. LOS PROCERES NRO. 560",
      district: "SAN JUAN DE LURIGANCHO",
      province: "LIMA",
      department: "LIMA",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Comercio minorista de electrodomesticos",
      registryAgeDays: 13,
    },
    executiveId: EXECUTIVES.PABLO,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: EXECUTIVES.PABLO,
    stage: "CLOSED_LOST",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 13,
    current: current("BBVA", 2.68, 3.0, 47_000, 125, "BBVA", 2),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P2",
      "DISPONIBLE",
      "Disponible, en evaluación comercial",
      11,
    ),
    proposals: [
      proposal(1, 0.95, 2.45, "revision_requested", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 8,
        decidedOffsetDays: 6,
      }),
    ],
    close: {
      reason: "OTHER_CHANNEL_QUOTE",
      note: "El cliente cerró con otro canal de Culqi",
      by: EXECUTIVES.PABLO,
      offsetDays: 3,
    },
  },

  // ── FULFILLMENT (additional coverage) ───────────────────────────────────────
  // One lead per remaining FulfillmentStep not already covered above (sierra:
  // AWAITING_SIGNATURE, litoral: AWAITING_SALE_REGISTRATION, the three LIVE
  // leads: COMPLETED), so a fresh seed exercises every step of both hardware
  // branches without anyone hand-walking a lead through fulfillment. Appended
  // here rather than interleaved so merchant-stats' by-position org linking
  // (linkableOrganizations) does not shift any earlier lead's generated index.
  {
    key: "fulfillment-choose-vertice",
    org: {
      ruc: "20544001122",
      legalName: "VERTICE INDUSTRIAL SAC",
      address: "AV. ARGENTINA NRO. 2100",
      district: "CALLAO",
      province: "CALLAO",
      department: "CALLAO",
      activity: ACTIVITY.storage,
      lineOfBusiness: "Almacenamiento de carga industrial",
      registryAgeDays: 20,
    },
    executiveId: EXECUTIVES.MATIAS,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 20,
    current: current("BBVA", 2.7, 3.0, 60_000, 150, "BBVA", 2),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, buen volumen de almacenaje",
      18,
    ),
    proposals: [
      // The one deliberately USD proposal in the seed, so the USD path is
      // exercised by a proposal as well as by venue accounts.
      proposal(1, 0.9, 2.35, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 15,
        decidedOffsetDays: 13,
        acceptedBy: EXECUTIVES.MATIAS,
        currency: "USD",
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 11 },
      { to: "FULFILLMENT", offsetDays: 5 },
    ],
    venue: {
      tradeName: "Vertice Callao",
      posQuantity: 1,
      address: "AV. ARGENTINA NRO. 2100",
      addressReference: "Frente al terminal de carga",
      createdOffsetDays: 7,
      createdBy: EXECUTIVES.MATIAS,
      accounts: [
        {
          currency: "PEN",
          bank: "BBVA",
          accountType: "CORRIENTE",
          accountNumber: "011-2233445-0-40",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Product not chosen yet: zero units, the order sits alone on the very
    // first step.
    fulfillment: fulfillmentSpec(null, "CHOOSE_PRODUCT"),
  },
  {
    key: "fulfillment-transactions-report-cobre",
    org: {
      ruc: "20566112233",
      legalName: "COMERCIALIZADORA COBRE ANDINO SRL",
      address: "AV. LEGUIA NRO. 455",
      district: "AREQUIPA",
      province: "AREQUIPA",
      department: "AREQUIPA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Venta al por mayor de insumos mineros",
      registryAgeDays: 18,
    },
    executiveId: EXECUTIVES.SOFIA,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: BACK_OFFICE.GABRIEL,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 18,
    current: current("SCOTIABANK", 2.75, 3.05, 90_000, 210, "SCOTIABANK", 3),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P1",
      "DISPONIBLE",
      "Alto volumen, prioridad alta",
      16,
    ),
    proposals: [
      proposal(1, 0.88, 2.3, "accepted", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 13,
        decidedOffsetDays: 11,
        acceptedBy: EXECUTIVES.SOFIA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 9 },
      { to: "FULFILLMENT", offsetDays: 4 },
    ],
    venue: {
      tradeName: "Cobre Andino Arequipa",
      posQuantity: 1,
      address: "AV. LEGUIA NRO. 455",
      addressReference: "Local dentro del parque industrial",
      createdOffsetDays: 6,
      createdBy: EXECUTIVES.SOFIA,
      accounts: [
        {
          currency: "PEN",
          bank: "SCOTIABANK",
          accountType: "CORRIENTE",
          accountNumber: "000-9988776-5",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Refurbished branch, first step: nothing uploaded yet.
    fulfillment: fulfillmentSpec(
      "pos_refurbished",
      "AWAITING_TRANSACTIONS_REPORT",
      { chosenOffsetDays: 3 },
    ),
  },
  {
    key: "fulfillment-addendum-rioverde",
    org: {
      ruc: "20522887766",
      legalName: "AGROINDUSTRIAS RIO VERDE EIRL",
      address: "CAR. PANAMERICANA SUR KM 295",
      district: "ICA",
      province: "ICA",
      department: "ICA",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Procesamiento y venta de productos agricolas",
      registryAgeDays: 17,
    },
    executiveId: EXECUTIVES.MANUEL,
    createdBy: SUPERVISORS.MARIANA,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 17,
    current: current("INTERBANK", 2.65, 2.98, 58_000, 135, "INTERBANK", 2),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, buena temporada agricola",
      15,
    ),
    proposals: [
      proposal(1, 0.93, 2.4, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 12,
        decidedOffsetDays: 10,
        acceptedBy: EXECUTIVES.MANUEL,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 8 },
      { to: "FULFILLMENT", offsetDays: 4 },
    ],
    venue: {
      tradeName: "Rio Verde Ica",
      posQuantity: 1,
      address: "CAR. PANAMERICANA SUR KM 295",
      addressReference: "Ingreso al fundo",
      createdOffsetDays: 6,
      createdBy: EXECUTIVES.MANUEL,
      accounts: [
        {
          currency: "PEN",
          bank: "INTERBANK",
          accountType: "CORRIENTE",
          accountNumber: "898-1122334-1",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Transactions report already uploaded; addendum generation is back
    // office's pending turn.
    fulfillment: fulfillmentSpec("pos_refurbished", "AWAITING_ADDENDUM", {
      chosenOffsetDays: 3,
    }),
  },
  {
    key: "fulfillment-pdf-compile-nortex",
    org: {
      ruc: "20599334455",
      legalName: "TEXTILES NORTEX SAC",
      address: "AV. GRAU NRO. 1440",
      district: "TRUJILLO",
      province: "TRUJILLO",
      department: "LA LIBERTAD",
      activity: ACTIVITY.textiles,
      lineOfBusiness: "Fabricacion y venta de textiles",
      registryAgeDays: 22,
    },
    executiveId: EXECUTIVES.LUCIA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 22,
    current: current("BCP", 2.72, 3.02, 102_000, 230, "BCP", 4),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P1",
      "DISPONIBLE",
      "Fabrica consolidada, alta prioridad",
      20,
    ),
    proposals: [
      proposal(1, 0.87, 2.28, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 17,
        decidedOffsetDays: 15,
        acceptedBy: EXECUTIVES.LUCIA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 13 },
      { to: "FULFILLMENT", offsetDays: 9 },
    ],
    venue: {
      tradeName: "Nortex Trujillo",
      posQuantity: 1,
      address: "AV. GRAU NRO. 1440",
      addressReference: "Planta textil, ingreso administrativo",
      createdOffsetDays: 11,
      createdBy: EXECUTIVES.LUCIA,
      accounts: [
        {
          currency: "PEN",
          bank: "BCP",
          accountType: "CORRIENTE",
          accountNumber: "194-5566778-0-15",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Signature already submitted; PDF compilation is back office's pending
    // turn (transactions report and addendum are done too).
    fulfillment: fulfillmentSpec("pos_refurbished", "AWAITING_PDF_COMPILE", {
      chosenOffsetDays: 8,
    }),
  },
  {
    key: "fulfillment-serials-altiplano",
    org: {
      ruc: "20533667788",
      legalName: "FERRETERIA ALTIPLANO SRL",
      address: "JR. TACNA NRO. 380",
      district: "PUNO",
      province: "PUNO",
      department: "PUNO",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Venta al por menor de materiales de construccion",
      registryAgeDays: 19,
    },
    executiveId: EXECUTIVES.PABLO,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: BACK_OFFICE.GABRIEL,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 19,
    current: current("INTERBANK", 2.68, 3.0, 64_000, 145, "INTERBANK", 2),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P2",
      "DISPONIBLE",
      "Disponible, buen ticket promedio",
      17,
    ),
    proposals: [
      proposal(1, 0.91, 2.36, "accepted", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 14,
        decidedOffsetDays: 12,
        acceptedBy: EXECUTIVES.PABLO,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 10 },
      { to: "FULFILLMENT", offsetDays: 6 },
    ],
    venue: {
      tradeName: "Ferreteria Altiplano",
      posQuantity: 1,
      address: "JR. TACNA NRO. 380",
      addressReference: "Cerca a la plaza de armas",
      createdOffsetDays: 8,
      createdBy: EXECUTIVES.PABLO,
      // per_venue digital policy: the link config lives here instead of on
      // the lead-level policy row.
      linkUrl: "https://pay.culqi.com/altiplano",
      onlineUrl: null,
      onlineCollectionMode: null,
      accounts: [
        {
          currency: "PEN",
          bank: "INTERBANK",
          accountType: "CORRIENTE",
          accountNumber: "898-4455667-2",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Every document step is done; serial recording is back office's pending
    // turn.
    fulfillment: fulfillmentSpec("pos_refurbished", "AWAITING_SERIALS", {
      chosenOffsetDays: 5,
    }),
    digitalPolicy: {
      linkScope: "per_venue",
      linkUrl: null,
      onlineScope: "none",
      onlineUrl: null,
      onlineCollectionMode: null,
      updatedOffsetDays: 4,
      updatedBy: EXECUTIVES.PABLO,
    },
  },
  {
    key: "fulfillment-serial-entry-nortec",
    org: {
      ruc: "20544998877",
      legalName: "DISTRIBUIDORA NORTEC EIRL",
      address: "AV. SANCHEZ CARRION NRO. 610",
      district: "CHICLAYO",
      province: "CHICLAYO",
      department: "LAMBAYEQUE",
      activity: ACTIVITY.wholesale,
      lineOfBusiness: "Distribucion de electrodomesticos",
      registryAgeDays: 16,
    },
    executiveId: EXECUTIVES.ISABELLA,
    createdBy: SUPERVISORS.MARIANA,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 16,
    current: current("BCP", 2.74, 3.04, 76_000, 190, "BCP", 3),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P1",
      "DISPONIBLE",
      "Disponible, prioridad alta",
      14,
    ),
    proposals: [
      proposal(1, 0.89, 2.32, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 11,
        decidedOffsetDays: 9,
        acceptedBy: EXECUTIVES.ISABELLA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 7 },
      { to: "FULFILLMENT", offsetDays: 3 },
    ],
    venue: {
      tradeName: "Nortec Chiclayo",
      posQuantity: 1,
      address: "AV. SANCHEZ CARRION NRO. 610",
      addressReference: "Local con vitrina a la avenida",
      createdOffsetDays: 5,
      createdBy: EXECUTIVES.ISABELLA,
      accounts: [
        {
          currency: "PEN",
          bank: "BCP",
          accountType: "CORRIENTE",
          accountNumber: "194-7788990-0-25",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // New-POS branch, first step: the executive has not entered a serial yet.
    fulfillment: fulfillmentSpec("pos_new", "AWAITING_SERIAL_ENTRY", {
      chosenOffsetDays: 2,
    }),
  },
  {
    key: "fulfillment-payment-link-delrio",
    org: {
      ruc: "20511556677",
      legalName: "PANADERIA DEL RIO SAC",
      address: "AV. LOS HEROES NRO. 220",
      district: "CAJAMARCA",
      province: "CAJAMARCA",
      department: "CAJAMARCA",
      activity: ACTIVITY.restaurant,
      lineOfBusiness: "Panaderia y pasteleria",
      registryAgeDays: 14,
    },
    executiveId: EXECUTIVES.FERNANDA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: BACK_OFFICE.GABRIEL,
    stage: "FULFILLMENT",
    // STOCK reactivation surviving past PRICING: nothing re-derives status
    // after review, so this is a valid state.
    status: "STOCK",
    priority: "P1",
    createdOffsetDays: 14,
    current: current("BBVA", 2.6, 2.95, 40_000, 100, "BBVA", 2),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P1",
      "STOCK",
      "Reactivado desde stock, buen ticket",
      12,
    ),
    proposals: [
      proposal(1, 0.94, 2.42, "accepted", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 9,
        decidedOffsetDays: 7,
        acceptedBy: EXECUTIVES.FERNANDA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 5 },
      { to: "FULFILLMENT", offsetDays: 2 },
    ],
    venue: {
      tradeName: "Panaderia Del Rio",
      posQuantity: 1,
      address: "AV. LOS HEROES NRO. 220",
      addressReference: "Frente al mercado central",
      createdOffsetDays: 4,
      createdBy: EXECUTIVES.FERNANDA,
      accounts: [
        {
          currency: "PEN",
          bank: "BBVA",
          accountType: "CORRIENTE",
          accountNumber: "011-6677889-0-33",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Serial already entered; payment link generation is back office's
    // pending turn.
    fulfillment: fulfillmentSpec("pos_new", "AWAITING_PAYMENT_LINK", {
      chosenOffsetDays: 1,
    }),
  },
  {
    key: "fulfillment-payment-tejada",
    org: {
      ruc: "20522113344",
      legalName: "BOTICA TEJADA EIRL",
      address: "AV. LOS OLIVOS NRO. 505",
      district: "TARAPOTO",
      province: "SAN MARTIN",
      department: "SAN MARTIN",
      activity: ACTIVITY.pharmacy,
      lineOfBusiness: "Venta al por menor de productos farmaceuticos",
      registryAgeDays: 15,
    },
    executiveId: EXECUTIVES.CAMILA,
    createdBy: SUPERVISORS.MARIANA,
    updatedBy: BACK_OFFICE.JOSEFINA,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 15,
    current: current("SCOTIABANK", 2.66, 2.99, 48_000, 115, "SCOTIABANK", 2),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, botica en crecimiento",
      13,
    ),
    proposals: [
      proposal(1, 0.96, 2.44, "accepted", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 10,
        decidedOffsetDays: 8,
        acceptedBy: EXECUTIVES.CAMILA,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 6 },
      { to: "FULFILLMENT", offsetDays: 3 },
    ],
    venue: {
      tradeName: "Botica Tejada",
      posQuantity: 1,
      address: "AV. LOS OLIVOS NRO. 505",
      addressReference: "A media cuadra del hospital",
      createdOffsetDays: 5,
      createdBy: EXECUTIVES.CAMILA,
      accounts: [
        {
          currency: "PEN",
          bank: "SCOTIABANK",
          accountType: "CORRIENTE",
          accountNumber: "000-2233114-4",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Serial and payment link both done; the executive has not uploaded proof
    // of payment yet.
    fulfillment: fulfillmentSpec("pos_new", "AWAITING_PAYMENT", {
      chosenOffsetDays: 2,
    }),
  },
  {
    key: "fulfillment-payment-validation-esmeralda",
    org: {
      ruc: "20599887744",
      legalName: "JOYERIA ESMERALDA SAC",
      address: "JR. UNION NRO. 315",
      district: "CUSCO",
      province: "CUSCO",
      department: "CUSCO",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Venta al por menor de joyeria",
      registryAgeDays: 17,
    },
    executiveId: EXECUTIVES.JOSE,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: BACK_OFFICE.GABRIEL,
    stage: "FULFILLMENT",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 17,
    current: current("BCP", 2.71, 3.01, 82_000, 205, "BCP", 3),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P1",
      "DISPONIBLE",
      "Disponible, ticket alto",
      15,
    ),
    proposals: [
      proposal(1, 0.86, 2.29, "accepted", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 12,
        decidedOffsetDays: 10,
        acceptedBy: EXECUTIVES.JOSE,
      }),
    ],
    advances: [
      { to: "SETUP", offsetDays: 8 },
      { to: "FULFILLMENT", offsetDays: 4 },
    ],
    venue: {
      tradeName: "Joyeria Esmeralda",
      posQuantity: 1,
      address: "JR. UNION NRO. 315",
      addressReference: "Dentro de la galeria comercial",
      createdOffsetDays: 6,
      createdBy: EXECUTIVES.JOSE,
      accounts: [
        {
          currency: "PEN",
          bank: "BCP",
          accountType: "CORRIENTE",
          accountNumber: "194-3344556-0-18",
          cci: null,
          isSettlement: true,
        },
      ],
    },
    // Proof uploaded; validating the payment is back office's pending turn.
    fulfillment: fulfillmentSpec("pos_new", "AWAITING_PAYMENT_VALIDATION", {
      chosenOffsetDays: 3,
    }),
  },

  // ── CLOSED_LOST (additional reasons) ────────────────────────────────────────
  // One lead per CloseReason not already exercised above.
  {
    key: "closed-lost-culqi-references",
    org: {
      ruc: "20566223311",
      legalName: "COMERCIAL RINCON NORTE SRL",
      address: "AV. LOS LIBERTADORES NRO. 890",
      district: "TUMBES",
      province: "TUMBES",
      department: "TUMBES",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Comercio minorista de abarrotes",
      registryAgeDays: 12,
    },
    executiveId: EXECUTIVES.MARINA,
    createdBy: SUPERVISORS.DIEGO,
    updatedBy: EXECUTIVES.MARINA,
    stage: "CLOSED_LOST",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 12,
    current: current("BCP", 2.6, 2.95, 35_000, 90, "BCP", 1),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, a la espera de referencias",
      10,
    ),
    proposals: [
      proposal(1, 0.9, 2.35, "pending", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 7,
      }),
    ],
    close: {
      reason: "CULQI_REFERENCES",
      note: "El cliente no pudo presentar las referencias comerciales que pidió Culqi",
      by: EXECUTIVES.MARINA,
      offsetDays: 3,
    },
  },
  {
    key: "closed-lost-declined-tax-report",
    org: {
      ruc: "20544667722",
      legalName: "CONSTRUCTORA DEL NORTE SAC",
      address: "AV. LOS TALLANES NRO. 415",
      district: "SULLANA",
      province: "SULLANA",
      department: "PIURA",
      activity: ACTIVITY.construction,
      lineOfBusiness: "Construccion de edificios comerciales",
      registryAgeDays: 14,
    },
    executiveId: EXECUTIVES.ELENA,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: EXECUTIVES.ELENA,
    stage: "CLOSED_LOST",
    status: "DISPONIBLE",
    priority: "P1",
    createdOffsetDays: 14,
    current: current("INTERBANK", 2.7, 3.05, 88_000, 195, "INTERBANK", 3),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P1",
      "DISPONIBLE",
      "Alto volumen, en revisión de documentos",
      12,
    ),
    proposals: [
      proposal(1, 0.85, 2.3, "accepted", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 9,
        decidedOffsetDays: 7,
        acceptedBy: EXECUTIVES.ELENA,
      }),
    ],
    close: {
      reason: "DECLINED_TAX_REPORT",
      note: "El cliente se negó a presentar el reporte tributario solicitado",
      by: EXECUTIVES.ELENA,
      offsetDays: 4,
    },
  },
  {
    key: "closed-lost-quote-delays",
    org: {
      ruc: "20511774455",
      legalName: "TRANSPORTES DEL VALLE EIRL",
      address: "CAR. CENTRAL KM 8",
      district: "HUANCAYO",
      province: "HUANCAYO",
      department: "JUNIN",
      activity: ACTIVITY.transport,
      lineOfBusiness: "Transporte de carga interprovincial",
      registryAgeDays: 11,
    },
    executiveId: EXECUTIVES.MATIAS,
    createdBy: SUPERVISORS.MARIANA,
    updatedBy: EXECUTIVES.MATIAS,
    stage: "CLOSED_LOST",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 11,
    current: current("BBVA", 2.62, 2.96, 42_000, 105, "BBVA", 2),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, cotización en curso",
      9,
    ),
    proposals: [
      proposal(1, 0.95, 2.4, "pending", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 6,
      }),
    ],
    close: {
      reason: "QUOTE_DELAYS",
      note: "El cliente desistió por la demora en recibir la cotización",
      by: EXECUTIVES.MATIAS,
      offsetDays: 2,
    },
  },
  {
    key: "closed-lost-bcp-refusal",
    org: {
      ruc: "20599112288",
      legalName: "MINIMARKET LAS FLORES SAC",
      address: "AV. LOS JAZMINES NRO. 233",
      district: "CHIMBOTE",
      province: "SANTA",
      department: "ANCASH",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Minimarket de abarrotes",
      registryAgeDays: 10,
    },
    executiveId: EXECUTIVES.SOFIA,
    createdBy: SUPERVISORS.NICOLAS,
    updatedBy: EXECUTIVES.SOFIA,
    stage: "CLOSED_LOST",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 10,
    current: current("SCOTIABANK", 2.63, 2.97, 30_000, 80, "SCOTIABANK", 1),
    review: review(
      BACK_OFFICE.GABRIEL,
      "P2",
      "DISPONIBLE",
      "Disponible, requiere aprobación bancaria",
      8,
    ),
    proposals: [
      proposal(1, 0.92, 2.38, "accepted", {
        proposedBy: BACK_OFFICE.GABRIEL,
        proposedOffsetDays: 6,
        decidedOffsetDays: 5,
        acceptedBy: EXECUTIVES.SOFIA,
      }),
    ],
    close: {
      reason: "BCP_REFUSAL",
      note: "BCP rechazó la afiliación de la cuenta de liquidación",
      by: EXECUTIVES.SOFIA,
      offsetDays: 2,
    },
  },
  {
    key: "closed-lost-pos-cost-refusal",
    org: {
      ruc: "20522998811",
      legalName: "LIBRERIA EL SABER EIRL",
      address: "JR. LIMA NRO. 512",
      district: "HUARAZ",
      province: "HUARAZ",
      department: "ANCASH",
      activity: ACTIVITY.retail,
      lineOfBusiness: "Venta al por menor de libros y utiles",
      registryAgeDays: 9,
    },
    executiveId: EXECUTIVES.MANUEL,
    createdBy: SUPERVISORS.MARIANA,
    updatedBy: EXECUTIVES.MANUEL,
    stage: "CLOSED_LOST",
    status: "DISPONIBLE",
    priority: "P2",
    createdOffsetDays: 9,
    current: current("BCP", 2.61, 2.94, 20_000, 60, "BCP", 1),
    review: review(
      BACK_OFFICE.JOSEFINA,
      "P2",
      "DISPONIBLE",
      "Disponible, sensible al costo del equipo",
      7,
    ),
    proposals: [
      proposal(1, 0.98, 2.5, "pending", {
        proposedBy: BACK_OFFICE.JOSEFINA,
        proposedOffsetDays: 5,
      }),
    ],
    close: {
      reason: "POS_COST_REFUSAL",
      note: "El cliente rechazó el costo del POS ofrecido",
      by: EXECUTIVES.MANUEL,
      offsetDays: 1,
    },
  },
];

function current(
  provider: string,
  debitRate: number,
  creditRate: number,
  gpv: number,
  ticket: number,
  settlementBank: SettlementBank,
  posCount: number,
): LeadCurrent {
  return {
    provider,
    debitRate,
    creditRate,
    gpv,
    ticket,
    settlementBank,
    posCount,
  };
}

function review(
  by: UserId,
  priority: LeadPriority,
  status: LeadStatus,
  reason: string,
  offsetDays: number,
): ReviewSpec {
  return { by, reason, status, priority, toStage: "PRICING", offsetDays };
}

function proposal(
  round: number,
  debitRate: number,
  creditRate: number,
  outcome: RateProposalSpec["outcome"],
  extra: {
    proposedBy: UserId;
    proposedOffsetDays: number;
    decidedOffsetDays?: number;
    acceptedBy?: UserId;
    currency?: "PEN" | "USD";
  },
): RateProposalSpec {
  return {
    round,
    paybackPricing: 1.2,
    debitRate,
    creditRate,
    foreignRate: 1.7,
    fee: 18.0,
    currency: "PEN",
    outcome,
    ...extra,
  };
}

// The order is created the instant addVenueAccountsCommand transitions the
// lead to FULFILLMENT, so every FULFILLMENT/LIVE lead's advances must name
// that transition explicitly (never skip straight from SETUP to LIVE).
export function fulfillmentEnteredOffsetDays(spec: LeadSpec): number {
  const advance = (spec.advances ?? []).find((a) => a.to === "FULFILLMENT");
  if (!advance) {
    throw new Error(`missing_seed_fulfillment_advance:${spec.key}`);
  }
  return advance.offsetDays;
}

// venue is mandatory here (not optional) because FulfillmentSpec is only
// legal alongside one -- see the comment on FulfillmentSpec.
function fulfillmentSpec(
  productKind: ProductKind | null,
  targetStep: FulfillmentStep,
  extra: {
    chosenOffsetDays?: number;
    unitSerials?: Array<string | null>;
  } = {},
): FulfillmentSpec {
  return { productKind, targetStep, ...extra };
}
