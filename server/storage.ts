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
  users, locations, products, machines, machineInventory, machineAlerts, machineVisits, machineSales,
  suppliers, warehouseInventory, productLots, warehouseMovements
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
}

export const storage = new DatabaseStorage();
