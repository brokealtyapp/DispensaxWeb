import { db } from "./db";
import { users, routes, routeStops, machines } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

async function seedSupplierData() {
  console.log("Seeding supplier data...");

  // Crear usuario abastecedor demo
  const existingUser = await db.select().from(users).where(eq(users.username, "abastecedor1"));
  
  let supplierId: string;
  
  if (existingUser.length === 0) {
    const [newUser] = await db.insert(users).values({
      username: "abastecedor1",
      password: "demo123",
      fullName: "Carlos García López",
      role: "abastecedor"
    }).returning();
    supplierId = newUser.id;
    console.log("Created demo supplier user:", newUser.username);
  } else {
    supplierId = existingUser[0].id;
    console.log("Using existing supplier user:", existingUser[0].username);
  }

  // Obtener máquinas existentes
  const allMachines = await db.select().from(machines).where(eq(machines.isActive, true));
  
  if (allMachines.length === 0) {
    console.log("No machines found. Please create machines first.");
    return;
  }

  console.log(`Found ${allMachines.length} machines`);

  // Crear ruta del día de hoy
  const today = new Date();
  today.setHours(8, 0, 0, 0);

  // Verificar si ya existe una ruta para hoy
  const existingRoute = await db.select().from(routes).where(
    sql`DATE(${routes.date}) = DATE(${today})`
  );

  if (existingRoute.length > 0) {
    console.log("Route for today already exists");
    return;
  }

  // Crear nueva ruta
  const machineCount = Math.min(allMachines.length, 6);
  const [newRoute] = await db.insert(routes).values({
    date: today,
    supplierId: supplierId,
    status: "pendiente",
    totalStops: machineCount,
    estimatedDuration: machineCount * 30,
    notes: "Ruta regular de abastecimiento"
  }).returning();

  console.log("Created route:", newRoute.id);

  // Crear paradas para las primeras 6 máquinas
  const selectedMachines = allMachines.slice(0, machineCount);
  
  for (let i = 0; i < selectedMachines.length; i++) {
    const machine = selectedMachines[i];
    const estimatedTime = new Date(today);
    estimatedTime.setMinutes(today.getMinutes() + (i * 30) + 30);

    await db.insert(routeStops).values({
      routeId: newRoute.id,
      machineId: machine.id,
      order: i + 1,
      status: "pendiente",
      estimatedArrival: estimatedTime,
      notes: `Parada ${i + 1}: ${machine.name}`
    });
  }

  console.log(`Created ${selectedMachines.length} route stops`);
  console.log("Supplier data seeding completed!");
}

seedSupplierData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error seeding:", error);
    process.exit(1);
  });
