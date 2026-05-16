import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { db, pool } from "./db";
import { storage } from "./storage";
import { checkAndSendRouteAlerts } from "./routeAlertService";
import {
  tenants,
  users,
  routes,
  routeStages,
  routeStageLog,
  routeModuleAlertConfig,
} from "@shared/schema";

// ─── SMTP isolation ───────────────────────────────────────────────────────────
// Ensure no real SMTP calls are made during tests. isEmailConfigured() reads
// these env vars at call time, so clearing them here forces sendRouteAlertEmail
// to return early (before calling transporter.sendMail) for every test.

const _savedSmtp = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
};
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASSWORD;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

async function makeTenant(suffix: string) {
  const slug = `test-alerts-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Tenant Alerts ${suffix}`, slug })
    .returning();
  return tenant;
}

async function makeAdminUser(tenantId: string, suffix: string) {
  const username = `admin-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      username,
      password: "x",
      role: "admin",
      email: `${username}@test.example`,
    })
    .returning();
  return user;
}

async function makeStage(
  tenantId: string,
  opts: {
    slaHours?: number;
    alertOnSlaWarning?: boolean;
    alertOnSlaExpired?: boolean;
    thresholdPct?: number;
  } = {},
) {
  const [stage] = await db
    .insert(routeStages)
    .values({
      tenantId,
      name: `Etapa-${Math.random().toString(36).slice(2, 6)}`,
      sortOrder: 0,
      slaHours: opts.slaHours !== undefined ? String(opts.slaHours) : null,
      alertOnSlaWarning: opts.alertOnSlaWarning ?? false,
      alertOnSlaExpired: opts.alertOnSlaExpired ?? false,
      slaAlertThresholdPct: opts.thresholdPct ?? 80,
    })
    .returning();
  return stage;
}

async function makeRoute(
  tenantId: string,
  supplierId: string,
  stageId: string,
  enteredAt: Date,
  lastAlertedSlaStatus?: string | null,
) {
  const [route] = await db
    .insert(routes)
    .values({
      tenantId,
      date: new Date(),
      supplierId,
      status: "en_progreso",
      currentStageId: stageId,
      currentStageEnteredAt: enteredAt,
      lastAlertedSlaStatus: lastAlertedSlaStatus ?? null,
    })
    .returning();
  return route;
}

async function fetchRoute(id: string) {
  const [row] = await db.select().from(routes).where(eq(routes.id, id));
  return row;
}

async function cleanupTenant(tenantId: string) {
  await db
    .delete(routeModuleAlertConfig)
    .where(eq(routeModuleAlertConfig.tenantId, tenantId));
  await db
    .delete(routeStageLog)
    .where(eq(routeStageLog.tenantId, tenantId));
  await db.delete(routes).where(eq(routes.tenantId, tenantId));
  await db.delete(routeStages).where(eq(routeStages.tenantId, tenantId));
  await db.delete(users).where(eq(users.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("checkAndSendRouteAlerts: no alerta cuando la ruta está dentro_tiempo", async () => {
  const tenant = await makeTenant("dt");
  const admin = await makeAdminUser(tenant.id, "dt");
  try {
    // SLA 4h, threshold 80%, entró hace 1h → 25% usado → dentro_tiempo
    const stage = await makeStage(tenant.id, {
      slaHours: 4,
      alertOnSlaWarning: true,
      alertOnSlaExpired: true,
    });
    const route = await makeRoute(tenant.id, admin.id, stage.id, hoursAgo(1));

    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      null,
      "no debe establecer lastAlertedSlaStatus cuando la ruta está dentro del tiempo SLA",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: alerta proximo_vencer cuando alertOnSlaWarning=true", async () => {
  const tenant = await makeTenant("warn-on");
  const admin = await makeAdminUser(tenant.id, "warn-on");
  try {
    // SLA 4h, threshold 80%, entró hace 3.5h → 87.5% → proximo_vencer
    const stage = await makeStage(tenant.id, {
      slaHours: 4,
      alertOnSlaWarning: true,
      alertOnSlaExpired: false,
      thresholdPct: 80,
    });
    const route = await makeRoute(tenant.id, admin.id, stage.id, hoursAgo(3.5));

    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      "proximo_vencer",
      "debe registrar lastAlertedSlaStatus=proximo_vencer cuando alertOnSlaWarning está activo",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: sin alerta proximo_vencer cuando alertOnSlaWarning=false", async () => {
  const tenant = await makeTenant("warn-off");
  const admin = await makeAdminUser(tenant.id, "warn-off");
  try {
    // SLA 4h, threshold 80%, entró hace 3.5h → proximo_vencer, pero flag desactivado
    const stage = await makeStage(tenant.id, {
      slaHours: 4,
      alertOnSlaWarning: false,
      alertOnSlaExpired: false,
      thresholdPct: 80,
    });
    const route = await makeRoute(tenant.id, admin.id, stage.id, hoursAgo(3.5));

    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      null,
      "no debe alertar cuando alertOnSlaWarning=false aunque el SLA esté próximo a vencer",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: alerta vencido cuando alertOnSlaExpired=true", async () => {
  const tenant = await makeTenant("exp-on");
  const admin = await makeAdminUser(tenant.id, "exp-on");
  try {
    // SLA 4h, entró hace 5h → vencido
    const stage = await makeStage(tenant.id, {
      slaHours: 4,
      alertOnSlaWarning: false,
      alertOnSlaExpired: true,
    });
    const route = await makeRoute(tenant.id, admin.id, stage.id, hoursAgo(5));

    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      "vencido",
      "debe registrar lastAlertedSlaStatus=vencido cuando alertOnSlaExpired está activo",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: alerta vencido por globalAlertOnExpiry aunque alertOnSlaExpired=false", async () => {
  const tenant = await makeTenant("global-exp");
  const admin = await makeAdminUser(tenant.id, "global-exp");
  try {
    // globalAlertOnExpiry=true (default), alertOnSlaExpired=false a nivel etapa
    const stage = await makeStage(tenant.id, {
      slaHours: 4,
      alertOnSlaWarning: false,
      alertOnSlaExpired: false,
    });
    const route = await makeRoute(tenant.id, admin.id, stage.id, hoursAgo(5));

    // No upsert de config → usa defaults (globalAlertOnExpiry=true)
    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      "vencido",
      "debe alertar vencido por globalAlertOnExpiry aunque la etapa tenga alertOnSlaExpired=false",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: sin alerta vencido cuando globalAlertOnExpiry=false y alertOnSlaExpired=false", async () => {
  const tenant = await makeTenant("global-off");
  const admin = await makeAdminUser(tenant.id, "global-off");
  try {
    const stage = await makeStage(tenant.id, {
      slaHours: 4,
      alertOnSlaWarning: false,
      alertOnSlaExpired: false,
    });
    const route = await makeRoute(tenant.id, admin.id, stage.id, hoursAgo(5));

    // Deshabilitar el flag global
    await storage.upsertRouteModuleAlertConfig(tenant.id, {
      globalAlertOnExpiry: false,
      alertRecipientsJson: JSON.stringify(["all_admins"]),
    });

    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      null,
      "no debe alertar cuando tanto globalAlertOnExpiry como alertOnSlaExpired son false",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: no reenvía alerta cuando lastAlertedSlaStatus ya coincide (deduplicación)", async () => {
  const tenant = await makeTenant("dedup");
  const admin = await makeAdminUser(tenant.id, "dedup");
  try {
    // Ruta ya alertada por vencido
    const stage = await makeStage(tenant.id, {
      slaHours: 4,
      alertOnSlaWarning: false,
      alertOnSlaExpired: true,
    });
    const route = await makeRoute(
      tenant.id,
      admin.id,
      stage.id,
      hoursAgo(5),
      "vencido", // ya fue alertada
    );

    // Registrar el timestamp original para verificar que no se toca
    const before = await fetchRoute(route.id);

    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      "vencido",
      "debe mantener el estado existente sin duplicar la alerta",
    );
    assert.deepEqual(
      updated.lastAlertSentAt,
      before.lastAlertSentAt,
      "lastAlertSentAt no debe actualizarse si ya fue alertada para este estado",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: envía alerta al pasar de proximo_vencer a vencido (transición de estado)", async () => {
  const tenant = await makeTenant("transition");
  const admin = await makeAdminUser(tenant.id, "transition");
  try {
    // La ruta fue alertada por proximo_vencer anteriormente, ahora ya está vencida
    const stage = await makeStage(tenant.id, {
      slaHours: 4,
      alertOnSlaWarning: true,
      alertOnSlaExpired: true,
    });
    const route = await makeRoute(
      tenant.id,
      admin.id,
      stage.id,
      hoursAgo(5), // vencido (5h > SLA 4h)
      "proximo_vencer", // último estado alertado
    );

    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      "vencido",
      "debe actualizar lastAlertedSlaStatus a vencido al transicionar desde proximo_vencer",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: sin alerta cuando no hay rutas activas", async () => {
  const tenant = await makeTenant("empty");
  await makeAdminUser(tenant.id, "empty");
  try {
    // No se crean rutas
    await checkAndSendRouteAlerts(tenant.id);
    // Solo verifica que no lanza error
  } finally {
    await cleanupTenant(tenant.id);
  }
});

test("checkAndSendRouteAlerts: no procesa rutas sin currentStageId o currentStageEnteredAt", async () => {
  const tenant = await makeTenant("no-stage");
  const admin = await makeAdminUser(tenant.id, "no-stage");
  try {
    // Ruta sin etapa actual (sin currentStageId)
    const [route] = await db
      .insert(routes)
      .values({
        tenantId: tenant.id,
        date: new Date(),
        supplierId: admin.id,
        status: "en_progreso",
        currentStageId: null,
        currentStageEnteredAt: null,
      })
      .returning();

    await checkAndSendRouteAlerts(tenant.id);

    const updated = await fetchRoute(route.id);
    assert.equal(
      updated.lastAlertedSlaStatus,
      null,
      "no debe tocar rutas sin etapa o sin enteredAt",
    );
  } finally {
    await cleanupTenant(tenant.id);
  }
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

test.after(async () => {
  if (_savedSmtp.SMTP_HOST) process.env.SMTP_HOST = _savedSmtp.SMTP_HOST;
  if (_savedSmtp.SMTP_USER) process.env.SMTP_USER = _savedSmtp.SMTP_USER;
  if (_savedSmtp.SMTP_PASSWORD) process.env.SMTP_PASSWORD = _savedSmtp.SMTP_PASSWORD;
  await pool.end();
});
