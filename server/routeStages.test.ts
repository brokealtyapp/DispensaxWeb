import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { db, pool } from "./db";
import { storage } from "./storage";
import { computeRouteSlaStatus } from "./routeUtils";
import {
  tenants,
  users,
  routes,
  routeStages,
  routeStageLog,
} from "@shared/schema";

// ─── Fixtures ────────────────────────────────────────────────────────────────

async function makeTenant(suffix: string) {
  const slug = `test-route-stages-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Tenant ${suffix}`, slug })
    .returning();
  return tenant;
}

async function makeUser(tenantId: string, suffix: string) {
  const username = `supplier-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [user] = await db
    .insert(users)
    .values({ tenantId, username, password: "x", role: "abastecedor" })
    .returning();
  return user;
}

async function makeRoute(tenantId: string, supplierId: string) {
  const [route] = await db
    .insert(routes)
    .values({
      tenantId,
      date: new Date(),
      supplierId,
      status: "en_progreso",
    })
    .returning();
  return route;
}

async function cleanupTenant(tenantId: string) {
  await db
    .delete(routeStageLog)
    .where(eq(routeStageLog.tenantId, tenantId));
  await db.delete(routes).where(eq(routes.tenantId, tenantId));
  await db.delete(routeStages).where(eq(routeStages.tenantId, tenantId));
  await db.delete(users).where(eq(users.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

// ─── computeRouteSlaStatus (pure function, no DB) ────────────────────────────

test("computeRouteSlaStatus: sin SLA cuando slaHours es null o cero", () => {
  const now = new Date();
  assert.equal(computeRouteSlaStatus(now, null), "sin_sla");
  assert.equal(computeRouteSlaStatus(now, 0), "sin_sla");
});

test("computeRouteSlaStatus: dentro_tiempo cuando el elapsed es menor al umbral", () => {
  // Entró hace 1 hora, SLA 4 horas, threshold 80% → pct=25% → dentro_tiempo
  const enteredAt = new Date(Date.now() - 1 * 3_600_000);
  const status = computeRouteSlaStatus(enteredAt, 4, 80);
  assert.equal(status, "dentro_tiempo");
});

test("computeRouteSlaStatus: proximo_vencer cuando elapsed ≥ threshold pero < 100%", () => {
  // Entró hace 3.5 horas, SLA 4 horas, threshold 80% → pct=87.5% → proximo_vencer
  const enteredAt = new Date(Date.now() - 3.5 * 3_600_000);
  const status = computeRouteSlaStatus(enteredAt, 4, 80);
  assert.equal(status, "proximo_vencer");
});

test("computeRouteSlaStatus: vencido cuando elapsed ≥ 100% del SLA", () => {
  // Entró hace 5 horas, SLA 4 horas → pct=125% → vencido
  const enteredAt = new Date(Date.now() - 5 * 3_600_000);
  const status = computeRouteSlaStatus(enteredAt, 4, 80);
  assert.equal(status, "vencido");
});

test("computeRouteSlaStatus: finalizada_a_tiempo cuando hay exitedAt dentro del SLA", () => {
  const enteredAt = new Date(Date.now() - 5 * 3_600_000);
  const exitedAt = new Date(enteredAt.getTime() + 3 * 3_600_000); // salió a las 3h (SLA=4h)
  const status = computeRouteSlaStatus(enteredAt, 4, 80, exitedAt);
  assert.equal(status, "finalizada_a_tiempo");
});

test("computeRouteSlaStatus: finalizada_fuera_de_tiempo cuando exitedAt excede el SLA", () => {
  const enteredAt = new Date(Date.now() - 10 * 3_600_000);
  const exitedAt = new Date(enteredAt.getTime() + 5 * 3_600_000); // salió a las 5h (SLA=4h)
  const status = computeRouteSlaStatus(enteredAt, 4, 80, exitedAt);
  assert.equal(status, "finalizada_fuera_de_tiempo");
});

// ─── CRUD de etapas (con DB) ──────────────────────────────────────────────────

test("createRouteStage: crea y recupera una etapa para el tenant correcto", async () => {
  const tenant = await makeTenant("create");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "Etapa de prueba",
      sortOrder: 0,
      color: "#FF0000",
      isDefault: false,
      isTerminal: false,
    });

    assert.ok(stage.id, "debe tener id");
    assert.equal(stage.tenantId, tenant.id);
    assert.equal(stage.name, "Etapa de prueba");
    assert.equal(stage.color, "#FF0000");

    const fetched = await storage.getRouteStage(stage.id, tenant.id);
    assert.ok(fetched, "debe poder recuperar la etapa por id y tenantId");
    assert.equal(fetched!.name, "Etapa de prueba");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("getRouteStage: no devuelve una etapa de otro tenant (aislamiento)", async () => {
  const tenantA = await makeTenant("iso-a");
  const tenantB = await makeTenant("iso-b");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenantA.id,
      name: "Etapa de Tenant A",
      sortOrder: 0,
    });

    const fromB = await storage.getRouteStage(stage.id, tenantB.id);
    assert.equal(fromB, undefined, "tenantB no debe ver la etapa de tenantA");
  } finally {
    await cleanupTenant(tenantA.id);
    await cleanupTenant(tenantB.id);
  }
});

test("getRouteStages: solo devuelve etapas del tenant solicitado", async () => {
  const tenantA = await makeTenant("list-a");
  const tenantB = await makeTenant("list-b");
  try {
    await storage.createRouteStage({ tenantId: tenantA.id, name: "A1", sortOrder: 0 });
    await storage.createRouteStage({ tenantId: tenantA.id, name: "A2", sortOrder: 1 });
    await storage.createRouteStage({ tenantId: tenantB.id, name: "B1", sortOrder: 0 });

    const stagesA = await storage.getRouteStages(tenantA.id);
    const stagesB = await storage.getRouteStages(tenantB.id);

    assert.equal(stagesA.length, 2);
    assert.ok(stagesA.every(s => s.tenantId === tenantA.id));
    assert.equal(stagesB.length, 1);
    assert.equal(stagesB[0].name, "B1");
  } finally {
    await cleanupTenant(tenantA.id);
    await cleanupTenant(tenantB.id);
  }
});

test("updateRouteStage: actualiza solo los campos indicados", async () => {
  const tenant = await makeTenant("update");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "Original",
      sortOrder: 0,
      slaHours: "2",
    });

    const updated = await storage.updateRouteStage(
      stage.id,
      { name: "Actualizada", slaHours: "6" },
      tenant.id,
    );

    assert.ok(updated, "debe devolver la etapa actualizada");
    assert.equal(updated!.name, "Actualizada");
    assert.equal(Number(updated!.slaHours), 6);
    assert.equal(updated!.tenantId, tenant.id);
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("updateRouteStage: no afecta etapas de otro tenant", async () => {
  const tenantA = await makeTenant("upd-iso-a");
  const tenantB = await makeTenant("upd-iso-b");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenantA.id,
      name: "Etapa A",
      sortOrder: 0,
    });

    const result = await storage.updateRouteStage(stage.id, { name: "Hackeada" }, tenantB.id);
    assert.equal(result, undefined, "un tenant no puede editar etapas de otro");

    const unchanged = await storage.getRouteStage(stage.id, tenantA.id);
    assert.equal(unchanged!.name, "Etapa A");
  } finally {
    await cleanupTenant(tenantA.id);
    await cleanupTenant(tenantB.id);
  }
});

test("deleteRouteStage: elimina la etapa correctamente", async () => {
  const tenant = await makeTenant("delete");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "Para Eliminar",
      sortOrder: 0,
    });

    const deleted = await storage.deleteRouteStage(stage.id, tenant.id);
    assert.equal(deleted, true);

    const fetched = await storage.getRouteStage(stage.id, tenant.id);
    assert.equal(fetched, undefined, "la etapa no debe existir tras eliminarse");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("deleteRouteStage: lanza error 409 si hay rutas activas en la etapa", async () => {
  const tenant = await makeTenant("del-active");
  const user = await makeUser(tenant.id, "del-active");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "Etapa Ocupada",
      sortOrder: 0,
    });

    // Crear ruta en progreso asignada a esta etapa
    const [route] = await db
      .insert(routes)
      .values({
        tenantId: tenant.id,
        date: new Date(),
        supplierId: user.id,
        status: "en_progreso",
        currentStageId: stage.id,
      })
      .returning();

    await assert.rejects(
      () => storage.deleteRouteStage(stage.id, tenant.id),
      (err: Error) => {
        assert.ok(err.message.includes("rutas activas"), `mensaje inesperado: ${err.message}`);
        return true;
      },
      "debe lanzar error si la etapa tiene rutas activas",
    );

    // Cleanup manual (ruta antes de la etapa)
    await db.delete(routes).where(eq(routes.id, route.id));
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("reorderRouteStages: actualiza el sortOrder de cada etapa", async () => {
  const tenant = await makeTenant("reorder");
  try {
    const s1 = await storage.createRouteStage({ tenantId: tenant.id, name: "Primero", sortOrder: 0 });
    const s2 = await storage.createRouteStage({ tenantId: tenant.id, name: "Segundo", sortOrder: 1 });
    const s3 = await storage.createRouteStage({ tenantId: tenant.id, name: "Tercero", sortOrder: 2 });

    // Invertir el orden
    await storage.reorderRouteStages([s3.id, s2.id, s1.id], tenant.id);

    const stages = await storage.getRouteStages(tenant.id);
    assert.equal(stages[0].id, s3.id, "s3 debe ser primero");
    assert.equal(stages[1].id, s2.id, "s2 debe ser segundo");
    assert.equal(stages[2].id, s1.id, "s1 debe ser tercero");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("deleteRouteStage: no elimina etapas de otro tenant (aislamiento)", async () => {
  const tenantA = await makeTenant("del-iso-a");
  const tenantB = await makeTenant("del-iso-b");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenantA.id,
      name: "Etapa de A",
      sortOrder: 0,
    });

    const deleted = await storage.deleteRouteStage(stage.id, tenantB.id);
    assert.equal(deleted, false, "tenantB no debe poder eliminar etapas de tenantA");

    const stillExists = await storage.getRouteStage(stage.id, tenantA.id);
    assert.ok(stillExists, "la etapa de tenantA debe seguir existiendo");
  } finally {
    await cleanupTenant(tenantA.id);
    await cleanupTenant(tenantB.id);
  }
});

test("reorderRouteStages: no afecta etapas de otro tenant (aislamiento)", async () => {
  const tenantA = await makeTenant("reorder-iso-a");
  const tenantB = await makeTenant("reorder-iso-b");
  try {
    const s1 = await storage.createRouteStage({ tenantId: tenantA.id, name: "A-1", sortOrder: 0 });
    const s2 = await storage.createRouteStage({ tenantId: tenantA.id, name: "A-2", sortOrder: 1 });

    // tenantB intenta reordenar etapas de tenantA — las cláusulas WHERE incluyen tenantId,
    // por lo que la actualización no debe afectar ninguna fila de tenantA.
    await storage.reorderRouteStages([s2.id, s1.id], tenantB.id);

    const stagesA = await storage.getRouteStages(tenantA.id);
    assert.equal(stagesA[0].id, s1.id, "el orden original de tenantA no debe cambiar");
    assert.equal(stagesA[1].id, s2.id, "el orden original de tenantA no debe cambiar");
  } finally {
    await cleanupTenant(tenantA.id);
    await cleanupTenant(tenantB.id);
  }
});

// ─── advanceRouteStage ────────────────────────────────────────────────────────

test("advanceRouteStage: crea log entry y cierra la anterior en una transacción", async () => {
  const tenant = await makeTenant("advance");
  const user = await makeUser(tenant.id, "advance");
  try {
    const stage1 = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "Inicio",
      sortOrder: 0,
      slaHours: "2",
    });
    const stage2 = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "En Ruta",
      sortOrder: 1,
      slaHours: "4",
    });

    const route = await makeRoute(tenant.id, user.id);

    // Avanzar a stage1 primero
    await storage.advanceRouteStage(route.id, stage1.id, user.id, "Inicio de ruta");

    // Verificar que hay un log entry abierto para stage1
    const logAfterFirst = await storage.getRouteStageLog(route.id);
    assert.equal(logAfterFirst.length, 1);
    assert.equal(logAfterFirst[0].stageId, stage1.id);
    assert.equal(logAfterFirst[0].exitedAt, null, "log entry debe estar abierto");

    // Avanzar a stage2
    const updatedRoute = await storage.advanceRouteStage(
      route.id,
      stage2.id,
      user.id,
      "Salió a ruta",
    );

    assert.ok(updatedRoute, "debe devolver la ruta actualizada");
    assert.equal(updatedRoute!.currentStageId, stage2.id);
    assert.ok(updatedRoute!.currentStageEnteredAt, "debe registrar la hora de entrada");

    const logAfterSecond = await storage.getRouteStageLog(route.id);
    assert.equal(logAfterSecond.length, 2, "debe haber 2 entradas de log");

    const firstEntry = logAfterSecond.find(e => e.stageId === stage1.id);
    const secondEntry = logAfterSecond.find(e => e.stageId === stage2.id);

    assert.ok(firstEntry, "debe existir entrada de stage1");
    assert.ok(firstEntry!.exitedAt, "log de stage1 debe estar cerrado (exitedAt)");
    assert.equal(secondEntry!.exitedAt, null, "log de stage2 debe estar abierto");
    assert.equal(secondEntry!.notes, "Salió a ruta");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("advanceRouteStage: establece slaStatus=dentro_tiempo cuando la etapa tiene SLA", async () => {
  const tenant = await makeTenant("adv-sla");
  const user = await makeUser(tenant.id, "adv-sla");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "Con SLA",
      sortOrder: 0,
      slaHours: "8",
    });

    const route = await makeRoute(tenant.id, user.id);
    const updated = await storage.advanceRouteStage(route.id, stage.id, user.id);

    assert.equal(
      updated!.slaStatus,
      "dentro_tiempo",
      "slaStatus debe ser dentro_tiempo al entrar a una etapa con SLA",
    );
    assert.equal(
      updated!.lastAlertedSlaStatus,
      null,
      "lastAlertedSlaStatus debe resetearse al avanzar de etapa",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("advanceRouteStage: establece slaStatus=sin_sla cuando la etapa no tiene SLA", async () => {
  const tenant = await makeTenant("adv-nosla");
  const user = await makeUser(tenant.id, "adv-nosla");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "Sin SLA",
      sortOrder: 0,
      slaHours: null,
    });

    const route = await makeRoute(tenant.id, user.id);
    const updated = await storage.advanceRouteStage(route.id, stage.id, user.id);

    assert.equal(
      updated!.slaStatus,
      "sin_sla",
      "slaStatus debe ser sin_sla cuando la etapa no tiene slaHours configurado",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("advanceRouteStage: devuelve undefined si la ruta no existe", async () => {
  const tenant = await makeTenant("adv-noroute");
  const user = await makeUser(tenant.id, "adv-noroute");
  try {
    const stage = await storage.createRouteStage({
      tenantId: tenant.id,
      name: "Etapa",
      sortOrder: 0,
    });

    const result = await storage.advanceRouteStage(
      "00000000-0000-0000-0000-000000000000",
      stage.id,
      user.id,
    );
    assert.equal(result, undefined, "debe devolver undefined si la ruta no existe");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("advanceRouteStage: devuelve undefined si la etapa no existe", async () => {
  const tenant = await makeTenant("adv-nostage");
  const user = await makeUser(tenant.id, "adv-nostage");
  try {
    const route = await makeRoute(tenant.id, user.id);
    const result = await storage.advanceRouteStage(
      route.id,
      "00000000-0000-0000-0000-000000000000",
      user.id,
    );
    assert.equal(result, undefined, "debe devolver undefined si la etapa no existe");
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test.after(async () => {
  await pool.end();
});
