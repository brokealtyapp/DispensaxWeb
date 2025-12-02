import { 
  type User, type InsertUser,
  type Location, type InsertLocation,
  type Product, type InsertProduct,
  type Machine, type InsertMachine,
  type MachineInventory, type InsertMachineInventory,
  type MachineAlert, type InsertMachineAlert,
  type MachineVisit, type InsertMachineVisit,
  type MachineSale, type InsertMachineSale,
  type Supplier, type InsertSupplier,
  type WarehouseInventory, type InsertWarehouseInventory,
  type ProductLot, type InsertProductLot,
  type WarehouseMovement, type InsertWarehouseMovement,
  type Route, type InsertRoute,
  type RouteStop, type InsertRouteStop,
  type ServiceRecord, type InsertServiceRecord,
  type CashCollection, type InsertCashCollection,
  type ProductLoad, type InsertProductLoad,
  type IssueReport, type InsertIssueReport,
  type SupplierInventory, type InsertSupplierInventory,
  users, locations, products, machines, machineInventory, machineAlerts, machineVisits, machineSales,
  suppliers, warehouseInventory, productLots, warehouseMovements,
  routes, routeStops, serviceRecords, cashCollections, productLoads, issueReports, supplierInventory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, asc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<boolean>;
  
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  getMachines(filters?: { status?: string; zone?: string }): Promise<Machine[]>;
  getMachine(id: string): Promise<Machine | undefined>;
  getMachineWithDetails(id: string): Promise<any>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: string, machine: Partial<InsertMachine>): Promise<Machine | undefined>;
  deleteMachine(id: string): Promise<boolean>;
  
  getMachineInventory(machineId: string): Promise<(MachineInventory & { product: Product })[]>;
  updateMachineInventory(machineId: string, productId: string, quantity: number): Promise<MachineInventory | undefined>;
  setMachineInventory(inventory: InsertMachineInventory): Promise<MachineInventory>;
  
  getMachineAlerts(machineId?: string, resolved?: boolean): Promise<MachineAlert[]>;
  createMachineAlert(alert: InsertMachineAlert): Promise<MachineAlert>;
  resolveAlert(id: string, userId: string): Promise<MachineAlert | undefined>;
  resolveAlertSimple(id: string): Promise<MachineAlert | undefined>;
  
  getMachineVisits(machineId: string): Promise<MachineVisit[]>;
  createMachineVisit(visit: InsertMachineVisit): Promise<MachineVisit>;
  endMachineVisit(id: string, endTime: Date, notes?: string): Promise<MachineVisit | undefined>;
  
  getMachineSales(machineId: string, startDate?: Date, endDate?: Date): Promise<MachineSale[]>;
  createMachineSale(sale: InsertMachineSale): Promise<MachineSale>;
  getMachineSalesSummary(machineId: string): Promise<{ today: number; week: number; month: number }>;
  
  // Almacén - Proveedores
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;
  
  // Almacén - Inventario
  getWarehouseInventory(): Promise<(WarehouseInventory & { product: Product })[]>;
  getWarehouseInventoryItem(productId: string): Promise<WarehouseInventory | undefined>;
  updateWarehouseStock(productId: string, quantity: number): Promise<WarehouseInventory>;
  getLowStockAlerts(): Promise<(WarehouseInventory & { product: Product })[]>;
  
  // Almacén - Lotes
  getProductLots(productId?: string): Promise<(ProductLot & { product: Product; supplier?: Supplier })[]>;
  getProductLot(id: string): Promise<ProductLot | undefined>;
  createProductLot(lot: InsertProductLot): Promise<ProductLot>;
  updateProductLot(id: string, lot: Partial<InsertProductLot>): Promise<ProductLot | undefined>;
  getExpiringLots(days: number): Promise<(ProductLot & { product: Product })[]>;
  
  // Almacén - Movimientos (Kardex)
  getWarehouseMovements(productId?: string, limit?: number): Promise<(WarehouseMovement & { product: Product })[]>;
  createWarehouseMovement(movement: InsertWarehouseMovement): Promise<WarehouseMovement>;
  registerPurchaseEntry(data: { productId: string; quantity: number; unitCost: number; supplierId?: string; lotNumber: string; expirationDate?: Date; notes?: string }): Promise<WarehouseMovement>;
  registerSupplierExit(data: { productId: string; quantity: number; destinationUserId: string; notes?: string }): Promise<WarehouseMovement>;

  // ==================== MÓDULO ABASTECEDOR ====================
  
  // Rutas
  getRoutes(userId?: string, date?: Date, status?: string): Promise<any[]>;
  getRoute(id: string): Promise<any>;
  getTodayRoute(userId: string): Promise<any>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, route: Partial<InsertRoute>): Promise<Route | undefined>;
  startRoute(id: string): Promise<Route | undefined>;
  completeRoute(id: string): Promise<Route | undefined>;
  
  // Paradas de Ruta
  getRouteStops(routeId: string): Promise<any[]>;
  getRouteStop(id: string): Promise<any>;
  createRouteStop(stop: InsertRouteStop): Promise<RouteStop>;
  updateRouteStop(id: string, stop: Partial<RouteStop>): Promise<RouteStop | undefined>;
  startStop(id: string): Promise<RouteStop | undefined>;
  completeStop(id: string): Promise<RouteStop | undefined>;
  
  // Registros de Servicio
  getServiceRecords(userId?: string, machineId?: string, limit?: number): Promise<any[]>;
  getServiceRecord(id: string): Promise<any>;
  getActiveService(userId: string): Promise<ServiceRecord | undefined>;
  startService(data: InsertServiceRecord): Promise<ServiceRecord>;
  endService(id: string, notes?: string): Promise<ServiceRecord | undefined>;
  
  // Recolección de Efectivo
  getCashCollections(userId?: string, machineId?: string, startDate?: Date, endDate?: Date): Promise<any[]>;
  createCashCollection(collection: InsertCashCollection): Promise<CashCollection>;
  getCashCollectionsSummary(userId: string, startDate?: Date, endDate?: Date): Promise<{ total: number; count: number; difference: number }>;
  
  // Carga/Retiro de Productos
  getProductLoads(serviceRecordId?: string, machineId?: string): Promise<any[]>;
  createProductLoad(load: InsertProductLoad): Promise<ProductLoad>;
  
  // Reportes de Problemas
  getIssueReports(machineId?: string, status?: string): Promise<any[]>;
  getIssueReport(id: string): Promise<any>;
  createIssueReport(report: InsertIssueReport): Promise<IssueReport>;
  resolveIssue(id: string, userId: string, resolution: string): Promise<IssueReport | undefined>;
  
  // Inventario del Abastecedor
  getSupplierInventory(userId: string): Promise<any[]>;
  updateSupplierInventoryItem(userId: string, productId: string, quantity: number, lotId?: string): Promise<SupplierInventory>;
  loadProductsFromWarehouse(userId: string, productId: string, quantity: number): Promise<void>;
  unloadProductsToMachine(userId: string, machineId: string, productId: string, quantity: number): Promise<void>;
  
  // Estadísticas del Abastecedor
  getSupplierStats(userId: string, startDate?: Date, endDate?: Date): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getLocations(): Promise<Location[]> {
    return db.select().from(locations).orderBy(locations.name);
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined> {
    const [updated] = await db.update(locations).set(location).where(eq(locations.id, id)).returning();
    return updated;
  }

  async deleteLocation(id: string): Promise<boolean> {
    const result = await db.delete(locations).where(eq(locations.id, id));
    return true;
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).where(eq(products.isActive, true)).orderBy(products.name);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
    return true;
  }

  async getMachines(filters?: { status?: string; zone?: string }): Promise<Machine[]> {
    let query = db.select().from(machines).where(eq(machines.isActive, true));
    
    if (filters?.status) {
      query = db.select().from(machines).where(and(eq(machines.isActive, true), eq(machines.status, filters.status)));
    }
    if (filters?.zone) {
      query = db.select().from(machines).where(and(eq(machines.isActive, true), eq(machines.zone, filters.zone)));
    }
    if (filters?.status && filters?.zone) {
      query = db.select().from(machines).where(and(eq(machines.isActive, true), eq(machines.status, filters.status), eq(machines.zone, filters.zone)));
    }
    
    return query.orderBy(machines.name);
  }

  async getMachine(id: string): Promise<Machine | undefined> {
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    return machine;
  }

  async getMachineWithDetails(id: string): Promise<any> {
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    if (!machine) return undefined;

    const location = machine.locationId 
      ? await this.getLocation(machine.locationId)
      : undefined;
    
    const inventory = await this.getMachineInventory(id);
    const alerts = await this.getMachineAlerts(id, false);
    const visits = await this.getMachineVisits(id);
    const salesSummary = await this.getMachineSalesSummary(id);

    const totalCapacity = inventory.reduce((sum, inv) => sum + (inv.maxCapacity || 0), 0);
    const currentStock = inventory.reduce((sum, inv) => sum + (inv.currentQuantity || 0), 0);
    const inventoryPercentage = totalCapacity > 0 ? Math.round((currentStock / totalCapacity) * 100) : 0;

    return {
      ...machine,
      location,
      inventory,
      alerts,
      recentVisits: visits.slice(0, 10),
      salesSummary,
      inventoryPercentage,
    };
  }

  async createMachine(machine: InsertMachine): Promise<Machine> {
    const [newMachine] = await db.insert(machines).values(machine).returning();
    return newMachine;
  }

  async updateMachine(id: string, machine: Partial<InsertMachine>): Promise<Machine | undefined> {
    const [updated] = await db.update(machines).set(machine).where(eq(machines.id, id)).returning();
    return updated;
  }

  async deleteMachine(id: string): Promise<boolean> {
    await db.update(machines).set({ isActive: false }).where(eq(machines.id, id));
    return true;
  }

  async getMachineInventory(machineId: string): Promise<(MachineInventory & { product: Product })[]> {
    const inventory = await db.select().from(machineInventory).where(eq(machineInventory.machineId, machineId));
    
    const result = await Promise.all(inventory.map(async (inv) => {
      const product = await this.getProduct(inv.productId);
      return { ...inv, product: product! };
    }));
    
    return result.filter(inv => inv.product);
  }

  async updateMachineInventory(machineId: string, productId: string, quantity: number): Promise<MachineInventory | undefined> {
    const [updated] = await db.update(machineInventory)
      .set({ currentQuantity: quantity, lastUpdated: new Date() })
      .where(and(eq(machineInventory.machineId, machineId), eq(machineInventory.productId, productId)))
      .returning();
    return updated;
  }

  async setMachineInventory(inventory: InsertMachineInventory): Promise<MachineInventory> {
    const existing = await db.select().from(machineInventory)
      .where(and(eq(machineInventory.machineId, inventory.machineId), eq(machineInventory.productId, inventory.productId)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(machineInventory)
        .set({ ...inventory, lastUpdated: new Date() })
        .where(eq(machineInventory.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [newInventory] = await db.insert(machineInventory).values(inventory).returning();
    return newInventory;
  }

  async getMachineAlerts(machineId?: string, resolved?: boolean): Promise<MachineAlert[]> {
    if (machineId && resolved !== undefined) {
      return db.select().from(machineAlerts)
        .where(and(eq(machineAlerts.machineId, machineId), eq(machineAlerts.isResolved, resolved)))
        .orderBy(desc(machineAlerts.createdAt));
    }
    if (machineId) {
      return db.select().from(machineAlerts)
        .where(eq(machineAlerts.machineId, machineId))
        .orderBy(desc(machineAlerts.createdAt));
    }
    if (resolved !== undefined) {
      return db.select().from(machineAlerts)
        .where(eq(machineAlerts.isResolved, resolved))
        .orderBy(desc(machineAlerts.createdAt));
    }
    return db.select().from(machineAlerts).orderBy(desc(machineAlerts.createdAt));
  }

  async createMachineAlert(alert: InsertMachineAlert): Promise<MachineAlert> {
    const [newAlert] = await db.insert(machineAlerts).values(alert).returning();
    return newAlert;
  }

  async resolveAlert(id: string, userId: string): Promise<MachineAlert | undefined> {
    const [updated] = await db.update(machineAlerts)
      .set({ isResolved: true, resolvedAt: new Date(), resolvedBy: userId })
      .where(eq(machineAlerts.id, id))
      .returning();
    return updated;
  }

  async resolveAlertSimple(id: string): Promise<MachineAlert | undefined> {
    const [updated] = await db.update(machineAlerts)
      .set({ isResolved: true, resolvedAt: new Date() })
      .where(eq(machineAlerts.id, id))
      .returning();
    return updated;
  }

  async getMachineVisits(machineId: string): Promise<MachineVisit[]> {
    return db.select().from(machineVisits)
      .where(eq(machineVisits.machineId, machineId))
      .orderBy(desc(machineVisits.startTime))
      .limit(50);
  }

  async createMachineVisit(visit: InsertMachineVisit): Promise<MachineVisit> {
    const [newVisit] = await db.insert(machineVisits).values(visit).returning();
    return newVisit;
  }

  async endMachineVisit(id: string, endTime: Date, notes?: string): Promise<MachineVisit | undefined> {
    const [visit] = await db.select().from(machineVisits).where(eq(machineVisits.id, id));
    if (!visit) return undefined;

    const durationMinutes = Math.round((endTime.getTime() - new Date(visit.startTime).getTime()) / 60000);
    
    const [updated] = await db.update(machineVisits)
      .set({ endTime, durationMinutes, notes: notes || visit.notes })
      .where(eq(machineVisits.id, id))
      .returning();
    return updated;
  }

  async getMachineSales(machineId: string, startDate?: Date, endDate?: Date): Promise<MachineSale[]> {
    let conditions = [eq(machineSales.machineId, machineId)];
    
    if (startDate) {
      conditions.push(gte(machineSales.saleDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(machineSales.saleDate, endDate));
    }
    
    return db.select().from(machineSales)
      .where(and(...conditions))
      .orderBy(desc(machineSales.saleDate));
  }

  async createMachineSale(sale: InsertMachineSale): Promise<MachineSale> {
    const [newSale] = await db.insert(machineSales).values(sale).returning();
    return newSale;
  }

  async getMachineSalesSummary(machineId: string): Promise<{ today: number; week: number; month: number }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const todaySales = await db.select({ total: sql<string>`COALESCE(SUM(${machineSales.totalAmount}), 0)` })
      .from(machineSales)
      .where(and(eq(machineSales.machineId, machineId), gte(machineSales.saleDate, todayStart)));

    const weekSales = await db.select({ total: sql<string>`COALESCE(SUM(${machineSales.totalAmount}), 0)` })
      .from(machineSales)
      .where(and(eq(machineSales.machineId, machineId), gte(machineSales.saleDate, weekStart)));

    const monthSales = await db.select({ total: sql<string>`COALESCE(SUM(${machineSales.totalAmount}), 0)` })
      .from(machineSales)
      .where(and(eq(machineSales.machineId, machineId), gte(machineSales.saleDate, monthStart)));

    return {
      today: parseFloat(todaySales[0]?.total || "0"),
      week: parseFloat(weekSales[0]?.total || "0"),
      month: parseFloat(monthSales[0]?.total || "0"),
    };
  }

  // ==================== MÓDULO ALMACÉN ====================

  // Proveedores
  async getSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name);
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db.insert(suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updated] = await db.update(suppliers).set(supplier).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
    return true;
  }

  // Inventario de Almacén
  async getWarehouseInventory(): Promise<(WarehouseInventory & { product: Product })[]> {
    const inventory = await db.select().from(warehouseInventory);
    
    const result = await Promise.all(inventory.map(async (inv) => {
      const product = await this.getProduct(inv.productId);
      return { ...inv, product: product! };
    }));
    
    return result.filter(inv => inv.product);
  }

  async getWarehouseInventoryItem(productId: string): Promise<WarehouseInventory | undefined> {
    const [item] = await db.select().from(warehouseInventory).where(eq(warehouseInventory.productId, productId));
    return item;
  }

  async updateWarehouseStock(productId: string, quantity: number): Promise<WarehouseInventory> {
    const existing = await this.getWarehouseInventoryItem(productId);
    
    if (existing) {
      const [updated] = await db.update(warehouseInventory)
        .set({ currentStock: quantity, lastUpdated: new Date() })
        .where(eq(warehouseInventory.productId, productId))
        .returning();
      return updated;
    }
    
    const [newInventory] = await db.insert(warehouseInventory)
      .values({ productId, currentStock: quantity })
      .returning();
    return newInventory;
  }

  async getLowStockAlerts(): Promise<(WarehouseInventory & { product: Product })[]> {
    const inventory = await db.select().from(warehouseInventory);
    const lowStock = inventory.filter(inv => (inv.currentStock || 0) <= (inv.reorderPoint || 20));
    
    const result = await Promise.all(lowStock.map(async (inv) => {
      const product = await this.getProduct(inv.productId);
      return { ...inv, product: product! };
    }));
    
    return result.filter(inv => inv.product);
  }

  // Lotes de Productos
  async getProductLots(productId?: string): Promise<(ProductLot & { product: Product; supplier?: Supplier })[]> {
    let lotsQuery = productId 
      ? db.select().from(productLots).where(and(eq(productLots.productId, productId), eq(productLots.isActive, true)))
      : db.select().from(productLots).where(eq(productLots.isActive, true));
    
    const lots = await lotsQuery.orderBy(asc(productLots.expirationDate));
    
    const result = await Promise.all(lots.map(async (lot) => {
      const product = await this.getProduct(lot.productId);
      const supplier = lot.supplierId ? await this.getSupplier(lot.supplierId) : undefined;
      return { ...lot, product: product!, supplier };
    }));
    
    return result.filter(lot => lot.product);
  }

  async getProductLot(id: string): Promise<ProductLot | undefined> {
    const [lot] = await db.select().from(productLots).where(eq(productLots.id, id));
    return lot;
  }

  async createProductLot(lot: InsertProductLot): Promise<ProductLot> {
    const [newLot] = await db.insert(productLots)
      .values({ ...lot, remainingQuantity: lot.quantity })
      .returning();
    return newLot;
  }

  async updateProductLot(id: string, lot: Partial<InsertProductLot>): Promise<ProductLot | undefined> {
    const [updated] = await db.update(productLots).set(lot).where(eq(productLots.id, id)).returning();
    return updated;
  }

  async getExpiringLots(days: number): Promise<(ProductLot & { product: Product })[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    const lots = await db.select().from(productLots)
      .where(and(
        eq(productLots.isActive, true),
        lte(productLots.expirationDate, futureDate),
        gte(productLots.remainingQuantity, 1)
      ))
      .orderBy(asc(productLots.expirationDate));
    
    const result = await Promise.all(lots.map(async (lot) => {
      const product = await this.getProduct(lot.productId);
      return { ...lot, product: product! };
    }));
    
    return result.filter(lot => lot.product);
  }

  // Movimientos de Almacén (Kardex)
  async getWarehouseMovements(productId?: string, limit?: number): Promise<(WarehouseMovement & { product: Product })[]> {
    let query = productId
      ? db.select().from(warehouseMovements).where(eq(warehouseMovements.productId, productId))
      : db.select().from(warehouseMovements);
    
    const movements = await query.orderBy(desc(warehouseMovements.createdAt)).limit(limit || 100);
    
    const result = await Promise.all(movements.map(async (mov) => {
      const product = await this.getProduct(mov.productId);
      return { ...mov, product: product! };
    }));
    
    return result.filter(mov => mov.product);
  }

  async createWarehouseMovement(movement: InsertWarehouseMovement): Promise<WarehouseMovement> {
    const [newMovement] = await db.insert(warehouseMovements).values(movement).returning();
    return newMovement;
  }

  async registerPurchaseEntry(data: { 
    productId: string; 
    quantity: number; 
    unitCost: number; 
    supplierId?: string; 
    lotNumber: string; 
    expirationDate?: Date; 
    notes?: string 
  }): Promise<WarehouseMovement> {
    const currentInventory = await this.getWarehouseInventoryItem(data.productId);
    const previousStock = currentInventory?.currentStock || 0;
    const newStock = previousStock + data.quantity;

    // Crear lote
    const lot = await this.createProductLot({
      productId: data.productId,
      lotNumber: data.lotNumber,
      quantity: data.quantity,
      costPrice: String(data.unitCost),
      expirationDate: data.expirationDate,
      supplierId: data.supplierId,
      notes: data.notes,
    });

    // Actualizar inventario
    await this.updateWarehouseStock(data.productId, newStock);

    // Registrar movimiento
    const movement = await this.createWarehouseMovement({
      productId: data.productId,
      lotId: lot.id,
      movementType: "entrada_compra",
      quantity: data.quantity,
      previousStock,
      newStock,
      unitCost: String(data.unitCost),
      totalCost: String(data.quantity * data.unitCost),
      supplierId: data.supplierId,
      notes: data.notes,
    });

    return movement;
  }

  async registerSupplierExit(data: { 
    productId: string; 
    quantity: number; 
    destinationUserId: string; 
    notes?: string 
  }): Promise<WarehouseMovement> {
    const currentInventory = await this.getWarehouseInventoryItem(data.productId);
    const previousStock = currentInventory?.currentStock || 0;
    
    if (previousStock < data.quantity) {
      throw new Error("Stock insuficiente");
    }
    
    const newStock = previousStock - data.quantity;

    // Actualizar inventario
    await this.updateWarehouseStock(data.productId, newStock);

    // Descontar de lotes (FIFO - primero los más próximos a caducar)
    const lots = await this.getProductLots(data.productId);
    let remaining = data.quantity;
    
    for (const lot of lots) {
      if (remaining <= 0) break;
      
      const toDeduct = Math.min(remaining, lot.remainingQuantity);
      await db.update(productLots)
        .set({ remainingQuantity: lot.remainingQuantity - toDeduct })
        .where(eq(productLots.id, lot.id));
      remaining -= toDeduct;
    }

    // Registrar movimiento
    const movement = await this.createWarehouseMovement({
      productId: data.productId,
      movementType: "salida_abastecedor",
      quantity: data.quantity,
      previousStock,
      newStock,
      destinationUserId: data.destinationUserId,
      notes: data.notes,
    });

    return movement;
  }

  // ==================== MÓDULO ABASTECEDOR ====================

  // Rutas
  async getRoutes(userId?: string, date?: Date, status?: string): Promise<any[]> {
    let conditions: any[] = [];
    
    if (userId) conditions.push(eq(routes.supplierId, userId));
    if (status) conditions.push(eq(routes.status, status));
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(routes.date, startOfDay));
      conditions.push(lte(routes.date, endOfDay));
    }
    
    const result = conditions.length > 0
      ? await db.select().from(routes).where(and(...conditions)).orderBy(desc(routes.date))
      : await db.select().from(routes).orderBy(desc(routes.date));
    
    const routesWithDetails = await Promise.all(result.map(async (route) => {
      const supplier = await this.getUser(route.supplierId);
      const supervisor = route.supervisorId ? await this.getUser(route.supervisorId) : undefined;
      const stops = await this.getRouteStops(route.id);
      return { ...route, supplier, supervisor, stops };
    }));
    
    return routesWithDetails;
  }

  async getRoute(id: string): Promise<any> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    if (!route) return undefined;
    
    const supplier = await this.getUser(route.supplierId);
    const supervisor = route.supervisorId ? await this.getUser(route.supervisorId) : undefined;
    const stops = await this.getRouteStops(route.id);
    
    return { ...route, supplier, supervisor, stops };
  }

  async getTodayRoute(userId: string): Promise<any> {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [route] = await db.select().from(routes)
      .where(and(
        eq(routes.supplierId, userId),
        gte(routes.date, startOfDay),
        lte(routes.date, endOfDay)
      ));
    
    if (!route) return undefined;
    
    return this.getRoute(route.id);
  }

  async createRoute(route: InsertRoute): Promise<Route> {
    const [newRoute] = await db.insert(routes).values(route).returning();
    return newRoute;
  }

  async updateRoute(id: string, route: Partial<InsertRoute>): Promise<Route | undefined> {
    const [updated] = await db.update(routes).set(route).where(eq(routes.id, id)).returning();
    return updated;
  }

  async startRoute(id: string): Promise<Route | undefined> {
    const [updated] = await db.update(routes)
      .set({ status: "en_progreso", startTime: new Date() })
      .where(eq(routes.id, id))
      .returning();
    return updated;
  }

  async completeRoute(id: string): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    if (!route || !route.startTime) return undefined;
    
    const endTime = new Date();
    const actualDuration = Math.round((endTime.getTime() - new Date(route.startTime).getTime()) / 60000);
    
    const [updated] = await db.update(routes)
      .set({ status: "completada", endTime, actualDuration })
      .where(eq(routes.id, id))
      .returning();
    return updated;
  }

  // Paradas de Ruta
  async getRouteStops(routeId: string): Promise<any[]> {
    const stops = await db.select().from(routeStops)
      .where(eq(routeStops.routeId, routeId))
      .orderBy(asc(routeStops.order));
    
    const stopsWithDetails = await Promise.all(stops.map(async (stop) => {
      const machine = await this.getMachineWithDetails(stop.machineId);
      return { ...stop, machine };
    }));
    
    return stopsWithDetails;
  }

  async getRouteStop(id: string): Promise<any> {
    const [stop] = await db.select().from(routeStops).where(eq(routeStops.id, id));
    if (!stop) return undefined;
    
    const machine = await this.getMachineWithDetails(stop.machineId);
    return { ...stop, machine };
  }

  async createRouteStop(stop: InsertRouteStop): Promise<RouteStop> {
    const [newStop] = await db.insert(routeStops).values(stop).returning();
    return newStop;
  }

  async updateRouteStop(id: string, stop: Partial<RouteStop>): Promise<RouteStop | undefined> {
    const [updated] = await db.update(routeStops).set(stop).where(eq(routeStops.id, id)).returning();
    return updated;
  }

  async startStop(id: string): Promise<RouteStop | undefined> {
    const [updated] = await db.update(routeStops)
      .set({ status: "en_progreso", actualArrival: new Date() })
      .where(eq(routeStops.id, id))
      .returning();
    return updated;
  }

  async completeStop(id: string): Promise<RouteStop | undefined> {
    const [stop] = await db.select().from(routeStops).where(eq(routeStops.id, id));
    if (!stop || !stop.actualArrival) return undefined;
    
    const actualDeparture = new Date();
    const durationMinutes = Math.round((actualDeparture.getTime() - new Date(stop.actualArrival).getTime()) / 60000);
    
    const [updated] = await db.update(routeStops)
      .set({ status: "completada", actualDeparture, durationMinutes })
      .where(eq(routeStops.id, id))
      .returning();
    
    // Actualizar contador de paradas completadas en la ruta
    const routeData = await this.getRoute(stop.routeId);
    if (routeData) {
      await db.update(routes)
        .set({ completedStops: (routeData.completedStops || 0) + 1 })
        .where(eq(routes.id, stop.routeId));
    }
    
    return updated;
  }

  // Registros de Servicio
  async getServiceRecords(userId?: string, machineId?: string, limit?: number): Promise<any[]> {
    let conditions: any[] = [];
    
    if (userId) conditions.push(eq(serviceRecords.userId, userId));
    if (machineId) conditions.push(eq(serviceRecords.machineId, machineId));
    
    const query = conditions.length > 0
      ? db.select().from(serviceRecords).where(and(...conditions))
      : db.select().from(serviceRecords);
    
    const records = await query.orderBy(desc(serviceRecords.startTime)).limit(limit || 50);
    
    const recordsWithDetails = await Promise.all(records.map(async (record) => {
      const machine = await this.getMachine(record.machineId);
      const user = await this.getUser(record.userId);
      const loads = await this.getProductLoads(record.id);
      const cash = await db.select().from(cashCollections).where(eq(cashCollections.serviceRecordId, record.id));
      const issues = await db.select().from(issueReports).where(eq(issueReports.serviceRecordId, record.id));
      return { ...record, machine, user, productLoads: loads, cashCollections: cash, issues };
    }));
    
    return recordsWithDetails;
  }

  async getServiceRecord(id: string): Promise<any> {
    const [record] = await db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    if (!record) return undefined;
    
    const machine = await this.getMachineWithDetails(record.machineId);
    const user = await this.getUser(record.userId);
    const loads = await this.getProductLoads(id);
    const cash = await db.select().from(cashCollections).where(eq(cashCollections.serviceRecordId, id));
    const issues = await db.select().from(issueReports).where(eq(issueReports.serviceRecordId, id));
    
    return { ...record, machine, user, productLoads: loads, cashCollections: cash, issues };
  }

  async getActiveService(userId: string): Promise<ServiceRecord | undefined> {
    const [record] = await db.select().from(serviceRecords)
      .where(and(eq(serviceRecords.userId, userId), eq(serviceRecords.status, "en_progreso")));
    return record;
  }

  async startService(data: InsertServiceRecord): Promise<ServiceRecord> {
    const [record] = await db.insert(serviceRecords).values(data).returning();
    
    // Actualizar última visita de la máquina
    await db.update(machines)
      .set({ lastVisit: new Date() })
      .where(eq(machines.id, data.machineId));
    
    return record;
  }

  async endService(id: string, notes?: string): Promise<ServiceRecord | undefined> {
    const [record] = await db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    if (!record) return undefined;
    
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - new Date(record.startTime).getTime()) / 60000);
    
    const [updated] = await db.update(serviceRecords)
      .set({ 
        endTime, 
        durationMinutes, 
        status: "completado",
        notes: notes || record.notes 
      })
      .where(eq(serviceRecords.id, id))
      .returning();
    
    return updated;
  }

  // Recolección de Efectivo
  async getCashCollections(userId?: string, machineId?: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    let conditions: any[] = [];
    
    if (userId) conditions.push(eq(cashCollections.userId, userId));
    if (machineId) conditions.push(eq(cashCollections.machineId, machineId));
    if (startDate) conditions.push(gte(cashCollections.createdAt, startDate));
    if (endDate) conditions.push(lte(cashCollections.createdAt, endDate));
    
    const query = conditions.length > 0
      ? db.select().from(cashCollections).where(and(...conditions))
      : db.select().from(cashCollections);
    
    const collections = await query.orderBy(desc(cashCollections.createdAt));
    
    const collectionsWithDetails = await Promise.all(collections.map(async (collection) => {
      const machine = await this.getMachine(collection.machineId);
      const user = await this.getUser(collection.userId);
      return { ...collection, machine, user };
    }));
    
    return collectionsWithDetails;
  }

  async createCashCollection(collection: InsertCashCollection): Promise<CashCollection> {
    const difference = collection.expectedAmount 
      ? parseFloat(collection.actualAmount) - parseFloat(collection.expectedAmount)
      : null;
    
    const [newCollection] = await db.insert(cashCollections)
      .values({ ...collection, difference: difference?.toString() })
      .returning();
    return newCollection;
  }

  async getCashCollectionsSummary(userId: string, startDate?: Date, endDate?: Date): Promise<{ total: number; count: number; difference: number }> {
    let conditions = [eq(cashCollections.userId, userId)];
    if (startDate) conditions.push(gte(cashCollections.createdAt, startDate));
    if (endDate) conditions.push(lte(cashCollections.createdAt, endDate));
    
    const result = await db.select({
      total: sql<string>`COALESCE(SUM(${cashCollections.actualAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
      difference: sql<string>`COALESCE(SUM(${cashCollections.difference}), 0)`
    }).from(cashCollections).where(and(...conditions));
    
    return {
      total: parseFloat(result[0]?.total || "0"),
      count: result[0]?.count || 0,
      difference: parseFloat(result[0]?.difference || "0")
    };
  }

  // Carga/Retiro de Productos
  async getProductLoads(serviceRecordId?: string, machineId?: string): Promise<any[]> {
    let conditions: any[] = [];
    
    if (serviceRecordId) conditions.push(eq(productLoads.serviceRecordId, serviceRecordId));
    if (machineId) conditions.push(eq(productLoads.machineId, machineId));
    
    const query = conditions.length > 0
      ? db.select().from(productLoads).where(and(...conditions))
      : db.select().from(productLoads);
    
    const loads = await query.orderBy(desc(productLoads.createdAt));
    
    const loadsWithDetails = await Promise.all(loads.map(async (load) => {
      const product = await this.getProduct(load.productId);
      return { ...load, product };
    }));
    
    return loadsWithDetails;
  }

  async createProductLoad(load: InsertProductLoad): Promise<ProductLoad> {
    const [newLoad] = await db.insert(productLoads).values(load).returning();
    
    // Actualizar inventario de la máquina
    const currentInventory = await this.getMachineInventory(load.machineId);
    const existingItem = currentInventory.find(inv => inv.productId === load.productId);
    
    if (existingItem) {
      const newQuantity = load.loadType === "cargado"
        ? (existingItem.currentQuantity || 0) + load.quantity
        : Math.max(0, (existingItem.currentQuantity || 0) - load.quantity);
      
      await this.updateMachineInventory(load.machineId, load.productId, newQuantity);
    } else if (load.loadType === "cargado") {
      await this.setMachineInventory({
        machineId: load.machineId,
        productId: load.productId,
        currentQuantity: load.quantity,
        maxCapacity: 20,
        minLevel: 5,
      });
    }
    
    return newLoad;
  }

  // Reportes de Problemas
  async getIssueReports(machineId?: string, status?: string): Promise<any[]> {
    let conditions: any[] = [];
    
    if (machineId) conditions.push(eq(issueReports.machineId, machineId));
    if (status) conditions.push(eq(issueReports.status, status));
    
    const query = conditions.length > 0
      ? db.select().from(issueReports).where(and(...conditions))
      : db.select().from(issueReports);
    
    const reports = await query.orderBy(desc(issueReports.createdAt));
    
    const reportsWithDetails = await Promise.all(reports.map(async (report) => {
      const machine = await this.getMachine(report.machineId);
      const user = await this.getUser(report.userId);
      const resolvedByUser = report.resolvedBy ? await this.getUser(report.resolvedBy) : undefined;
      return { ...report, machine, user, resolvedByUser };
    }));
    
    return reportsWithDetails;
  }

  async getIssueReport(id: string): Promise<any> {
    const [report] = await db.select().from(issueReports).where(eq(issueReports.id, id));
    if (!report) return undefined;
    
    const machine = await this.getMachine(report.machineId);
    const user = await this.getUser(report.userId);
    const resolvedByUser = report.resolvedBy ? await this.getUser(report.resolvedBy) : undefined;
    
    return { ...report, machine, user, resolvedByUser };
  }

  async createIssueReport(report: InsertIssueReport): Promise<IssueReport> {
    const [newReport] = await db.insert(issueReports).values(report).returning();
    
    // Crear alerta en la máquina si es de alta prioridad
    if (report.priority === "alta" || report.priority === "critica") {
      await this.createMachineAlert({
        machineId: report.machineId,
        type: report.issueType,
        priority: report.priority,
        message: report.description,
      });
      
      // Actualizar estado de la máquina si es crítico
      if (report.priority === "critica") {
        await this.updateMachine(report.machineId, { status: "necesita_servicio" });
      }
    }
    
    return newReport;
  }

  async resolveIssue(id: string, userId: string, resolution: string): Promise<IssueReport | undefined> {
    const [updated] = await db.update(issueReports)
      .set({ 
        status: "resuelto", 
        resolvedAt: new Date(), 
        resolvedBy: userId,
        resolution 
      })
      .where(eq(issueReports.id, id))
      .returning();
    return updated;
  }

  // Inventario del Abastecedor
  async getSupplierInventory(userId: string): Promise<any[]> {
    const inventory = await db.select().from(supplierInventory)
      .where(eq(supplierInventory.userId, userId));
    
    const inventoryWithDetails = await Promise.all(inventory.map(async (item) => {
      const product = await this.getProduct(item.productId);
      const lot = item.lotId ? await this.getProductLot(item.lotId) : undefined;
      return { ...item, product, lot };
    }));
    
    return inventoryWithDetails.filter(item => item.product);
  }

  async updateSupplierInventoryItem(userId: string, productId: string, quantity: number, lotId?: string): Promise<SupplierInventory> {
    const [existing] = await db.select().from(supplierInventory)
      .where(and(eq(supplierInventory.userId, userId), eq(supplierInventory.productId, productId)));
    
    if (existing) {
      const [updated] = await db.update(supplierInventory)
        .set({ quantity, lotId, lastUpdated: new Date() })
        .where(eq(supplierInventory.id, existing.id))
        .returning();
      return updated;
    }
    
    const [newItem] = await db.insert(supplierInventory)
      .values({ userId, productId, quantity, lotId })
      .returning();
    return newItem;
  }

  async loadProductsFromWarehouse(userId: string, productId: string, quantity: number): Promise<void> {
    // Registrar salida del almacén hacia el abastecedor
    await this.registerSupplierExit({ productId, quantity, destinationUserId: userId });
    
    // Agregar al inventario del abastecedor
    const currentInv = await this.getSupplierInventory(userId);
    const existingItem = currentInv.find(inv => inv.productId === productId);
    const newQuantity = existingItem ? (existingItem.quantity || 0) + quantity : quantity;
    
    await this.updateSupplierInventoryItem(userId, productId, newQuantity);
  }

  async unloadProductsToMachine(userId: string, machineId: string, productId: string, quantity: number): Promise<void> {
    // Reducir inventario del abastecedor
    const currentInv = await this.getSupplierInventory(userId);
    const existingItem = currentInv.find(inv => inv.productId === productId);
    
    if (!existingItem || (existingItem.quantity || 0) < quantity) {
      throw new Error("Inventario insuficiente del abastecedor");
    }
    
    await this.updateSupplierInventoryItem(userId, productId, (existingItem.quantity || 0) - quantity);
    
    // Agregar al inventario de la máquina
    const machineInv = await this.getMachineInventory(machineId);
    const machineItem = machineInv.find(inv => inv.productId === productId);
    
    if (machineItem) {
      await this.updateMachineInventory(machineId, productId, (machineItem.currentQuantity || 0) + quantity);
    } else {
      await this.setMachineInventory({
        machineId,
        productId,
        currentQuantity: quantity,
        maxCapacity: 20,
        minLevel: 5,
      });
    }
  }

  // Estadísticas del Abastecedor
  async getSupplierStats(userId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate || new Date();
    
    // Total de servicios
    const services = await db.select({ count: sql<number>`COUNT(*)` })
      .from(serviceRecords)
      .where(and(
        eq(serviceRecords.userId, userId),
        gte(serviceRecords.startTime, start),
        lte(serviceRecords.startTime, end)
      ));
    
    // Tiempo total trabajado
    const timeWorked = await db.select({ 
      total: sql<number>`COALESCE(SUM(${serviceRecords.durationMinutes}), 0)` 
    })
      .from(serviceRecords)
      .where(and(
        eq(serviceRecords.userId, userId),
        gte(serviceRecords.startTime, start),
        lte(serviceRecords.startTime, end)
      ));
    
    // Efectivo recolectado
    const cashSummary = await this.getCashCollectionsSummary(userId, start, end);
    
    // Productos cargados
    const productsLoaded = await db.select({ 
      total: sql<number>`COALESCE(SUM(${productLoads.quantity}), 0)` 
    })
      .from(productLoads)
      .where(and(
        eq(productLoads.userId, userId),
        eq(productLoads.loadType, "cargado"),
        gte(productLoads.createdAt, start),
        lte(productLoads.createdAt, end)
      ));
    
    // Reportes creados
    const issuesReported = await db.select({ count: sql<number>`COUNT(*)` })
      .from(issueReports)
      .where(and(
        eq(issueReports.userId, userId),
        gte(issueReports.createdAt, start),
        lte(issueReports.createdAt, end)
      ));
    
    return {
      totalServices: services[0]?.count || 0,
      totalMinutesWorked: timeWorked[0]?.total || 0,
      cashCollected: cashSummary.total,
      cashDifference: cashSummary.difference,
      productsLoaded: productsLoaded[0]?.total || 0,
      issuesReported: issuesReported[0]?.count || 0,
    };
  }
}

export const storage = new DatabaseStorage();
