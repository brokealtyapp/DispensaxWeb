import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  establishments,
  locations,
  machines,
  users,
  establishmentViewers,
  machineViewerAssignments,
  tenantInvites,
} from "../shared/schema";

const TENANT_ID = "717d5e1f-7a58-42f6-b4cc-95cb58c2270f";
const VIEWER_ROLE = "visor_establecimiento";
const DEMO_PASSWORD = "visor123";

type EstablishmentSeed = {
  establishmentName: string;
  locationName: string;
  city: string;
  zone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  commissionPercent: string;
  machines: Array<{ name: string; type: string }>;
  viewer?: {
    username: string;
    fullName: string;
    email: string;
    phone: string;
    commissionPercent: string;
    machineCount: number;
  };
  pendingInvite?: {
    email: string;
    contactName: string;
    phone: string;
    commissionPercent: string;
  };
};

const SEEDS: EstablishmentSeed[] = [
  {
    establishmentName: "Test Colmado",
    locationName: "Colmado La Esquina",
    city: "Santo Domingo",
    zone: "Naco",
    contactName: "Juan Pérez",
    contactEmail: "juan.colmado@demo.dispensax.com",
    contactPhone: "+1 809-555-0101",
    commissionPercent: "5.00",
    machines: [
      { name: "Bebidas - Colmado La Esquina", type: "bebidas" },
      { name: "Snacks - Colmado La Esquina", type: "snacks" },
    ],
    viewer: {
      username: "dueno_colmado",
      fullName: "Juan Pérez (Dueño Colmado)",
      email: "dueno.colmado@demo.dispensax.com",
      phone: "+1 809-555-0101",
      commissionPercent: "5.00",
      machineCount: 2,
    },
  },
  {
    establishmentName: "Test Sin Fecha",
    locationName: "Supermercado El Ahorro",
    city: "Santiago",
    zone: "Centro",
    contactName: "María Rodríguez",
    contactEmail: "maria.super@demo.dispensax.com",
    contactPhone: "+1 809-555-0202",
    commissionPercent: "7.00",
    machines: [
      { name: "Bebidas - Supermercado El Ahorro", type: "bebidas" },
      { name: "Mixta - Supermercado El Ahorro", type: "mixta" },
    ],
    viewer: {
      username: "dueno_super",
      fullName: "María Rodríguez (Dueña Super)",
      email: "dueno.super@demo.dispensax.com",
      phone: "+1 809-555-0202",
      commissionPercent: "7.00",
      machineCount: 1,
    },
  },
  {
    establishmentName: "Test Prox Accion",
    locationName: "Cafetería Universitaria",
    city: "Santo Domingo",
    zone: "Universitaria",
    contactName: "Pedro Martínez",
    contactEmail: "pedro.cafe@demo.dispensax.com",
    contactPhone: "+1 809-555-0303",
    commissionPercent: "6.00",
    machines: [{ name: "Mixta - Cafetería Universitaria", type: "mixta" }],
    // Sin viewer activo a propósito; en su lugar se crea una invitación
    // pendiente (tenant_invites) para mostrar ese estado en la UI.
    pendingInvite: {
      email: "pendiente.cafe@demo.dispensax.com",
      contactName: "Pedro Martínez",
      phone: "+1 809-555-0303",
      commissionPercent: "6.00",
    },
  },
];

const counters = {
  locationsCreated: 0,
  locationsSkipped: 0,
  establishmentsConverted: 0,
  establishmentsSkipped: 0,
  machinesCreated: 0,
  machinesSkipped: 0,
  usersCreated: 0,
  usersSkipped: 0,
  viewersCreated: 0,
  viewersSkipped: 0,
  assignmentsCreated: 0,
  assignmentsSkipped: 0,
  invitesCreated: 0,
  invitesSkipped: 0,
  orphansFixed: 0,
};

async function upsertLocation(seed: EstablishmentSeed): Promise<string> {
  const existing = await db
    .select()
    .from(locations)
    .where(
      and(eq(locations.tenantId, TENANT_ID), eq(locations.name, seed.locationName)),
    );
  if (existing[0]) {
    const loc = existing[0];
    const needsFix =
      loc.city !== seed.city ||
      loc.zone !== seed.zone ||
      loc.contactName !== seed.contactName ||
      loc.contactPhone !== seed.contactPhone;
    if (needsFix) {
      await db
        .update(locations)
        .set({
          city: seed.city,
          zone: seed.zone,
          contactName: seed.contactName,
          contactPhone: seed.contactPhone,
        })
        .where(eq(locations.id, loc.id));
    }
    counters.locationsSkipped++;
    return loc.id;
  }
  const [created] = await db
    .insert(locations)
    .values({
      tenantId: TENANT_ID,
      name: seed.locationName,
      city: seed.city,
      zone: seed.zone,
      contactName: seed.contactName,
      contactPhone: seed.contactPhone,
    })
    .returning();
  counters.locationsCreated++;
  return created.id;
}

async function convertEstablishment(seed: EstablishmentSeed, locationId: string) {
  const existing = await db
    .select()
    .from(establishments)
    .where(
      and(
        eq(establishments.tenantId, TENANT_ID),
        eq(establishments.name, seed.establishmentName),
      ),
    );
  if (!existing[0]) {
    counters.establishmentsSkipped++;
    return null;
  }
  const est = existing[0];
  if (est.convertedToLocationId === locationId) {
    counters.establishmentsSkipped++;
    return est.id;
  }
  await db
    .update(establishments)
    .set({
      convertedToLocationId: locationId,
      convertedAt: est.convertedAt ?? new Date(),
      isActive: true,
      status: "activo",
      contactName: est.contactName ?? seed.contactName,
      contactEmail: est.contactEmail ?? seed.contactEmail,
      contactPhone: est.contactPhone ?? seed.contactPhone,
      city: est.city ?? seed.city,
      zone: est.zone ?? seed.zone,
      commissionPercent: seed.commissionPercent,
      updatedAt: new Date(),
    })
    .where(eq(establishments.id, est.id));
  counters.establishmentsConverted++;
  return est.id;
}

async function upsertMachines(seed: EstablishmentSeed, locationId: string) {
  const created: string[] = [];
  for (const m of seed.machines) {
    const existing = await db
      .select()
      .from(machines)
      .where(and(eq(machines.tenantId, TENANT_ID), eq(machines.name, m.name)));
    if (existing[0]) {
      const machine = existing[0];
      const needsFix =
        machine.locationId !== locationId ||
        machine.zone !== seed.zone ||
        machine.type !== m.type ||
        machine.isActive !== true;
      if (needsFix) {
        await db
          .update(machines)
          .set({
            locationId,
            zone: seed.zone,
            type: m.type,
            isActive: true,
          })
          .where(eq(machines.id, machine.id));
      }
      counters.machinesSkipped++;
      created.push(machine.id);
      continue;
    }
    const [row] = await db
      .insert(machines)
      .values({
        tenantId: TENANT_ID,
        name: m.name,
        type: m.type,
        status: "operando",
        locationId,
        zone: seed.zone,
        isActive: true,
      })
      .returning();
    counters.machinesCreated++;
    created.push(row.id);
  }
  return created;
}

async function upsertUser(viewer: NonNullable<EstablishmentSeed["viewer"]>) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, viewer.username));
  if (existing[0]) {
    const u = existing[0];
    const needsFix =
      u.role !== VIEWER_ROLE ||
      u.isActive !== true ||
      u.email !== viewer.email ||
      u.tenantId !== TENANT_ID ||
      u.fullName !== viewer.fullName;
    if (needsFix) {
      await db
        .update(users)
        .set({
          role: VIEWER_ROLE,
          isActive: true,
          email: viewer.email,
          tenantId: TENANT_ID,
          fullName: viewer.fullName,
        })
        .where(eq(users.id, u.id));
    }
    counters.usersSkipped++;
    return u.id;
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [row] = await db
    .insert(users)
    .values({
      tenantId: TENANT_ID,
      username: viewer.username,
      password: passwordHash,
      fullName: viewer.fullName,
      email: viewer.email,
      role: VIEWER_ROLE,
      isActive: true,
    })
    .returning();
  counters.usersCreated++;
  return row.id;
}

async function upsertPendingInvite(
  seed: EstablishmentSeed,
  establishmentId: string,
  machineIds: string[],
) {
  const invite = seed.pendingInvite!;
  // Idempotencia: buscar invitación pendiente (sin acceptedAt) para
  // este establishment_id en metadata.
  const existing = await db
    .select()
    .from(tenantInvites)
    .where(
      and(
        eq(tenantInvites.tenantId, TENANT_ID),
        eq(tenantInvites.role, VIEWER_ROLE),
        sql`accepted_at IS NULL`,
        sql`metadata->>'establishmentId' = ${establishmentId}`,
      ),
    )
    .orderBy(desc(tenantInvites.createdAt));
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  if (existing[0]) {
    // Si la invitación pendiente existe pero ya expiró, rotamos token y
    // expiresAt para que el estado "Invitación pendiente" siga válido en
    // la UI tras re-runs lejanos en el tiempo.
    if (existing[0].expiresAt && new Date(existing[0].expiresAt) <= new Date()) {
      const newToken = crypto.randomBytes(32).toString("hex");
      await db
        .update(tenantInvites)
        .set({ token: newToken, expiresAt })
        .where(eq(tenantInvites.id, existing[0].id));
    }
    counters.invitesSkipped++;
    return existing[0].id;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const [row] = await db
    .insert(tenantInvites)
    .values({
      tenantId: TENANT_ID,
      email: invite.email,
      role: VIEWER_ROLE,
      token,
      expiresAt,
      metadata: {
        viewerType: "establishment",
        establishmentName: seed.locationName,
        contactName: invite.contactName,
        phone: invite.phone,
        machineIds,
        commissionPercent: invite.commissionPercent,
        establishmentId,
      },
    })
    .returning();
  counters.invitesCreated++;
  return row.id;
}

async function upsertViewer(
  seed: EstablishmentSeed,
  establishmentId: string,
  userId: string,
) {
  const viewer = seed.viewer!;
  const existing = await db
    .select()
    .from(establishmentViewers)
    .where(
      and(
        eq(establishmentViewers.tenantId, TENANT_ID),
        eq(establishmentViewers.userId, userId),
      ),
    );
  if (existing[0]) {
    if (
      existing[0].establishmentId !== establishmentId ||
      existing[0].isActive !== true
    ) {
      await db
        .update(establishmentViewers)
        .set({
          establishmentId,
          establishmentName: seed.locationName,
          contactName: viewer.fullName,
          contactEmail: viewer.email,
          contactPhone: viewer.phone,
          defaultCommissionPercent: viewer.commissionPercent,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(establishmentViewers.id, existing[0].id));
    }
    counters.viewersSkipped++;
    return existing[0].id;
  }
  const [row] = await db
    .insert(establishmentViewers)
    .values({
      tenantId: TENANT_ID,
      userId,
      establishmentId,
      establishmentName: seed.locationName,
      contactName: viewer.fullName,
      contactEmail: viewer.email,
      contactPhone: viewer.phone,
      defaultCommissionPercent: viewer.commissionPercent,
      isActive: true,
    })
    .returning();
  counters.viewersCreated++;
  return row.id;
}

async function upsertAssignments(
  viewerId: string,
  machineIds: string[],
  commissionPercent: string,
) {
  for (const machineId of machineIds) {
    const existing = await db
      .select()
      .from(machineViewerAssignments)
      .where(
        and(
          eq(machineViewerAssignments.viewerId, viewerId),
          eq(machineViewerAssignments.machineId, machineId),
          eq(machineViewerAssignments.isActive, true),
        ),
      );
    if (existing[0]) {
      counters.assignmentsSkipped++;
      continue;
    }
    await db.insert(machineViewerAssignments).values({
      tenantId: TENANT_ID,
      viewerId,
      machineId,
      commissionPercent,
      isActive: true,
    });
    counters.assignmentsCreated++;
  }
}

async function fixOrphanDemoViewer() {
  // Visor "Establecimiento Demo" (sin establishment_id) -> desactivar para
  // que no aparezca como huérfano en /visores.
  const updated = await db
    .update(establishmentViewers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(establishmentViewers.tenantId, TENANT_ID),
        eq(establishmentViewers.establishmentName, "Establecimiento Demo"),
        sql`establishment_id IS NULL`,
        eq(establishmentViewers.isActive, true),
      ),
    )
    .returning({ id: establishmentViewers.id });
  counters.orphansFixed += updated.length;
}

async function main() {
  console.log("Sembrando datos demo (tenant:", TENANT_ID, ")\n");

  for (const seed of SEEDS) {
    const locationId = await upsertLocation(seed);
    const establishmentId = await convertEstablishment(seed, locationId);
    if (!establishmentId) {
      console.warn(
        `  ! Establecimiento "${seed.establishmentName}" no encontrado; salteando máquinas y visor.`,
      );
      continue;
    }
    const machineIds = await upsertMachines(seed, locationId);

    if (seed.viewer) {
      const userId = await upsertUser(seed.viewer);
      const viewerId = await upsertViewer(seed, establishmentId, userId);
      const assignTo = machineIds.slice(0, seed.viewer.machineCount);
      await upsertAssignments(viewerId, assignTo, seed.viewer.commissionPercent);
    }

    if (seed.pendingInvite) {
      await upsertPendingInvite(seed, establishmentId, machineIds);
    }
  }

  await fixOrphanDemoViewer();

  console.log("\nResumen:");
  for (const [k, v] of Object.entries(counters)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(
    `\nUsuarios visores creados con password demo: "${DEMO_PASSWORD}"`,
  );
  console.log("  - dueno_colmado (Visor A, 2 máquinas)");
  console.log("  - dueno_super   (Visor B, 1 máquina)");
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
