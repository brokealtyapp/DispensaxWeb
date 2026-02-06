import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { nayaxConfig } from "@shared/schema";

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
