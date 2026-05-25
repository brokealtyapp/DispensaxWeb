import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import cookieParser from "cookie-parser";
import { eq } from "drizzle-orm";

import { db, pool } from "./db";
import { registerRoutes } from "./routes";
import { signAccessToken } from "./auth";
import {
  tenants,
  users,
  routes,
  routeStages,
  routeStageLog,
  routeActionPermissions,
} from "@shared/schema";

// ─── Server setup ────────────────────────────────────────────────────────────

let baseUrl: string;
let testHttpServer: ReturnType<typeof createServer>;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  testHttpServer = createServer(app);
  await registerRoutes(testHttpServer, app);
  await new Promise<void>((resolve) => testHttpServer.listen(0, "127.0.0.1", resolve));
  const addr = testHttpServer.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  // Destroy keep-alive connections so server.close() resolves promptly.
  testHttpServer?.closeAllConnections?.();
  await new Promise<void>((resolve) => testHttpServer.close(() => resolve()));
  await pool.end();
});

// ─── Fixture helpers ─────────────────────────────────────────────────────────

async function makeTenant(suffix: string) {
  const slug = `test-http-stages-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `HTTP Tenant ${suffix}`, slug })
    .returning();
  return tenant;
}

async function makeAdminUser(tenantId: string, suffix: string) {
  const username = `admin-http-${suffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const [user] = await db
    .insert(users)
    .values({ tenantId, username, password: "x", role: "admin" })
    .returning();
  return user;
}

function makeToken(userId: string, tenantId: string, role = "admin") {
  return signAccessToken({ userId, username: "test", role, tenantId, isSuperAdmin: false });
}

async function cleanupTenant(tenantId: string) {
  await db.delete(routeStageLog).where(eq(routeStageLog.tenantId, tenantId));
  await db.delete(routes).where(eq(routes.tenantId, tenantId));
  await db.delete(routeActionPermissions).where(eq(routeActionPermissions.tenantId, tenantId));
  await db.delete(routeStages).where(eq(routeStages.tenantId, tenantId));
  await db.delete(users).where(eq(users.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

// ─── Autenticación ───────────────────────────────────────────────────────────

test("HTTP GET /api/supplier/route-stages: rechaza petición sin token (401)", async () => {
  const res = await fetch(`${baseUrl}/api/supplier/route-stages`);
  assert.equal(res.status, 401);
});

// ─── GET: aislamiento de lectura ─────────────────────────────────────────────

test("HTTP GET /api/supplier/route-stages: tenantB no ve etapas de tenantA", async () => {
  const tA = await makeTenant("get-a");
  const tB = await makeTenant("get-b");
  try {
    await db
      .insert(routeStages)
      .values({ tenantId: tA.id, name: "Etapa Secreta A", sortOrder: 0 });

    const userB = await makeAdminUser(tB.id, "get-b");
    const tokenB = makeToken(userB.id, tB.id);

    const res = await fetch(`${baseUrl}/api/supplier/route-stages`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as Array<{ tenantId: string }>;
    assert.ok(Array.isArray(data), "debe devolver un array");
    const leaked = data.filter((s) => s.tenantId === tA.id);
    assert.equal(leaked.length, 0, "tenantB no debe recibir etapas de tenantA");
  } finally {
    await cleanupTenant(tA.id);
    await cleanupTenant(tB.id);
  }
});

// ─── POST: la etapa se crea para el tenant del token ─────────────────────────

test("HTTP POST /api/supplier/route-stages: crea etapa solo para el tenant del token", async () => {
  const tA = await makeTenant("post-a");
  try {
    const userA = await makeAdminUser(tA.id, "post-a");
    const tokenA = makeToken(userA.id, tA.id);

    const res = await fetch(`${baseUrl}/api/supplier/route-stages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Nueva Etapa", sortOrder: 0 }),
    });

    assert.equal(res.status, 201);
    const stage = (await res.json()) as { tenantId: string };
    assert.equal(
      stage.tenantId,
      tA.id,
      "la etapa creada debe pertenecer al tenant del token, no a otro",
    );
  } finally {
    await cleanupTenant(tA.id);
  }
});

// ─── PATCH: aislamiento de escritura ─────────────────────────────────────────

test("HTTP PATCH /api/supplier/route-stages/:id: tenantB no puede editar etapa de tenantA (404)", async () => {
  const tA = await makeTenant("patch-a");
  const tB = await makeTenant("patch-b");
  try {
    const [stageA] = await db
      .insert(routeStages)
      .values({ tenantId: tA.id, name: "Etapa Original A", sortOrder: 0 })
      .returning();

    const userB = await makeAdminUser(tB.id, "patch-b");
    const tokenB = makeToken(userB.id, tB.id);

    const res = await fetch(`${baseUrl}/api/supplier/route-stages/${stageA.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Nombre Hackeado" }),
    });

    assert.equal(res.status, 404, "tenantB no debe poder editar etapas de tenantA");

    const [unchanged] = await db
      .select()
      .from(routeStages)
      .where(eq(routeStages.id, stageA.id));
    assert.equal(unchanged.name, "Etapa Original A", "el nombre original no debe cambiar");
  } finally {
    await cleanupTenant(tA.id);
    await cleanupTenant(tB.id);
  }
});

// ─── DELETE: aislamiento de borrado ──────────────────────────────────────────

test("HTTP DELETE /api/supplier/route-stages/:id: tenantB no puede eliminar etapa de tenantA (404)", async () => {
  const tA = await makeTenant("del-a");
  const tB = await makeTenant("del-b");
  try {
    const [stageA] = await db
      .insert(routeStages)
      .values({ tenantId: tA.id, name: "Etapa Para No Borrar", sortOrder: 0 })
      .returning();

    const userB = await makeAdminUser(tB.id, "del-b");
    const tokenB = makeToken(userB.id, tB.id);

    const res = await fetch(`${baseUrl}/api/supplier/route-stages/${stageA.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    assert.equal(res.status, 404, "tenantB no debe poder eliminar etapas de tenantA");

    const [stillExists] = await db
      .select()
      .from(routeStages)
      .where(eq(routeStages.id, stageA.id));
    assert.ok(stillExists, "la etapa de tenantA debe seguir existiendo tras el intento de borrado");
  } finally {
    await cleanupTenant(tA.id);
    await cleanupTenant(tB.id);
  }
});

// ─── REORDER: tenantB no puede reordenar etapas de tenantA ───────────────────

test("HTTP POST /api/supplier/route-stages/reorder: tenantB no afecta el orden de etapas de tenantA", async () => {
  const tA = await makeTenant("reorder-a");
  const tB = await makeTenant("reorder-b");
  try {
    const [s1] = await db
      .insert(routeStages)
      .values({ tenantId: tA.id, name: "Primera A", sortOrder: 0 })
      .returning();
    const [s2] = await db
      .insert(routeStages)
      .values({ tenantId: tA.id, name: "Segunda A", sortOrder: 1 })
      .returning();

    const userB = await makeAdminUser(tB.id, "reorder-b");
    const tokenB = makeToken(userB.id, tB.id);

    const res = await fetch(`${baseUrl}/api/supplier/route-stages/reorder`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: [s2.id, s1.id] }),
    });

    assert.equal(res.status, 200, "el endpoint debe responder 200 (operación no-op para tenantB)");

    const stagesA = await db
      .select()
      .from(routeStages)
      .where(eq(routeStages.tenantId, tA.id))
      .orderBy(routeStages.sortOrder);

    assert.equal(stagesA[0].id, s1.id, "el orden de tenantA no debe haber cambiado");
    assert.equal(stagesA[1].id, s2.id, "el orden de tenantA no debe haber cambiado");
  } finally {
    await cleanupTenant(tA.id);
    await cleanupTenant(tB.id);
  }
});

// ─── advance-stage: tenantB no puede avanzar ruta de tenantA ─────────────────

test("HTTP POST /api/supplier/routes/:id/advance-stage: tenantB no puede avanzar ruta de tenantA (404)", async () => {
  const tA = await makeTenant("adv-a");
  const tB = await makeTenant("adv-b");
  try {
    const userA = await makeAdminUser(tA.id, "adv-a");
    const [stageA] = await db
      .insert(routeStages)
      .values({ tenantId: tA.id, name: "Etapa Avanzar A", sortOrder: 0 })
      .returning();
    const [routeA] = await db
      .insert(routes)
      .values({
        tenantId: tA.id,
        name: "Ruta Advance Test",
        date: new Date(),
        supplierId: userA.id,
        status: "activa",
      })
      .returning();

    const userB = await makeAdminUser(tB.id, "adv-b");
    const tokenB = makeToken(userB.id, tB.id);

    const res = await fetch(`${baseUrl}/api/supplier/routes/${routeA.id}/advance-stage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newStageId: stageA.id }),
    });

    assert.equal(
      res.status,
      404,
      "tenantB no debe poder avanzar una ruta de tenantA — debe recibir 404",
    );
  } finally {
    await cleanupTenant(tA.id);
    await cleanupTenant(tB.id);
  }
});

// ─── advance-stage: la etapa debe pertenecer al mismo tenant ─────────────────

test("HTTP POST advance-stage: bloquea avance si la etapa no pertenece al tenant de la ruta", async () => {
  const tA = await makeTenant("cross-a");
  const tB = await makeTenant("cross-b");
  try {
    const userA = await makeAdminUser(tA.id, "cross-a");
    const [routeA] = await db
      .insert(routes)
      .values({
        tenantId: tA.id,
        name: "Ruta Cross Test",
        date: new Date(),
        supplierId: userA.id,
        status: "activa",
      })
      .returning();

    const [stageB] = await db
      .insert(routeStages)
      .values({ tenantId: tB.id, name: "Etapa de B", sortOrder: 0 })
      .returning();

    const tokenA = makeToken(userA.id, tA.id);

    const res = await fetch(`${baseUrl}/api/supplier/routes/${routeA.id}/advance-stage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newStageId: stageB.id }),
    });

    assert.ok(
      res.status === 404 || res.status === 400 || res.status === 403,
      `debe rechazar el avance con una etapa de otro tenant (recibió ${res.status})`,
    );
  } finally {
    await cleanupTenant(tA.id);
    await cleanupTenant(tB.id);
  }
});
