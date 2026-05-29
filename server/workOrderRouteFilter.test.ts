import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { db, pool } from "./db";
import { storage } from "./storage";
import {
  tenants,
  users,
  routes,
  machines,
  workOrders,
} from "@shared/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeTenant(suffix: string) {
  const slug = `test-wo-route-filter-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Tenant WO ${suffix}`, slug })
    .returning();
  return tenant;
}

async function makeUser(tenantId: string, suffix: string) {
  const username = `supplier-wo-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [user] = await db
    .insert(users)
    .values({ tenantId, username, password: "x", role: "abastecedor" })
    .returning();
  return user;
}

async function makeMachine(tenantId: string, suffix: string) {
  const [machine] = await db
    .insert(machines)
    .values({ tenantId, name: `Máquina WO ${suffix}` })
    .returning();
  return machine;
}

async function makeRoute(tenantId: string, supplierId: string, suffix: string) {
  const [route] = await db
    .insert(routes)
    .values({
      tenantId,
      name: `Ruta WO ${suffix}`,
      date: new Date(),
      supplierId,
      status: "activa",
    })
    .returning();
  return route;
}

let orderCounter = 0;

async function makeWorkOrder(
  tenantId: string,
  machineId: string,
  routeId: string | null,
  suffix: string,
) {
  orderCounter += 1;
  const [wo] = await db
    .insert(workOrders)
    .values({
      tenantId,
      orderNumber: `OT-WO-FILTER-${suffix}-${orderCounter}-${Date.now()}`,
      machineId,
      type: "tecnico",
      status: "pendiente",
      routeId: routeId ?? undefined,
    })
    .returning();
  return wo;
}

async function cleanupTenant(tenantId: string) {
  await db.delete(workOrders).where(eq(workOrders.tenantId, tenantId));
  await db.delete(routes).where(eq(routes.tenantId, tenantId));
  await db.delete(machines).where(eq(machines.tenantId, tenantId));
  await db.delete(users).where(eq(users.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("getWorkOrders con routeId: devuelve solo las órdenes asignadas a esa ruta", async () => {
  const tenant = await makeTenant("filter");
  const user = await makeUser(tenant.id, "filter");
  const machine = await makeMachine(tenant.id, "filter");
  const routeA = await makeRoute(tenant.id, user.id, "A");
  const routeB = await makeRoute(tenant.id, user.id, "B");

  try {
    const wo1 = await makeWorkOrder(tenant.id, machine.id, routeA.id, "r1");
    const wo2 = await makeWorkOrder(tenant.id, machine.id, routeA.id, "r2");
    await makeWorkOrder(tenant.id, machine.id, routeB.id, "r3");
    await makeWorkOrder(tenant.id, machine.id, null, "r4");

    const results = await storage.getWorkOrders(tenant.id, { routeId: routeA.id });

    assert.equal(results.length, 2, "debe devolver exactamente 2 órdenes de routeA");
    const ids = results.map((o) => o.id);
    assert.ok(ids.includes(wo1.id), "debe incluir wo1 (routeA)");
    assert.ok(ids.includes(wo2.id), "debe incluir wo2 (routeA)");
    assert.ok(
      results.every((o) => o.routeId === routeA.id),
      "todas las órdenes deben pertenecer a routeA",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("getWorkOrders con routeId: no devuelve órdenes sin routeId ni de otra ruta", async () => {
  const tenant = await makeTenant("excl");
  const user = await makeUser(tenant.id, "excl");
  const machine = await makeMachine(tenant.id, "excl");
  const route = await makeRoute(tenant.id, user.id, "main");
  const otherRoute = await makeRoute(tenant.id, user.id, "other");

  try {
    await makeWorkOrder(tenant.id, machine.id, null, "no-route");
    await makeWorkOrder(tenant.id, machine.id, otherRoute.id, "other-route");
    const targetWo = await makeWorkOrder(tenant.id, machine.id, route.id, "target");

    const results = await storage.getWorkOrders(tenant.id, { routeId: route.id });

    assert.equal(results.length, 1, "debe devolver solo 1 orden");
    assert.equal(results[0].id, targetWo.id, "debe ser la orden asignada a la ruta correcta");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("getWorkOrders con routeId: devuelve lista vacía si la ruta no tiene órdenes", async () => {
  const tenant = await makeTenant("empty");
  const user = await makeUser(tenant.id, "empty");
  const machine = await makeMachine(tenant.id, "empty");
  const route = await makeRoute(tenant.id, user.id, "sin-ordenes");
  const otherRoute = await makeRoute(tenant.id, user.id, "con-ordenes");

  try {
    await makeWorkOrder(tenant.id, machine.id, otherRoute.id, "unrelated");

    const results = await storage.getWorkOrders(tenant.id, { routeId: route.id });

    assert.equal(results.length, 0, "debe devolver array vacío cuando la ruta no tiene órdenes");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("getWorkOrders con routeId: aislamiento de tenant — tenantB no ve órdenes de tenantA", async () => {
  const tenantA = await makeTenant("iso-a");
  const tenantB = await makeTenant("iso-b");
  const userA = await makeUser(tenantA.id, "iso-a");
  const userB = await makeUser(tenantB.id, "iso-b");
  const machineA = await makeMachine(tenantA.id, "iso-a");
  const machineB = await makeMachine(tenantB.id, "iso-b");
  const routeA = await makeRoute(tenantA.id, userA.id, "iso-a");
  const routeB = await makeRoute(tenantB.id, userB.id, "iso-b");

  try {
    // Crear órdenes en tenantA asignadas a routeA
    await makeWorkOrder(tenantA.id, machineA.id, routeA.id, "tenantA-1");
    await makeWorkOrder(tenantA.id, machineA.id, routeA.id, "tenantA-2");

    // tenantB no tiene órdenes en routeB
    await makeWorkOrder(tenantB.id, machineB.id, routeB.id, "tenantB-1");

    // tenantB consulta usando el ID de routeA (pertenece a tenantA)
    const resultsB = await storage.getWorkOrders(tenantB.id, { routeId: routeA.id });

    assert.equal(
      resultsB.length,
      0,
      "tenantB no debe ver órdenes de tenantA aunque use el mismo routeId",
    );
  } finally {
    await cleanupTenant(tenantA.id);
    await cleanupTenant(tenantB.id);
  }
});

test("getWorkOrders con routeId: aislamiento de tenant — tenantA solo ve sus propias órdenes", async () => {
  const tenantA = await makeTenant("iso2-a");
  const tenantB = await makeTenant("iso2-b");
  const userA = await makeUser(tenantA.id, "iso2-a");
  const userB = await makeUser(tenantB.id, "iso2-b");
  const machineA = await makeMachine(tenantA.id, "iso2-a");
  const machineB = await makeMachine(tenantB.id, "iso2-b");
  const routeA = await makeRoute(tenantA.id, userA.id, "iso2-a");
  const routeB = await makeRoute(tenantB.id, userB.id, "iso2-b");

  try {
    const woA1 = await makeWorkOrder(tenantA.id, machineA.id, routeA.id, "a1");
    const woA2 = await makeWorkOrder(tenantA.id, machineA.id, routeA.id, "a2");
    await makeWorkOrder(tenantB.id, machineB.id, routeB.id, "b1");

    const resultsA = await storage.getWorkOrders(tenantA.id, { routeId: routeA.id });

    assert.equal(resultsA.length, 2, "tenantA debe ver exactamente sus 2 órdenes");
    const ids = resultsA.map((o) => o.id);
    assert.ok(ids.includes(woA1.id), "debe incluir woA1");
    assert.ok(ids.includes(woA2.id), "debe incluir woA2");
    assert.ok(
      resultsA.every((o) => o.tenantId === tenantA.id),
      "todas las órdenes deben pertenecer a tenantA",
    );
  } finally {
    await cleanupTenant(tenantA.id);
    await cleanupTenant(tenantB.id);
  }
});

test("getWorkOrders sin filtro routeId: devuelve todas las órdenes del tenant (sin filtrar por ruta)", async () => {
  const tenant = await makeTenant("no-filter");
  const user = await makeUser(tenant.id, "no-filter");
  const machine = await makeMachine(tenant.id, "no-filter");
  const routeX = await makeRoute(tenant.id, user.id, "X");
  const routeY = await makeRoute(tenant.id, user.id, "Y");

  try {
    await makeWorkOrder(tenant.id, machine.id, routeX.id, "nf-1");
    await makeWorkOrder(tenant.id, machine.id, routeY.id, "nf-2");
    await makeWorkOrder(tenant.id, machine.id, null, "nf-3");

    const all = await storage.getWorkOrders(tenant.id, {});

    assert.ok(all.length >= 3, "sin filtro routeId debe devolver todas las órdenes del tenant");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

test.after(async () => {
  await pool.end();
});
