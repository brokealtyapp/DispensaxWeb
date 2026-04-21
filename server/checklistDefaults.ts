import { and, eq, ne } from "drizzle-orm";
import { db as defaultDb } from "./db";
import {
  workOrders as workOrdersTable,
  workOrderChecklistItems as workOrderChecklistItemsTable,
  workOrderChecklistTemplates as workOrderChecklistTemplatesTable,
} from "@shared/schema";

export type DefaultChecklistEntry = {
  label: string;
  itemType: string;
  options?: string[] | null;
};

export const DEFAULT_CHECKLISTS: Record<string, DefaultChecklistEntry[]> = {
  abastecimiento: [
    { label: "Verificar niveles de inventario actuales", itemType: "checkbox" },
    { label: "Retirar productos vencidos o dañados", itemType: "checkbox" },
    { label: "Cargar productos según planograma", itemType: "checkbox" },
    { label: "Verificar fechas de vencimiento", itemType: "checkbox" },
    { label: "Limpiar bandejas y dispensadores", itemType: "checkbox" },
    { label: "Verificar precios configurados", itemType: "checkbox" },
    { label: "Registrar conteo de monedas/billetes", itemType: "numeric" },
    { label: "Tomar foto de la máquina abastecida", itemType: "photo" },
  ],
  tecnico: [
    { label: "Diagnosticar falla reportada", itemType: "open_question" },
    { label: "Verificar conexión eléctrica", itemType: "checkbox" },
    { label: "Revisar sistema de refrigeración", itemType: "checkbox" },
    { label: "Probar mecanismo de dispensado", itemType: "checkbox" },
    { label: "Verificar aceptador de monedas/billetes", itemType: "checkbox" },
    { label: "Verificar sistema de pago cashless", itemType: "checkbox" },
    { label: "Limpiar componentes internos", itemType: "checkbox" },
    { label: "Realizar prueba de funcionamiento completa", itemType: "checkbox" },
  ],
  mantenimiento_preventivo: [
    { label: "Limpieza general exterior e interior", itemType: "checkbox" },
    { label: "Verificar y limpiar condensador", itemType: "checkbox" },
    { label: "Revisar sellos y empaques", itemType: "checkbox" },
    { label: "Lubricar mecanismos móviles", itemType: "checkbox" },
    { label: "Verificar temperatura de refrigeración", itemType: "numeric" },
    { label: "Inspeccionar cableado eléctrico", itemType: "checkbox" },
    { label: "Actualizar software/firmware si aplica", itemType: "checkbox" },
  ],
  instalacion: [
    { label: "Verificar punto de instalación (electricidad, espacio)", itemType: "checkbox" },
    { label: "Posicionar y nivelar máquina", itemType: "checkbox" },
    { label: "Conectar a fuente de energía", itemType: "checkbox" },
    { label: "Configurar parámetros iniciales", itemType: "checkbox" },
    { label: "Cargar inventario inicial", itemType: "checkbox" },
    { label: "Realizar pruebas de dispensado", itemType: "checkbox" },
    { label: "Capacitar al personal del establecimiento", itemType: "checkbox" },
  ],
  retiro: [
    { label: "Retirar todo el inventario restante", itemType: "checkbox" },
    { label: "Recolectar efectivo pendiente", itemType: "checkbox" },
    { label: "Desconectar de fuente de energía", itemType: "checkbox" },
    { label: "Documentar estado de la máquina", itemType: "open_question" },
    { label: "Coordinar transporte de retiro", itemType: "checkbox" },
  ],
};

export function getDefaultChecklistEntries(type: string): DefaultChecklistEntry[] {
  return DEFAULT_CHECKLISTS[type] ?? [];
}

// Lookup scoped by (orderType, label). Only upgrades items belonging to a
// known default order type AND whose label matches a default entry whose
// intended type is non-checkbox. Custom labels and custom order types are
// always left alone.
export function getDefaultEntryFor(orderType: string, label: string): DefaultChecklistEntry | undefined {
  const entries = DEFAULT_CHECKLISTS[orderType];
  if (!entries) return undefined;
  const match = entries.find((e) => e.label === label);
  if (match && match.itemType !== "checkbox") return match;
  return undefined;
}

type DbLike = typeof defaultDb;

export async function runChecklistDefaultsUpgrade(tenantId: string, dbInstance: DbLike = defaultDb): Promise<void> {
  // Wrap the whole upgrade in a single transaction per tenant so partial
  // failures roll back instead of leaving templates/items in mixed state.
  await dbInstance.transaction(async (tx) => {
    // 1) Upgrade matching templates still on the legacy default
    // ("checkbox" + no options), scoped by both tenantId and orderType.
    const templates = await tx
      .select()
      .from(workOrderChecklistTemplatesTable)
      .where(eq(workOrderChecklistTemplatesTable.tenantId, tenantId));
    for (const tpl of templates) {
      const currentType = tpl.itemType ?? "checkbox";
      const currentOptions = (tpl.options as string[] | null) ?? null;
      if (currentType !== "checkbox") continue;
      if (currentOptions && currentOptions.length > 0) continue;
      const desired = getDefaultEntryFor(tpl.orderType, tpl.label);
      if (!desired) continue;
      await tx
        .update(workOrderChecklistTemplatesTable)
        .set({
          itemType: desired.itemType,
          options: desired.options ?? null,
        })
        .where(
          and(
            eq(workOrderChecklistTemplatesTable.id, tpl.id),
            eq(workOrderChecklistTemplatesTable.tenantId, tenantId),
            eq(workOrderChecklistTemplatesTable.orderType, tpl.orderType),
            eq(workOrderChecklistTemplatesTable.itemType, "checkbox"),
          ),
        );
    }

    // 2) Upgrade matching items in checklists of orders that are still
    // open. Scoped by (workOrder.type, label) so custom order types are
    // never touched.
    const openItems = await tx
      .select({
        id: workOrderChecklistItemsTable.id,
        label: workOrderChecklistItemsTable.label,
        itemType: workOrderChecklistItemsTable.itemType,
        options: workOrderChecklistItemsTable.options,
        answer: workOrderChecklistItemsTable.answer,
        photoUrl: workOrderChecklistItemsTable.photoUrl,
        isCompleted: workOrderChecklistItemsTable.isCompleted,
        orderType: workOrdersTable.type,
      })
      .from(workOrderChecklistItemsTable)
      .innerJoin(workOrdersTable, eq(workOrdersTable.id, workOrderChecklistItemsTable.workOrderId))
      .where(
        and(
          eq(workOrderChecklistItemsTable.tenantId, tenantId),
          eq(workOrdersTable.tenantId, tenantId),
          ne(workOrdersTable.status, "completada"),
          ne(workOrdersTable.status, "cancelada"),
        ),
      );
    for (const it of openItems) {
      const currentType = it.itemType ?? "checkbox";
      const currentOptions = (it.options as string[] | null) ?? null;
      if (currentType !== "checkbox") continue;
      if (currentOptions && currentOptions.length > 0) continue;
      if (it.answer) continue;
      if (it.photoUrl) continue;
      if (it.isCompleted) continue;
      const desired = getDefaultEntryFor(it.orderType, it.label);
      if (!desired) continue;
      await tx
        .update(workOrderChecklistItemsTable)
        .set({
          itemType: desired.itemType,
          options: desired.options ?? null,
        })
        .where(
          and(
            eq(workOrderChecklistItemsTable.id, it.id),
            eq(workOrderChecklistItemsTable.tenantId, tenantId),
            eq(workOrderChecklistItemsTable.itemType, "checkbox"),
          ),
        );
    }
  });
}

// Per-tenant in-flight migration promises so concurrent callers await the
// same run instead of racing past it. Entries are removed as soon as the
// run finishes (success or failure), so a new request after that point
// will re-run the migration. This is intentional: tenant template/item
// data can change at any time (admin edits, new orders), and the upgrade
// is cheap and idempotent.
const checklistDefaultsUpgrades = new Map<string, Promise<void>>();

export async function ensureChecklistDefaultsUpgraded(tenantId: string, dbInstance: DbLike = defaultDb): Promise<void> {
  // If a run is already in flight for this tenant, await it instead of
  // starting a duplicate one.
  const existing = checklistDefaultsUpgrades.get(tenantId);
  if (existing) return existing;
  const promise = (async () => {
    try {
      await runChecklistDefaultsUpgrade(tenantId, dbInstance);
    } catch (err) {
      // Migration is best-effort; never throw to callers — request
      // handling must continue even if the upgrade fails.
      console.error("[checklist defaults] upgrade failed for tenant", tenantId, err);
    }
  })().finally(() => {
    // Always release the in-flight slot so the next request will re-check
    // (template/order data may have changed since the previous run).
    checklistDefaultsUpgrades.delete(tenantId);
  });
  checklistDefaultsUpgrades.set(tenantId, promise);
  return promise;
}
