import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, asc, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { 
  signAccessToken, 
  signRefreshToken, 
  hashRefreshToken, 
  authenticateJWT, 
  authorizeRoles,
  optionalAuth,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  type AuthenticatedRequest 
} from "./auth";
import { getSummaryCache, getDashboardCache, isCacheValid, isSummaryCacheValid, isDashboardCacheValid, refreshSummaryCacheIfStale, refreshDashboardCacheIfStale } from "./cache";
import { 
  insertLocationSchema, 
  insertProductSchema, 
  insertMachineSchema,
  insertMachineInventorySchema,
  insertMachineAlertSchema,
  insertMachineVisitSchema,
  insertMachineSaleSchema,
  insertSupplierSchema,
  insertProductLotSchema,
  insertRouteSchema,
  insertRouteStopSchema,
  insertServiceRecordSchema,
  insertCashCollectionSchema,
  insertProductLoadSchema,
  insertIssueReportSchema,
  insertCashMovementSchema,
  insertBankDepositSchema,
  insertProductTransferSchema,
  insertShrinkageRecordSchema,
  insertPettyCashExpenseSchema,
  insertPettyCashFundSchema,
  insertPurchaseOrderSchema,
  insertPurchaseOrderItemSchema,
  insertPurchaseReceptionSchema,
  insertReceptionItemSchema,
  insertVehicleSchema,
  insertFuelRecordSchema,
  insertEmployeeSchema,
  insertTaskSchema,
  insertCalendarEventSchema,
  machines,
  machineSales,
  cashCollections,
  bankDeposits,
  cashMovements
} from "@shared/schema";
import { z } from "zod";

// =====================
// TIMEZONE UTILITIES (GMT-4 / America/Santo_Domingo)
// =====================
const TIMEZONE = 'America/Santo_Domingo';

function getTodayInTimezone(): Date {
  // Get current date in GMT-4 timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dateStr = formatter.format(now); // YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0); // Noon to avoid DST issues
}

function getStartOfWeekInTimezone(): Date {
  const today = getTodayInTimezone();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getStartOfMonthInTimezone(): Date {
  const today = getTodayInTimezone();
  return new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
}

function getDateRangeForToday(): { start: Date; end: Date } {
  const today = getTodayInTimezone();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function isSameDayInTimezone(date1: Date, date2: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date1) === formatter.format(date2);
}

function getDateKeyInTimezone(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

// For dates stored as DATE (without time), extract date key directly
function getDateKeyFromDateOnly(date: Date): string {
  // If date was stored as DATE (midnight UTC), extract year/month/day from UTC
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // =====================
  // AUTHENTICATION ROUTES
  // =====================

  const loginSchema = z.object({
    username: z.string().min(1, "Usuario requerido"),
    password: z.string().min(1, "Contraseña requerida"),
  });

  const registerSchema = z.object({
    username: z.string().min(3, "Usuario debe tener al menos 3 caracteres"),
    password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
    fullName: z.string().min(1, "Nombre completo requerido"),
    email: z.string().email("Email inválido"),
    role: z.enum(["admin", "supervisor", "abastecedor", "almacen", "contabilidad", "rh"]).default("abastecedor"),
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      
      if (res.headersSent) return;
      
      if (!user) {
        return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (res.headersSent) return;
      
      if (!isValidPassword) {
        return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      }

      if (!user.isActive) {
        return res.status(401).json({ error: "Usuario desactivado. Contacta al administrador." });
      }

      const accessToken = signAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role || "abastecedor"
      });

      const { token: refreshToken, hash: refreshTokenHash, expiresAt } = signRefreshToken();

      await storage.createRefreshToken({
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      if (res.headersSent) return;

      res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        accessToken,
        user: userWithoutPassword,
      });
    } catch (error) {
      if (res.headersSent) return;
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      
      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token requerido" });
      }

      const tokenHash = hashRefreshToken(refreshToken);
      const storedToken = await storage.getRefreshTokenByHash(tokenHash);

      if (!storedToken) {
        res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/auth" });
        return res.status(401).json({ error: "Token inválido o expirado" });
      }

      const user = await storage.getUser(storedToken.userId);
      if (!user || !user.isActive) {
        await storage.revokeRefreshToken(tokenHash);
        res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/auth" });
        return res.status(401).json({ error: "Usuario no encontrado o desactivado" });
      }

      await storage.revokeRefreshToken(tokenHash);

      const accessToken = signAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role || "abastecedor"
      });

      const { token: newRefreshToken, hash: newRefreshTokenHash, expiresAt } = signRefreshToken();

      await storage.createRefreshToken({
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        expiresAt,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      res.json({ accessToken });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(500).json({ error: "Error al renovar sesión" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      
      if (refreshToken) {
        const tokenHash = hashRefreshToken(refreshToken);
        await storage.revokeRefreshToken(tokenHash);
      }

      res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/auth" });
      res.json({ message: "Sesión cerrada correctamente" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Error al cerrar sesión" });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ error: "El nombre de usuario ya existe" });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      const newUser = await storage.createEmployee({
        username: data.username,
        password: hashedPassword,
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        isActive: true,
      });

      const accessToken = signAccessToken({
        userId: newUser.id,
        username: newUser.username,
        role: newUser.role || "abastecedor"
      });

      const { token: refreshToken, hash: refreshTokenHash, expiresAt } = signRefreshToken();

      await storage.createRefreshToken({
        userId: newUser.id,
        tokenHash: refreshTokenHash,
        expiresAt,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      const { password: _, ...userWithoutPassword } = newUser;

      res.status(201).json({
        accessToken,
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Register error:", error);
      res.status(500).json({ error: "Error al registrar usuario" });
    }
  });

  app.get("/api/auth/me", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const user = await storage.getEmployee(req.user.userId);
      
      if (!user) {
        return res.status(401).json({ error: "Usuario no encontrado" });
      }

      const { password: _, ...userWithoutPassword } = user;

      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Auth me error:", error);
      res.status(401).json({ error: "Token inválido o expirado" });
    }
  });

  // =====================
  // LOCATION ROUTES
  // =====================

  app.get("/api/locations", async (req: Request, res: Response) => {
    try {
      const locations = await storage.getLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener ubicaciones" });
    }
  });

  app.get("/api/locations/:id", async (req: Request, res: Response) => {
    try {
      const location = await storage.getLocation(req.params.id);
      if (!location) {
        return res.status(404).json({ error: "Ubicación no encontrada" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener ubicación" });
    }
  });

  app.post("/api/locations", async (req: Request, res: Response) => {
    try {
      const data = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(data);
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear ubicación" });
    }
  });

  app.patch("/api/locations/:id", async (req: Request, res: Response) => {
    try {
      const data = insertLocationSchema.partial().parse(req.body);
      const location = await storage.updateLocation(req.params.id, data);
      if (!location) {
        return res.status(404).json({ error: "Ubicación no encontrada" });
      }
      res.json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar ubicación" });
    }
  });

  app.delete("/api/locations/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteLocation(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar ubicación" });
    }
  });

  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener productos" });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener producto" });
    }
  });

  app.post("/api/products", async (req: Request, res: Response) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear producto" });
    }
  });

  app.patch("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const data = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, data);
      if (!product) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar producto" });
    }
  });

  app.delete("/api/products/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar producto" });
    }
  });

  app.get("/api/machines/summary", async (req: Request, res: Response) => {
    try {
      const cache = getDashboardCache();
      res.json({
        stats: cache.stats,
        machinesByZone: cache.machinesByZone,
        machines: cache.machinesList,
      });
      if (!isDashboardCacheValid()) {
        refreshDashboardCacheIfStale().catch(err => console.error("[Cache] Error refresh dashboard:", err));
      }
    } catch (error) {
      console.error("Error getting machines summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de máquinas" });
    }
  });

  app.get("/api/machines", async (req: Request, res: Response) => {
    try {
      const { status, zone } = req.query;
      
      const cache = getDashboardCache();
      if (cache && isCacheValid() && !status && !zone) {
        return res.json(cache.machinesList);
      }
      
      const filters = {
        status: status as string | undefined,
        zone: zone as string | undefined,
      };
      const machines = await storage.getMachines(filters);
      res.json(machines);
    } catch (error) {
      console.error("Error getting machines:", error);
      res.status(500).json({ error: "Error al obtener máquinas" });
    }
  });

  app.get("/api/machines/:id", async (req: Request, res: Response) => {
    try {
      const machine = await storage.getMachineWithDetails(req.params.id);
      if (!machine) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }
      res.json(machine);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener máquina" });
    }
  });

  app.post("/api/machines", async (req: Request, res: Response) => {
    try {
      const data = insertMachineSchema.parse(req.body);
      const machine = await storage.createMachine(data);
      res.status(201).json(machine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating machine:", error);
      res.status(500).json({ error: "Error al crear máquina" });
    }
  });

  app.patch("/api/machines/:id", async (req: Request, res: Response) => {
    try {
      const data = insertMachineSchema.partial().parse(req.body);
      const machine = await storage.updateMachine(req.params.id, data);
      if (!machine) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }
      res.json(machine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar máquina" });
    }
  });

  app.delete("/api/machines/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteMachine(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar máquina" });
    }
  });

  app.get("/api/machines/:id/inventory", async (req: Request, res: Response) => {
    try {
      const inventory = await storage.getMachineInventory(req.params.id);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener inventario" });
    }
  });

  app.post("/api/machines/:id/inventory", async (req: Request, res: Response) => {
    try {
      const data = insertMachineInventorySchema.parse({
        ...req.body,
        machineId: req.params.id,
      });
      const inventory = await storage.setMachineInventory(data);
      res.status(201).json(inventory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar inventario" });
    }
  });

  app.patch("/api/machines/:id/inventory/:productId", async (req: Request, res: Response) => {
    try {
      const { quantity } = req.body;
      const inventory = await storage.updateMachineInventory(
        req.params.id,
        req.params.productId,
        quantity
      );
      if (!inventory) {
        return res.status(404).json({ error: "Inventario no encontrado" });
      }
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar inventario" });
    }
  });

  app.get("/api/machines/:id/alerts", async (req: Request, res: Response) => {
    try {
      const { resolved } = req.query;
      const alerts = await storage.getMachineAlerts(
        req.params.id,
        resolved === "true" ? true : resolved === "false" ? false : undefined
      );
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener alertas" });
    }
  });

  app.get("/api/alerts", async (req: Request, res: Response) => {
    try {
      const { resolved } = req.query;
      
      if (!resolved || resolved === "false") {
        const cache = getDashboardCache();
        if (cache && isCacheValid()) {
          return res.json(cache.recentAlerts);
        }
      }
      
      const alerts = await storage.getMachineAlerts(
        undefined,
        resolved === "true" ? true : resolved === "false" ? false : undefined
      );
      if (res.headersSent) return;
      res.json(alerts);
    } catch (error) {
      if (res.headersSent) return;
      res.status(500).json({ error: "Error al obtener alertas" });
    }
  });

  app.post("/api/machines/:id/alerts", async (req: Request, res: Response) => {
    try {
      const data = insertMachineAlertSchema.parse({
        ...req.body,
        machineId: req.params.id,
      });
      const alert = await storage.createMachineAlert(data);
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear alerta" });
    }
  });

  app.patch("/api/alerts/:id/resolve", async (req: Request, res: Response) => {
    try {
      const alert = await storage.resolveAlertSimple(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Alerta no encontrada" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Error al resolver alerta" });
    }
  });

  app.get("/api/machines/:id/visits", async (req: Request, res: Response) => {
    try {
      const visits = await storage.getMachineVisits(req.params.id);
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener visitas" });
    }
  });

  app.post("/api/machines/:id/visits", async (req: Request, res: Response) => {
    try {
      const body = {
        ...req.body,
        machineId: req.params.id,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
      };
      const data = insertMachineVisitSchema.parse(body);
      const visit = await storage.createMachineVisit(data);
      res.status(201).json(visit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear visita" });
    }
  });

  app.patch("/api/visits/:id/end", async (req: Request, res: Response) => {
    try {
      const { endTime, notes } = req.body;
      const visit = await storage.endMachineVisit(
        req.params.id,
        new Date(endTime),
        notes
      );
      if (!visit) {
        return res.status(404).json({ error: "Visita no encontrada" });
      }
      res.json(visit);
    } catch (error) {
      res.status(500).json({ error: "Error al finalizar visita" });
    }
  });

  app.get("/api/machines/:id/sales", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const sales = await storage.getMachineSales(
        req.params.id,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener ventas" });
    }
  });

  app.post("/api/machines/:id/sales", async (req: Request, res: Response) => {
    try {
      const data = insertMachineSaleSchema.parse({
        ...req.body,
        machineId: req.params.id,
      });
      const sale = await storage.createMachineSale(data);
      res.status(201).json(sale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al registrar venta" });
    }
  });

  app.get("/api/machines/:id/sales/summary", async (req: Request, res: Response) => {
    try {
      const summary = await storage.getMachineSalesSummary(req.params.id);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen de ventas" });
    }
  });

  app.get("/api/stats/zones", async (req: Request, res: Response) => {
    try {
      const machines = await storage.getMachines();
      const zonesSet = new Set(machines.map(m => m.zone).filter(Boolean));
      const zones = Array.from(zonesSet);
      res.json(zones);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener zonas" });
    }
  });

  // ==================== MÓDULO ALMACÉN ====================

  // Proveedores (protegidos con JWT)
  app.get("/api/suppliers", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener proveedores" });
    }
  });

  app.get("/api/suppliers/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const supplier = await storage.getSupplier(req.params.id);
      if (!supplier) {
        return res.status(404).json({ error: "Proveedor no encontrado" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener proveedor" });
    }
  });

  app.post("/api/suppliers", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(data);
      res.status(201).json(supplier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear proveedor" });
    }
  });

  app.patch("/api/suppliers/:id", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertSupplierSchema.partial().parse(req.body);
      const supplier = await storage.updateSupplier(req.params.id, data);
      if (!supplier) {
        return res.status(404).json({ error: "Proveedor no encontrado" });
      }
      res.json(supplier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar proveedor" });
    }
  });

  app.delete("/api/suppliers/:id", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteSupplier(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar proveedor" });
    }
  });

  // Inventario de Almacén (protegido con JWT)
  app.get("/api/warehouse/inventory", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inventory = await storage.getWarehouseInventory();
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener inventario de almacén" });
    }
  });

  app.get("/api/warehouse/low-stock", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lowStock = await storage.getLowStockAlerts();
      res.json(lowStock);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener alertas de stock bajo" });
    }
  });

  app.patch("/api/warehouse/inventory/:productId", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { quantity, minStock, maxStock, reorderPoint } = req.body;
      const inventory = await storage.updateWarehouseInventory(req.params.productId, {
        currentStock: quantity,
        minStock,
        maxStock,
        reorderPoint,
      });
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar stock" });
    }
  });

  // Lotes de Productos (protegido con JWT)
  app.get("/api/warehouse/lots", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId } = req.query;
      const lots = await storage.getProductLots(productId as string | undefined);
      res.json(lots);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener lotes" });
    }
  });

  app.get("/api/warehouse/lots/expiring", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { days } = req.query;
      const expiringLots = await storage.getExpiringLots(parseInt(days as string) || 30);
      res.json(expiringLots);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener lotes por vencer" });
    }
  });

  app.post("/api/warehouse/lots", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertProductLotSchema.parse(req.body);
      const lot = await storage.createProductLot(data);
      res.status(201).json(lot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear lote" });
    }
  });

  // Movimientos/Kardex (protegido con JWT)
  app.get("/api/warehouse/movements", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, limit } = req.query;
      const movements = await storage.getWarehouseMovements(
        productId as string | undefined,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener movimientos" });
    }
  });

  // Entrada de mercancía - solo admin y almacen pueden registrar entradas
  app.post("/api/warehouse/entry", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, quantity, unitCost, supplierId, lotNumber, expirationDate, notes } = req.body;
      
      if (!productId || !quantity || !unitCost || !lotNumber) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      
      const movement = await storage.registerPurchaseEntry({
        productId,
        quantity: parseInt(quantity),
        unitCost: parseFloat(unitCost),
        supplierId,
        lotNumber,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        notes,
        userId: req.user!.userId,
      });
      
      res.status(201).json(movement);
    } catch (error) {
      console.error("Error registering entry:", error);
      res.status(500).json({ error: "Error al registrar entrada" });
    }
  });

  // Salida hacia abastecedor - solo admin y almacen pueden registrar salidas
  app.post("/api/warehouse/exit", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, quantity, destinationUserId, notes } = req.body;
      
      if (!productId || !quantity || !destinationUserId) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      
      const movement = await storage.registerSupplierExit({
        productId,
        quantity: parseInt(quantity),
        destinationUserId,
        notes,
        userId: req.user!.userId,
      });
      
      res.status(201).json(movement);
    } catch (error: any) {
      if (error.message === "Stock insuficiente") {
        return res.status(400).json({ error: "Stock insuficiente para realizar la salida" });
      }
      console.error("Error registering exit:", error);
      res.status(500).json({ error: "Error al registrar salida" });
    }
  });

  // Ajuste de inventario - solo admin y almacen pueden ajustar
  app.post("/api/warehouse/adjustment", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, physicalCount, notes, reason } = req.body;
      
      if (!productId || physicalCount === undefined) {
        return res.status(400).json({ error: "Faltan campos requeridos: productId y physicalCount" });
      }
      
      const movement = await storage.registerInventoryAdjustment({
        productId,
        physicalCount: parseInt(physicalCount),
        reason: reason || "Ajuste de inventario físico",
        notes,
        userId: req.user!.userId,
      });
      
      res.status(201).json(movement);
    } catch (error) {
      console.error("Error registering adjustment:", error);
      res.status(500).json({ error: "Error al registrar ajuste de inventario" });
    }
  });

  // Estadísticas del almacén (protegido con JWT)
  app.get("/api/warehouse/stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inventory = await storage.getWarehouseInventory();
      const lowStock = await storage.getLowStockAlerts();
      const expiringLots = await storage.getExpiringLots(30);
      const movements = await storage.getWarehouseMovements(undefined, 10);
      
      const totalProducts = inventory.length;
      const totalStock = inventory.reduce((sum, inv) => sum + (inv.currentStock || 0), 0);
      const totalValue = inventory.reduce((sum, inv) => {
        const cost = parseFloat(inv.product.costPrice || "0");
        return sum + (inv.currentStock || 0) * cost;
      }, 0);
      
      res.json({
        totalProducts,
        totalStock,
        totalValue,
        lowStockCount: lowStock.length,
        expiringCount: expiringLots.length,
        recentMovements: movements,
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  // Valorización del inventario con costo promedio ponderado
  app.get("/api/warehouse/valuation", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inventory = await storage.getWarehouseInventory();
      const lots = await storage.getProductLots();
      
      // Calcular valorización por producto usando costo promedio ponderado de lotes
      const valuation = inventory.map(inv => {
        const productLots = lots.filter(l => l.productId === inv.productId && l.remainingQuantity > 0);
        
        // Costo promedio ponderado = Σ(cantidad * costo) / Σ(cantidad)
        let totalCost = 0;
        let totalQty = 0;
        
        for (const lot of productLots) {
          const lotCost = parseFloat(lot.costPrice || "0");
          const lotQty = lot.remainingQuantity;
          totalCost += lotCost * lotQty;
          totalQty += lotQty;
        }
        
        const weightedAvgCost = totalQty > 0 ? totalCost / totalQty : parseFloat(inv.product.costPrice || "0");
        const stockValue = (inv.currentStock || 0) * weightedAvgCost;
        
        return {
          productId: inv.productId,
          productName: inv.product.name,
          productCode: inv.product.code,
          currentStock: inv.currentStock || 0,
          unitCost: weightedAvgCost.toFixed(2),
          totalValue: stockValue.toFixed(2),
          lotCount: productLots.length,
        };
      });
      
      const grandTotal = valuation.reduce((sum, v) => sum + parseFloat(v.totalValue), 0);
      
      res.json({
        items: valuation,
        grandTotal: grandTotal.toFixed(2),
        productCount: valuation.length,
        calculatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error calculating valuation:", error);
      res.status(500).json({ error: "Error al calcular valorización" });
    }
  });

  // Configurar alertas de inventario por producto
  app.patch("/api/warehouse/inventory/:productId/alerts", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId } = req.params;
      const { minStock, maxStock, reorderPoint } = req.body;
      
      // Validar que al menos un campo esté presente
      if (minStock === undefined && maxStock === undefined && reorderPoint === undefined) {
        return res.status(400).json({ error: "Debe proporcionar al menos un campo: minStock, maxStock, o reorderPoint" });
      }
      
      // Validar valores numéricos
      const updateData: { minStock?: number; maxStock?: number; reorderPoint?: number } = {};
      if (minStock !== undefined) {
        const min = parseInt(minStock);
        if (isNaN(min) || min < 0) return res.status(400).json({ error: "minStock debe ser un número positivo" });
        updateData.minStock = min;
      }
      if (maxStock !== undefined) {
        const max = parseInt(maxStock);
        if (isNaN(max) || max < 0) return res.status(400).json({ error: "maxStock debe ser un número positivo" });
        updateData.maxStock = max;
      }
      if (reorderPoint !== undefined) {
        const reorder = parseInt(reorderPoint);
        if (isNaN(reorder) || reorder < 0) return res.status(400).json({ error: "reorderPoint debe ser un número positivo" });
        updateData.reorderPoint = reorder;
      }
      
      const updated = await storage.updateWarehouseInventory(productId, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating inventory alerts:", error);
      res.status(500).json({ error: "Error al actualizar configuración de alertas" });
    }
  });

  // Exportar inventario a CSV
  app.get("/api/warehouse/export/inventory", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inventory = await storage.getWarehouseInventory();
      
      const headers = ["Código", "Producto", "Categoría", "Stock Actual", "Stock Mínimo", "Stock Máximo", "Punto Reorden", "Costo Unitario", "Valor Total"];
      const rows = inventory.map(inv => [
        inv.product.code || "",
        inv.product.name,
        inv.product.category || "",
        inv.currentStock || 0,
        inv.minStock || 10,
        inv.maxStock || 100,
        inv.reorderPoint || 20,
        inv.product.costPrice || "0",
        ((inv.currentStock || 0) * parseFloat(inv.product.costPrice || "0")).toFixed(2)
      ]);
      
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="inventario_${new Date().toISOString().split("T")[0]}.csv"`);
      res.send("\uFEFF" + csv); // BOM for Excel UTF-8
    } catch (error) {
      console.error("Error exporting inventory:", error);
      res.status(500).json({ error: "Error al exportar inventario" });
    }
  });

  // Exportar movimientos/Kardex a CSV
  app.get("/api/warehouse/export/movements", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { limit } = req.query;
      const movements = await storage.getWarehouseMovements(undefined, limit ? parseInt(limit as string) : 500);
      
      const typeLabels: Record<string, string> = {
        entrada_compra: "Entrada (Compra)",
        entrada_devolucion: "Entrada (Devolución)",
        salida_abastecedor: "Salida (Abastecedor)",
        salida_merma: "Salida (Merma)",
        salida_caducidad: "Salida (Caducidad)",
        salida_danio: "Salida (Daño)",
        ajuste_inventario: "Ajuste",
        transferencia: "Transferencia",
      };
      
      const headers = ["Fecha", "Tipo", "Producto", "Cantidad", "Stock Anterior", "Stock Nuevo", "Costo Unitario", "Costo Total", "Referencia", "Notas"];
      const rows = movements.map(mov => [
        mov.createdAt ? new Date(mov.createdAt).toLocaleString("es-DO") : "",
        typeLabels[mov.movementType] || mov.movementType,
        mov.product.name,
        mov.quantity,
        mov.previousStock,
        mov.newStock,
        mov.unitCost || "",
        mov.totalCost || "",
        mov.reference || "",
        mov.notes || ""
      ]);
      
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="kardex_${new Date().toISOString().split("T")[0]}.csv"`);
      res.send("\uFEFF" + csv);
    } catch (error) {
      console.error("Error exporting movements:", error);
      res.status(500).json({ error: "Error al exportar movimientos" });
    }
  });

  // Exportar lotes a CSV
  app.get("/api/warehouse/export/lots", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lots = await storage.getProductLots();
      
      const headers = ["Número Lote", "Producto", "Cantidad Original", "Cantidad Restante", "Fecha Vencimiento", "Costo Unitario", "Proveedor", "Fecha Compra", "Estado"];
      const rows = lots.map(lot => {
        const isExpired = lot.expirationDate && new Date(lot.expirationDate) < new Date();
        const isLow = lot.remainingQuantity <= 0;
        const status = isExpired ? "Vencido" : isLow ? "Agotado" : "Activo";
        
        return [
          lot.lotNumber,
          lot.product.name,
          lot.quantity,
          lot.remainingQuantity,
          lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString("es-DO") : "",
          lot.costPrice || "",
          lot.supplier?.name || "",
          lot.purchaseDate ? new Date(lot.purchaseDate).toLocaleDateString("es-DO") : "",
          status
        ];
      });
      
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lotes_${new Date().toISOString().split("T")[0]}.csv"`);
      res.send("\uFEFF" + csv);
    } catch (error) {
      console.error("Error exporting lots:", error);
      res.status(500).json({ error: "Error al exportar lotes" });
    }
  });

  // ==================== MÓDULO ABASTECEDOR ====================
  // Roles permitidos: admin, supervisor, abastecedor

  // Rutas
  app.get("/api/supplier/routes", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, date, status } = req.query;
      const routes = await storage.getRoutes(
        userId as string | undefined,
        date ? new Date(date as string) : undefined,
        status as string | undefined
      );
      res.json(routes);
    } catch (error) {
      console.error("Error getting routes:", error);
      res.status(500).json({ error: "Error al obtener rutas" });
    }
  });

  app.get("/api/supplier/routes/:id", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const route = await storage.getRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener ruta" });
    }
  });

  app.get("/api/supplier/today-route/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const route = await storage.getTodayRoute(req.params.userId);
      if (!route) {
        return res.json(null);
      }
      res.json(route);
    } catch (error) {
      console.error("Error getting today route:", error);
      res.status(500).json({ error: "Error al obtener ruta del día" });
    }
  });

  app.post("/api/supplier/routes", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertRouteSchema.parse(req.body);
      const route = await storage.createRoute(data);
      res.status(201).json(route);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating route:", error);
      res.status(500).json({ error: "Error al crear ruta" });
    }
  });

  app.patch("/api/supplier/routes/:id", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertRouteSchema.partial().parse(req.body);
      const route = await storage.updateRoute(req.params.id, data);
      if (!route) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      res.json(route);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar ruta" });
    }
  });

  app.post("/api/supplier/routes/:id/start", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const route = await storage.startRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Error al iniciar ruta" });
    }
  });

  app.post("/api/supplier/routes/:id/complete", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const route = await storage.completeRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Error al completar ruta" });
    }
  });

  // Paradas de Ruta
  app.get("/api/supplier/routes/:routeId/stops", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stops = await storage.getRouteStops(req.params.routeId);
      res.json(stops);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener paradas" });
    }
  });

  // Endpoint batch para obtener paradas de múltiples rutas en una sola llamada
  app.post("/api/supplier/route-stops-batch", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { routeIds } = req.body;
      if (!Array.isArray(routeIds)) {
        return res.status(400).json({ error: "Se requiere un array de routeIds" });
      }
      const stopsMap = await storage.getRouteStopsBatch(routeIds);
      res.json(stopsMap);
    } catch (error) {
      console.error("Error fetching batch route stops:", error);
      res.status(500).json({ error: "Error al obtener paradas en batch" });
    }
  });

  app.get("/api/supplier/stops/:id", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stop = await storage.getRouteStop(req.params.id);
      if (!stop) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      res.json(stop);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener parada" });
    }
  });

  app.post("/api/supplier/routes/:routeId/stops", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertRouteStopSchema.parse({
        ...req.body,
        routeId: req.params.routeId,
      });
      const stop = await storage.createRouteStop(data);
      
      // Actualizar total de paradas en la ruta
      const route = await storage.getRoute(req.params.routeId);
      if (route) {
        await storage.updateRoute(req.params.routeId, { totalStops: (route.totalStops || 0) + 1 });
      }
      
      res.status(201).json(stop);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating stop:", error);
      res.status(500).json({ error: "Error al crear parada" });
    }
  });

  app.post("/api/supplier/stops/:id/start", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stop = await storage.startStop(req.params.id);
      if (!stop) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      res.json(stop);
    } catch (error) {
      res.status(500).json({ error: "Error al iniciar parada" });
    }
  });

  app.post("/api/supplier/stops/:id/complete", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stop = await storage.completeStop(req.params.id);
      if (!stop) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      res.json(stop);
    } catch (error) {
      res.status(500).json({ error: "Error al completar parada" });
    }
  });

  app.delete("/api/supplier/routes/:id", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const route = await storage.getRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      if (route.status !== "pendiente") {
        return res.status(400).json({ error: "Solo se pueden eliminar rutas pendientes" });
      }
      await storage.deleteRoute(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar ruta" });
    }
  });

  app.delete("/api/supplier/stops/:id", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const success = await storage.deleteRouteStop(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar parada" });
    }
  });

  // Registros de Servicio
  app.get("/api/supplier/services", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, machineId, limit } = req.query;
      const services = await storage.getServiceRecords(
        userId as string | undefined,
        machineId as string | undefined,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener servicios" });
    }
  });

  app.get("/api/supplier/services/:id", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const service = await storage.getServiceRecord(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener servicio" });
    }
  });

  app.get("/api/supplier/active-service/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const routeStopId = req.query.routeStopId as string | undefined;
      const service = await storage.getActiveService(req.params.userId, routeStopId);
      res.json(service || null);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener servicio activo" });
    }
  });

  app.post("/api/supplier/services", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertServiceRecordSchema.parse(req.body);
      const service = await storage.startService(data);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error starting service:", error);
      res.status(500).json({ error: "Error al iniciar servicio" });
    }
  });

  app.post("/api/supplier/services/:id/end", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { notes, signature, responsibleName } = req.body;
      const service = await storage.endService(req.params.id, notes, signature, responsibleName);
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: "Error al finalizar servicio" });
    }
  });

  // Recolección de Efectivo
  app.get("/api/supplier/cash", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, machineId, startDate, endDate } = req.query;
      const collections = await storage.getCashCollections(
        userId as string | undefined,
        machineId as string | undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(collections);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener recolecciones" });
    }
  });

  app.post("/api/supplier/cash", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertCashCollectionSchema.parse(req.body);
      const collection = await storage.createCashCollection(data);
      res.status(201).json(collection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating cash collection:", error);
      res.status(500).json({ error: "Error al registrar recolección" });
    }
  });

  app.get("/api/supplier/cash/summary/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const summary = await storage.getCashCollectionsSummary(
        req.params.userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen de efectivo" });
    }
  });

  // Carga/Retiro de Productos
  app.get("/api/supplier/loads", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serviceRecordId, machineId } = req.query;
      const loads = await storage.getProductLoads(
        serviceRecordId as string | undefined,
        machineId as string | undefined
      );
      res.json(loads);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener cargas" });
    }
  });

  app.post("/api/supplier/loads", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertProductLoadSchema.parse(req.body);
      const load = await storage.createProductLoad(data);
      res.status(201).json(load);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating product load:", error);
      res.status(500).json({ error: "Error al registrar carga" });
    }
  });

  // Reportes de Problemas
  app.get("/api/supplier/issues", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { machineId, status, userId } = req.query;
      const issues = await storage.getIssueReports(
        machineId as string | undefined,
        status as string | undefined,
        userId as string | undefined
      );
      res.json(issues);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener reportes" });
    }
  });

  app.get("/api/supplier/issues/:id", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const issue = await storage.getIssueReport(req.params.id);
      if (!issue) {
        return res.status(404).json({ error: "Reporte no encontrado" });
      }
      res.json(issue);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener reporte" });
    }
  });

  app.post("/api/supplier/issues", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertIssueReportSchema.parse(req.body);
      const issue = await storage.createIssueReport(data);
      res.status(201).json(issue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating issue report:", error);
      res.status(500).json({ error: "Error al crear reporte" });
    }
  });

  app.post("/api/supplier/issues/:id/resolve", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { resolution } = req.body;
      const userId = req.user?.userId;
      if (!userId || !resolution) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      const issue = await storage.resolveIssue(req.params.id, userId, resolution);
      if (!issue) {
        return res.status(404).json({ error: "Reporte no encontrado" });
      }
      res.json(issue);
    } catch (error) {
      res.status(500).json({ error: "Error al resolver reporte" });
    }
  });

  // Inventario del Abastecedor
  app.get("/api/supplier/inventory/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inventory = await storage.getSupplierInventory(req.params.userId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener inventario del abastecedor" });
    }
  });

  app.post("/api/supplier/inventory/load", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, productId, quantity } = req.body;
      if (!userId || !productId || !quantity) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      await storage.loadProductsFromWarehouse(userId, productId, parseInt(quantity));
      res.status(201).json({ message: "Productos cargados exitosamente" });
    } catch (error: any) {
      if (error.message === "Stock insuficiente") {
        return res.status(400).json({ error: "Stock insuficiente en almacén" });
      }
      console.error("Error loading products:", error);
      res.status(500).json({ error: "Error al cargar productos" });
    }
  });

  app.post("/api/supplier/inventory/unload", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, machineId, productId, quantity } = req.body;
      if (!userId || !machineId || !productId || !quantity) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      await storage.unloadProductsToMachine(userId, machineId, productId, parseInt(quantity));
      res.status(201).json({ message: "Productos descargados exitosamente" });
    } catch (error: any) {
      if (error.message === "Inventario insuficiente del abastecedor") {
        return res.status(400).json({ error: "Inventario insuficiente del abastecedor" });
      }
      console.error("Error unloading products:", error);
      res.status(500).json({ error: "Error al descargar productos" });
    }
  });

  // Cargar múltiples productos a máquina (desde el panel del abastecedor)
  app.post("/api/supplier/load-products", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { machineId, products } = req.body;
      if (!machineId || !products || !Array.isArray(products)) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      
      const { db } = await import("./db");
      const { machineInventory } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      let totalLoaded = 0;
      for (const product of products) {
        if (product.quantity > 0) {
          const [existing] = await db.select().from(machineInventory)
            .where(and(
              eq(machineInventory.machineId, machineId),
              eq(machineInventory.productId, product.productId)
            ));
          
          if (existing) {
            await db.update(machineInventory)
              .set({ 
                currentQuantity: (existing.currentQuantity || 0) + product.quantity,
                lastUpdated: new Date()
              })
              .where(eq(machineInventory.id, existing.id));
          } else {
            await db.insert(machineInventory).values({
              machineId,
              productId: product.productId,
              currentQuantity: product.quantity,
              maxCapacity: 20,
              minLevel: 5,
            });
          }
          totalLoaded += product.quantity;
        }
      }
      
      res.status(201).json({ message: "Productos cargados exitosamente", totalLoaded });
    } catch (error) {
      console.error("Error loading products to machine:", error);
      res.status(500).json({ error: "Error al cargar productos" });
    }
  });

  // Estadísticas del Abastecedor
  app.get("/api/supplier/stats/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await storage.getSupplierStats(
        req.params.userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(stats);
    } catch (error) {
      console.error("Error getting supplier stats:", error);
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  // Usuarios (para demo)
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { role } = req.query;
      
      let allUsers;
      if (role && typeof role === 'string') {
        allUsers = await db.select().from(users).where(eq(users.role, role));
      } else {
        allUsers = await db.select().from(users);
      }
      // Omitir password de la respuesta por seguridad
      const usersWithoutPassword = allUsers.map(({ password, ...user }) => user);
      res.json(usersWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener usuario" });
    }
  });

  // Schema para validar campos actualizables del perfil (excluye password, role, isActive)
  const updateProfileSchema = z.object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    phone: z.string().optional(),
  }).strict();

  app.patch("/api/users/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autenticado" });
      }

      // Verificar que el usuario solo pueda modificar su propio perfil (o admin para otros)
      if (req.user.userId !== req.params.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "No tienes permiso para modificar este usuario" });
      }
      
      // Validar que solo se actualicen campos permitidos
      const validatedData = updateProfileSchema.parse(req.body);
      
      const updateData: { fullName?: string; email?: string; username?: string; phone?: string } = {};
      if (validatedData.fullName !== undefined) updateData.fullName = validatedData.fullName;
      if (validatedData.email !== undefined) updateData.email = validatedData.email;
      if (validatedData.username !== undefined) updateData.username = validatedData.username;
      if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No se proporcionaron campos válidos para actualizar" });
      }
      
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Error al actualizar usuario" });
    }
  });

  // Schema para cambio de contraseña
  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
  });

  app.post("/api/auth/change-password", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const validatedData = changePasswordSchema.parse(req.body);
      const { currentPassword, newPassword } = validatedData;
      
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      
      const bcrypt = await import("bcryptjs");
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Contraseña actual incorrecta" });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updated = await storage.updateUserPassword(req.user.userId, hashedPassword);
      
      if (!updated) {
        return res.status(500).json({ error: "Error al actualizar contraseña" });
      }

      // Revocar todos los refresh tokens excepto el actual (forzar re-login en otros dispositivos)
      await storage.revokeAllUserRefreshTokens(req.user.userId);
      
      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || "Datos inválidos" });
      }
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Error al cambiar contraseña" });
    }
  });

  // ==================== GESTIÓN DE USUARIOS (ADMIN) ====================

  const adminUserSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6).optional(),
    fullName: z.string().min(2),
    email: z.string().email().or(z.literal("")).optional(),
    phone: z.string().optional(),
    role: z.string().min(1),
    assignedZone: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  // Crear usuario (solo admin)
  app.post("/api/admin/users", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validatedData = adminUserSchema.parse(req.body);
      
      if (!validatedData.password) {
        return res.status(400).json({ error: "La contraseña es requerida" });
      }

      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Verificar que el username no exista
      const existing = await db.select().from(users).where(eq(users.username, validatedData.username)).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "El nombre de usuario ya existe" });
      }
      
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const [newUser] = await db.insert(users).values({
        username: validatedData.username,
        password: hashedPassword,
        fullName: validatedData.fullName,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        role: validatedData.role,
        assignedZone: validatedData.assignedZone || null,
        isActive: validatedData.isActive ?? true,
      }).returning();
      
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Error al crear usuario" });
    }
  });

  // Actualizar usuario (solo admin - todos los campos)
  app.patch("/api/admin/users/:id", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validatedData = adminUserSchema.partial().parse(req.body);
      
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const updateData: Record<string, any> = {};
      
      if (validatedData.username !== undefined) updateData.username = validatedData.username;
      if (validatedData.fullName !== undefined) updateData.fullName = validatedData.fullName;
      if (validatedData.email !== undefined) updateData.email = validatedData.email || null;
      if (validatedData.phone !== undefined) updateData.phone = validatedData.phone || null;
      if (validatedData.role !== undefined) updateData.role = validatedData.role;
      if (validatedData.assignedZone !== undefined) updateData.assignedZone = validatedData.assignedZone || null;
      if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
      
      // Si se proporciona contraseña, hashearla
      if (validatedData.password) {
        const bcrypt = await import("bcryptjs");
        updateData.password = await bcrypt.hash(validatedData.password, 10);
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No se proporcionaron campos para actualizar" });
      }
      
      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, req.params.id))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Error al actualizar usuario" });
    }
  });

  // ==================== MÓDULO PRODUCTOS Y DINERO ====================

  // Movimientos de Efectivo
  app.get("/api/cash-movements", async (req: Request, res: Response) => {
    try {
      const { userId, type, status, startDate, endDate } = req.query;
      const filters = {
        userId: userId as string | undefined,
        type: type as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };
      const movements = await storage.getCashMovements(filters);
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener movimientos" });
    }
  });

  app.get("/api/cash-movements/summary", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const summary = await storage.getCashMovementsSummary(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen" });
    }
  });

  app.get("/api/cash-movements/:id", async (req: Request, res: Response) => {
    try {
      const movement = await storage.getCashMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movimiento no encontrado" });
      }
      res.json(movement);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener movimiento" });
    }
  });

  app.post("/api/cash-movements", async (req: Request, res: Response) => {
    try {
      const data = insertCashMovementSchema.parse(req.body);
      const movement = await storage.createCashMovement(data);
      res.status(201).json(movement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear movimiento" });
    }
  });

  app.patch("/api/cash-movements/:id/status", async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Falta el estado" });
      }
      const movement = await storage.updateCashMovementStatus(req.params.id, status);
      if (!movement) {
        return res.status(404).json({ error: "Movimiento no encontrado" });
      }
      res.json(movement);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar movimiento" });
    }
  });

  app.post("/api/cash-movements/:id/reconcile", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Falta el usuario que concilia" });
      }
      const movement = await storage.reconcileCashMovement(req.params.id, userId);
      if (!movement) {
        return res.status(404).json({ error: "Movimiento no encontrado" });
      }
      res.json(movement);
    } catch (error) {
      res.status(500).json({ error: "Error al conciliar movimiento" });
    }
  });

  // Depósitos Bancarios
  app.get("/api/bank-deposits", async (req: Request, res: Response) => {
    try {
      const { userId, status, startDate, endDate } = req.query;
      const filters = {
        userId: userId as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };
      const deposits = await storage.getBankDeposits(filters);
      res.json(deposits);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener depósitos" });
    }
  });

  app.get("/api/bank-deposits/:id", async (req: Request, res: Response) => {
    try {
      const deposit = await storage.getBankDeposit(req.params.id);
      if (!deposit) {
        return res.status(404).json({ error: "Depósito no encontrado" });
      }
      res.json(deposit);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener depósito" });
    }
  });

  app.post("/api/bank-deposits", async (req: Request, res: Response) => {
    try {
      const data = insertBankDepositSchema.parse(req.body);
      const deposit = await storage.createBankDeposit(data);
      res.status(201).json(deposit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear depósito" });
    }
  });

  app.post("/api/bank-deposits/:id/reconcile", async (req: Request, res: Response) => {
    try {
      const { amount } = req.body;
      if (amount === undefined) {
        return res.status(400).json({ error: "Falta el monto conciliado" });
      }
      const deposit = await storage.reconcileBankDeposit(req.params.id, parseFloat(amount));
      if (!deposit) {
        return res.status(404).json({ error: "Depósito no encontrado" });
      }
      res.json(deposit);
    } catch (error) {
      res.status(500).json({ error: "Error al conciliar depósito" });
    }
  });

  // Transferencias de Productos (protegido con JWT)
  app.get("/api/product-transfers", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, productId, startDate, endDate } = req.query;
      const filters = {
        type: type as string | undefined,
        productId: productId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };
      const transfers = await storage.getProductTransfers(filters);
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transferencias" });
    }
  });

  app.get("/api/product-transfers/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transfer = await storage.getProductTransfer(req.params.id);
      if (!transfer) {
        return res.status(404).json({ error: "Transferencia no encontrada" });
      }
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transferencia" });
    }
  });

  app.post("/api/product-transfers", authenticateJWT, authorizeRoles("admin", "almacen", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertProductTransferSchema.parse(req.body);
      const transfer = await storage.createProductTransfer(data);
      res.status(201).json(transfer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear transferencia" });
    }
  });

  // Mermas (protegido con JWT)
  app.get("/api/shrinkage", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, productId, status, startDate, endDate } = req.query;
      const filters = {
        type: type as string | undefined,
        productId: productId as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };
      const records = await storage.getShrinkageRecords(filters);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener mermas" });
    }
  });

  app.get("/api/shrinkage/summary", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const summary = await storage.getShrinkageSummary(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen de mermas" });
    }
  });

  app.get("/api/shrinkage/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await storage.getShrinkageRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Merma no encontrada" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener merma" });
    }
  });

  app.post("/api/shrinkage", authenticateJWT, authorizeRoles("admin", "almacen", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertShrinkageRecordSchema.parse({
        ...req.body,
        userId: req.user!.userId,
      });
      
      // Crear registro de merma
      const record = await storage.createShrinkageRecord(data);
      
      // Registrar salida en el inventario del almacén
      const movementType = data.shrinkageType === "caducidad" ? "salida_caducidad" : 
                          data.shrinkageType === "danio" ? "salida_danio" : "salida_merma";
      
      const currentInventory = await storage.getWarehouseInventoryItem(data.productId);
      const previousStock = currentInventory?.currentStock || 0;
      const newStock = Math.max(0, previousStock - data.quantity);
      
      // Solo actualizar inventario si hay stock
      if (previousStock > 0) {
        await storage.updateWarehouseStock(data.productId, newStock);
        
        await storage.createWarehouseMovement({
          productId: data.productId,
          lotId: data.lotId,
          movementType,
          quantity: data.quantity,
          previousStock,
          newStock,
          userId: req.user!.userId,
          reference: `Merma #${record.id.slice(-8)}`,
          notes: data.reason,
        });
      }
      
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al registrar merma" });
    }
  });

  app.post("/api/shrinkage/:id/approve", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await storage.approveShrinkage(req.params.id, req.user!.userId);
      if (!record) {
        return res.status(404).json({ error: "Merma no encontrada" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Error al aprobar merma" });
    }
  });

  // Conciliación
  app.get("/api/reconciliation/daily", async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const reconciliation = await storage.getDailyReconciliation(targetDate);
      res.json(reconciliation);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener conciliación diaria" });
    }
  });

  app.get("/api/reconciliation/supplier/:userId", async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const reconciliation = await storage.getSupplierReconciliation(req.params.userId, targetDate);
      res.json(reconciliation);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener conciliación del abastecedor" });
    }
  });

  // ==================== MÓDULO CAJA CHICA ====================

  // Gastos de Caja Chica
  app.get("/api/petty-cash/expenses", async (req: Request, res: Response) => {
    try {
      const { userId, category, status, startDate, endDate } = req.query;
      const filters = {
        userId: userId as string | undefined,
        category: category as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };
      const expenses = await storage.getPettyCashExpenses(filters);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener gastos" });
    }
  });

  app.get("/api/petty-cash/expenses/:id", async (req: Request, res: Response) => {
    try {
      const expense = await storage.getPettyCashExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Gasto no encontrado" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener gasto" });
    }
  });

  app.post("/api/petty-cash/expenses", async (req: Request, res: Response) => {
    try {
      const data = insertPettyCashExpenseSchema.parse(req.body);
      const expense = await storage.createPettyCashExpense(data);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al registrar gasto" });
    }
  });

  app.post("/api/petty-cash/expenses/:id/approve", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Falta el usuario que aprueba" });
      }
      const expense = await storage.approvePettyCashExpense(req.params.id, userId);
      if (!expense) {
        return res.status(404).json({ error: "Gasto no encontrado" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Error al aprobar gasto" });
    }
  });

  app.post("/api/petty-cash/expenses/:id/reject", async (req: Request, res: Response) => {
    try {
      const { userId, reason } = req.body;
      if (!userId || !reason) {
        return res.status(400).json({ error: "Faltan datos requeridos" });
      }
      const expense = await storage.rejectPettyCashExpense(req.params.id, userId, reason);
      if (!expense) {
        return res.status(404).json({ error: "Gasto no encontrado" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Error al rechazar gasto" });
    }
  });

  app.post("/api/petty-cash/expenses/:id/pay", async (req: Request, res: Response) => {
    try {
      const expense = await storage.markPettyCashExpenseAsPaid(req.params.id);
      if (!expense) {
        return res.status(400).json({ error: "No se puede pagar este gasto" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Error al pagar gasto" });
    }
  });

  // Fondo de Caja Chica
  app.get("/api/petty-cash/fund", async (req: Request, res: Response) => {
    try {
      const fund = await storage.getPettyCashFund();
      res.json(fund || { initialized: false });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener fondo" });
    }
  });

  app.post("/api/petty-cash/fund", async (req: Request, res: Response) => {
    try {
      const data = insertPettyCashFundSchema.parse(req.body);
      const fund = await storage.initializePettyCashFund(data);
      res.status(201).json(fund);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al inicializar fondo" });
    }
  });

  app.post("/api/petty-cash/fund/replenish", async (req: Request, res: Response) => {
    try {
      const { amount, userId } = req.body;
      if (!amount || !userId) {
        return res.status(400).json({ error: "Faltan datos requeridos" });
      }
      const fund = await storage.replenishPettyCashFund(parseFloat(amount), userId);
      if (!fund) {
        return res.status(400).json({ error: "El fondo no está inicializado" });
      }
      res.json(fund);
    } catch (error) {
      res.status(500).json({ error: "Error al reponer fondo" });
    }
  });

  // Transacciones de Caja Chica
  app.get("/api/petty-cash/transactions", async (req: Request, res: Response) => {
    try {
      const { limit } = req.query;
      const transactions = await storage.getPettyCashTransactions(
        limit ? parseInt(limit as string) : undefined
      );
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transacciones" });
    }
  });

  // Estadísticas de Caja Chica
  app.get("/api/petty-cash/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getPettyCashStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  // ==================== MÓDULO COMPRAS (protegidos con JWT) ====================

  // Órdenes de Compra
  app.get("/api/purchase-orders", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { supplierId, status, startDate, endDate } = req.query;
      const filters: any = {};
      if (supplierId) filters.supplierId = supplierId as string;
      if (status) filters.status = status as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const orders = await storage.getPurchaseOrders(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener órdenes de compra" });
    }
  });

  app.get("/api/purchase-orders/next-number", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orderNumber = await storage.getNextOrderNumber();
      res.json({ orderNumber });
    } catch (error) {
      res.status(500).json({ error: "Error al generar número de orden" });
    }
  });

  app.get("/api/purchase-orders/stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await storage.getPurchaseStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas de compras" });
    }
  });

  app.get("/api/purchase-orders/low-stock", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const products = await storage.getLowStockProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener productos con bajo stock" });
    }
  });

  app.get("/api/purchase-orders/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const order = await storage.getPurchaseOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener orden" });
    }
  });

  app.post("/api/purchase-orders", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertPurchaseOrderSchema.omit({ orderNumber: true }).parse(req.body);
      const orderNumber = await storage.getNextOrderNumber();
      const order = await storage.createPurchaseOrder({
        ...data,
        orderNumber,
        createdBy: req.user!.userId
      });
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating purchase order:", error);
      res.status(500).json({ error: "Error al crear orden de compra" });
    }
  });

  app.patch("/api/purchase-orders/:id", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertPurchaseOrderSchema.partial().parse(req.body);
      const order = await storage.updatePurchaseOrder(req.params.id, data);
      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar orden" });
    }
  });

  app.patch("/api/purchase-orders/:id/status", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const statusSchema = z.object({
        status: z.enum(["borrador", "enviada", "parcialmente_recibida", "recibida", "cancelada"]),
        reason: z.string().optional()
      });
      const { status, reason } = statusSchema.parse(req.body);
      const order = await storage.updatePurchaseOrderStatus(req.params.id, status, req.user!.userId, reason);
      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar estado de orden" });
    }
  });

  app.delete("/api/purchase-orders/:id", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const deleted = await storage.deletePurchaseOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar orden" });
    }
  });

  // Items de Orden de Compra
  app.get("/api/purchase-orders/:id/items", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const items = await storage.getPurchaseOrderItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener items de la orden" });
    }
  });

  app.post("/api/purchase-orders/:id/items", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertPurchaseOrderItemSchema.omit({ orderId: true }).parse(req.body);
      const item = await storage.addPurchaseOrderItem({
        ...data,
        orderId: req.params.id
      });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error adding item:", error);
      res.status(500).json({ error: "Error al agregar item a la orden" });
    }
  });

  app.patch("/api/purchase-order-items/:id", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertPurchaseOrderItemSchema.partial().parse(req.body);
      const item = await storage.updatePurchaseOrderItem(req.params.id, data);
      if (!item) {
        return res.status(404).json({ error: "Item no encontrado" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar item" });
    }
  });

  app.delete("/api/purchase-order-items/:id", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const deleted = await storage.removePurchaseOrderItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Item no encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar item" });
    }
  });

  // Recepciones de Mercancía
  app.get("/api/purchase-receptions", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { orderId, startDate, endDate } = req.query;
      const filters: any = {};
      if (orderId) filters.orderId = orderId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const receptions = await storage.getPurchaseReceptions(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(receptions);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener recepciones" });
    }
  });

  app.get("/api/purchase-receptions/next-number", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const receptionNumber = await storage.getNextReceptionNumber();
      res.json({ receptionNumber });
    } catch (error) {
      res.status(500).json({ error: "Error al generar número de recepción" });
    }
  });

  app.get("/api/purchase-receptions/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reception = await storage.getPurchaseReception(req.params.id);
      if (!reception) {
        return res.status(404).json({ error: "Recepción no encontrada" });
      }
      res.json(reception);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener recepción" });
    }
  });

  app.post("/api/purchase-receptions", authenticateJWT, authorizeRoles("admin", "almacen"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bodySchema = z.object({
        reception: insertPurchaseReceptionSchema.omit({ receptionNumber: true }),
        items: z.array(insertReceptionItemSchema.omit({ receptionId: true }))
      });
      const { reception, items } = bodySchema.parse(req.body);
      const receptionNumber = await storage.getNextReceptionNumber();
      
      const newReception = await storage.createPurchaseReception(
        { ...reception, receptionNumber, receivedBy: req.user!.userId },
        items,
        req.user!.userId
      );
      res.status(201).json(newReception);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating reception:", error);
      res.status(500).json({ error: "Error al crear recepción" });
    }
  });

  // Historial de compras por proveedor
  app.get("/api/suppliers/:id/purchase-history", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { limit } = req.query;
      const history = await storage.getSupplierPurchaseHistory(
        req.params.id,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener historial de compras" });
    }
  });

  // ==================== MÓDULO COMBUSTIBLE ====================

  // Vehículos
  app.get("/api/vehicles", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, type, assignedUserId } = req.query;
      const vehicles = await storage.getVehicles({
        status: status as string,
        type: type as string,
        assignedUserId: assignedUserId as string
      });
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener vehículos" });
    }
  });

  app.get("/api/vehicles/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener vehículo" });
    }
  });

  app.post("/api/vehicles", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(validated);
      res.status(201).json(vehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Error al crear vehículo" });
    }
  });

  app.patch("/api/vehicles/:id", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = insertVehicleSchema.partial().parse(req.body);
      const vehicle = await storage.updateVehicle(req.params.id, validated);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }
      res.json(vehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar vehículo" });
    }
  });

  app.delete("/api/vehicles/:id", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteVehicle(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar vehículo" });
    }
  });

  // Estadísticas de vehículo
  app.get("/api/vehicles/:id/fuel-stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await storage.getVehicleFuelStats(
        req.params.id,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas de vehículo" });
    }
  });

  // Registros de combustible
  app.get("/api/fuel-records", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { vehicleId, userId, startDate, endDate, limit } = req.query;
      const records = await storage.getFuelRecords({
        vehicleId: vehicleId as string,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50
      });
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener registros de combustible" });
    }
  });

  app.get("/api/fuel-records/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await storage.getFuelRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener registro de combustible" });
    }
  });

  app.post("/api/fuel-records", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = insertFuelRecordSchema.parse(req.body);
      const record = await storage.createFuelRecord(validated);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating fuel record:", error);
      res.status(500).json({ error: "Error al crear registro de combustible" });
    }
  });

  app.patch("/api/fuel-records/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = insertFuelRecordSchema.partial().parse(req.body);
      const record = await storage.updateFuelRecord(req.params.id, validated);
      if (!record) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar registro de combustible" });
    }
  });

  app.delete("/api/fuel-records/:id", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteFuelRecord(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar registro de combustible" });
    }
  });

  // Estadísticas generales de combustible
  app.get("/api/fuel-stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { vehicleId, userId, startDate, endDate } = req.query;
      const stats = await storage.getFuelStats({
        vehicleId: vehicleId as string,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas de combustible" });
    }
  });

  // Estadísticas por usuario
  app.get("/api/users/:id/fuel-stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await storage.getUserFuelStats(
        req.params.id,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas del usuario" });
    }
  });

  // Estadísticas por ruta
  app.get("/api/fuel-stats/by-route", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await storage.getFuelStatsPerRoute(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas por ruta" });
    }
  });

  // Vehículos con bajo rendimiento
  app.get("/api/vehicles/low-mileage", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const vehicles = await storage.getLowMileageVehicles();
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener vehículos con bajo rendimiento" });
    }
  });

  // ==================== MÓDULO REPORTES ====================

  const reportFiltersSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional()
  });

  const salesBreakdownSchema = reportFiltersSchema.extend({
    groupBy: z.enum(['machine', 'product', 'location', 'day']).optional()
  });

  const purchasesBreakdownSchema = reportFiltersSchema.extend({
    groupBy: z.enum(['supplier', 'product', 'day']).optional()
  });

  const fuelBreakdownSchema = reportFiltersSchema.extend({
    groupBy: z.enum(['vehicle', 'user', 'route', 'day']).optional()
  });

  const pettyCashBreakdownSchema = reportFiltersSchema.extend({
    groupBy: z.enum(['category', 'user', 'day']).optional()
  });

  const exportDataSchema = z.object({
    type: z.enum(['sales', 'purchases', 'fuel', 'pettycash', 'inventory']),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  });

  // Resumen general de reportes
  app.get("/api/reports/overview", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = reportFiltersSchema.parse(req.query);
      const overview = await storage.getReportsOverview(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      res.json(overview);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error getting reports overview:", error);
      res.status(500).json({ error: "Error al obtener resumen de reportes" });
    }
  });

  // Desglose de ventas
  app.get("/api/reports/sales", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, groupBy } = salesBreakdownSchema.parse(req.query);
      const breakdown = await storage.getSalesBreakdown({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy: groupBy as 'machine' | 'product' | 'location' | 'day'
      });
      res.json(breakdown);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error getting sales breakdown:", error);
      res.status(500).json({ error: "Error al obtener desglose de ventas" });
    }
  });

  // Desglose de compras
  app.get("/api/reports/purchases", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, groupBy } = purchasesBreakdownSchema.parse(req.query);
      const breakdown = await storage.getPurchasesBreakdown({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy: groupBy as 'supplier' | 'product' | 'day'
      });
      res.json(breakdown);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error getting purchases breakdown:", error);
      res.status(500).json({ error: "Error al obtener desglose de compras" });
    }
  });

  // Desglose de combustible
  app.get("/api/reports/fuel", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, groupBy } = fuelBreakdownSchema.parse(req.query);
      const breakdown = await storage.getFuelBreakdown({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy: groupBy as 'vehicle' | 'user' | 'route' | 'day'
      });
      res.json(breakdown);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error getting fuel breakdown:", error);
      res.status(500).json({ error: "Error al obtener desglose de combustible" });
    }
  });

  // Desglose de caja chica
  app.get("/api/reports/petty-cash", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, groupBy } = pettyCashBreakdownSchema.parse(req.query);
      const breakdown = await storage.getPettyCashBreakdown({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy: groupBy as 'category' | 'user' | 'day'
      });
      res.json(breakdown);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error getting petty cash breakdown:", error);
      res.status(500).json({ error: "Error al obtener desglose de caja chica" });
    }
  });

  // Rendimiento de máquinas
  app.get("/api/reports/machine-performance", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = reportFiltersSchema.parse(req.query);
      const performance = await storage.getMachinePerformance(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      res.json(performance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error getting machine performance:", error);
      res.status(500).json({ error: "Error al obtener rendimiento de máquinas" });
    }
  });

  // Productos más vendidos
  app.get("/api/reports/top-products", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = reportFiltersSchema.parse(req.query);
      const limit = parseInt(req.query.limit as string) || 10;
      const topProducts = await storage.getTopProducts(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        limit
      );
      res.json(topProducts);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error getting top products:", error);
      res.status(500).json({ error: "Error al obtener productos más vendidos" });
    }
  });

  // Ranking de proveedores
  app.get("/api/reports/supplier-ranking", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = reportFiltersSchema.parse(req.query);
      const ranking = await storage.getSupplierRanking(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      res.json(ranking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error getting supplier ranking:", error);
      res.status(500).json({ error: "Error al obtener ranking de proveedores" });
    }
  });

  // Exportar datos
  app.get("/api/reports/export", authenticateJWT, authorizeRoles("admin", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, startDate, endDate } = exportDataSchema.parse(req.query);
      const data = await storage.getExportData(type, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });
      res.json(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Error al exportar datos" });
    }
  });

  // ==================== MÓDULO CONTABILIDAD ====================

  app.get("/api/accounting/overview", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const overview = await storage.getAccountingOverview(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(overview);
    } catch (error) {
      console.error("Error getting accounting overview:", error);
      res.status(500).json({ error: "Error al obtener resumen contable" });
    }
  });

  app.get("/api/accounting/machine-sales", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const sales = await storage.getMachineSalesReport(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(sales);
    } catch (error) {
      console.error("Error getting machine sales report:", error);
      res.status(500).json({ error: "Error al obtener ventas por máquina" });
    }
  });

  app.get("/api/accounting/expenses", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, category } = req.query;
      const expenses = await storage.getExpensesReport({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        category: category as string | undefined
      });
      res.json(expenses);
    } catch (error) {
      console.error("Error getting expenses report:", error);
      res.status(500).json({ error: "Error al obtener reporte de gastos" });
    }
  });

  app.get("/api/accounting/cash-cut", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await storage.getCashCutReport(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(report);
    } catch (error) {
      console.error("Error getting cash cut report:", error);
      res.status(500).json({ error: "Error al obtener corte de caja" });
    }
  });

  app.get("/api/accounting/sales-summary", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const salesData = await db.select().from(machineSales)
        .where(and(
          gte(machineSales.saleDate, start),
          lte(machineSales.saleDate, end)
        ));
      
      const machinesList = await db.select().from(machines);
      const machineMap = new Map(machinesList.map(m => [m.id, m.name]));
      
      const totalRevenue = salesData.reduce((sum, s) => sum + Number(s.totalAmount), 0);
      const totalSales = salesData.length;
      
      const salesByMachine: Record<string, number> = {};
      for (const sale of salesData) {
        salesByMachine[sale.machineId] = (salesByMachine[sale.machineId] || 0) + Number(sale.totalAmount);
      }
      
      const topMachines = Object.entries(salesByMachine)
        .map(([machineId, total]) => ({
          machineId,
          machineName: machineMap.get(machineId) || machineId,
          total
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      
      const activeMachines = new Set(salesData.map(s => s.machineId)).size;
      const averagePerMachine = activeMachines > 0 ? totalRevenue / activeMachines : 0;
      
      res.json({
        totalSales,
        totalRevenue,
        averagePerMachine,
        topMachines
      });
    } catch (error) {
      console.error("Error getting sales summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de ventas" });
    }
  });

  app.get("/api/accounting/cash-summary", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const collectionsData = await db.select().from(cashCollections)
        .orderBy(desc(cashCollections.createdAt))
        .limit(100);
      
      const depositsData = await db.select().from(bankDeposits);
      
      const totalCollected = collectionsData.reduce((sum, c) => sum + Number(c.actualAmount), 0);
      const totalDeposited = depositsData.reduce((sum, d) => sum + Number(d.amount), 0);
      const pendingDeposit = totalCollected - totalDeposited;
      
      const recentMovements = await db.select().from(cashMovements)
        .orderBy(desc(cashMovements.createdAt))
        .limit(10);
      
      res.json({
        totalCollected,
        pendingDeposit: pendingDeposit > 0 ? pendingDeposit : 0,
        deposited: totalDeposited,
        recentMovements
      });
    } catch (error) {
      console.error("Error getting cash summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de efectivo" });
    }
  });

  // ==================== MÓDULO RRHH ====================

  app.get("/api/hr/employees", async (req: Request, res: Response) => {
    try {
      const { role, isActive, search } = req.query;
      const employees = await storage.getEmployees({
        role: role as string | undefined,
        isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
        search: search as string | undefined
      });
      res.json(employees);
    } catch (error) {
      console.error("Error getting employees:", error);
      res.status(500).json({ error: "Error al obtener empleados" });
    }
  });

  app.get("/api/hr/employees/:id", async (req: Request, res: Response) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: "Empleado no encontrado" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error getting employee:", error);
      res.status(500).json({ error: "Error al obtener empleado" });
    }
  });

  app.post("/api/hr/employees", async (req: Request, res: Response) => {
    try {
      const data = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(data);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating employee:", error);
      res.status(500).json({ error: "Error al crear empleado" });
    }
  });

  app.patch("/api/hr/employees/:id", async (req: Request, res: Response) => {
    try {
      const data = insertEmployeeSchema.partial().parse(req.body);
      const employee = await storage.updateEmployee(req.params.id, data);
      if (!employee) {
        return res.status(404).json({ error: "Empleado no encontrado" });
      }
      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating employee:", error);
      res.status(500).json({ error: "Error al actualizar empleado" });
    }
  });

  app.delete("/api/hr/employees/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteEmployee(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Empleado no encontrado" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ error: "Error al desactivar empleado" });
    }
  });

  app.get("/api/hr/time-tracking", async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate } = req.query;
      const records = await storage.getTimeTracking({
        userId: userId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });
      if (!res.headersSent) {
        res.json(records);
      }
    } catch (error) {
      console.error("Error getting time tracking:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error al obtener control de tiempos" });
      }
    }
  });

  app.get("/api/hr/performance", async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate } = req.query;
      const performance = await storage.getEmployeePerformance({
        userId: userId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });
      if (!res.headersSent) {
        res.json(performance);
      }
    } catch (error) {
      console.error("Error getting performance:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error al obtener rendimiento" });
      }
    }
  });

  // ==================== MÓDULO TAREAS ====================

  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      const { status, priority, assignedUserId, startDate, endDate, type } = req.query;
      const tasks = await storage.getTasks({
        status: status as string | undefined,
        priority: priority as string | undefined,
        assignedUserId: assignedUserId as string | undefined,
        type: type as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });
      res.json(tasks);
    } catch (error) {
      console.error("Error getting tasks:", error);
      res.status(500).json({ error: "Error al obtener tareas" });
    }
  });

  app.get("/api/tasks/today", async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;
      const tasks = await storage.getTasksForToday(userId as string | undefined);
      res.json(tasks);
    } catch (error) {
      console.error("Error getting today tasks:", error);
      res.status(500).json({ error: "Error al obtener tareas de hoy" });
    }
  });

  app.get("/api/tasks/stats", async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate } = req.query;
      const stats = await storage.getTaskStats({
        userId: userId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });
      res.json(stats);
    } catch (error) {
      console.error("Error getting task stats:", error);
      res.status(500).json({ error: "Error al obtener estadísticas de tareas" });
    }
  });

  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error getting task:", error);
      res.status(500).json({ error: "Error al obtener tarea" });
    }
  });

  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const bodyWithParsedDate = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined
      };
      const data = insertTaskSchema.parse(bodyWithParsedDate);
      const task = await storage.createTask(data);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Error al crear tarea" });
    }
  });

  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const bodyWithParsedDate = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : req.body.dueDate
      };
      const data = insertTaskSchema.partial().parse(bodyWithParsedDate);
      const task = await storage.updateTask(req.params.id, data);
      if (!task) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Error al actualizar tarea" });
    }
  });

  app.post("/api/tasks/:id/complete", async (req: Request, res: Response) => {
    try {
      const { completedBy } = req.body;
      if (!completedBy) {
        return res.status(400).json({ error: "Se requiere completedBy" });
      }
      const task = await storage.completeTask(req.params.id, completedBy);
      if (!task) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ error: "Error al completar tarea" });
    }
  });

  app.post("/api/tasks/:id/cancel", async (req: Request, res: Response) => {
    try {
      const { cancelledBy } = req.body;
      if (!cancelledBy) {
        return res.status(400).json({ error: "Se requiere cancelledBy" });
      }
      const task = await storage.cancelTask(req.params.id, cancelledBy);
      if (!task) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error cancelling task:", error);
      res.status(500).json({ error: "Error al cancelar tarea" });
    }
  });

  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Error al eliminar tarea" });
    }
  });

  // ==================== MÓDULO CALENDARIO ====================

  app.get("/api/calendar/events", async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate, eventType } = req.query;
      const events = await storage.getCalendarEvents({
        userId: userId as string | undefined,
        eventType: eventType as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });
      res.json(events);
    } catch (error) {
      console.error("Error getting calendar events:", error);
      res.status(500).json({ error: "Error al obtener eventos" });
    }
  });

  app.get("/api/calendar/events/:id", async (req: Request, res: Response) => {
    try {
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error getting calendar event:", error);
      res.status(500).json({ error: "Error al obtener evento" });
    }
  });

  app.post("/api/calendar/events", async (req: Request, res: Response) => {
    try {
      const data = insertCalendarEventSchema.parse(req.body);
      const event = await storage.createCalendarEvent(data);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating calendar event:", error);
      res.status(500).json({ error: "Error al crear evento" });
    }
  });

  app.patch("/api/calendar/events/:id", async (req: Request, res: Response) => {
    try {
      const data = insertCalendarEventSchema.partial().parse(req.body);
      const event = await storage.updateCalendarEvent(req.params.id, data);
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating calendar event:", error);
      res.status(500).json({ error: "Error al actualizar evento" });
    }
  });

  app.delete("/api/calendar/events/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteCalendarEvent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ error: "Error al eliminar evento" });
    }
  });

  // ==================== PASSWORD RESET ====================

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email requerido" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.json({ success: true, message: "Si el email existe, recibirás un enlace de recuperación" });
      }

      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken(user.id, token, expiresAt);

      const { sendPasswordResetEmail } = await import("./email");
      await sendPasswordResetEmail(email, token, user.fullName || user.username);

      res.json({ success: true, message: "Si el email existe, recibirás un enlace de recuperación" });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ error: "Error al procesar la solicitud" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Token y contraseña requeridos" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ error: "Token inválido o expirado" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ error: "Este enlace ya ha sido utilizado" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "El enlace ha expirado" });
      }

      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await storage.updateUserPassword(resetToken.userId, hashedPassword);
      await storage.markPasswordResetTokenUsed(token);

      res.json({ success: true, message: "Contraseña actualizada correctamente" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Error al restablecer la contraseña" });
    }
  });

  app.get("/api/auth/verify-reset-token/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ valid: false, error: "Token inválido" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ valid: false, error: "Este enlace ya ha sido utilizado" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ valid: false, error: "El enlace ha expirado" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ valid: false, error: "Error al verificar token" });
    }
  });

  // ============ SUMMARY ENDPOINTS FOR DASHBOARD ============

  // Routes/Supplier Summary (con cache)
  app.get("/api/summary/routes", async (req: Request, res: Response) => {
    try {
      const cache = getSummaryCache();
      res.json(cache.routes);
      if (!isSummaryCacheValid()) {
        refreshSummaryCacheIfStale().catch(err => console.error("[Cache] Error refresh routes:", err));
      }
    } catch (error) {
      if (res.headersSent) return;
      console.error("Error in routes summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de rutas" });
    }
  });

  // Warehouse Summary
  app.get("/api/summary/warehouse", async (req: Request, res: Response) => {
    try {
      const products = await storage.getProducts();
      const productLots = await storage.getProductLots();
      const movements = await storage.getWarehouseMovements();
      
      const lowStockProducts: any[] = [];
      const productStocks: Record<string, number> = {};
      
      productLots.forEach(lot => {
        if (!productStocks[lot.productId]) {
          productStocks[lot.productId] = 0;
        }
        productStocks[lot.productId] += lot.quantity;
      });
      
      products.forEach(p => {
        const stock = productStocks[p.id] || 0;
        if (stock < 20) {
          lowStockProducts.push({
            id: p.id,
            name: p.name,
            code: p.code,
            currentStock: stock,
            category: p.category
          });
        }
      });
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekMovements = movements.filter(m => new Date(m.createdAt || 0) >= weekAgo);
      
      const totalStock = Object.values(productStocks).reduce((a, b) => a + b, 0);
      
      res.json({
        totalProducts: products.length,
        totalStock,
        lowStockCount: lowStockProducts.length,
        lowStockProducts: lowStockProducts.slice(0, 5),
        weekMovements: weekMovements.length,
        entriesThisWeek: weekMovements.filter(m => m.movementType === "entrada").length,
        exitsThisWeek: weekMovements.filter(m => m.movementType === "salida").length
      });
    } catch (error) {
      console.error("Error in warehouse summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de almacén" });
    }
  });

  // Accounting Summary
  app.get("/api/summary/accounting", async (req: Request, res: Response) => {
    try {
      const machineSales = await storage.getAllMachineSales();
      const cashMovements = await storage.getCashMovements();
      const bankDeposits = await storage.getBankDeposits();
      
      // Use timezone-aware date calculations
      const today = getTodayInTimezone();
      const todayKey = getDateKeyInTimezone(today);
      const weekStart = getStartOfWeekInTimezone();
      const monthStart = getStartOfMonthInTimezone();
      
      // Calculate real sales from machine_sales table
      let salesToday = 0;
      let salesWeek = 0;
      let salesMonth = 0;
      
      machineSales.forEach((sale) => {
        if (!sale.saleDate) return;
        const saleDate = new Date(sale.saleDate);
        const saleDateKey = getDateKeyFromDateOnly(saleDate);
        const amount = parseFloat(sale.totalAmount || "0");
        
        // Today - compare date keys directly
        if (saleDateKey === todayKey) {
          salesToday += amount;
        }
        // This week
        const weekStartKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        if (saleDateKey >= weekStartKey) {
          salesWeek += amount;
        }
        // This month
        const monthStartKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-${String(monthStart.getDate()).padStart(2, '0')}`;
        if (saleDateKey >= monthStartKey) {
          salesMonth += amount;
        }
      });
      
      const weekCashMovements = cashMovements.filter(c => new Date(c.createdAt || 0) >= weekStart);
      const cashInflow = weekCashMovements.filter(c => c.type === "ingreso" || c.type === "recoleccion").reduce((s, c) => s + parseFloat(c.amount || "0"), 0);
      const cashOutflow = weekCashMovements.filter(c => c.type === "egreso").reduce((s, c) => s + parseFloat(c.amount || "0"), 0);
      
      const weekDeposits = bankDeposits.filter(d => new Date(d.depositDate || 0) >= weekStart);
      const totalDeposits = weekDeposits.reduce((s, d) => s + parseFloat(d.amount || "0"), 0);
      
      res.json({
        salesToday,
        salesWeek,
        salesMonth,
        cashInflow,
        cashOutflow,
        netCashFlow: cashInflow - cashOutflow,
        weekDeposits: totalDeposits,
        pendingDeposits: bankDeposits.filter(d => d.status === "pendiente").length,
        recentMovements: cashMovements.slice(0, 5).map(m => ({
          id: m.id,
          type: m.type,
          amount: m.amount,
          date: m.createdAt
        }))
      });
    } catch (error) {
      console.error("Error in accounting summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de contabilidad" });
    }
  });

  // Petty Cash Summary (con cache)
  app.get("/api/summary/petty-cash", async (req: Request, res: Response) => {
    try {
      const cache = getSummaryCache();
      res.json(cache.pettyCash);
      if (!isSummaryCacheValid()) {
        refreshSummaryCacheIfStale().catch(err => console.error("[Cache] Error refresh petty-cash:", err));
      }
    } catch (error) {
      console.error("Error in petty cash summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de caja chica" });
    }
  });

  // Purchases Summary (con cache)
  app.get("/api/summary/purchases", async (req: Request, res: Response) => {
    try {
      const cache = getSummaryCache();
      res.json(cache.purchases);
      if (!isSummaryCacheValid()) {
        refreshSummaryCacheIfStale().catch(err => console.error("[Cache] Error refresh purchases:", err));
      }
    } catch (error) {
      if (res.headersSent) return;
      console.error("Error in purchases summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de compras" });
    }
  });

  // Fuel Summary (con cache)
  app.get("/api/summary/fuel", async (req: Request, res: Response) => {
    try {
      const cache = getSummaryCache();
      res.json(cache.fuel);
      if (!isSummaryCacheValid()) {
        refreshSummaryCacheIfStale().catch(err => console.error("[Cache] Error refresh fuel:", err));
      }
    } catch (error) {
      if (res.headersSent) return;
      console.error("Error in fuel summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de combustible" });
    }
  });

  // HR Summary (con cache)
  app.get("/api/summary/hr", async (req: Request, res: Response) => {
    try {
      const cache = getSummaryCache();
      res.json(cache.hr);
      if (!isSummaryCacheValid()) {
        refreshSummaryCacheIfStale().catch(err => console.error("[Cache] Error refresh hr:", err));
      }
    } catch (error) {
      if (res.headersSent) return;
      console.error("Error in HR summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de RH" });
    }
  });

  // Money & Products Reconciliation Summary (con cache)
  app.get("/api/summary/reconciliation", async (req: Request, res: Response) => {
    try {
      const cache = getSummaryCache();
      res.json(cache.reconciliation);
      if (!isSummaryCacheValid()) {
        refreshSummaryCacheIfStale().catch(err => console.error("[Cache] Error refresh reconciliation:", err));
      }
    } catch (error) {
      console.error("Error in reconciliation summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de conciliación" });
    }
  });

  // Products Summary
  app.get("/api/summary/products", async (req: Request, res: Response) => {
    try {
      const products = await storage.getProducts();
      const productLots = await storage.getProductLots();
      const machineSales = await storage.getAllMachineSales();
      
      // Calculate stock per product
      const productStocks: Record<string, number> = {};
      productLots.forEach(lot => {
        if (!productStocks[lot.productId]) {
          productStocks[lot.productId] = 0;
        }
        productStocks[lot.productId] += lot.remainingQuantity ?? lot.quantity ?? 0;
      });
      
      // Products with low stock (< 50 units)
      const lowStockProducts = products.filter(p => (productStocks[p.id] || 0) < 50);
      
      // Sales filtering using timezone-aware dates (comparing date keys for DATE-only columns)
      const today = getTodayInTimezone();
      const todayKey = getDateKeyInTimezone(today);
      const weekStart = getStartOfWeekInTimezone();
      const weekStartKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      
      const todaySales = machineSales.filter(s => {
        if (!s.saleDate) return false;
        const saleDateKey = getDateKeyFromDateOnly(new Date(s.saleDate));
        return saleDateKey === todayKey;
      });
      
      const weekSales = machineSales.filter(s => {
        if (!s.saleDate) return false;
        const saleDateKey = getDateKeyFromDateOnly(new Date(s.saleDate));
        return saleDateKey >= weekStartKey;
      });
      
      // Top selling products
      const salesByProduct: Record<string, { quantity: number; revenue: number; name: string }> = {};
      weekSales.forEach(sale => {
        const pid = sale.productId;
        if (!pid) return;
        if (!salesByProduct[pid]) {
          const product = products.find(p => p.id === pid);
          salesByProduct[pid] = { 
            quantity: 0, 
            revenue: 0, 
            name: product?.name || "Desconocido" 
          };
        }
        salesByProduct[pid].quantity += sale.quantity || 0;
        salesByProduct[pid].revenue += parseFloat(sale.totalAmount || "0");
      });
      
      const topProducts = Object.entries(salesByProduct)
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .slice(0, 5)
        .map(([productId, data]) => ({
          id: productId,
          name: data.name,
          quantity: data.quantity,
          revenue: data.revenue
        }));
      
      // Categories count
      const categories: Record<string, number> = {};
      products.forEach(p => {
        const cat = p.category || "sin_categoria";
        categories[cat] = (categories[cat] || 0) + 1;
      });
      
      res.json({
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        lowStockCount: lowStockProducts.length,
        todaySalesUnits: todaySales.reduce((sum, s) => sum + (s.quantity || 0), 0),
        weekSalesUnits: weekSales.reduce((sum, s) => sum + (s.quantity || 0), 0),
        topProducts,
        categories
      });
    } catch (error) {
      console.error("Error in products summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de productos" });
    }
  });

  // Machines Summary
  app.get("/api/summary/machines", async (req: Request, res: Response) => {
    try {
      const dashCache = getDashboardCache();
      const machines = dashCache.machinesList;
      const alerts = dashCache.recentAlerts;
      const machineSales = await storage.getAllMachineSales();
      
      // Status counts
      const statusCounts = {
        operando: machines.filter(m => m.status === "operando").length,
        necesita_servicio: machines.filter(m => m.status === "necesita_servicio").length,
        mantenimiento: machines.filter(m => m.status === "mantenimiento").length,
        fuera_servicio: machines.filter(m => m.status === "fuera_servicio").length
      };
      
      // Today's sales using timezone-aware dates (comparing date keys for DATE-only columns)
      const today = getTodayInTimezone();
      const todayKey = getDateKeyInTimezone(today);
      const todaySales = machineSales.filter(s => {
        if (!s.saleDate) return false;
        const saleDateKey = getDateKeyFromDateOnly(new Date(s.saleDate));
        return saleDateKey === todayKey;
      });
      const todayRevenue = todaySales.reduce((sum, s) => sum + parseFloat(s.totalAmount || "0"), 0);
      
      // Critical alerts count
      const criticalAlerts = alerts.filter(a => a.priority === "critica").length;
      const highAlerts = alerts.filter(a => a.priority === "alta").length;
      
      // Zones summary
      const zoneStats: Record<string, { total: number; operating: number }> = {};
      machines.forEach(m => {
        const zone = m.zone || "Sin zona";
        if (!zoneStats[zone]) {
          zoneStats[zone] = { total: 0, operating: 0 };
        }
        zoneStats[zone].total++;
        if (m.status === "operando") {
          zoneStats[zone].operating++;
        }
      });
      
      res.json({
        totalMachines: machines.length,
        statusCounts,
        operativityRate: machines.length > 0 
          ? Math.round((statusCounts.operando / machines.length) * 100) 
          : 0,
        todaySalesUnits: todaySales.reduce((sum, s) => sum + (s.quantity || 0), 0),
        todayRevenue,
        activeAlerts: alerts.length,
        criticalAlerts,
        highAlerts,
        zonesCount: Object.keys(zoneStats).length
      });
    } catch (error) {
      console.error("Error in machines summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de máquinas" });
    }
  });

  // Supervisors management endpoints
  app.get("/api/supervisors", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { routes: routesTable, users: usersTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const allUsers = await storage.getEmployees();
      const supervisors = allUsers.filter((u: any) => u.role === "supervisor");
      
      const machines = await storage.getMachines();
      const routesList = await db.select().from(routesTable).limit(500);
      const alerts = await storage.getMachineAlerts();
      const tasks = await storage.getTasks();
      const abastecedores = allUsers.filter((u: any) => u.role === "abastecedor");
      
      const supervisorsWithMetrics = supervisors.map((sup: any) => {
        const zone = sup.assignedZone;
        const zoneMachines = zone ? machines.filter(m => m.zone === zone) : [];
        const zoneAbastecedores = zone ? abastecedores.filter((a: any) => a.assignedZone === zone) : [];
        const supRoutes = routesList.filter((r: any) => r.supervisorId === sup.id);
        const zoneAlerts = zone ? alerts.filter((a: any) => {
          const machine = machines.find(m => m.id === a.machineId);
          return machine?.zone === zone && !a.isResolved;
        }) : [];
        const assignedTasks = tasks.filter(t => t.assignedUserId === sup.id);
        const completedTasks = assignedTasks.filter(t => t.status === "completada");
        
        const operativeMachines = zoneMachines.filter(m => m.status === "operando").length;
        const operativityRate = zoneMachines.length > 0 
          ? Math.round((operativeMachines / zoneMachines.length) * 100) 
          : 0;
        
        const completionRate = assignedTasks.length > 0
          ? Math.round((completedTasks.length / assignedTasks.length) * 100)
          : 100;
        
        const criticalAlerts = zoneAlerts.filter((a: any) => a.priority === "critica").length;
        
        return {
          ...sup,
          metrics: {
            machinesCount: zoneMachines.length,
            operativeMachines,
            operativityRate,
            abastecedoresCount: zoneAbastecedores.length,
            routesCount: supRoutes.length,
            pendingAlerts: zoneAlerts.length,
            criticalAlerts,
            tasksCompleted: completedTasks.length,
            tasksTotal: assignedTasks.length,
            completionRate,
          }
        };
      });
      
      res.json(supervisorsWithMetrics);
    } catch (error) {
      console.error("Error getting supervisors:", error);
      res.status(500).json({ error: "Error al obtener supervisores" });
    }
  });

  app.get("/api/supervisors/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { routes: routesTable, users: usersTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const { id } = req.params;
      const supervisor = await storage.getEmployee(id);
      
      if (!supervisor || supervisor.role !== "supervisor") {
        return res.status(404).json({ error: "Supervisor no encontrado" });
      }
      
      const allUsers = await storage.getEmployees();
      const machines = await storage.getMachines();
      const routesList = await db.select().from(routesTable).where(eq(routesTable.supervisorId, id)).limit(50);
      const alerts = await storage.getMachineAlerts();
      const tasks = await storage.getTasks();
      
      const zone = supervisor.assignedZone;
      const zoneMachines = zone ? machines.filter(m => m.zone === zone) : [];
      const abastecedores = zone 
        ? allUsers.filter((u: any) => u.role === "abastecedor" && u.assignedZone === zone)
        : [];
      const zoneAlerts = zone ? alerts.filter((a: any) => {
        const machine = machines.find(m => m.id === a.machineId);
        return machine?.zone === zone;
      }) : [];
      
      const assignedTasks = tasks.filter(t => t.assignedUserId === id);
      const operativeMachines = zoneMachines.filter(m => m.status === "operando").length;
      
      const recentRoutes = routesList.slice(0, 10).map((r: any) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        totalStops: r.totalStops,
        completedStops: r.completedStops,
      }));
      
      res.json({
        ...supervisor,
        zone,
        machines: zoneMachines.map(m => ({
          id: m.id,
          name: m.name,
          code: m.code,
          status: m.status,
        })),
        abastecedores: abastecedores.map((a: any) => ({
          id: a.id,
          fullName: a.fullName,
          isActive: a.isActive,
        })),
        recentRoutes,
        alerts: zoneAlerts.filter((a: any) => !a.isResolved).slice(0, 10),
        tasks: assignedTasks.slice(0, 10),
        metrics: {
          machinesCount: zoneMachines.length,
          operativeMachines,
          operativityRate: zoneMachines.length > 0 
            ? Math.round((operativeMachines / zoneMachines.length) * 100) 
            : 0,
          abastecedoresCount: abastecedores.length,
          pendingAlerts: zoneAlerts.filter((a: any) => !a.isResolved).length,
          criticalAlerts: zoneAlerts.filter((a: any) => a.priority === "critica" && !a.isResolved).length,
          tasksCompleted: assignedTasks.filter(t => t.status === "completada").length,
          tasksTotal: assignedTasks.length,
        }
      });
    } catch (error) {
      console.error("Error getting supervisor detail:", error);
      res.status(500).json({ error: "Error al obtener detalle del supervisor" });
    }
  });

  app.patch("/api/supervisors/:id/zone", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { users: usersTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const { id } = req.params;
      const { zone } = req.body;
      
      const supervisor = await storage.getEmployee(id);
      if (!supervisor || supervisor.role !== "supervisor") {
        return res.status(404).json({ error: "Supervisor no encontrado" });
      }
      
      await db.update(usersTable).set({ assignedZone: zone }).where(eq(usersTable.id, id));
      
      res.json({ success: true, message: "Zona asignada correctamente" });
    } catch (error) {
      console.error("Error assigning zone:", error);
      res.status(500).json({ error: "Error al asignar zona" });
    }
  });

  // Global search endpoint
  app.get("/api/search", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      const query = (q as string || "").toLowerCase().trim();
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const results: any[] = [];

      // Search machines
      const machines = await storage.getMachines();
      machines.forEach(m => {
        if (m.name?.toLowerCase().includes(query) || m.code?.toLowerCase().includes(query) || m.zone?.toLowerCase().includes(query)) {
          results.push({
            id: m.id,
            type: "machine",
            title: m.name,
            subtitle: m.zone || "Sin zona",
            href: `/maquinas/${m.id}`
          });
        }
      });

      // Search products
      const products = await storage.getProducts();
      products.forEach(p => {
        if (p.name?.toLowerCase().includes(query) || p.code?.toLowerCase().includes(query) || p.category?.toLowerCase().includes(query)) {
          results.push({
            id: p.id,
            type: "product",
            title: p.name,
            subtitle: p.category || "Sin categoría",
            href: `/almacen`
          });
        }
      });

      // Search employees
      const employees = await storage.getEmployees();
      employees.forEach((u: any) => {
        if (u.fullName?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query) || u.role?.toLowerCase().includes(query)) {
          results.push({
            id: u.id,
            type: "employee",
            title: u.fullName,
            subtitle: u.role || "Sin rol",
            href: `/rh`
          });
        }
      });

      // Search tasks
      const tasks = await storage.getTasks();
      tasks.forEach(t => {
        if (t.title?.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)) {
          results.push({
            id: t.id,
            type: "task",
            title: t.title,
            subtitle: t.type || "Sin tipo",
            href: `/todas-tareas`
          });
        }
      });

      // Limit results
      res.json(results.slice(0, 10));
    } catch (error) {
      console.error("Error in search:", error);
      res.status(500).json({ error: "Error al buscar" });
    }
  });

  return httpServer;
}
