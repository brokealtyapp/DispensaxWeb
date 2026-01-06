import { db } from "./db";
import { 
  machines, locations, machineAlerts, machineInventory, products,
  warehouseInventory, productLots, cashCollections, pettyCashExpenses,
  pettyCashFund, productTransfers, shrinkageRecords, tasks, users,
  routes, routeStops, serviceRecords, purchaseOrders, purchaseReceptions,
  vehicles, fuelRecords, machineVisits
} from "@shared/schema";
import { eq, desc, and, gte, sql, count, inArray } from "drizzle-orm";

interface MachineBasic {
  id: string;
  name: string;
  code: string | null;
  status: string;
  zone: string | null;
  locationName: string | null;
  alertCount: number;
  inventoryPercentage: number;
}

interface DashboardCache {
  stats: {
    totalMachines: number;
    operatingMachines: number;
    needsServiceMachines: number;
    maintenanceMachines: number;
    activeAlerts: number;
    todayTasks: number;
    completedTasks: number;
  };
  machinesByZone: Array<{
    zone: string;
    total: number;
    operating: number;
    percentage: number;
  }>;
  recentAlerts: Array<{
    id: string;
    machineId: string;
    machineName: string;
    type: string;
    priority: string;
    message: string;
    createdAt: Date;
  }>;
  machinesList: MachineBasic[];
  lastUpdated: Date;
}

interface SummaryCache {
  warehouse: {
    totalProducts: number;
    lowStockCount: number;
    expiringCount: number;
    recentMovements: any[];
  };
  pettyCash: {
    currentBalance: string;
    initialAmount: string;
    weekExpenses: number;
    pendingCount: number;
    approvedCount: number;
    recentExpenses: any[];
  };
  reconciliation: {
    weekTransfers: number;
    pendingTransfers: number;
    weekShrinkage: number;
    shrinkageRecords: number;
    weekCollections: number;
    collectionsCount: number;
    recentDiscrepancies: any[];
  };
  routes: {
    activeRoutes: number;
    totalRoutes: number;
    todayStops: number;
    completedStops: number;
    pendingStops: number;
    avgServiceTimeMinutes: number;
  };
  purchases: {
    openOrders: number;
    totalOrders: number;
    weekSpending: number;
    pendingReceptions: number;
  };
  fuel: {
    totalVehicles: number;
    activeVehicles: number;
    monthCost: number;
    monthLiters: number;
    avgEfficiency: string;
    lowEfficiencyAlerts: number;
  };
  hr: {
    totalEmployees: number;
    activeEmployees: number;
    weekVisits: number;
    weekTasksCompleted: number;
    topPerformers: { id: string; name: string; role: string; visitsThisWeek: number; tasksCompleted: number }[];
    byRole: { technicians: number; admins: number; supervisors: number };
  };
  lastUpdated: Date;
}

let dashboardCache: DashboardCache | null = null;
let summaryCache: SummaryCache | null = null;
let isDashboardUpdating = false;
let isSummaryUpdating = false;
let updateInterval: NodeJS.Timeout | null = null;

const CACHE_TTL_MS = 2 * 60 * 1000;

const defaultDashboardCache: DashboardCache = {
  stats: {
    totalMachines: 0,
    operatingMachines: 0,
    needsServiceMachines: 0,
    maintenanceMachines: 0,
    activeAlerts: 0,
    todayTasks: 0,
    completedTasks: 0,
  },
  machinesByZone: [],
  recentAlerts: [],
  machinesList: [],
  lastUpdated: new Date(0),
};

const defaultSummaryCache: SummaryCache = {
  warehouse: { totalProducts: 0, lowStockCount: 0, expiringCount: 0, recentMovements: [] },
  pettyCash: { currentBalance: "0", initialAmount: "0", weekExpenses: 0, pendingCount: 0, approvedCount: 0, recentExpenses: [] },
  reconciliation: { weekTransfers: 0, pendingTransfers: 0, weekShrinkage: 0, shrinkageRecords: 0, weekCollections: 0, collectionsCount: 0, recentDiscrepancies: [] },
  routes: { activeRoutes: 0, totalRoutes: 0, todayStops: 0, completedStops: 0, pendingStops: 0, avgServiceTimeMinutes: 0 },
  purchases: { openOrders: 0, totalOrders: 0, weekSpending: 0, pendingReceptions: 0 },
  fuel: { totalVehicles: 0, activeVehicles: 0, monthCost: 0, monthLiters: 0, avgEfficiency: "0", lowEfficiencyAlerts: 0 },
  hr: { totalEmployees: 0, activeEmployees: 0, weekVisits: 0, weekTasksCompleted: 0, topPerformers: [], byRole: { technicians: 0, admins: 0, supervisors: 0 } },
  lastUpdated: new Date(0),
};

async function computeDashboardStats(): Promise<DashboardCache['stats']> {
  const machineStats = await db
    .select({
      total: count(),
      operating: sql<number>`count(*) filter (where ${machines.status} = 'operando')`,
      needsService: sql<number>`count(*) filter (where ${machines.status} = 'necesita_servicio')`,
      maintenance: sql<number>`count(*) filter (where ${machines.status} = 'mantenimiento')`,
    })
    .from(machines)
    .where(eq(machines.isActive, true));

  const alertCount = await db
    .select({ count: count() })
    .from(machineAlerts)
    .where(eq(machineAlerts.isResolved, false));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const taskStats = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'completada')`,
    })
    .from(tasks)
    .where(gte(tasks.dueDate, today));

  return {
    totalMachines: machineStats[0]?.total || 0,
    operatingMachines: Number(machineStats[0]?.operating) || 0,
    needsServiceMachines: Number(machineStats[0]?.needsService) || 0,
    maintenanceMachines: Number(machineStats[0]?.maintenance) || 0,
    activeAlerts: alertCount[0]?.count || 0,
    todayTasks: taskStats[0]?.total || 0,
    completedTasks: Number(taskStats[0]?.completed) || 0,
  };
}

async function computeMachinesByZone(): Promise<DashboardCache['machinesByZone']> {
  const zoneStats = await db
    .select({
      zone: machines.zone,
      total: count(),
      operating: sql<number>`count(*) filter (where ${machines.status} = 'operando')`,
    })
    .from(machines)
    .where(eq(machines.isActive, true))
    .groupBy(machines.zone);

  return zoneStats.map(z => ({
    zone: z.zone || 'Sin zona',
    total: z.total,
    operating: Number(z.operating),
    percentage: z.total > 0 ? Math.round((Number(z.operating) / z.total) * 100) : 0,
  }));
}

async function computeRecentAlerts(): Promise<DashboardCache['recentAlerts']> {
  const alerts = await db
    .select({
      id: machineAlerts.id,
      machineId: machineAlerts.machineId,
      machineName: machines.name,
      type: machineAlerts.type,
      priority: machineAlerts.priority,
      message: machineAlerts.message,
      createdAt: machineAlerts.createdAt,
    })
    .from(machineAlerts)
    .leftJoin(machines, eq(machineAlerts.machineId, machines.id))
    .where(eq(machineAlerts.isResolved, false))
    .orderBy(desc(machineAlerts.createdAt))
    .limit(10);

  return alerts.map(a => ({
    id: a.id,
    machineId: a.machineId,
    machineName: a.machineName || 'Máquina desconocida',
    type: a.type,
    priority: a.priority || 'media',
    message: a.message,
    createdAt: a.createdAt || new Date(),
  }));
}

async function computeMachinesList(): Promise<MachineBasic[]> {
  const machineData = await db
    .select({
      id: machines.id,
      name: machines.name,
      code: machines.code,
      status: machines.status,
      zone: machines.zone,
      locationName: locations.name,
    })
    .from(machines)
    .leftJoin(locations, eq(machines.locationId, locations.id))
    .where(eq(machines.isActive, true))
    .orderBy(machines.name);

  const alertCounts = await db
    .select({
      machineId: machineAlerts.machineId,
      count: count(),
    })
    .from(machineAlerts)
    .where(eq(machineAlerts.isResolved, false))
    .groupBy(machineAlerts.machineId);

  const inventoryStats = await db
    .select({
      machineId: machineInventory.machineId,
      totalCurrent: sql<number>`sum(${machineInventory.currentQuantity})`,
      totalMax: sql<number>`sum(${machineInventory.maxCapacity})`,
    })
    .from(machineInventory)
    .groupBy(machineInventory.machineId);

  const alertMap = new Map(alertCounts.map(a => [a.machineId, a.count]));
  const inventoryMap = new Map(inventoryStats.map(i => [i.machineId, {
    current: Number(i.totalCurrent) || 0,
    max: Number(i.totalMax) || 1,
  }]));

  return machineData.map(m => {
    const inv = inventoryMap.get(m.id) || { current: 0, max: 1 };
    return {
      id: m.id,
      name: m.name,
      code: m.code,
      status: m.status || 'operando',
      zone: m.zone,
      locationName: m.locationName,
      alertCount: alertMap.get(m.id) || 0,
      inventoryPercentage: Math.round((inv.current / inv.max) * 100),
    };
  });
}

async function computeWarehouseSummary() {
  const productCount = await db.select({ count: count() }).from(products).where(eq(products.isActive, true));
  
  const lowStock = await db
    .select({ count: count() })
    .from(warehouseInventory)
    .innerJoin(products, eq(warehouseInventory.productId, products.id))
    .where(sql`${warehouseInventory.currentStock} <= ${warehouseInventory.minStock}`);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const expiring = await db
    .select({ count: count() })
    .from(productLots)
    .where(and(
      sql`${productLots.remainingQuantity} > 0`,
      sql`${productLots.expirationDate} <= ${thirtyDaysFromNow}`
    ));

  return {
    totalProducts: productCount[0]?.count || 0,
    lowStockCount: lowStock[0]?.count || 0,
    expiringCount: expiring[0]?.count || 0,
    recentMovements: [],
  };
}

async function computePettyCashSummary() {
  const fund = await db.select().from(pettyCashFund).limit(1);
  const currentFund = fund[0];

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const expenseStats = await db
    .select({
      pending: sql<number>`count(*) filter (where ${pettyCashExpenses.status} = 'pendiente')`,
      approved: sql<number>`count(*) filter (where ${pettyCashExpenses.status} = 'aprobado')`,
      weekTotal: sql<number>`coalesce(sum(case when ${pettyCashExpenses.createdAt} >= ${weekAgo} and ${pettyCashExpenses.status} = 'aprobado' then ${pettyCashExpenses.amount} else 0 end), 0)`,
    })
    .from(pettyCashExpenses);

  const recentExpenses = await db
    .select({
      id: pettyCashExpenses.id,
      description: pettyCashExpenses.description,
      amount: pettyCashExpenses.amount,
      category: pettyCashExpenses.category,
      status: pettyCashExpenses.status,
    })
    .from(pettyCashExpenses)
    .orderBy(desc(pettyCashExpenses.createdAt))
    .limit(5);

  return {
    currentBalance: currentFund?.currentBalance?.toString() || "0",
    initialAmount: currentFund?.initialBalance?.toString() || "0",
    weekExpenses: Number(expenseStats[0]?.weekTotal) || 0,
    pendingCount: Number(expenseStats[0]?.pending) || 0,
    approvedCount: Number(expenseStats[0]?.approved) || 0,
    recentExpenses,
  };
}

async function computeReconciliationSummary() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const transferStats = await db
    .select({
      weekTotal: sql<number>`count(*) filter (where ${productTransfers.createdAt} >= ${weekAgo})`,
      pending: sql<number>`count(*) filter (where ${productTransfers.status} = 'pendiente')`,
    })
    .from(productTransfers);

  const shrinkageStats = await db
    .select({
      weekTotal: sql<number>`coalesce(sum(case when ${shrinkageRecords.createdAt} >= ${weekAgo} then ${shrinkageRecords.quantity} else 0 end), 0)`,
      totalRecords: count(),
    })
    .from(shrinkageRecords);

  const collectionStats = await db
    .select({
      weekTotal: sql<number>`coalesce(sum(case when ${cashCollections.createdAt} >= ${weekAgo} then ${cashCollections.actualAmount} else 0 end), 0)`,
      totalCount: count(),
    })
    .from(cashCollections);

  const recentDiscrepancies = await db
    .select({
      id: shrinkageRecords.id,
      productId: shrinkageRecords.productId,
      quantity: shrinkageRecords.quantity,
      reason: shrinkageRecords.reason,
    })
    .from(shrinkageRecords)
    .orderBy(desc(shrinkageRecords.createdAt))
    .limit(5);

  return {
    weekTransfers: Number(transferStats[0]?.weekTotal) || 0,
    pendingTransfers: Number(transferStats[0]?.pending) || 0,
    weekShrinkage: Number(shrinkageStats[0]?.weekTotal) || 0,
    shrinkageRecords: shrinkageStats[0]?.totalRecords || 0,
    weekCollections: Number(collectionStats[0]?.weekTotal) || 0,
    collectionsCount: collectionStats[0]?.totalCount || 0,
    recentDiscrepancies,
  };
}

async function computeRoutesSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const routeStats = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${routes.status} in ('en_progreso', 'activa'))`,
    })
    .from(routes);

  const todayStops = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${routeStops.status} = 'completada')`,
    })
    .from(routeStops)
    .innerJoin(routes, eq(routeStops.routeId, routes.id))
    .where(gte(routes.date, today));

  const serviceStats = await db
    .select({
      avgTime: sql<number>`coalesce(avg(${serviceRecords.durationMinutes}), 0)`,
    })
    .from(serviceRecords)
    .where(gte(serviceRecords.createdAt, weekAgo));

  return {
    activeRoutes: Number(routeStats[0]?.active) || 0,
    totalRoutes: routeStats[0]?.total || 0,
    todayStops: todayStops[0]?.total || 0,
    completedStops: Number(todayStops[0]?.completed) || 0,
    pendingStops: (todayStops[0]?.total || 0) - (Number(todayStops[0]?.completed) || 0),
    avgServiceTimeMinutes: Math.round(Number(serviceStats[0]?.avgTime) || 0),
  };
}

async function computePurchasesSummary() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const orderStats = await db
    .select({
      total: count(),
      open: sql<number>`count(*) filter (where ${purchaseOrders.status} in ('borrador', 'enviada'))`,
      // Sum only orders that were received (fully or partially) in the last week
      weekTotal: sql<number>`coalesce(sum(case when ${purchaseOrders.status} in ('recibida', 'parcialmente_recibida') and ${purchaseOrders.createdAt} >= ${weekAgo} then cast(${purchaseOrders.total} as numeric) else 0 end), 0)`,
    })
    .from(purchaseOrders);

  const pendingReceptions = await db
    .select({ count: count() })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.status, 'enviada'));

  return {
    openOrders: Number(orderStats[0]?.open) || 0,
    totalOrders: orderStats[0]?.total || 0,
    weekSpending: Number(orderStats[0]?.weekTotal) || 0,
    pendingReceptions: pendingReceptions[0]?.count || 0,
  };
}

async function computeFuelSummary() {
  const vehicleStats = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${vehicles.isActive} = true)`,
    })
    .from(vehicles);

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const recentFuel = await db
    .select()
    .from(fuelRecords)
    .limit(500);

  const recentRecords = recentFuel.filter(r => new Date(r.recordDate) >= monthAgo);

  let monthCost = 0;
  let monthLiters = 0;
  let effSum = 0;
  let effCount = 0;
  let lowEff = 0;

  for (const r of recentRecords) {
    monthCost += Number(r.totalAmount) || 0;
    monthLiters += Number(r.liters) || 0;
    const eff = Number(r.calculatedMileage) || 0;
    if (eff > 0) {
      effSum += eff;
      effCount++;
      if (eff < 8) lowEff++;
    }
  }

  return {
    totalVehicles: vehicleStats[0]?.total || 0,
    activeVehicles: Number(vehicleStats[0]?.active) || 0,
    monthCost,
    monthLiters,
    avgEfficiency: effCount > 0 ? (effSum / effCount).toFixed(2) : "0",
    lowEfficiencyAlerts: lowEff,
  };
}

async function computeHRSummary() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const employeeStats = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${users.isActive} = true)`,
      technicians: sql<number>`count(*) filter (where ${users.role} in ('abastecedor', 'tecnico') and ${users.isActive} = true)`,
      admins: sql<number>`count(*) filter (where ${users.role} = 'admin' and ${users.isActive} = true)`,
      supervisors: sql<number>`count(*) filter (where ${users.role} = 'supervisor' and ${users.isActive} = true)`,
    })
    .from(users);

  const visitStats = await db
    .select({ count: count() })
    .from(machineVisits)
    .where(gte(machineVisits.createdAt, weekAgo));

  const taskStats = await db
    .select({
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'completada')`,
    })
    .from(tasks)
    .where(gte(tasks.createdAt, weekAgo));

  // Top performers - users with most visits/tasks this week
  const topPerformersData = await db
    .select({
      userId: machineVisits.userId,
    })
    .from(machineVisits)
    .where(gte(machineVisits.createdAt, weekAgo))
    .groupBy(machineVisits.userId)
    .limit(5);

  const userIds = topPerformersData.map(p => p.userId).filter(Boolean) as string[];
  const usersList = userIds.length > 0 ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
  const usersMap = new Map(usersList.map(u => [u.id, u]));

  // Count visits and tasks per user
  const visitsPerUser = await db
    .select({
      userId: machineVisits.userId,
      count: count(),
    })
    .from(machineVisits)
    .where(gte(machineVisits.createdAt, weekAgo))
    .groupBy(machineVisits.userId);

  const tasksPerUser = await db
    .select({
      userId: tasks.assignedUserId,
      count: sql<number>`count(*) filter (where ${tasks.status} = 'completada')`,
    })
    .from(tasks)
    .where(gte(tasks.createdAt, weekAgo))
    .groupBy(tasks.assignedUserId);

  const visitsMap = new Map(visitsPerUser.map(v => [v.userId, v.count]));
  const tasksMap = new Map(tasksPerUser.map(t => [t.userId, Number(t.count) || 0]));

  const topPerformers = userIds.slice(0, 5).map(userId => {
    const user = usersMap.get(userId);
    return {
      id: userId,
      name: user?.fullName || user?.username || 'Desconocido',
      role: user?.role || 'empleado',
      visitsThisWeek: visitsMap.get(userId) || 0,
      tasksCompleted: tasksMap.get(userId) || 0,
    };
  });

  return {
    totalEmployees: employeeStats[0]?.total || 0,
    activeEmployees: Number(employeeStats[0]?.active) || 0,
    weekVisits: visitStats[0]?.count || 0,
    weekTasksCompleted: Number(taskStats[0]?.completed) || 0,
    topPerformers,
    byRole: {
      technicians: Number(employeeStats[0]?.technicians) || 0,
      admins: Number(employeeStats[0]?.admins) || 0,
      supervisors: Number(employeeStats[0]?.supervisors) || 0,
    },
  };
}

export async function updateDashboardCache(): Promise<void> {
  if (isDashboardUpdating) return;
  isDashboardUpdating = true;

  try {
    console.log('[Cache] Actualizando cache de dashboard...');
    const startTime = Date.now();

    const [stats, machinesByZone, recentAlerts, machinesList] = await Promise.all([
      computeDashboardStats(),
      computeMachinesByZone(),
      computeRecentAlerts(),
      computeMachinesList(),
    ]);

    dashboardCache = {
      stats,
      machinesByZone,
      recentAlerts,
      machinesList,
      lastUpdated: new Date(),
    };

    console.log(`[Cache] Dashboard actualizado en ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('[Cache] Error actualizando dashboard:', error);
  } finally {
    isDashboardUpdating = false;
  }
}

export async function updateSummaryCache(): Promise<void> {
  if (isSummaryUpdating) return;
  isSummaryUpdating = true;

  try {
    console.log('[Cache] Actualizando cache de resúmenes...');
    const startTime = Date.now();

    const [warehouse, pettyCash, reconciliation, routesSummary, purchases, fuel, hr] = await Promise.all([
      computeWarehouseSummary(),
      computePettyCashSummary(),
      computeReconciliationSummary(),
      computeRoutesSummary(),
      computePurchasesSummary(),
      computeFuelSummary(),
      computeHRSummary(),
    ]);

    summaryCache = {
      warehouse,
      pettyCash,
      reconciliation,
      routes: routesSummary,
      purchases,
      fuel,
      hr,
      lastUpdated: new Date(),
    };

    console.log(`[Cache] Resúmenes actualizados en ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('[Cache] Error actualizando resúmenes:', error);
  } finally {
    isSummaryUpdating = false;
  }
}

export async function updateAllCaches(): Promise<void> {
  await updateDashboardCache();
  await updateSummaryCache();
}

export function getDashboardCache(): DashboardCache {
  return dashboardCache || defaultDashboardCache;
}

export function getSummaryCache(): SummaryCache {
  return summaryCache || defaultSummaryCache;
}

export function isCacheValid(): boolean {
  return isDashboardCacheValid() && isSummaryCacheValid();
}

export function isDashboardCacheValid(): boolean {
  if (!dashboardCache) return false;
  return Date.now() - dashboardCache.lastUpdated.getTime() < CACHE_TTL_MS;
}

export function isSummaryCacheValid(): boolean {
  if (!summaryCache) return false;
  return Date.now() - summaryCache.lastUpdated.getTime() < CACHE_TTL_MS;
}

export async function refreshDashboardCacheIfStale(): Promise<void> {
  if (!isDashboardCacheValid() && !isDashboardUpdating) {
    await updateDashboardCache();
  }
}

export async function refreshSummaryCacheIfStale(): Promise<void> {
  if (!isSummaryCacheValid() && !isSummaryUpdating) {
    await updateSummaryCache();
  }
}

export function startCacheUpdater(): void {
  console.log('[Cache] Iniciando actualizador automático de cache (cada 2 minutos)');
  
  updateAllCaches().catch(err => console.error('[Cache] Error en inicialización:', err));

  updateInterval = setInterval(async () => {
    if (!isDashboardCacheValid()) {
      updateDashboardCache().catch(err => console.error('[Cache] Error actualizando dashboard:', err));
    }
    if (!isSummaryCacheValid()) {
      updateSummaryCache().catch(err => console.error('[Cache] Error actualizando resúmenes:', err));
    }
  }, CACHE_TTL_MS);
}

export function stopCacheUpdater(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('[Cache] Actualizador de cache detenido');
  }
}

export function invalidateCache(): void {
  dashboardCache = null;
  summaryCache = null;
  console.log('[Cache] Cache invalidado');
}
