import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { nayaxConfig, machines, nayaxTransactions, type InsertNayaxTransaction } from "@shared/schema";

const LYNX_BASE_URL = "https://lynx.nayax.com/operational/api/v1";

interface NayaxRequestOptions {
  method?: string;
  path: string;
  token: string;
  params?: Record<string, string | number>;
  body?: any;
}

async function nayaxRequest<T = any>(options: NayaxRequestOptions): Promise<T> {
  const { method = "GET", path, token, params, body } = options;

  let url = `${LYNX_BASE_URL}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const fetchOptions: RequestInit = { method, headers };
  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Nayax API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text);
  } catch {
    return text as unknown as T;
  }
}

export interface NayaxMachine {
  MachineID: number;
  MachineName: string;
  MachineNumber: string;
  MachineStatusBit: number;
  SerialNumber: string;
  DeviceSerialNumber: string;
  VPOSSerialNumber: string;
  GeoCity: string;
  GeoAddress: string;
  GeoLatitude: number;
  GeoLongitude: number;
  LastUpdated: string;
  [key: string]: any;
}

export interface NayaxSale {
  TransactionID: number;
  PaymentServiceTransactionID: string;
  PaymentServiceProviderName: string;
  MachineID: number;
  MachineName: string;
  MachineNumber: string;
  AuthorizationValue: number;
  SettlementValue: number;
  CurrencyCode: string;
  PaymentMethod: string;
  RecognitionMethod: string;
  CardBrand: string;
  ProductName: string;
  Quantity: number;
  AuthorizationDateTimeGMT: string;
  SettlementDateTimeGMT: string;
  [key: string]: any;
}

export async function getNayaxToken(tenantId: string): Promise<string | null> {
  const config = await db.select().from(nayaxConfig).where(eq(nayaxConfig.tenantId, tenantId)).limit(1);
  if (config.length === 0 || !config[0].apiToken) return null;
  return config[0].apiToken;
}

export async function getAllNayaxMachines(token: string, limit = 200): Promise<NayaxMachine[]> {
  return nayaxRequest<NayaxMachine[]>({
    path: "/machines",
    token,
    params: { ResultsLimit: limit },
  });
}

export async function getNayaxMachine(token: string, machineId: number): Promise<NayaxMachine> {
  return nayaxRequest<NayaxMachine>({
    path: `/machines/${machineId}`,
    token,
  });
}

export async function getNayaxMachineLastSales(token: string, machineId: number): Promise<NayaxSale[]> {
  return nayaxRequest<NayaxSale[]>({
    path: `/machines/${machineId}/lastSales`,
    token,
  });
}

export async function testNayaxConnection(token: string): Promise<{ success: boolean; machineCount?: number; error?: string }> {
  try {
    const machines = await getAllNayaxMachines(token, 1);
    return { success: true, machineCount: Array.isArray(machines) ? machines.length : 0 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export type PaymentCategory = "cash" | "card" | "other";

export function categorizePaymentMethod(method: string | null | undefined): PaymentCategory {
  if (!method) return "other";
  const normalized = method.toLowerCase();
  if (
    normalized.includes("cash") ||
    normalized.includes("coin") ||
    normalized.includes("bill") ||
    normalized.includes("efectivo") ||
    normalized.includes("currency") ||
    normalized.includes("mdb")
  ) {
    return "cash";
  }
  if (
    normalized.includes("card") ||
    normalized.includes("credit") ||
    normalized.includes("debit") ||
    normalized.includes("emv") ||
    normalized.includes("nfc") ||
    normalized.includes("contactless") ||
    normalized.includes("apple pay") ||
    normalized.includes("google pay") ||
    normalized.includes("wallet")
  ) {
    return "card";
  }
  return "other";
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function syncNayaxSalesForTenant(tenantId: string): Promise<{
  machinesProcessed: number;
  transactionsUpserted: number;
  errors: Array<{ machineId: string; error: string }>;
}> {
  const token = await getNayaxToken(tenantId);
  if (!token) {
    return { machinesProcessed: 0, transactionsUpserted: 0, errors: [{ machineId: "config", error: "No hay token de Nayax configurado" }] };
  }

  const linked = await db
    .select({
      id: machines.id,
      tenantId: machines.tenantId,
      nayaxMachineId: machines.nayaxMachineId,
    })
    .from(machines)
    .where(and(eq(machines.tenantId, tenantId), sql`${machines.nayaxMachineId} IS NOT NULL`));

  let upserted = 0;
  const errors: Array<{ machineId: string; error: string }> = [];

  for (const m of linked) {
    if (!m.nayaxMachineId) continue;
    try {
      const sales = await getNayaxMachineLastSales(token, m.nayaxMachineId);
      if (!Array.isArray(sales) || sales.length === 0) continue;

      const rows: InsertNayaxTransaction[] = [];
      for (const s of sales) {
        const settlementDate = parseDate(s.SettlementDateTimeGMT) ?? parseDate(s.AuthorizationDateTimeGMT);
        if (!settlementDate) continue;
        const transactionId = String(s.TransactionID ?? s.PaymentServiceTransactionID ?? "").trim();
        if (!transactionId) continue;
        rows.push({
          tenantId,
          machineId: m.id,
          nayaxMachineId: m.nayaxMachineId,
          transactionId,
          paymentServiceTransactionId: s.PaymentServiceTransactionID || null,
          paymentMethod: s.PaymentMethod || null,
          paymentCategory: categorizePaymentMethod(s.PaymentMethod),
          cardBrand: s.CardBrand || null,
          currencyCode: s.CurrencyCode || "DOP",
          settlementValue: String(s.SettlementValue ?? s.AuthorizationValue ?? 0),
          authorizationValue: s.AuthorizationValue != null ? String(s.AuthorizationValue) : null,
          productName: s.ProductName || null,
          quantity: typeof s.Quantity === "number" ? s.Quantity : 1,
          settlementDate,
          authorizationDate: parseDate(s.AuthorizationDateTimeGMT),
          raw: s as Record<string, unknown>,
        });
      }

      if (rows.length === 0) continue;

      const result = await db
        .insert(nayaxTransactions)
        .values(rows)
        .onConflictDoUpdate({
          target: [nayaxTransactions.tenantId, nayaxTransactions.transactionId],
          set: {
            paymentMethod: sql`EXCLUDED.payment_method`,
            paymentCategory: sql`EXCLUDED.payment_category`,
            cardBrand: sql`EXCLUDED.card_brand`,
            settlementValue: sql`EXCLUDED.settlement_value`,
            authorizationValue: sql`EXCLUDED.authorization_value`,
            productName: sql`EXCLUDED.product_name`,
            quantity: sql`EXCLUDED.quantity`,
            settlementDate: sql`EXCLUDED.settlement_date`,
            authorizationDate: sql`EXCLUDED.authorization_date`,
            raw: sql`EXCLUDED.raw`,
            syncedAt: new Date(),
          },
        });
      upserted += rows.length;
    } catch (err: any) {
      errors.push({ machineId: m.id, error: err?.message || String(err) });
    }
  }

  return { machinesProcessed: linked.length, transactionsUpserted: upserted, errors };
}

export interface LaneChangeNayaxPayload {
  id: string;
  tenantId: string;
  machineId: string;
  fromTrayNumber: number | null;
  fromLaneNumber: number | null;
  toTrayNumber: number;
  toLaneNumber: number;
  productId: string;
  previousProductId: string | null;
}

/**
 * Stub: encola un cambio de carril para sincronizar con la API de Nayax Lynx.
 * El registro `lane_change_events` ya guarda `syncStatus="pending"` (cola pendiente
 * para Nayax). Esta función actualmente es un no-op; será reemplazada por la
 * llamada real a Lynx (asignación de planograma) en una iteración futura.
 *
 * Contrato esperado:
 *   - Reintentar con backoff exponencial.
 *   - Marcar el evento como `synced` en éxito o `failed` con `syncError` en error
 *     terminal a través de `storage.updateLaneChangeSyncStatus` (futuro).
 */
export async function enqueueLaneChangeForNayax(_event: LaneChangeNayaxPayload): Promise<void> {
  // TODO Nayax sync: integrar con Lynx API cuando esté disponible.
  return;
}
