import { 
  type User, type InsertUser,
  type Location, type InsertLocation,
  type Product, type InsertProduct,
  type Machine, type InsertMachine,
  type MachineInventory, type InsertMachineInventory,
  type MachineAlert, type InsertMachineAlert,
  type MachineVisit, type InsertMachineVisit,
  type MachineSale, type InsertMachineSale,
  users, locations, products, machines, machineInventory, machineAlerts, machineVisits, machineSales
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

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
  
  getMachineVisits(machineId: string): Promise<MachineVisit[]>;
  createMachineVisit(visit: InsertMachineVisit): Promise<MachineVisit>;
  endMachineVisit(id: string, endTime: Date, notes?: string): Promise<MachineVisit | undefined>;
  
  getMachineSales(machineId: string, startDate?: Date, endDate?: Date): Promise<MachineSale[]>;
  createMachineSale(sale: InsertMachineSale): Promise<MachineSale>;
  getMachineSalesSummary(machineId: string): Promise<{ today: number; week: number; month: number }>;
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
}

export const storage = new DatabaseStorage();
