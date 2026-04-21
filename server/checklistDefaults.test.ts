import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";

import { db, pool } from "./db";
import {
  ensureChecklistDefaultsUpgraded,
  getDefaultEntryFor,
} from "./checklistDefaults";
import {
  tenants,
  machines,
  workOrders,
  workOrderChecklistItems,
  workOrderChecklistTemplates,
} from "@shared/schema";

// Helper: insert a tenant + machine for the test scope
async function makeTenantWithMachine(suffix: string) {
  const slug = `test-checklist-defaults-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Test ${suffix}`, slug })
    .returning();
  const [machine] = await db
    .insert(machines)
    .values({ tenantId: tenant.id, name: `Machine ${suffix}` })
    .returning();
  return { tenant, machine };
}

async function cleanupTenant(tenantId: string) {
  // Delete in dependency order
  await db
    .delete(workOrderChecklistItems)
    .where(eq(workOrderChecklistItems.tenantId, tenantId));
  await db.delete(workOrders).where(eq(workOrders.tenantId, tenantId));
  await db
    .delete(workOrderChecklistTemplates)
    .where(eq(workOrderChecklistTemplates.tenantId, tenantId));
  await db.delete(machines).where(eq(machines.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

test("templates: misconfigured default item gets restored to its correct type", async () => {
  const { tenant } = await makeTenantWithMachine("tpl");
  try {
    // Seed a template using the wrong type ("checkbox") for a label whose
    // intended type is "photo". This simulates an admin (or stale data)
    // that broke the configuration.
    const [tpl] = await db
      .insert(workOrderChecklistTemplates)
      .values({
        tenantId: tenant.id,
        orderType: "abastecimiento",
        label: "Tomar foto de la máquina abastecida",
        sortOrder: 0,
        isActive: true,
        requiresPhoto: false,
        itemType: "checkbox",
        options: null,
      })
      .returning();

    assert.equal(tpl.itemType, "checkbox", "precondition: stored as checkbox");

    // First call simulates the next request after the regression — it must
    // self-heal without a server restart.
    await ensureChecklistDefaultsUpgraded(tenant.id);

    const [afterFirst] = await db
      .select()
      .from(workOrderChecklistTemplates)
      .where(eq(workOrderChecklistTemplates.id, tpl.id));
    assert.equal(
      afterFirst.itemType,
      "photo",
      "template should be auto-corrected to its default type",
    );

    // Now simulate an admin (or another bug) breaking the same record
    // again. The previous run of the upgrade has finished, so a follow-up
    // call must fix it again — it must NOT be a one-shot per process.
    await db
      .update(workOrderChecklistTemplates)
      .set({ itemType: "checkbox", options: null })
      .where(eq(workOrderChecklistTemplates.id, tpl.id));

    await ensureChecklistDefaultsUpgraded(tenant.id);

    const [afterSecond] = await db
      .select()
      .from(workOrderChecklistTemplates)
      .where(eq(workOrderChecklistTemplates.id, tpl.id));
    assert.equal(
      afterSecond.itemType,
      "photo",
      "template should be auto-corrected again on the very next request",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checklist items: open work order items get restored to the correct type", async () => {
  const { tenant, machine } = await makeTenantWithMachine("items");
  try {
    const [order] = await db
      .insert(workOrders)
      .values({
        tenantId: tenant.id,
        orderNumber: `OT-TEST-${Date.now()}`,
        machineId: machine.id,
        type: "abastecimiento",
        status: "pendiente",
      })
      .returning();

    const [item] = await db
      .insert(workOrderChecklistItems)
      .values({
        workOrderId: order.id,
        tenantId: tenant.id,
        label: "Registrar conteo de monedas/billetes",
        sortOrder: 0,
        itemType: "checkbox",
        options: null,
      })
      .returning();

    assert.equal(item.itemType, "checkbox");

    await ensureChecklistDefaultsUpgraded(tenant.id);

    const [healed] = await db
      .select()
      .from(workOrderChecklistItems)
      .where(eq(workOrderChecklistItems.id, item.id));
    // The default for this label is "numeric"
    const expected = getDefaultEntryFor(
      "abastecimiento",
      "Registrar conteo de monedas/billetes",
    );
    assert.equal(expected?.itemType, "numeric");
    assert.equal(
      healed.itemType,
      "numeric",
      "open-order checklist item should be auto-corrected",
    );

    // Break it again and verify the second call also heals it.
    await db
      .update(workOrderChecklistItems)
      .set({ itemType: "checkbox", options: null })
      .where(eq(workOrderChecklistItems.id, item.id));

    await ensureChecklistDefaultsUpgraded(tenant.id);

    const [healedAgain] = await db
      .select()
      .from(workOrderChecklistItems)
      .where(eq(workOrderChecklistItems.id, item.id));
    assert.equal(
      healedAgain.itemType,
      "numeric",
      "checklist item should be re-corrected without restarting the server",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("custom labels and custom order types are left alone", async () => {
  const { tenant, machine } = await makeTenantWithMachine("custom");
  try {
    // 1) Custom label inside a known order type — should not be touched.
    const [customLabelTpl] = await db
      .insert(workOrderChecklistTemplates)
      .values({
        tenantId: tenant.id,
        orderType: "abastecimiento",
        label: "Verificar etiqueta personalizada",
        sortOrder: 0,
        isActive: true,
        requiresPhoto: false,
        itemType: "checkbox",
        options: null,
      })
      .returning();

    // 2) Default label inside an unknown order type — should not be touched.
    const [customTypeTpl] = await db
      .insert(workOrderChecklistTemplates)
      .values({
        tenantId: tenant.id,
        orderType: "tipo_personalizado",
        label: "Tomar foto de la máquina abastecida",
        sortOrder: 0,
        isActive: true,
        requiresPhoto: false,
        itemType: "checkbox",
        options: null,
      })
      .returning();

    // 3) An item on a closed order — must not be migrated.
    const [closedOrder] = await db
      .insert(workOrders)
      .values({
        tenantId: tenant.id,
        orderNumber: `OT-CLOSED-${Date.now()}`,
        machineId: machine.id,
        type: "abastecimiento",
        status: "completada",
      })
      .returning();

    const [closedItem] = await db
      .insert(workOrderChecklistItems)
      .values({
        workOrderId: closedOrder.id,
        tenantId: tenant.id,
        label: "Tomar foto de la máquina abastecida",
        sortOrder: 0,
        itemType: "checkbox",
        options: null,
      })
      .returning();

    await ensureChecklistDefaultsUpgraded(tenant.id);

    const [tpl1] = await db
      .select()
      .from(workOrderChecklistTemplates)
      .where(eq(workOrderChecklistTemplates.id, customLabelTpl.id));
    assert.equal(
      tpl1.itemType,
      "checkbox",
      "custom label inside a known order type must remain untouched",
    );

    const [tpl2] = await db
      .select()
      .from(workOrderChecklistTemplates)
      .where(eq(workOrderChecklistTemplates.id, customTypeTpl.id));
    assert.equal(
      tpl2.itemType,
      "checkbox",
      "default label inside a custom order type must remain untouched",
    );

    const [closedAfter] = await db
      .select()
      .from(workOrderChecklistItems)
      .where(eq(workOrderChecklistItems.id, closedItem.id));
    assert.equal(
      closedAfter.itemType,
      "checkbox",
      "items on closed orders must not be migrated",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test.after(async () => {
  await pool.end();
});
