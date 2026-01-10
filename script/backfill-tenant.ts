import { db } from "../server/db";
import { 
  tenants, subscriptionPlans, tenantSubscriptions, tenantSettings,
  users, locations, products, machines, machineInventory, machineAlerts, machineVisits, machineSales,
  suppliers, warehouseInventory, productLots, warehouseMovements,
  routes, routeStops, serviceRecords, cashCollections, productLoads, issueReports, supplierInventory,
  cashMovements, bankDeposits, productTransfers, shrinkageRecords,
  pettyCashExpenses, pettyCashFund, pettyCashTransactions,
  purchaseOrders, purchaseOrderItems, purchaseReceptions, receptionItems,
  vehicles, fuelRecords, tasks, calendarEvents,
  employeeAttendance, payrollRecords, vacationRequests, performanceReviews, employeeDocuments, employeeProfiles,
  vehicleInventory, inventoryTransfers, machineInventoryLots
} from "../shared/schema";
import { eq, sql, isNull } from "drizzle-orm";

async function backfillTenant() {
  console.log("=== INICIANDO BACKFILL MULTI-TENANT ===\n");

  // 1. Crear plan de suscripción por defecto
  console.log("1. Creando plan de suscripción por defecto...");
  const [defaultPlan] = await db.insert(subscriptionPlans).values({
    name: "Plan Empresarial",
    code: "enterprise",
    description: "Plan completo para empresas establecidas",
    monthlyPrice: "5000.00",
    yearlyPrice: "50000.00",
    maxMachines: 100,
    maxUsers: 50,
    maxProducts: 500,
    maxLocations: 200,
    features: {
      modules: ["all"],
      support: "priority",
      reports: "advanced",
      api: true
    },
    status: "active",
    isActive: true
  }).returning();
  console.log(`   ✓ Plan creado: ${defaultPlan.id} - ${defaultPlan.name}\n`);

  // 2. Crear tenant por defecto
  console.log("2. Creando tenant por defecto...");
  const [defaultTenant] = await db.insert(tenants).values({
    name: "Empresa Demo",
    slug: "empresa-demo",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    country: "DO",
    email: "admin@dispensax.com",
    isActive: true
  }).returning();
  console.log(`   ✓ Tenant creado: ${defaultTenant.id} - ${defaultTenant.name}\n`);

  // 3. Crear suscripción para el tenant
  console.log("3. Creando suscripción del tenant...");
  const [subscription] = await db.insert(tenantSubscriptions).values({
    tenantId: defaultTenant.id,
    planId: defaultPlan.id,
    status: "active",
    billingCycle: "monthly",
    startDate: new Date()
  }).returning();
  console.log(`   ✓ Suscripción creada: ${subscription.id}\n`);

  // 4. Crear configuraciones del tenant
  console.log("4. Creando configuraciones del tenant...");
  await db.insert(tenantSettings).values({
    tenantId: defaultTenant.id,
    primaryColor: "#E84545",
    secondaryColor: "#2F6FED",
    language: "es"
  });
  console.log(`   ✓ Configuraciones creadas\n`);

  // 5. Actualizar usuarios existentes con el tenantId
  console.log("5. Actualizando usuarios existentes...");
  const usersResult = await db.update(users)
    .set({ tenantId: defaultTenant.id })
    .where(isNull(users.tenantId));
  console.log(`   ✓ Usuarios actualizados\n`);

  // 6. Actualizar todas las tablas con tenantId
  const tablesToUpdate = [
    { table: locations, name: "locations" },
    { table: products, name: "products" },
    { table: machines, name: "machines" },
    { table: machineInventory, name: "machineInventory" },
    { table: machineAlerts, name: "machineAlerts" },
    { table: machineVisits, name: "machineVisits" },
    { table: machineSales, name: "machineSales" },
    { table: suppliers, name: "suppliers" },
    { table: warehouseInventory, name: "warehouseInventory" },
    { table: productLots, name: "productLots" },
    { table: warehouseMovements, name: "warehouseMovements" },
    { table: routes, name: "routes" },
    { table: routeStops, name: "routeStops" },
    { table: serviceRecords, name: "serviceRecords" },
    { table: cashCollections, name: "cashCollections" },
    { table: productLoads, name: "productLoads" },
    { table: issueReports, name: "issueReports" },
    { table: supplierInventory, name: "supplierInventory" },
    { table: cashMovements, name: "cashMovements" },
    { table: bankDeposits, name: "bankDeposits" },
    { table: productTransfers, name: "productTransfers" },
    { table: shrinkageRecords, name: "shrinkageRecords" },
    { table: pettyCashExpenses, name: "pettyCashExpenses" },
    { table: pettyCashFund, name: "pettyCashFund" },
    { table: pettyCashTransactions, name: "pettyCashTransactions" },
    { table: purchaseOrders, name: "purchaseOrders" },
    { table: purchaseOrderItems, name: "purchaseOrderItems" },
    { table: purchaseReceptions, name: "purchaseReceptions" },
    { table: receptionItems, name: "receptionItems" },
    { table: vehicles, name: "vehicles" },
    { table: fuelRecords, name: "fuelRecords" },
    { table: tasks, name: "tasks" },
    { table: calendarEvents, name: "calendarEvents" },
    { table: employeeAttendance, name: "employeeAttendance" },
    { table: payrollRecords, name: "payrollRecords" },
    { table: vacationRequests, name: "vacationRequests" },
    { table: performanceReviews, name: "performanceReviews" },
    { table: employeeDocuments, name: "employeeDocuments" },
    { table: employeeProfiles, name: "employeeProfiles" },
    { table: vehicleInventory, name: "vehicleInventory" },
    { table: inventoryTransfers, name: "inventoryTransfers" },
    { table: machineInventoryLots, name: "machineInventoryLots" }
  ];

  console.log("6. Actualizando tablas operativas con tenantId...");
  for (const { table, name } of tablesToUpdate) {
    try {
      await db.update(table as any)
        .set({ tenantId: defaultTenant.id })
        .where(isNull((table as any).tenantId));
      console.log(`   ✓ ${name}`);
    } catch (error) {
      console.log(`   ⚠ ${name}: ${(error as Error).message}`);
    }
  }

  // 7. Crear usuario Super Admin
  console.log("\n7. Marcando usuario admin como Super Admin...");
  try {
    await db.update(users)
      .set({ isSuperAdmin: true })
      .where(eq(users.username, "admin"));
    console.log("   ✓ Usuario admin es ahora Super Admin\n");
  } catch (error) {
    console.log(`   ⚠ No se pudo marcar admin como Super Admin: ${(error as Error).message}\n`);
  }

  console.log("=== BACKFILL COMPLETADO ===");
  console.log(`\nTenant ID: ${defaultTenant.id}`);
  console.log(`Plan ID: ${defaultPlan.id}`);
  console.log(`Subscription ID: ${subscription.id}`);
  
  process.exit(0);
}

backfillTenant().catch((error) => {
  console.error("Error en backfill:", error);
  process.exit(1);
});
