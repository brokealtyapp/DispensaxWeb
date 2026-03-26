import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, asc, or, inArray, count, SQL } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { 
  signAccessToken, 
  signRefreshToken, 
  hashRefreshToken, 
  authenticateJWT, 
  authorizeRoles,
  authorizeOwnership,
  getEffectiveUserId,
  getSupervisorZone,
  optionalAuth,
  requireSuperAdmin,
  requireTenant,
  verifyTenantOwnership,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  type AuthenticatedRequest 
} from "./auth";
import { authorizeAction, checkPermission } from "./permissions";
import { getSummaryCache, getDashboardCache, isCacheValid, isSummaryCacheValid, isDashboardCacheValid, refreshSummaryCacheIfStale, refreshDashboardCacheIfStale } from "./cache";
import { 
  insertMachineTypeOptionSchema,
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
  insertEmployeeAttendanceSchema,
  insertPayrollRecordSchema,
  insertVacationRequestSchema,
  insertPerformanceReviewSchema,
  insertEmployeeDocumentSchema,
  insertEmployeeProfileSchema,
  insertEstablishmentViewerSchema,
  insertMachineViewerAssignmentSchema,
  machines,
  machineSales,
  cashCollections,
  bankDeposits,
  cashMovements,
  establishmentViewers,
  machineViewerAssignments,
  users,
  tenants,
  machineTypeOptions as machineTypeOptionsTable,
  tenantSettings,
  nayaxConfig as nayaxConfigTable,
  routes as routesTable,
  routeStops,
  serviceRecords,
  pettyCashFund,
  pettyCashExpenses,
  purchaseOrders,
  purchaseReceptions,
  receptionItems,
  vehicles as vehiclesTable,
  fuelRecords,
  machineVisits,
  productTransfers,
  shrinkageRecords,
  tasks as tasksTable,
  machineAlerts,
  products,
  insertEstablishmentSchema,
  insertEstablishmentStageSchema,
  insertEstablishmentFollowupSchema,
  insertEstablishmentDocumentSchema,
  establishments as establishmentsTable,
  establishmentStages as establishmentStagesTable,
  establishmentDocuments as establishmentDocsTable,
} from "@shared/schema";
import { z } from "zod";
import { getNayaxToken, getAllNayaxMachines, getNayaxMachineLastSales, testNayaxConnection } from "./nayax";

// =====================
// RATE LIMITING (In-memory, can upgrade to Redis for production)
// =====================
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function rateLimit(options: { 
  windowMs: number; 
  max: number; 
  keyPrefix: string;
  message?: string;
}) {
  return (req: Request, res: Response, next: () => void) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    
    const entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
      res.setHeader("X-RateLimit-Limit", options.max);
      res.setHeader("X-RateLimit-Remaining", options.max - 1);
      return next();
    }
    
    if (entry.count >= options.max) {
      res.setHeader("X-RateLimit-Limit", options.max);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("Retry-After", Math.ceil((entry.resetTime - now) / 1000));
      return res.status(429).json({ 
        error: options.message || "Demasiadas solicitudes. Intenta de nuevo más tarde.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }
    
    entry.count++;
    res.setHeader("X-RateLimit-Limit", options.max);
    res.setHeader("X-RateLimit-Remaining", options.max - entry.count);
    next();
  };
}

// Cleanup old rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Rate limiters for different endpoints
const publicPlansLimiter = rateLimit({ 
  windowMs: 60 * 1000, // 1 minute
  max: 60, 
  keyPrefix: "public-plans" 
});

const signupLimiter = rateLimit({ 
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, 
  keyPrefix: "signup",
  message: "Demasiados intentos de registro. Intenta de nuevo en 1 hora."
});

const authLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, 
  keyPrefix: "auth",
  message: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos."
});

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

  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
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
        role: user.role || "abastecedor",
        tenantId: user.tenantId || null,
        isSuperAdmin: user.isSuperAdmin || false
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
        role: user.role || "abastecedor",
        tenantId: user.tenantId || null,
        isSuperAdmin: user.isSuperAdmin || false
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
        role: newUser.role || "abastecedor",
        tenantId: newUser.tenantId || null,
        isSuperAdmin: newUser.isSuperAdmin || false
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

      res.status(201).json({
        accessToken,
        user: newUser,
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

      res.json({ user });
    } catch (error) {
      console.error("Auth me error:", error);
      res.status(401).json({ error: "Token inválido o expirado" });
    }
  });

  // =====================
  // PUBLIC ROUTES (No auth required)
  // =====================

  // Get active subscription plans (public for signup page)
  app.get("/api/public/plans", publicPlansLimiter, async (req: Request, res: Response) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      const activePlans = plans.filter(p => p.isActive);
      res.json(activePlans);
    } catch (error) {
      console.error("Error getting public plans:", error);
      res.status(500).json({ error: "Error al obtener planes" });
    }
  });

  // Tenant signup (public registration for new companies)
  app.post("/api/public/tenant-signup", signupLimiter, async (req: Request, res: Response) => {
    try {
      const signupSchema = z.object({
        companyName: z.string().min(2, "El nombre de la empresa es requerido"),
        email: z.string().email("Email de empresa inválido"),
        phone: z.string().optional(),
        address: z.string().optional(),
        adminName: z.string().min(2, "El nombre del administrador es requerido"),
        adminEmail: z.string().email("Email del administrador inválido"),
        password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
        planId: z.string().min(1, "El plan es requerido"),
      });

      const data = signupSchema.parse(req.body);

      // Check if plan exists and is active
      const plan = await storage.getSubscriptionPlan(data.planId);
      if (!plan || !plan.isActive) {
        return res.status(400).json({ error: "Plan no disponible" });
      }

      // Check if company email already exists
      const existingTenant = await storage.getTenantByEmail(data.email);
      if (existingTenant) {
        return res.status(400).json({ error: "Ya existe una empresa registrada con este email" });
      }

      // Check if admin email already exists
      const existingUser = await storage.getUserByEmail(data.adminEmail);
      if (existingUser) {
        return res.status(400).json({ error: "El email del administrador ya está registrado" });
      }

      // Create tenant
      const slug = data.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      const tenant = await storage.createTenant({
        name: data.companyName,
        slug: slug + "-" + Date.now().toString(36),
        email: data.email,
        phone: data.phone,
        address: data.address,
        isActive: true,
      });

      // Create subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month trial

      await storage.createTenantSubscription({
        tenantId: tenant.id,
        planId: data.planId,
        status: "active",
        startDate,
        endDate,
        isTrial: true,
      });

      // Create admin user for the tenant
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const adminUsername = data.adminEmail.split("@")[0] + "-" + Date.now().toString(36);

      const adminUser = await storage.createEmployee({
        username: adminUsername,
        password: hashedPassword,
        fullName: data.adminName,
        email: data.adminEmail,
        role: "admin",
        isActive: true,
        tenantId: tenant.id,
        isSuperAdmin: false,
      });

      await storage.seedDefaultEstablishmentStages(tenant.id);

      // Log the signup
      await storage.createAuditLog({
        userId: adminUser.id,
        action: "TENANT_SIGNUP",
        resourceType: "tenants",
        resourceId: tenant.id,
        details: { planId: data.planId, companyName: data.companyName },
        tenantId: tenant.id,
      });

      res.status(201).json({
        message: "Empresa registrada correctamente",
        tenant: { id: tenant.id, name: tenant.name },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Tenant signup error:", error);
      res.status(500).json({ error: "Error al registrar empresa" });
    }
  });

  // =====================
  // LOCATION ROUTES
  // =====================

  app.get("/api/locations", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const locations = await storage.getLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener ubicaciones" });
    }
  });

  app.get("/api/locations/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyLocationTenant(req.params.id, req, res)) return;
      
      const location = await storage.getLocation(req.params.id);
      res.json(location);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener ubicación" });
    }
  });

  app.post("/api/locations", authenticateJWT, authorizeAction("locations", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const data = insertLocationSchema.omit({ tenantId: true }).parse(req.body);
      const location = await storage.createLocation({ ...data, tenantId });
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear ubicación" });
    }
  });

  app.patch("/api/locations/:id", authenticateJWT, authorizeAction("locations", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyLocationTenant(req.params.id, req, res)) return;
      
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

  app.delete("/api/locations/:id", authenticateJWT, authorizeAction("locations", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyLocationTenant(req.params.id, req, res)) return;
      
      await storage.deleteLocation(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar ubicación" });
    }
  });

  app.get("/api/products", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const products = await storage.getProducts(tenantId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener productos" });
    }
  });

  app.get("/api/products/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyProductTenant(req.params.id, req, res)) return;
      
      const product = await storage.getProduct(req.params.id);
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener producto" });
    }
  });

  app.post("/api/products", authenticateJWT, authorizeAction("products", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant no identificado. Por favor cierre sesión e inicie de nuevo." });
      }
      const data = insertProductSchema.omit({ tenantId: true }).parse(req.body);
      const product = await storage.createProduct({ ...data, tenantId });
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear producto" });
    }
  });

  app.patch("/api/products/:id", authenticateJWT, authorizeAction("products", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyProductTenant(req.params.id, req, res)) return;
      
      const data = insertProductSchema.omit({ tenantId: true }).partial().parse(req.body);
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

  app.delete("/api/products/:id", authenticateJWT, authorizeAction("products", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyProductTenant(req.params.id, req, res)) return;
      
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar producto" });
    }
  });

  app.get("/api/machines/summary", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenantMachines = await storage.getMachines(tenantId);

      const stats = {
        totalMachines: tenantMachines.length,
        operatingMachines: tenantMachines.filter(m => m.status === "operando").length,
        needsServiceMachines: tenantMachines.filter(m => m.status === "necesita_servicio").length,
        maintenanceMachines: tenantMachines.filter(m => m.status === "mantenimiento").length,
        activeAlerts: 0,
        todayTasks: 0,
        completedTasks: 0,
      };

      const zoneMap: Record<string, { zone: string; total: number; operating: number; percentage: number }> = {};
      tenantMachines.forEach(m => {
        const zone = m.zone || "Sin zona";
        if (!zoneMap[zone]) zoneMap[zone] = { zone, total: 0, operating: 0, percentage: 0 };
        zoneMap[zone].total++;
        if (m.status === "operando") zoneMap[zone].operating++;
      });
      const machinesByZone = Object.values(zoneMap).map(z => ({
        ...z,
        percentage: z.total > 0 ? Math.round((z.operating / z.total) * 100) : 0,
      }));

      res.json({
        stats,
        machinesByZone,
        machines: tenantMachines,
      });
    } catch (error) {
      console.error("Error getting machines summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de máquinas" });
    }
  });

  app.get("/api/machines", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, zone } = req.query;
      const tenantId = req.user!.tenantId;
      
      // Si es supervisor, filtrar automáticamente por su zona asignada
      let effectiveZone = zone as string | undefined;
      if (req.user?.role === "supervisor") {
        const fullUser = await storage.getUser(req.user.userId);
        if (fullUser?.assignedZone) {
          effectiveZone = fullUser.assignedZone;
        }
      }
      
      const filters = {
        status: status as string | undefined,
        zone: effectiveZone,
      };
      const machinesList = await storage.getMachinesEnriched(tenantId, filters);
      res.json(machinesList);
    } catch (error) {
      console.error("Error getting machines:", error);
      res.status(500).json({ error: "Error al obtener máquinas" });
    }
  });

  app.get("/api/machines/next-code", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "Acceso denegado" });
      }
      // Query the MAX numeric suffix from all existing MAQ-NNN codes (active + inactive)
      const result = await db
        .select({ maxNum: sql<number>`COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0)` })
        .from(machines)
        .where(and(
          eq(machines.tenantId, tenantId),
          sql`code ~ '^MAQ-[0-9]+$'`
        ));
      const nextNum = (result[0]?.maxNum ?? 0) + 1;
      const code = `MAQ-${String(nextNum).padStart(3, "0")}`;
      res.set("Cache-Control", "no-store");
      res.json({ code });
    } catch (error) {
      res.status(500).json({ error: "Error al generar código" });
    }
  });

  app.get("/api/machines/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const machine = await storage.getMachineWithDetails(req.params.id);
      if (!machine) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }
      
      // SECURITY: Verify tenant ownership (fail closed)
      if (!verifyTenantOwnership(machine.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }
      
      res.json(machine);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener máquina" });
    }
  });

  app.post("/api/machines", authenticateJWT, authorizeAction("machines", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // SECURITY: Always use tenantId from authenticated user context, never from request body
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "Acceso denegado: contexto de empresa no disponible" });
      }
      
      // Validate plan limits before creating machine
      const limits = await storage.checkTenantPlanLimits(tenantId);
      if (!limits.canCreateMachine) {
        return res.status(403).json({ 
          error: `Límite de máquinas alcanzado (${limits.currentMachines}/${limits.maxMachines}). Actualiza tu plan para agregar más máquinas.`,
          code: "PLAN_LIMIT_EXCEEDED",
          planName: limits.planName
        });
      }
      
      const data = insertMachineSchema.omit({ tenantId: true }).parse(req.body);
      // Override tenantId with authenticated user's tenant (prevent bypass attacks)
      const machine = await storage.createMachine({ ...data, tenantId });
      res.status(201).json(machine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating machine:", error);
      res.status(500).json({ error: "Error al crear máquina" });
    }
  });

  app.patch("/api/machines/:id", authenticateJWT, authorizeAction("machines", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // SECURITY: First verify tenant ownership before updating
      const existingMachine = await storage.getMachine(req.params.id);
      if (!existingMachine) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }
      
      if (!verifyTenantOwnership(existingMachine.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }
      
      const data = insertMachineSchema.partial().parse(req.body);
      // Prevent tenantId modification (security)
      delete (data as any).tenantId;
      
      const machine = await storage.updateMachine(req.params.id, data);
      res.json(machine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar máquina" });
    }
  });

  app.delete("/api/machines/:id", authenticateJWT, authorizeAction("machines", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // SECURITY: First verify tenant ownership before deleting
      const existingMachine = await storage.getMachine(req.params.id);
      if (!existingMachine) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }
      
      if (!verifyTenantOwnership(existingMachine.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }
      
      await storage.deleteMachine(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar máquina" });
    }
  });

  // Helper function to verify machine tenant ownership
  async function verifyMachineTenant(machineId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const machine = await storage.getMachine(machineId);
    if (!machine) {
      res.status(404).json({ error: "Máquina no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(machine.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Máquina no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify supplier tenant ownership
  async function verifySupplierTenant(supplierId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const supplier = await storage.getSupplier(supplierId);
    if (!supplier) {
      res.status(404).json({ error: "Proveedor no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(supplier.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Proveedor no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify route tenant ownership
  async function verifyRouteTenant(routeId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const route = await storage.getRoute(routeId);
    if (!route) {
      res.status(404).json({ error: "Ruta no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(route.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Ruta no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify route stop tenant ownership (via route)
  async function verifyStopTenant(stopId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const stop = await storage.getRouteStop(stopId);
    if (!stop) {
      res.status(404).json({ error: "Parada no encontrada" });
      return false;
    }
    const route = await storage.getRoute(stop.routeId);
    if (!route) {
      res.status(404).json({ error: "Parada no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(route.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Parada no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify service record tenant ownership
  async function verifyServiceTenant(serviceId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const service = await storage.getServiceRecord(serviceId);
    if (!service) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(service.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify vehicle tenant ownership
  async function verifyVehicleTenant(vehicleId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const vehicle = await storage.getVehicle(vehicleId);
    if (!vehicle) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(vehicle.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify fuel record tenant ownership
  async function verifyFuelRecordTenant(recordId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const record = await storage.getFuelRecord(recordId);
    if (!record) {
      res.status(404).json({ error: "Registro de combustible no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(record.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Registro de combustible no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify cash movement tenant ownership
  async function verifyCashMovementTenant(movementId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const movement = await storage.getCashMovement(movementId);
    if (!movement) {
      res.status(404).json({ error: "Movimiento no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(movement.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Movimiento no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify bank deposit tenant ownership
  async function verifyBankDepositTenant(depositId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const deposit = await storage.getBankDeposit(depositId);
    if (!deposit) {
      res.status(404).json({ error: "Depósito no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(deposit.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Depósito no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify product transfer tenant ownership
  async function verifyProductTransferTenant(transferId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const transfer = await storage.getProductTransfer(transferId);
    if (!transfer) {
      res.status(404).json({ error: "Transferencia no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(transfer.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Transferencia no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify shrinkage record tenant ownership
  async function verifyShrinkageTenant(shrinkageId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const record = await storage.getShrinkageRecord(shrinkageId);
    if (!record) {
      res.status(404).json({ error: "Merma no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(record.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Merma no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify purchase order tenant ownership
  async function verifyPurchaseOrderTenant(orderId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const order = await storage.getPurchaseOrder(orderId);
    if (!order) {
      res.status(404).json({ error: "Orden no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(order.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Orden no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify purchase order item tenant ownership (via order)
  // Note: Uses direct DB query since storage.getPurchaseOrderItem doesn't exist
  async function verifyPurchaseOrderItemTenant(itemId: string, req: AuthenticatedRequest, res: Response): Promise<{ valid: boolean; orderId?: string }> {
    const { purchaseOrderItems } = await import("@shared/schema");
    const [item] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId));
    if (!item) {
      res.status(404).json({ error: "Item no encontrado" });
      return { valid: false };
    }
    const order = await storage.getPurchaseOrder(item.orderId);
    if (!order) {
      res.status(404).json({ error: "Item no encontrado" });
      return { valid: false };
    }
    if (!verifyTenantOwnership(order.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Item no encontrado" });
      return { valid: false };
    }
    return { valid: true, orderId: item.orderId };
  }

  // Helper function to verify purchase reception tenant ownership
  async function verifyReceptionTenant(receptionId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const reception = await storage.getPurchaseReception(receptionId);
    if (!reception) {
      res.status(404).json({ error: "Recepción no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(reception.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Recepción no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify location tenant ownership
  async function verifyLocationTenant(locationId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const location = await storage.getLocation(locationId);
    if (!location) {
      res.status(404).json({ error: "Ubicación no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(location.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Ubicación no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify product tenant ownership
  async function verifyProductTenant(productId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const product = await storage.getProduct(productId);
    if (!product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(product.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Producto no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify alert tenant ownership (via machine)
  async function verifyAlertTenant(alertId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const alert = await storage.getMachineAlert(alertId);
    if (!alert) {
      res.status(404).json({ error: "Alerta no encontrada" });
      return false;
    }
    const machine = await storage.getMachine(alert.machineId);
    if (!machine || !verifyTenantOwnership(machine.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Alerta no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify visit tenant ownership (via machine)
  async function verifyVisitTenant(visitId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const visit = await storage.getMachineVisit(visitId);
    if (!visit) {
      res.status(404).json({ error: "Visita no encontrada" });
      return false;
    }
    const machine = await storage.getMachine(visit.machineId);
    if (!machine || !verifyTenantOwnership(machine.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Visita no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify petty cash expense tenant ownership
  async function verifyPettyCashExpenseTenant(expenseId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const expense = await storage.getPettyCashExpense(expenseId);
    if (!expense) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(expense.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify employee tenant ownership
  async function verifyEmployeeTenant(employeeId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const employee = await storage.getEmployee(employeeId);
    if (!employee) {
      res.status(404).json({ error: "Empleado no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(employee.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Empleado no encontrado" });
      return false;
    }
    return true;
  }

  // Helper function to verify task tenant ownership
  async function verifyTaskTenant(taskId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const task = await storage.getTask(taskId);
    if (!task) {
      res.status(404).json({ error: "Tarea no encontrada" });
      return false;
    }
    if (!verifyTenantOwnership(task.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Tarea no encontrada" });
      return false;
    }
    return true;
  }

  // Helper function to verify calendar event tenant ownership
  async function verifyCalendarEventTenant(eventId: string, req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const event = await storage.getCalendarEvent(eventId);
    if (!event) {
      res.status(404).json({ error: "Evento no encontrado" });
      return false;
    }
    if (!verifyTenantOwnership(event.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
      res.status(404).json({ error: "Evento no encontrado" });
      return false;
    }
    return true;
  }

  app.get("/api/machines/:id/inventory", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
      const inventory = await storage.getMachineInventory(req.params.id);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener inventario" });
    }
  });

  app.post("/api/machines/:id/inventory", authenticateJWT, authorizeAction("machines", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
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

  app.patch("/api/machines/:id/inventory/:productId", authenticateJWT, authorizeAction("machines", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
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

  app.get("/api/machines/:id/alerts", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
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

  app.get("/api/alerts", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { resolved } = req.query;
      const userRole = req.user?.role;
      const userId = req.user?.userId;
      
      // Admin, supervisor y contabilidad ven todas las alertas
      if (userRole === "admin" || userRole === "supervisor" || userRole === "contabilidad") {
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
        return res.json(alerts);
      }
      
      // Abastecedor solo ve alertas de máquinas en su ruta de hoy
      if (userRole === "abastecedor" && userId) {
        const todayRoute = await storage.getTodayRoute(userId);
        if (!todayRoute || !todayRoute.stops || todayRoute.stops.length === 0) {
          return res.json([]);
        }
        
        // Obtener IDs de máquinas en la ruta
        const machineIds = todayRoute.stops.map((stop: any) => stop.machineId);
        
        // Filtrar alertas por máquinas de la ruta
        const allAlerts = await storage.getMachineAlerts(
          undefined,
          resolved === "true" ? true : resolved === "false" ? false : undefined
        );
        const filteredAlerts = allAlerts.filter((alert: any) => machineIds.includes(alert.machineId));
        
        if (res.headersSent) return;
        return res.json(filteredAlerts);
      }
      
      // Otros roles no ven alertas
      res.json([]);
    } catch (error) {
      if (res.headersSent) return;
      res.status(500).json({ error: "Error al obtener alertas" });
    }
  });

  app.post("/api/machines/:id/alerts", authenticateJWT, authorizeAction("machines", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
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

  app.patch("/api/alerts/:id/resolve", authenticateJWT, authorizeAction("machines", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyAlertTenant(req.params.id, req, res)) return;
      
      const alert = await storage.resolveAlertSimple(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Alerta no encontrada" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Error al resolver alerta" });
    }
  });

  app.get("/api/machines/:id/visits", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
      const visits = await storage.getMachineVisits(req.params.id);
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener visitas" });
    }
  });

  app.post("/api/machines/:id/visits", authenticateJWT, authorizeAction("machines", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
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

  app.patch("/api/visits/:id/end", authenticateJWT, authorizeAction("machines", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyVisitTenant(req.params.id, req, res)) return;
      
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

  app.get("/api/machines/:id/sales", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
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

  app.post("/api/machines/:id/sales", authenticateJWT, authorizeAction("accounting", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
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

  app.get("/api/machines/:id/sales/summary", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyMachineTenant(req.params.id, req, res)) return;
      
      const summary = await storage.getMachineSalesSummary(req.params.id);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen de ventas" });
    }
  });

  app.get("/api/stats/zones", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const machines = await storage.getMachines(req.user!.tenantId);
      const zonesSet = new Set(machines.map(m => m.zone).filter(Boolean));
      const zones = Array.from(zonesSet);
      res.json(zones);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener zonas" });
    }
  });

  // ==================== MÓDULO ALMACÉN ====================

  // Proveedores (protegidos con JWT)
  app.get("/api/suppliers", authenticateJWT, authorizeAction("suppliers", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const suppliers = await storage.getSuppliers(tenantId);
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener proveedores" });
    }
  });

  app.get("/api/suppliers/:id", authenticateJWT, authorizeAction("suppliers", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifySupplierTenant(req.params.id, req, res)) return;
      
      const supplier = await storage.getSupplier(req.params.id);
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener proveedor" });
    }
  });

  app.post("/api/suppliers", authenticateJWT, authorizeAction("suppliers", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertSupplierSchema.omit({ tenantId: true }).parse(req.body);
      const supplier = await storage.createSupplier({ ...data, tenantId: req.user!.tenantId! });
      res.status(201).json(supplier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear proveedor" });
    }
  });

  app.patch("/api/suppliers/:id", authenticateJWT, authorizeAction("suppliers", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifySupplierTenant(req.params.id, req, res)) return;
      
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

  app.delete("/api/suppliers/:id", authenticateJWT, authorizeAction("suppliers", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifySupplierTenant(req.params.id, req, res)) return;
      
      await storage.deleteSupplier(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar proveedor" });
    }
  });

  // Inventario de Almacén (protegido con JWT)
  app.get("/api/warehouse/inventory", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const inventory = await storage.getWarehouseInventory(tenantId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener inventario de almacén" });
    }
  });

  app.get("/api/warehouse/low-stock", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const lowStock = await storage.getLowStockAlerts(tenantId);
      res.json(lowStock);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener alertas de stock bajo" });
    }
  });

  app.patch("/api/warehouse/inventory/:productId", authenticateJWT, authorizeAction("warehouse", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyProductTenant(req.params.productId, req, res)) return;
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
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const lots = await storage.getProductLots(productId as string | undefined, 50, tenantId);
      res.json(lots);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener lotes" });
    }
  });

  app.get("/api/warehouse/lots/expiring", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { days } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const expiringLots = await storage.getExpiringLots(parseInt(days as string) || 30, 30, tenantId);
      res.json(expiringLots);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener lotes por vencer" });
    }
  });

  app.post("/api/warehouse/lots", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ error: "productId es requerido" });
      }

      // Load product and verify tenant ownership (fail-closed)
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }
      if (!verifyTenantOwnership(product.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      // Derive tenantId from JWT; for superAdmin without tenant, fall back to product's tenant
      const tenantId = req.user?.isSuperAdmin
        ? (req.query.tenantId as string | undefined) || req.user.tenantId || product.tenantId
        : req.user!.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "No se pudo determinar el tenant" });
      }

      const { tenantId: _omitted, ...bodyRest } = req.body;
      const data = insertProductLotSchema.parse({ ...bodyRest, tenantId });
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
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const movements = await storage.getWarehouseMovements(
        productId as string | undefined,
        limit ? parseInt(limit as string) : undefined,
        tenantId
      );
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener movimientos" });
    }
  });

  // Entrada de mercancía - solo admin y almacen pueden registrar entradas
  app.post("/api/warehouse/entry", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, quantity, unitCost, supplierId, lotNumber, expirationDate, notes } = req.body;
      
      if (!productId || !quantity || unitCost === undefined || unitCost === null || unitCost === "" || !lotNumber) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      
      if (!await verifyProductTenant(productId, req, res)) return;
      
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
  app.post("/api/warehouse/exit", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, quantity, destinationUserId, notes } = req.body;
      
      if (!productId || !quantity || !destinationUserId) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      
      if (!await verifyProductTenant(productId, req, res)) return;
      
      // Verify destinationUserId belongs to the same tenant (fail-closed)
      if (!req.user!.isSuperAdmin) {
        const destinationUser = await storage.getUser(destinationUserId);
        if (!destinationUser || destinationUser.tenantId !== req.user!.tenantId) {
          return res.status(404).json({ error: "Abastecedor no encontrado" });
        }
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
  app.post("/api/warehouse/adjustment", authenticateJWT, authorizeAction("warehouse", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId, physicalCount, notes, reason } = req.body;
      
      if (!productId || physicalCount === undefined) {
        return res.status(400).json({ error: "Faltan campos requeridos: productId y physicalCount" });
      }
      
      if (!await verifyProductTenant(productId, req, res)) return;
      
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

  // Despachar productos del almacén a un vehículo (flujo de inventario conectado)
  app.post("/api/warehouse/dispatch-to-vehicle", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { vehicleId, items, notes } = req.body;
      
      if (!vehicleId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Faltan campos requeridos: vehicleId y items (array de {productId, quantity})" });
      }
      
      // Validar estructura de items
      for (const item of items) {
        if (!item.productId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({ error: "Cada item debe tener productId y quantity > 0" });
        }
      }
      
      // Verificar que el vehículo pertenece al tenant del usuario
      if (!await verifyVehicleTenant(vehicleId, req, res)) return;
      
      // Verificar que todos los productos pertenecen al tenant del usuario
      for (const item of items) {
        if (!await verifyProductTenant(item.productId, req, res)) return;
      }
      
      const result = await storage.dispatchToVehicle({
        vehicleId,
        items: items.map((i: { productId: string; quantity: number }) => ({
          productId: i.productId,
          quantity: parseInt(String(i.quantity)),
        })),
        executedByUserId: req.user!.userId,
        notes,
      });
      
      res.status(201).json({
        success: true,
        message: `Se despacharon ${items.length} productos al vehículo`,
        warehouseMovementsCount: result.warehouseMovements.length,
        vehicleInventoryItemsCount: result.vehicleInventoryItems.length,
        inventoryTransfersCount: result.inventoryTransfers.length,
      });
    } catch (error: any) {
      if (error.message?.includes("Stock insuficiente")) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message?.includes("lotes disponibles")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error dispatching to vehicle:", error);
      res.status(500).json({ error: "Error al despachar productos al vehículo" });
    }
  });

  // Obtener inventario de un vehículo
  app.get("/api/vehicle-inventory/:vehicleId", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { vehicleId } = req.params;
      if (!await verifyVehicleTenant(vehicleId, req, res)) return;
      const inventory = await storage.getVehicleInventory(vehicleId);
      res.json(inventory);
    } catch (error) {
      console.error("Error getting vehicle inventory:", error);
      res.status(500).json({ error: "Error al obtener inventario del vehículo" });
    }
  });

  // Obtener inventario del vehículo del usuario actual (abastecedor)
  app.get("/api/my-vehicle-inventory", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inventory = await storage.getVehicleInventoryByUser(req.user!.userId);
      res.json(inventory);
    } catch (error) {
      console.error("Error getting my vehicle inventory:", error);
      res.status(500).json({ error: "Error al obtener inventario de mi vehículo" });
    }
  });

  // Obtener historial de transferencias de inventario
  app.get("/api/inventory-transfers", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { vehicleId, machineId, transferType, limit } = req.query;
      // Fail-closed: exigir tenantId para no-superAdmin
      if (req.user && !req.user.isSuperAdmin && !req.user.tenantId) {
        return res.status(403).json({ error: "Contexto de tenant requerido" });
      }
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const transfers = await storage.getInventoryTransfers({
        vehicleId: vehicleId as string,
        machineId: machineId as string,
        transferType: transferType as string,
        limit: limit ? parseInt(limit as string) : undefined,
        tenantId,
      });
      res.json(transfers);
    } catch (error) {
      console.error("Error getting inventory transfers:", error);
      res.status(500).json({ error: "Error al obtener transferencias de inventario" });
    }
  });

  // Estadísticas del almacén (protegido con JWT)
  app.get("/api/warehouse/stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;

      const [allProducts, inventory, lowStock, expiringLots, movements] = await Promise.all([
        storage.getProducts(tenantId),
        storage.getWarehouseInventory(tenantId),
        storage.getLowStockAlerts(tenantId),
        storage.getExpiringLots(30, 30, tenantId),
        storage.getWarehouseMovements(undefined, 10, tenantId),
      ]);

      const totalProducts = allProducts.length;
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
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const inventory = await storage.getWarehouseInventory(tenantId);
      const lots = await storage.getProductLots(undefined, 50, tenantId);
      
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
  app.patch("/api/warehouse/inventory/:productId/alerts", authenticateJWT, authorizeAction("warehouse", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productId } = req.params;
      
      if (!await verifyProductTenant(productId, req, res)) return;
      
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
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const inventory = await storage.getWarehouseInventory(tenantId);
      
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
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const movements = await storage.getWarehouseMovements(undefined, limit ? parseInt(limit as string) : 500, tenantId);
      
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
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const lots = await storage.getProductLots(undefined, 500, tenantId);
      
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
      const { date, status, page, pageSize, supplierId, search } = req.query;
      // Abastecedor solo ve sus propias rutas
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const result = await storage.getRoutes(
        effectiveUserId,
        date ? new Date(date as string) : undefined,
        status as string | undefined,
        tenantId,
        page ? Number(page) : 1,
        pageSize ? Number(pageSize) : 20,
        supplierId as string | undefined,
        search as string | undefined
      );
      res.json(result);
    } catch (error) {
      console.error("Error getting routes:", error);
      res.status(500).json({ error: "Error al obtener rutas" });
    }
  });

  app.get("/api/supplier/routes/stats", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const stats = await storage.getRouteStats(effectiveUserId, tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting route stats:", error);
      res.status(500).json({ error: "Error al obtener estadísticas de rutas" });
    }
  });

  app.get("/api/supplier/routes/:id", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyRouteTenant(req.params.id, req, res)) return;
      
      const route = await storage.getRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      // Abastecedor solo puede ver sus propias rutas
      if (req.user?.role === "abastecedor" && route.supplierId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para ver esta ruta" });
      }
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener ruta" });
    }
  });

  app.get("/api/supplier/today-route/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), authorizeOwnership("userId"), async (req: AuthenticatedRequest, res: Response) => {
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

  app.post("/api/supplier/routes", authenticateJWT, authorizeAction("routes", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const data = insertRouteSchema.omit({ tenantId: true }).extend({ date: z.coerce.date() }).parse(req.body);
      const route = await storage.createRoute({ ...data, tenantId });
      res.status(201).json(route);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating route:", error);
      res.status(500).json({ error: "Error al crear ruta" });
    }
  });

  app.patch("/api/supplier/routes/:id", authenticateJWT, authorizeAction("routes", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyRouteTenant(req.params.id, req, res)) return;
      
      const data = insertRouteSchema.extend({ date: z.coerce.date().optional() }).partial().parse(req.body);
      const route = await storage.updateRoute(req.params.id, data);
      if (!route) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      // Cascada: al cancelar ruta, cancelar también las paradas pendientes/en progreso
      if (data.status === "cancelada") {
        await storage.cancelRouteStops(req.params.id);
      }
      res.json(route);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al actualizar ruta" });
    }
  });

  app.patch("/api/supplier/stops/:id", authenticateJWT, authorizeAction("stops", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyStopTenant(req.params.id, req, res)) return;
      const { order, notes, status } = req.body;
      const updates: Record<string, unknown> = {};
      if (order !== undefined) updates.order = Number(order);
      if (notes !== undefined) updates.notes = notes;
      if (status !== undefined) updates.status = status;
      const stop = await storage.updateRouteStop(req.params.id, updates);
      if (!stop) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      res.json(stop);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar parada" });
    }
  });

  app.post("/api/supplier/routes/:id/start", authenticateJWT, authorizeAction("routes", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyRouteTenant(req.params.id, req, res)) return;
      // Verificar ownership para abastecedor
      const existingRoute = await storage.getRoute(req.params.id);
      if (!existingRoute) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      if (req.user?.role === "abastecedor" && existingRoute.supplierId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para iniciar esta ruta" });
      }
      const route = await storage.startRoute(req.params.id);
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Error al iniciar ruta" });
    }
  });

  app.post("/api/supplier/routes/:id/complete", authenticateJWT, authorizeAction("routes", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyRouteTenant(req.params.id, req, res)) return;
      // Verificar ownership para abastecedor
      const existingRoute = await storage.getRoute(req.params.id);
      if (!existingRoute) {
        return res.status(404).json({ error: "Ruta no encontrada" });
      }
      if (req.user?.role === "abastecedor" && existingRoute.supplierId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para completar esta ruta" });
      }
      const route = await storage.completeRoute(req.params.id);
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Error al completar ruta" });
    }
  });

  // Paradas de Ruta
  app.get("/api/supplier/routes/:routeId/stops", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyRouteTenant(req.params.routeId, req, res)) return;
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor") {
        const route = await storage.getRoute(req.params.routeId);
        if (!route) {
          return res.status(404).json({ error: "Ruta no encontrada" });
        }
        if (route.supplierId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para ver las paradas de esta ruta" });
        }
      }
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
      
      const userTenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      
      // Verificar tenant y ownership para cada routeId
      for (const routeId of routeIds) {
        const route = await storage.getRoute(routeId);
        if (!route) {
          return res.status(404).json({ error: "Ruta no encontrada" });
        }
        if (userTenantId && route.tenantId !== userTenantId) {
          return res.status(404).json({ error: "Ruta no encontrada" });
        }
        if (req.user?.role === "abastecedor" && route.supplierId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para ver las paradas de una o más rutas" });
        }
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
      if (!await verifyStopTenant(req.params.id, req, res)) return;
      
      const stop = await storage.getRouteStop(req.params.id);
      if (!stop) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor") {
        const route = await storage.getRoute(stop.routeId);
        if (!route || route.supplierId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para ver esta parada" });
        }
      }
      res.json(stop);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener parada" });
    }
  });

  app.post("/api/supplier/routes/:routeId/stops", authenticateJWT, authorizeAction("stops", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyRouteTenant(req.params.routeId, req, res)) return;
      const tenantId = req.user!.tenantId;
      const data = insertRouteStopSchema.omit({ tenantId: true }).extend({ estimatedArrival: z.coerce.date().optional() }).parse({
        ...req.body,
        routeId: req.params.routeId,
      });
      const stop = await storage.createRouteStop({ ...data, tenantId });
      
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

  app.post("/api/supplier/stops/:id/start", authenticateJWT, authorizeAction("stops", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyStopTenant(req.params.id, req, res)) return;
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor") {
        const existingStop = await storage.getRouteStop(req.params.id);
        if (!existingStop) {
          return res.status(404).json({ error: "Parada no encontrada" });
        }
        const route = await storage.getRoute(existingStop.routeId);
        if (!route || route.supplierId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para iniciar esta parada" });
        }
      }
      const stop = await storage.startStop(req.params.id);
      if (!stop) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      res.json(stop);
    } catch (error) {
      res.status(500).json({ error: "Error al iniciar parada" });
    }
  });

  app.post("/api/supplier/stops/:id/complete", authenticateJWT, authorizeAction("stops", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyStopTenant(req.params.id, req, res)) return;
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor") {
        const existingStop = await storage.getRouteStop(req.params.id);
        if (!existingStop) {
          return res.status(404).json({ error: "Parada no encontrada" });
        }
        const route = await storage.getRoute(existingStop.routeId);
        if (!route || route.supplierId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para completar esta parada" });
        }
      }
      const stop = await storage.completeStop(req.params.id);
      if (!stop) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      res.json(stop);
    } catch (error) {
      res.status(500).json({ error: "Error al completar parada" });
    }
  });

  // Endpoint de recuperación: cancela parada inconsistente (en_progreso sin servicio activo)
  app.post("/api/supplier/stops/:id/recover", authenticateJWT, authorizeAction("stops", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { db } = await import("./db");
      const { routeStops, serviceRecords } = await import("@shared/schema");
      const { eq, and, isNull } = await import("drizzle-orm");
      
      // Buscar la parada
      const [stop] = await db.select().from(routeStops).where(eq(routeStops.id, req.params.id));
      if (!stop) {
        return res.status(404).json({ error: "Parada no encontrada" });
      }
      
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor") {
        const route = await storage.getRoute(stop.routeId);
        if (!route || route.supplierId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para recuperar esta parada" });
        }
      }
      
      // Verificar que está en estado inconsistente (en_progreso)
      if (stop.status !== "en_progreso") {
        return res.status(400).json({ error: "La parada no está en estado en_progreso" });
      }
      
      // Verificar que no hay servicio activo asociado
      const [activeService] = await db.select()
        .from(serviceRecords)
        .where(and(
          eq(serviceRecords.routeStopId, req.params.id),
          isNull(serviceRecords.endTime)
        ));
      
      if (activeService) {
        return res.status(400).json({ error: "La parada tiene un servicio activo, no se puede recuperar" });
      }
      
      // Resetear la parada a estado pendiente
      const [recovered] = await db.update(routeStops)
        .set({ status: "pendiente", actualArrival: null, actualDeparture: null })
        .where(eq(routeStops.id, req.params.id))
        .returning();
      
      res.json({ message: "Parada recuperada exitosamente", stop: recovered });
    } catch (error) {
      console.error("Error recovering stop:", error);
      res.status(500).json({ error: "Error al recuperar parada" });
    }
  });

  app.delete("/api/supplier/routes/:id", authenticateJWT, authorizeAction("routes", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyRouteTenant(req.params.id, req, res)) return;
      
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

  app.delete("/api/supplier/stops/:id", authenticateJWT, authorizeAction("stops", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyStopTenant(req.params.id, req, res)) return;
      
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
      const { machineId, limit } = req.query;
      // Abastecedor solo ve sus propios servicios
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const services = await storage.getServiceRecords(
        effectiveUserId,
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
      if (!await verifyServiceTenant(req.params.id, req, res)) return;
      
      const service = await storage.getServiceRecord(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      // Abastecedor solo puede ver sus propios servicios
      if (req.user?.role === "abastecedor" && service.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para ver este servicio" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener servicio" });
    }
  });

  app.get("/api/supplier/active-service/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), authorizeOwnership("userId"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const routeStopId = req.query.routeStopId as string | undefined;
      console.log(`[active-service] Looking for active service for userId=${req.params.userId}, routeStopId=${routeStopId || 'not specified'}`);
      const service = await storage.getActiveService(req.params.userId, routeStopId);
      
      if (!service) {
        console.log(`[active-service] No active service found for userId=${req.params.userId}`);
        return res.json(null);
      }
      console.log(`[active-service] Found service: id=${service.id}, status=${service.status}`);
      
      // Obtener datos completos del servicio activo (checklist, efectivo, cargas, incidencias)
      const [cashCollections, productLoads, serviceIssues] = await Promise.all([
        storage.getCashCollections(req.params.userId, undefined, undefined, undefined, 100),
        storage.getProductLoads(service.id),
        storage.getIssueReportsByService(service.id)
      ]);
      
      // Filtrar solo las colecciones de efectivo para este servicio
      const serviceCash = cashCollections.filter((c: any) => c.serviceRecordId === service.id);
      
      res.json({
        ...service,
        cashCollections: serviceCash,
        productLoads,
        issueReports: serviceIssues
      });
    } catch (error) {
      console.error("Error getting active service:", error);
      res.status(500).json({ error: "Error al obtener servicio activo" });
    }
  });

  // Creación de servicio idempotente: si ya existe uno activo para la parada, lo devuelve
  app.post("/api/supplier/services", authenticateJWT, authorizeAction("service_records", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(),
      };
      const data = insertServiceRecordSchema.parse(body);
      
      // Abastecedor solo puede crear servicios para sí mismo
      if (req.user?.role === "abastecedor" && data.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para crear servicios para otros usuarios" });
      }
      
      // Verificar si ya existe un servicio activo para esta parada
      if (data.routeStopId) {
        const existingService = await storage.getActiveService(data.userId, data.routeStopId);
        if (existingService) {
          // Devolver el servicio existente (idempotencia)
          return res.status(200).json(existingService);
        }
      }
      
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

  app.post("/api/supplier/services/:id/end", authenticateJWT, authorizeAction("service_records", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Obtener el servicio actual
      const existingService = await storage.getServiceRecord(req.params.id);
      if (!existingService) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor" && existingService.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para finalizar este servicio" });
      }
      
      // Verificar que el servicio esté en progreso
      if (existingService.status !== "en_progreso") {
        return res.status(400).json({ error: "Solo se pueden finalizar servicios en progreso" });
      }
      
      const { notes, signature, responsibleName, checklistData } = req.body;
      
      // Validar checklist - verificar que esté completo
      let checklistWarnings: string[] = [];
      if (checklistData) {
        try {
          const items = typeof checklistData === "string" ? JSON.parse(checklistData) : checklistData;
          if (Array.isArray(items)) {
            const uncheckedItems = items.filter((item: any) => !item.checked);
            if (uncheckedItems.length > 0) {
              checklistWarnings.push(`${uncheckedItems.length} item(s) del checklist sin completar`);
            }
          }
        } catch (e) {
          return res.status(400).json({ error: "Formato de checklist inválido" });
        }
      }
      
      // Validar firma - requerida para finalización
      if (!signature) {
        return res.status(400).json({ 
          error: "La firma es requerida para finalizar el servicio",
          code: "SIGNATURE_REQUIRED"
        });
      }
      
      // Validar nombre del responsable si hay firma
      if (signature && !responsibleName?.trim()) {
        return res.status(400).json({ 
          error: "El nombre del responsable es requerido con la firma",
          code: "RESPONSIBLE_NAME_REQUIRED"
        });
      }
      
      const service = await storage.endService(req.params.id, notes, signature, responsibleName, checklistData);
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      
      // Incluir advertencias en la respuesta si hay
      res.json({
        ...service,
        warnings: checklistWarnings.length > 0 ? checklistWarnings : undefined
      });
    } catch (error) {
      console.error("Error ending service:", error);
      res.status(500).json({ error: "Error al finalizar servicio" });
    }
  });

  // Actualizar checklist del servicio
  app.patch("/api/supplier/services/:id/checklist", authenticateJWT, authorizeAction("service_records", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor") {
        const existingService = await storage.getServiceRecord(req.params.id);
        if (!existingService) {
          return res.status(404).json({ error: "Servicio no encontrado" });
        }
        if (existingService.userId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para modificar este servicio" });
        }
      }
      const { checklistData } = req.body;
      const { db } = await import("./db");
      const { serviceRecords } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [updated] = await db.update(serviceRecords)
        .set({ checklistData: JSON.stringify(checklistData) })
        .where(eq(serviceRecords.id, req.params.id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating checklist:", error);
      res.status(500).json({ error: "Error al actualizar checklist" });
    }
  });

  // Cancelar servicio activo
  app.post("/api/supplier/services/:id/cancel", authenticateJWT, authorizeAction("service_records", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { db } = await import("./db");
      const { serviceRecords, routeStops } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Obtener el servicio
      const [service] = await db.select().from(serviceRecords)
        .where(eq(serviceRecords.id, req.params.id));
      
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor" && service.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para cancelar este servicio" });
      }
      
      if (service.status !== "en_progreso") {
        return res.status(400).json({ error: "Solo se pueden cancelar servicios en progreso" });
      }
      
      // Cancelar el servicio
      await db.update(serviceRecords)
        .set({ status: "cancelado", endTime: new Date() })
        .where(eq(serviceRecords.id, req.params.id));
      
      // Revertir la parada a pendiente si existe
      if (service.routeStopId) {
        await db.update(routeStops)
          .set({ status: "pendiente", actualArrival: null })
          .where(eq(routeStops.id, service.routeStopId));
      }
      
      res.json({ message: "Servicio cancelado exitosamente" });
    } catch (error) {
      console.error("Error cancelling service:", error);
      res.status(500).json({ error: "Error al cancelar servicio" });
    }
  });

  // Obtener productos cargados en un servicio
  app.get("/api/supplier/services/:id/products", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor") {
        const service = await storage.getServiceRecord(req.params.id);
        if (!service) {
          return res.status(404).json({ error: "Servicio no encontrado" });
        }
        if (service.userId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para ver los productos de este servicio" });
        }
      }
      
      const { db } = await import("./db");
      const { productLoads, products } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const loads = await db.select({
        id: productLoads.id,
        productId: productLoads.productId,
        quantity: productLoads.quantity,
        loadType: productLoads.loadType,
        createdAt: productLoads.createdAt,
        productName: products.name,
        productCode: products.code,
      })
        .from(productLoads)
        .leftJoin(products, eq(productLoads.productId, products.id))
        .where(eq(productLoads.serviceRecordId, req.params.id));
      
      res.json(loads);
    } catch (error) {
      console.error("Error getting service products:", error);
      res.status(500).json({ error: "Error al obtener productos del servicio" });
    }
  });

  // Estado completo del servicio (para monitoreo de admin/supervisor)
  app.get("/api/services/:id/full-status", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serviceRecords, productLoads, cashCollections, issueReports, products, machines, users, routeStops, routes } = await import("@shared/schema");
      
      // Obtener el servicio base (incluye tenantId para validación)
      const [service] = await db.select({
        id: serviceRecords.id,
        tenantId: serviceRecords.tenantId,
        status: serviceRecords.status,
        startTime: serviceRecords.startTime,
        endTime: serviceRecords.endTime,
        notes: serviceRecords.notes,
        checklistData: serviceRecords.checklistData,
        signature: serviceRecords.signature,
        responsibleName: serviceRecords.responsibleName,
        machineId: serviceRecords.machineId,
        userId: serviceRecords.userId,
        routeStopId: serviceRecords.routeStopId,
        machineName: machines.name,
        machineCode: machines.code,
        userName: users.fullName,
        userEmail: users.email,
      })
        .from(serviceRecords)
        .leftJoin(machines, eq(serviceRecords.machineId, machines.id))
        .leftJoin(users, eq(serviceRecords.userId, users.id))
        .where(eq(serviceRecords.id, req.params.id));
      
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }

      // Tenant isolation: admin/supervisor sólo pueden ver servicios de su tenant
      // SuperAdmin bypassa esta verificación
      if (!req.user?.isSuperAdmin && service.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      
      // Verificar ownership para abastecedor
      if (req.user?.role === "abastecedor" && service.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para ver este servicio" });
      }
      
      // Obtener productos cargados, efectivo e incidencias en paralelo
      const [loadedProducts, cashCollected, issues] = await Promise.all([
        db.select({
          id: productLoads.id,
          productId: productLoads.productId,
          quantity: productLoads.quantity,
          loadType: productLoads.loadType,
          createdAt: productLoads.createdAt,
          productName: products.name,
          productCode: products.code,
        })
          .from(productLoads)
          .leftJoin(products, eq(productLoads.productId, products.id))
          .where(eq(productLoads.serviceRecordId, req.params.id)),
        
        db.select({
          id: cashCollections.id,
          expectedAmount: cashCollections.expectedAmount,
          actualAmount: cashCollections.actualAmount,
          difference: cashCollections.difference,
          createdAt: cashCollections.createdAt,
        })
          .from(cashCollections)
          .where(eq(cashCollections.serviceRecordId, req.params.id)),
        
        db.select({
          id: issueReports.id,
          type: issueReports.issueType,
          priority: issueReports.priority,
          description: issueReports.description,
          status: issueReports.status,
          photoUrl: issueReports.photoUrl,
          createdAt: issueReports.createdAt,
        })
          .from(issueReports)
          .where(eq(issueReports.serviceRecordId, req.params.id)),
      ]);
      
      // Calcular totales
      const totalCashCollected = cashCollected.reduce((sum, c) => sum + parseFloat(c.actualAmount || "0"), 0);
      const totalProductsLoaded = loadedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
      
      // Parsear checklist si existe
      let checklistItems: any[] = [];
      let checklistProgress = 0;
      if (service.checklistData) {
        try {
          checklistItems = JSON.parse(service.checklistData);
          const checked = checklistItems.filter((item: any) => item.checked).length;
          checklistProgress = checklistItems.length > 0 ? Math.round((checked / checklistItems.length) * 100) : 0;
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Construir cronología de eventos
      const timeline: any[] = [];
      
      // Inicio del servicio
      if (service.startTime) {
        timeline.push({
          type: "service_start",
          timestamp: service.startTime,
          description: "Servicio iniciado",
        });
      }
      
      // Productos cargados
      for (const load of loadedProducts) {
        timeline.push({
          type: "product_load",
          timestamp: load.createdAt,
          description: `${load.loadType === "carga" ? "Cargó" : "Retiró"} ${load.quantity} unidades de ${load.productName}`,
        });
      }
      
      // Efectivo recolectado
      for (const cash of cashCollected) {
        timeline.push({
          type: "cash_collection",
          timestamp: cash.createdAt,
          description: `Recolectó RD$${parseFloat(cash.actualAmount || "0").toFixed(2)}`,
        });
      }
      
      // Incidencias reportadas
      for (const issue of issues) {
        timeline.push({
          type: "issue_report",
          timestamp: issue.createdAt,
          description: `Reportó incidencia: ${issue.type} (${issue.priority})`,
          priority: issue.priority,
        });
      }
      
      // Fin del servicio
      if (service.endTime) {
        timeline.push({
          type: "service_end",
          timestamp: service.endTime,
          description: service.status === "cancelado" ? "Servicio cancelado" : "Servicio finalizado",
        });
      }
      
      // Ordenar cronología por timestamp
      timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      res.json({
        ...service,
        loadedProducts,
        cashCollected,
        issues,
        totalCashCollected,
        totalProductsLoaded,
        checklistItems,
        checklistProgress,
        hasSignature: !!service.signature,
        timeline,
        duration: service.endTime 
          ? Math.round((new Date(service.endTime).getTime() - new Date(service.startTime!).getTime()) / 60000)
          : service.startTime 
            ? Math.round((Date.now() - new Date(service.startTime).getTime()) / 60000)
            : 0,
      });
    } catch (error) {
      console.error("Error getting service full status:", error);
      res.status(500).json({ error: "Error al obtener estado del servicio" });
    }
  });

  // Lista de servicios activos (para panel de monitoreo admin/supervisor)
  app.get("/api/admin/active-services", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serviceRecords, machines, users, routeStops, routes, productLoads, cashCollections, issueReports } = await import("@shared/schema");
      
      // Tenant isolation: SuperAdmin puede opcionalmente filtrar por ?tenantId=
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;

      // Si es supervisor, filtrar por usuarios de su zona
      const supervisorZone = await getSupervisorZone(req);
      let zoneUserIds: string[] | null = null;
      if (supervisorZone) {
        zoneUserIds = await storage.getUserIdsByZone(supervisorZone);
      }
      
      // Construir condiciones de filtro
      const conditions: (SQL<unknown> | undefined)[] = [eq(serviceRecords.status, "en_progreso")];
      if (tenantId) {
        conditions.push(eq(serviceRecords.tenantId, tenantId));
      }
      if (zoneUserIds && zoneUserIds.length > 0) {
        conditions.push(inArray(serviceRecords.userId, zoneUserIds));
      }
      
      // Obtener servicios activos (en_progreso), filtrados por tenant y zona
      const activeServices = await db.select({
        id: serviceRecords.id,
        status: serviceRecords.status,
        startTime: serviceRecords.startTime,
        checklistData: serviceRecords.checklistData,
        machineId: serviceRecords.machineId,
        userId: serviceRecords.userId,
        routeStopId: serviceRecords.routeStopId,
        machineName: machines.name,
        machineCode: machines.code,
        userName: users.fullName,
        userEmail: users.email,
        userPhone: users.phone,
        routeId: routes.id,
        routeDate: routes.date,
      })
        .from(serviceRecords)
        .leftJoin(machines, eq(serviceRecords.machineId, machines.id))
        .leftJoin(users, eq(serviceRecords.userId, users.id))
        .leftJoin(routeStops, eq(serviceRecords.routeStopId, routeStops.id))
        .leftJoin(routes, eq(routeStops.routeId, routes.id))
        .where(and(...conditions))
        .orderBy(desc(serviceRecords.startTime));
      
      if (activeServices.length === 0) {
        return res.json({ activeCount: 0, services: [] });
      }

      const serviceIds = activeServices.map((s) => s.id);

      // Agregados en 3 queries únicas (GROUP BY) — sin N+1
      const [productTotals, cashTotals, issueCounts] = await Promise.all([
        db.select({
          serviceRecordId: productLoads.serviceRecordId,
          total: sql<number>`COALESCE(SUM(${productLoads.quantity}), 0)`,
        })
          .from(productLoads)
          .where(inArray(productLoads.serviceRecordId, serviceIds))
          .groupBy(productLoads.serviceRecordId),

        db.select({
          serviceRecordId: cashCollections.serviceRecordId,
          total: sql<number>`COALESCE(SUM(CAST(${cashCollections.actualAmount} AS DECIMAL)), 0)`,
        })
          .from(cashCollections)
          .where(inArray(cashCollections.serviceRecordId, serviceIds))
          .groupBy(cashCollections.serviceRecordId),

        db.select({
          serviceRecordId: issueReports.serviceRecordId,
          count: sql<number>`COUNT(*)`,
        })
          .from(issueReports)
          .where(inArray(issueReports.serviceRecordId, serviceIds))
          .groupBy(issueReports.serviceRecordId),
      ]);

      // Construir mapas O(1) para lookup
      const productMap = new Map(productTotals.map((r) => [r.serviceRecordId, Number(r.total)]));
      const cashMap = new Map(cashTotals.map((r) => [r.serviceRecordId, Number(r.total)]));
      const issueMap = new Map(issueCounts.map((r) => [r.serviceRecordId, Number(r.count)]));

      // Enriquecer sin queries adicionales
      const enrichedServices = activeServices.map((service) => {
        let checklistProgress = 0;
        if (service.checklistData) {
          try {
            const items = JSON.parse(service.checklistData);
            const checked = items.filter((item: any) => item.checked).length;
            checklistProgress = items.length > 0 ? Math.round((checked / items.length) * 100) : 0;
          } catch (e) {
            // Ignore
          }
        }
        const duration = service.startTime
          ? Math.round((Date.now() - new Date(service.startTime).getTime()) / 60000)
          : 0;
        return {
          ...service,
          totalProductsLoaded: productMap.get(service.id) ?? 0,
          totalCashCollected: cashMap.get(service.id) ?? 0,
          issuesReported: issueMap.get(service.id) ?? 0,
          checklistProgress,
          duration,
        };
      });
      
      res.json({
        activeCount: enrichedServices.length,
        services: enrichedServices,
      });
    } catch (error) {
      console.error("Error getting active services:", error);
      res.status(500).json({ error: "Error al obtener servicios activos" });
    }
  });

  // Recolección de Efectivo
  app.get("/api/supplier/cash", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "contabilidad"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { machineId, startDate, endDate } = req.query;
      // Abastecedor solo ve sus propias recolecciones
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const collections = await storage.getCashCollections(
        effectiveUserId,
        machineId as string | undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(collections);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener recolecciones" });
    }
  });

  app.post("/api/supplier/cash", authenticateJWT, authorizeAction("cash_collections", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertCashCollectionSchema.parse(req.body);
      // Abastecedor solo puede crear recolecciones para sí mismo
      if (req.user?.role === "abastecedor" && data.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para registrar recolecciones para otros usuarios" });
      }
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

  app.get("/api/supplier/cash/summary/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "contabilidad"), authorizeOwnership("userId"), async (req: AuthenticatedRequest, res: Response) => {
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
      // Abastecedor solo ve sus propias cargas
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const loads = await storage.getProductLoads(
        serviceRecordId as string | undefined,
        machineId as string | undefined,
        effectiveUserId
      );
      res.json(loads);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener cargas" });
    }
  });

  app.post("/api/supplier/loads", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertProductLoadSchema.parse(req.body);
      // Abastecedor solo puede crear cargas para sí mismo
      if (req.user?.role === "abastecedor" && data.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para registrar cargas para otros usuarios" });
      }
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
      const { machineId, status } = req.query;
      // Abastecedor solo ve sus propios reportes
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const issues = await storage.getIssueReports(
        machineId as string | undefined,
        status as string | undefined,
        effectiveUserId
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
      // Abastecedor solo puede ver sus propios reportes
      if (req.user?.role === "abastecedor" && issue.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para ver este reporte" });
      }
      res.json(issue);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener reporte" });
    }
  });

  app.post("/api/supplier/issues", authenticateJWT, authorizeAction("issue_reports", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertIssueReportSchema.parse(req.body);
      // Abastecedor solo puede crear reportes para sí mismo
      if (req.user?.role === "abastecedor" && data.userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para crear reportes para otros usuarios" });
      }
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

  app.post("/api/supplier/issues/:id/resolve", authenticateJWT, authorizeAction("issue_reports", "approve"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { resolution } = req.body;
      const userId = req.user?.userId;
      if (!userId || !resolution) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      const existing = await storage.getIssueReport(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Reporte no encontrado" });
      }
      if (!req.user?.isSuperAdmin && existing.tenantId !== req.user?.tenantId) {
        return res.status(404).json({ error: "Reporte no encontrado" });
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
  app.get("/api/supplier/inventory/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "almacen"), authorizeOwnership("userId"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inventory = await storage.getSupplierInventoryForDisplay(req.params.userId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener inventario del abastecedor" });
    }
  });

  app.post("/api/supplier/inventory/load", authenticateJWT, authorizeAction("warehouse", "create"), async (req: AuthenticatedRequest, res: Response) => {
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

  app.post("/api/supplier/inventory/unload", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, machineId, productId, quantity } = req.body;
      if (!userId || !machineId || !productId || !quantity) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      // Abastecedor solo puede descargar su propio inventario
      if (req.user?.role === "abastecedor" && userId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para descargar inventario de otros usuarios" });
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

  // DEPRECATED: Use /api/supplier/load-from-vehicle instead (uses vehicleInventory with FEFO and zone validation)
  // This endpoint uses the legacy supplierInventory table without lot traceability
  app.post("/api/supplier/load-products", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { machineId, products, serviceRecordId } = req.body;
      const userId = req.user?.userId;
      
      if (!machineId || !products || !Array.isArray(products) || !userId) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }
      
      const { db } = await import("./db");
      const { machineInventory, supplierInventory, productLoads } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // 1. Validar que el abastecedor tiene suficiente inventario para cada producto
      const insufficientProducts: { productId: string; requested: number; available: number }[] = [];
      
      for (const product of products) {
        if (product.quantity > 0) {
          const [supplierInv] = await db.select().from(supplierInventory)
            .where(and(
              eq(supplierInventory.userId, userId),
              eq(supplierInventory.productId, product.productId)
            ));
          
          const available = supplierInv?.quantity || 0;
          if (available < product.quantity) {
            insufficientProducts.push({
              productId: product.productId,
              requested: product.quantity,
              available
            });
          }
        }
      }
      
      if (insufficientProducts.length > 0) {
        return res.status(400).json({ 
          error: "Inventario insuficiente en vehículo",
          insufficientProducts 
        });
      }
      
      let totalLoaded = 0;
      const loadedProducts: { productId: string; quantity: number }[] = [];
      
      for (const product of products) {
        if (product.quantity > 0) {
          // 2. Descontar del inventario del abastecedor
          const [supplierInv] = await db.select().from(supplierInventory)
            .where(and(
              eq(supplierInventory.userId, userId),
              eq(supplierInventory.productId, product.productId)
            ));
          
          if (supplierInv) {
            await db.update(supplierInventory)
              .set({ 
                quantity: (supplierInv.quantity || 0) - product.quantity,
                lastUpdated: new Date()
              })
              .where(eq(supplierInventory.id, supplierInv.id));
          }
          
          // 3. Agregar al inventario de la máquina
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
              tenantId: req.user!.tenantId!,
              machineId,
              productId: product.productId,
              currentQuantity: product.quantity,
              maxCapacity: 20,
              minLevel: 5,
            });
          }
          
          // 4. Registrar en product_loads
          await db.insert(productLoads).values({
            tenantId: req.user!.tenantId!,
            serviceRecordId: serviceRecordId || null,
            machineId,
            productId: product.productId,
            userId,
            loadType: "cargado",
            quantity: product.quantity,
            lotId: supplierInv?.lotId || null,
          });
          
          totalLoaded += product.quantity;
          loadedProducts.push({ productId: product.productId, quantity: product.quantity });
        }
      }
      
      res.status(201).json({ 
        message: "Productos cargados exitosamente", 
        totalLoaded,
        loadedProducts 
      });
    } catch (error) {
      console.error("Error loading products to machine:", error);
      res.status(500).json({ error: "Error al cargar productos" });
    }
  });

  // Cargar productos desde vehículo a máquina (nuevo flujo con trazabilidad de lotes y FEFO)
  app.post("/api/supplier/load-from-vehicle", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { machineId, products, serviceRecordId, notes, targetSupplierId } = req.body;
      const authenticatedUserId = req.user?.userId;
      const userRole = req.user?.role;
      
      if (!machineId || !products || !Array.isArray(products) || !authenticatedUserId) {
        return res.status(400).json({ 
          error: "Faltan campos requeridos",
          errorCode: "MISSING_FIELDS"
        });
      }
      
      // Determinar el userId efectivo: admins y supervisores pueden operar en nombre de otro supplier
      let effectiveUserId = authenticatedUserId;
      if (targetSupplierId && (userRole === "admin" || userRole === "supervisor")) {
        // Validar que el target supplier existe y es abastecedor
        const targetUser = await storage.getUser(targetSupplierId);
        if (!targetUser || targetUser.role !== "abastecedor") {
          return res.status(400).json({
            error: "Usuario objetivo no encontrado o no es abastecedor",
            errorCode: "INVALID_TARGET_USER"
          });
        }
        effectiveUserId = targetSupplierId;
      }
      
      // Validar que la máquina existe
      const machine = await storage.getMachine(machineId);
      if (!machine) {
        return res.status(404).json({
          error: "Máquina no encontrada",
          errorCode: "MACHINE_NOT_FOUND"
        });
      }
      
      // Admin puede operar cualquier máquina - sin restricciones de zona
      // Para otros roles: validar zona estrictamente (fail closed)
      if (userRole !== "admin") {
        // Para abastecedores: validar que la máquina está en su zona asignada
        if (userRole === "abastecedor") {
          const user = await storage.getUser(effectiveUserId);
          // Fail closed: si el usuario no tiene zona O la máquina no tiene zona O no coinciden → rechazar
          if (!user?.assignedZone || !machine.zone || user.assignedZone !== machine.zone) {
            return res.status(403).json({
              error: "No tiene permiso para cargar productos a esta máquina. La máquina no está en su zona asignada o faltan configuraciones de zona.",
              errorCode: "MACHINE_NOT_IN_ZONE"
            });
          }
        }
        
        // Para supervisores: validar que la máquina está en su zona (también valida el supplier objetivo)
        if (userRole === "supervisor") {
          const supervisorZone = await getSupervisorZone(req);
          // Fail closed: si el supervisor no tiene zona O la máquina no tiene zona O no coinciden → rechazar
          if (!supervisorZone || !machine.zone || supervisorZone !== machine.zone) {
            return res.status(403).json({
              error: "No tiene permiso para operar esta máquina. La máquina no está en su zona o faltan configuraciones de zona.",
              errorCode: "MACHINE_NOT_IN_ZONE"
            });
          }
          // Si actúa en nombre de un supplier, validar que el supplier está en la zona del supervisor
          if (targetSupplierId) {
            const targetUser = await storage.getUser(targetSupplierId);
            if (!targetUser?.assignedZone || targetUser.assignedZone !== supervisorZone) {
              return res.status(403).json({
                error: "El abastecedor objetivo no está en su zona de supervisión.",
                errorCode: "SUPPLIER_NOT_IN_ZONE"
              });
            }
          }
        }
        
        // Para otros roles no-admin (almacen, contabilidad, rh): no deberían usar este endpoint
        // pero si tienen el permiso warehouse_movements:create, solo pueden operar sin restricciones de zona
        // si explícitamente se les asigna ese permiso (ya validado por authorizeAction)
      }
      
      const result = await storage.transferFromVehicleToMachine({
        userId: effectiveUserId,
        machineId,
        items: products.map((p: { productId: string; quantity: number }) => ({
          productId: p.productId,
          quantity: p.quantity
        })),
        serviceRecordId: serviceRecordId || undefined,
        notes: notes || undefined,
      });
      
      if (!result.success) {
        // Determinar el tipo de error específico
        if (result.errorCode === "NO_VEHICLE_ASSIGNED") {
          return res.status(400).json({
            error: "No tiene un vehículo asignado. Contacte al administrador.",
            errorCode: "NO_VEHICLE_ASSIGNED"
          });
        }
        
        if (result.insufficientProducts && result.insufficientProducts.length > 0) {
          return res.status(400).json({
            error: "Inventario insuficiente en vehículo para algunos productos",
            errorCode: "INSUFFICIENT_STOCK",
            insufficientProducts: result.insufficientProducts
          });
        }
        
        return res.status(400).json({
          error: "Error al transferir productos",
          errorCode: "TRANSFER_FAILED"
        });
      }
      
      res.status(201).json({
        message: "Productos cargados exitosamente desde vehículo",
        totalLoaded: result.totalLoaded,
        loadedProducts: result.loadedProducts
      });
    } catch (error) {
      console.error("Error loading products from vehicle to machine:", error);
      res.status(500).json({ 
        error: "Error al cargar productos desde vehículo",
        errorCode: "INTERNAL_ERROR"
      });
    }
  });

  // Estadísticas del Abastecedor
  app.get("/api/supplier/stats/:userId", authenticateJWT, authorizeRoles("admin", "supervisor", "abastecedor", "rh"), authorizeOwnership("userId"), async (req: AuthenticatedRequest, res: Response) => {
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

  // Usuarios
  app.get("/api/users", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq, and, ne } = await import("drizzle-orm");
      const { role } = req.query;
      
      // Si es supervisor, filtrar por su zona asignada
      const supervisorZone = await getSupervisorZone(req);
      
      let allUsers;
      const conditions = [];
      
      if (role && typeof role === 'string') {
        conditions.push(eq(users.role, role));
      }
      
      if (supervisorZone) {
        conditions.push(eq(users.assignedZone, supervisorZone));
      }

      // Aislamiento multi-tenant: fail-closed — exigir tenantId para no-superAdmin
      if (req.user && !req.user.isSuperAdmin) {
        if (!req.user.tenantId) {
          return res.status(403).json({ error: "Contexto de tenant requerido" });
        }
        conditions.push(eq(users.tenantId, req.user.tenantId));
        // Excluir visor_establecimiento (se gestionan en /visores) y super admins
        conditions.push(ne(users.role, "visor_establecimiento"));
        conditions.push(eq(users.isSuperAdmin, false));
      }
      
      if (conditions.length > 0) {
        allUsers = await db.select().from(users).where(and(...conditions));
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

  app.get("/api/users/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Solo admin puede ver cualquier usuario, otros solo pueden ver su propio perfil
      if (req.user?.role !== "admin" && !req.user?.isSuperAdmin && req.user?.userId !== req.params.id) {
        return res.status(403).json({ error: "No tienes permiso para ver este usuario" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      if (!req.user?.isSuperAdmin && user.tenantId !== req.user?.tenantId) {
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

  // Self-service endpoint - permite a cualquier usuario autenticado actualizar su propio perfil
  app.patch("/api/users/me", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autenticado" });
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
      
      const user = await storage.updateUser(req.user.userId, updateData);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Error updating own profile:", error);
      res.status(500).json({ error: "Error al actualizar perfil" });
    }
  });

  // =====================
  // SETTINGS ROUTES (Tenant self-service configuration)
  // =====================

  // GET /api/settings/company — Returns current tenant data (admin only)
  app.get("/api/settings/company", authenticateJWT, requireTenant, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "No autenticado" });
      // Super admin without tenant context not allowed here
      if (!req.user.tenantId) return res.status(403).json({ error: "Sin empresa asignada" });
      
      const tenant = await storage.getTenant(req.user.tenantId);
      if (!tenant) return res.status(404).json({ error: "Empresa no encontrada" });
      
      res.json({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        address: tenant.address || "",
        taxId: tenant.taxId || "",
        country: tenant.country || "DO",
      });
    } catch (error) {
      console.error("Error getting company settings:", error);
      res.status(500).json({ error: "Error al obtener datos de empresa" });
    }
  });

  // PATCH /api/settings/company — Updates current tenant data (admin only)
  app.patch("/api/settings/company", authenticateJWT, requireTenant, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "No autenticado" });
      if (!req.user.tenantId) return res.status(403).json({ error: "Sin empresa asignada" });

      const updateCompanySchema = z.object({
        name: z.string().min(1, "El nombre de la empresa es requerido").optional(),
        email: z.string().email("Email inválido").optional().or(z.literal("")),
        phone: z.string().optional(),
        address: z.string().optional(),
        taxId: z.string().optional(),
        country: z.string().optional(),
      });

      const data = updateCompanySchema.parse(req.body);
      
      // Filter out empty strings for optional fields
      const updateData: Partial<typeof data> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.taxId !== undefined) updateData.taxId = data.taxId;
      if (data.country !== undefined) updateData.country = data.country;

      const updated = await storage.updateTenant(req.user.tenantId, updateData);
      if (!updated) return res.status(404).json({ error: "Empresa no encontrada" });

      res.json({
        name: updated.name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        address: updated.address || "",
        taxId: updated.taxId || "",
        country: updated.country || "DO",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating company settings:", error);
      res.status(500).json({ error: "Error al actualizar datos de empresa" });
    }
  });

  // GET /api/settings/notifications — Returns tenant notification settings (admin only)
  app.get("/api/settings/notifications", authenticateJWT, requireTenant, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "No autenticado" });
      if (!req.user.tenantId) return res.status(403).json({ error: "Sin empresa asignada" });

      const [settings] = await db.select().from(tenantSettings)
        .where(eq(tenantSettings.tenantId, req.user.tenantId));

      res.json({
        notifyLowStock: settings?.notifyLowStock ?? true,
        notifyMaintenanceDue: settings?.notifyMaintenanceDue ?? true,
        lowStockThreshold: settings?.lowStockThreshold ?? 5,
      });
    } catch (error) {
      console.error("Error getting notification settings:", error);
      res.status(500).json({ error: "Error al obtener preferencias de notificación" });
    }
  });

  // PATCH /api/settings/notifications — Updates tenant notification settings (admin only)
  app.patch("/api/settings/notifications", authenticateJWT, requireTenant, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "No autenticado" });
      if (!req.user.tenantId) return res.status(403).json({ error: "Sin empresa asignada" });

      const notificationsSchema = z.object({
        notifyLowStock: z.boolean().optional(),
        notifyMaintenanceDue: z.boolean().optional(),
        lowStockThreshold: z.number().int().min(0).max(1000).optional(),
      });

      const data = notificationsSchema.parse(req.body);

      // Upsert tenant settings
      const existing = await db.select().from(tenantSettings)
        .where(eq(tenantSettings.tenantId, req.user.tenantId));

      let result;
      if (existing.length === 0) {
        const [inserted] = await db.insert(tenantSettings).values({
          tenantId: req.user.tenantId,
          notifyLowStock: data.notifyLowStock ?? true,
          notifyMaintenanceDue: data.notifyMaintenanceDue ?? true,
          lowStockThreshold: data.lowStockThreshold ?? 5,
        }).returning();
        result = inserted;
      } else {
        const updateValues: Record<string, unknown> = { updatedAt: new Date() };
        if (data.notifyLowStock !== undefined) updateValues.notifyLowStock = data.notifyLowStock;
        if (data.notifyMaintenanceDue !== undefined) updateValues.notifyMaintenanceDue = data.notifyMaintenanceDue;
        if (data.lowStockThreshold !== undefined) updateValues.lowStockThreshold = data.lowStockThreshold;
        const [updated] = await db.update(tenantSettings)
          .set(updateValues)
          .where(eq(tenantSettings.tenantId, req.user.tenantId))
          .returning();
        result = updated;
      }

      res.json({
        notifyLowStock: result.notifyLowStock ?? true,
        notifyMaintenanceDue: result.notifyMaintenanceDue ?? true,
        lowStockThreshold: result.lowStockThreshold ?? 5,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating notification settings:", error);
      res.status(500).json({ error: "Error al actualizar preferencias de notificación" });
    }
  });

  app.patch("/api/users/:id", authenticateJWT, authorizeAction("users", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autenticado" });
      }

      // Verificar que el usuario solo pueda modificar su propio perfil (o admin para otros)
      if (req.user.userId !== req.params.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "No tienes permiso para modificar este usuario" });
      }

      // Si es admin editando otro usuario, verificar que pertenezca al mismo tenant
      if (req.user.userId !== req.params.id && req.user.role === "admin" && !req.user.isSuperAdmin) {
        const targetUser = await storage.getUser(req.params.id);
        if (!targetUser || targetUser.tenantId !== req.user.tenantId) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
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

  const OPERATIONAL_ROLES = ["admin", "supervisor", "abastecedor", "almacen", "contabilidad", "rh"] as const;
  const ROLES_REQUIRING_ZONE = ["supervisor", "abastecedor"];

  const adminUserSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6).optional(),
    fullName: z.string().min(2),
    email: z.string().email().or(z.literal("")).optional(),
    phone: z.string().optional(),
    role: z.enum(OPERATIONAL_ROLES, { errorMap: () => ({ message: "Rol inválido" }) }),
    assignedZone: z.string().optional(),
    isActive: z.boolean().optional(),
  }).superRefine((data, ctx) => {
    if (ROLES_REQUIRING_ZONE.includes(data.role) && !data.assignedZone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La zona asignada es requerida para este rol",
        path: ["assignedZone"],
      });
    }
  });

  // Crear usuario (solo admin)
  app.post("/api/admin/users", authenticateJWT, authorizeAction("users", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // SECURITY: Always use tenantId from authenticated user context
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "Acceso denegado: contexto de empresa no disponible" });
      }
      
      // Validate plan limits before creating user
      const limits = await storage.checkTenantPlanLimits(tenantId);
      if (!limits.canCreateUser) {
        return res.status(403).json({ 
          error: `Límite de usuarios alcanzado (${limits.currentUsers}/${limits.maxUsers}). Actualiza tu plan para agregar más usuarios.`,
          code: "PLAN_LIMIT_EXCEEDED",
          planName: limits.planName
        });
      }
      
      const validatedData = adminUserSchema.parse(req.body);
      
      if (!validatedData.password) {
        return res.status(400).json({ error: "La contraseña es requerida" });
      }

      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq: eqChk, and: andChk } = await import("drizzle-orm");
      
      // Verificar que el username no exista dentro del mismo tenant
      const existing = await db.select().from(users)
        .where(andChk(eqChk(users.username, validatedData.username), eqChk(users.tenantId, tenantId)))
        .limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "El nombre de usuario ya existe" });
      }

      // Verificar unicidad de email dentro del tenant (si se proveyó)
      if (validatedData.email) {
        const existingEmail = await db.select().from(users)
          .where(andChk(eqChk(users.email, validatedData.email), eqChk(users.tenantId, tenantId)))
          .limit(1);
        if (existingEmail.length > 0) {
          return res.status(400).json({ error: "El email ya está en uso" });
        }
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
        tenantId: tenantId,
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
  app.patch("/api/admin/users/:id", authenticateJWT, authorizeAction("users", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // SECURITY: Verificar que el usuario objetivo pertenece al mismo tenant
      if (!req.user?.isSuperAdmin) {
        const tenantId = req.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: "Contexto de tenant requerido" });
        const targetUser = await storage.getUser(req.params.id);
        if (!targetUser || targetUser.tenantId !== tenantId) {
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
        // Impedir modificar visor_establecimiento o superAdmins desde esta ruta
        if (targetUser.role === "visor_establecimiento" || targetUser.isSuperAdmin) {
          return res.status(403).json({ error: "No se puede editar este tipo de usuario desde aquí" });
        }
      }

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

      // Revocar tokens si se desactiva el usuario o se cambia su contraseña
      if (validatedData.isActive === false || validatedData.password) {
        await storage.revokeAllUserRefreshTokens(req.params.id);
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
  app.get("/api/cash-movements", authenticateJWT, authorizeAction("cash_collections", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { userId, type, status, startDate, endDate } = req.query;
      const filters = {
        tenantId,
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

  app.get("/api/cash-movements/summary", authenticateJWT, authorizeAction("cash_collections", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { startDate, endDate } = req.query;
      const summary = await storage.getCashMovementsSummary(
        tenantId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen" });
    }
  });

  app.get("/api/cash-movements/:id", authenticateJWT, authorizeAction("cash_collections", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyCashMovementTenant(req.params.id, req, res)) return;
      
      const movement = await storage.getCashMovement(req.params.id);
      res.json(movement);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener movimiento" });
    }
  });

  app.post("/api/cash-movements", authenticateJWT, authorizeAction("cash_collections", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertCashMovementSchema.omit({ tenantId: true }).parse(req.body);
      const movement = await storage.createCashMovement({ ...data, tenantId: req.user!.tenantId! });
      res.status(201).json(movement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear movimiento" });
    }
  });

  app.patch("/api/cash-movements/:id/status", authenticateJWT, authorizeAction("cash_collections", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyCashMovementTenant(req.params.id, req, res)) return;
      
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

  app.post("/api/cash-movements/:id/reconcile", authenticateJWT, authorizeAction("cash_collections", "approve"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyCashMovementTenant(req.params.id, req, res)) return;
      const reconcilerUserId = req.user?.userId;
      if (!reconcilerUserId) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      const movement = await storage.reconcileCashMovement(req.params.id, reconcilerUserId);
      if (!movement) {
        return res.status(404).json({ error: "Movimiento no encontrado" });
      }
      res.json(movement);
    } catch (error) {
      res.status(500).json({ error: "Error al conciliar movimiento" });
    }
  });

  // Depósitos Bancarios
  app.get("/api/bank-deposits", authenticateJWT, authorizeAction("cash_collections", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { userId, status, startDate, endDate, limit } = req.query;
      const filters = {
        tenantId,
        userId: userId as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };
      const deposits = await storage.getBankDeposits({
        ...filters,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json(deposits);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener depósitos" });
    }
  });

  app.get("/api/bank-deposits/:id", authenticateJWT, authorizeAction("cash_collections", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyBankDepositTenant(req.params.id, req, res)) return;
      
      const deposit = await storage.getBankDeposit(req.params.id);
      res.json(deposit);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener depósito" });
    }
  });

  app.post("/api/bank-deposits", authenticateJWT, authorizeAction("cash_collections", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const data = insertBankDepositSchema.omit({ tenantId: true }).parse(req.body);
      const deposit = await storage.createBankDeposit({ ...data, tenantId });
      res.status(201).json(deposit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear depósito" });
    }
  });

  app.post("/api/bank-deposits/:id/reconcile", authenticateJWT, authorizeAction("cash_collections", "approve"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyBankDepositTenant(req.params.id, req, res)) return;
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
  app.get("/api/product-transfers", authenticateJWT, authorizeAction("warehouse_movements", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { type, productId, startDate, endDate } = req.query;
      const filters = {
        tenantId,
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
      if (!await verifyProductTransferTenant(req.params.id, req, res)) return;
      
      const transfer = await storage.getProductTransfer(req.params.id);
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transferencia" });
    }
  });

  app.post("/api/product-transfers", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertProductTransferSchema.omit({ tenantId: true }).parse(req.body);
      const transfer = await storage.createProductTransfer({ ...data, tenantId: req.user!.tenantId! });
      res.status(201).json(transfer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al crear transferencia" });
    }
  });

  // Mermas (protegido con JWT)
  app.get("/api/shrinkage", authenticateJWT, authorizeAction("warehouse_movements", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { type, productId, status, startDate, endDate } = req.query;
      const filters = {
        tenantId,
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

  app.get("/api/shrinkage/summary", authenticateJWT, authorizeAction("warehouse_movements", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { startDate, endDate } = req.query;
      const summary = await storage.getShrinkageSummary(
        tenantId,
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
      if (!await verifyShrinkageTenant(req.params.id, req, res)) return;
      
      const record = await storage.getShrinkageRecord(req.params.id);
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener merma" });
    }
  });

  app.post("/api/shrinkage", authenticateJWT, authorizeAction("warehouse_movements", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertShrinkageRecordSchema.omit({ tenantId: true }).parse({
        ...req.body,
        userId: req.user!.userId,
      });
      const dataWithTenant = { ...data, tenantId: req.user!.tenantId! };
      
      // Crear registro de merma
      const record = await storage.createShrinkageRecord(dataWithTenant);
      
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
          tenantId: req.user!.tenantId!,
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

  app.post("/api/shrinkage/:id/approve", authenticateJWT, authorizeAction("warehouse_movements", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyShrinkageTenant(req.params.id, req, res)) return;
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
  app.get("/api/reconciliation/daily", authenticateJWT, authorizeAction("cash_collections", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { date, startDate, endDate } = req.query;
      // Compatibilidad: si se pasa 'date', usar ese día específico
      // Si se pasa 'startDate' y 'endDate', usar rango
      // Si no se pasa nada, usar hoy (con fallback a 30 días si no hay datos)
      const targetDate = date ? new Date(date as string) : 
                         startDate ? new Date(startDate as string) : new Date();
      const end = endDate ? new Date(endDate as string) : undefined;
      const reconciliation = await storage.getDailyReconciliation(targetDate, end, tenantId);
      res.json(reconciliation);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener conciliación diaria" });
    }
  });

  app.get("/api/reconciliation/supplier/:userId", authenticateJWT, authorizeAction("cash_collections", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const reconciliation = await storage.getSupplierReconciliation(req.params.userId, targetDate, tenantId);
      res.json(reconciliation);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener conciliación del abastecedor" });
    }
  });

  // ==================== MÓDULO CAJA CHICA ====================

  // Gastos de Caja Chica
  app.get("/api/petty-cash/expenses", authenticateJWT, authorizeAction("petty_cash", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { userId, category, status, startDate, endDate } = req.query;
      const filters = {
        tenantId,
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

  app.get("/api/petty-cash/expenses/:id", authenticateJWT, authorizeAction("petty_cash", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPettyCashExpenseTenant(req.params.id, req, res)) return;
      
      const expense = await storage.getPettyCashExpense(req.params.id);
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener gasto" });
    }
  });

  app.post("/api/petty-cash/expenses", authenticateJWT, authorizeAction("petty_cash", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const data = insertPettyCashExpenseSchema.omit({ tenantId: true }).parse(req.body);
      const expense = await storage.createPettyCashExpense({ ...data, tenantId });
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al registrar gasto" });
    }
  });

  app.post("/api/petty-cash/expenses/:id/approve", authenticateJWT, authorizeAction("petty_cash_approval", "approve"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPettyCashExpenseTenant(req.params.id, req, res)) return;
      const approvedBy = req.user!.userId;
      const expense = await storage.approvePettyCashExpense(req.params.id, approvedBy);
      if (!expense) {
        return res.status(404).json({ error: "Gasto no encontrado" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Error al aprobar gasto" });
    }
  });

  app.post("/api/petty-cash/expenses/:id/reject", authenticateJWT, authorizeAction("petty_cash_approval", "approve"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPettyCashExpenseTenant(req.params.id, req, res)) return;
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "Faltan datos requeridos" });
      }
      const rejectedBy = req.user!.userId;
      const expense = await storage.rejectPettyCashExpense(req.params.id, rejectedBy, reason);
      if (!expense) {
        return res.status(404).json({ error: "Gasto no encontrado" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Error al rechazar gasto" });
    }
  });

  app.post("/api/petty-cash/expenses/:id/pay", authenticateJWT, authorizeAction("petty_cash", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPettyCashExpenseTenant(req.params.id, req, res)) return;
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
  app.get("/api/petty-cash/fund", authenticateJWT, authorizeAction("petty_cash", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const fund = await storage.getPettyCashFund(tenantId);
      res.json(fund || { initialized: false });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener fondo" });
    }
  });

  app.post("/api/petty-cash/fund", authenticateJWT, authorizeAction("petty_cash", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const data = insertPettyCashFundSchema.omit({ tenantId: true }).parse(req.body);
      const fund = await storage.initializePettyCashFund({ ...data, tenantId });
      res.status(201).json(fund);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al inicializar fondo" });
    }
  });

  app.post("/api/petty-cash/fund/replenish", authenticateJWT, authorizeAction("petty_cash", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const { amount, authorizedBy } = req.body;
      if (!amount) {
        return res.status(400).json({ error: "Faltan datos requeridos" });
      }
      const userId = req.user!.userId;

      // Validate authorizedBy belongs to same tenant
      if (authorizedBy) {
        const authUser = await storage.getUser(authorizedBy);
        if (!authUser || authUser.tenantId !== tenantId) {
          return res.status(400).json({ error: "Usuario autorizador no válido" });
        }
      }

      const fund = await storage.replenishPettyCashFund(parseFloat(amount), userId, tenantId, authorizedBy || undefined);
      if (!fund) {
        return res.status(400).json({ error: "El fondo no está inicializado" });
      }
      res.json(fund);
    } catch (error) {
      res.status(500).json({ error: "Error al reponer fondo" });
    }
  });

  // Transacciones de Caja Chica
  app.get("/api/petty-cash/transactions", authenticateJWT, authorizeAction("petty_cash", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { limit } = req.query;
      const transactions = await storage.getPettyCashTransactions(
        limit ? parseInt(limit as string) : undefined,
        tenantId
      );
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener transacciones" });
    }
  });

  // Estadísticas de Caja Chica
  app.get("/api/petty-cash/stats", authenticateJWT, authorizeAction("petty_cash", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const stats = await storage.getPettyCashStats(tenantId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  // ==================== MÓDULO COMPRAS (protegidos con JWT) ====================

  // Órdenes de Compra
  app.get("/api/purchase-orders", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { supplierId, status, startDate, endDate } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const filters: any = {};
      if (tenantId) filters.tenantId = tenantId;
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

  app.get("/api/purchase-orders/next-number", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const orderNumber = await storage.getNextOrderNumber(tenantId);
      res.json({ orderNumber });
    } catch (error) {
      res.status(500).json({ error: "Error al generar número de orden" });
    }
  });

  app.get("/api/purchase-orders/stats", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const stats = await storage.getPurchaseStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        tenantId
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas de compras" });
    }
  });

  app.get("/api/purchase-orders/low-stock", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const products = await storage.getLowStockProducts(tenantId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener productos con bajo stock" });
    }
  });

  app.get("/api/purchase-orders/:id", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPurchaseOrderTenant(req.params.id, req, res)) return;
      
      const order = await storage.getPurchaseOrder(req.params.id);
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener orden" });
    }
  });

  app.post("/api/purchase-orders", authenticateJWT, authorizeAction("purchase_orders", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { tenantId: _dropTenant, ...rest } = req.body;
      const data = insertPurchaseOrderSchema.omit({ orderNumber: true }).parse({ ...rest, tenantId });
      if (!await verifySupplierTenant(data.supplierId, req, res)) return;
      const orderNumber = await storage.getNextOrderNumber(tenantId);
      const order = await storage.createPurchaseOrder({
        ...data,
        tenantId,
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

  app.patch("/api/purchase-orders/:id", authenticateJWT, authorizeAction("purchase_orders", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPurchaseOrderTenant(req.params.id, req, res)) return;
      
      const data = insertPurchaseOrderSchema.omit({ tenantId: true }).partial().parse(req.body);
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

  app.patch("/api/purchase-orders/:id/status", authenticateJWT, authorizeAction("purchase_orders", "approve"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPurchaseOrderTenant(req.params.id, req, res)) return;
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

  app.delete("/api/purchase-orders/:id", authenticateJWT, authorizeAction("purchase_orders", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPurchaseOrderTenant(req.params.id, req, res)) return;
      
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
  app.get("/api/purchase-orders/:id/items", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyPurchaseOrderTenant(req.params.id, req, res)) return;
      
      const items = await storage.getPurchaseOrderItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener items de la orden" });
    }
  });

  app.post("/api/purchase-orders/:id/items", authenticateJWT, authorizeAction("purchase_orders", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const verifyResult = await verifyPurchaseOrderTenant(req.params.id, req, res);
      if (!verifyResult) return;
      
      const order = await storage.getPurchaseOrder(req.params.id);
      const tenantId = order!.tenantId;
      const { tenantId: _dropTenant, orderId: _dropOrderId, ...rest } = req.body;
      const data = insertPurchaseOrderItemSchema.omit({ orderId: true }).parse({ ...rest, tenantId });
      const item = await storage.addPurchaseOrderItem({
        ...data,
        tenantId,
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

  app.patch("/api/purchase-order-items/:id", authenticateJWT, authorizeAction("purchase_orders", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const verifyResult = await verifyPurchaseOrderItemTenant(req.params.id, req, res);
      if (!verifyResult.valid) return;
      
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

  app.delete("/api/purchase-order-items/:id", authenticateJWT, authorizeAction("purchase_orders", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const verifyResult = await verifyPurchaseOrderItemTenant(req.params.id, req, res);
      if (!verifyResult.valid) return;
      
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
  app.get("/api/purchase-receptions", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { orderId, startDate, endDate } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const filters: any = {};
      if (tenantId) filters.tenantId = tenantId;
      if (orderId) filters.orderId = orderId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const receptions = await storage.getPurchaseReceptions(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(receptions);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener recepciones" });
    }
  });

  app.get("/api/purchase-receptions/next-number", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const receptionNumber = await storage.getNextReceptionNumber(tenantId);
      res.json({ receptionNumber });
    } catch (error) {
      res.status(500).json({ error: "Error al generar número de recepción" });
    }
  });

  app.get("/api/purchase-receptions/:id", authenticateJWT, authorizeAction("purchase_orders", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyReceptionTenant(req.params.id, req, res)) return;
      const reception = await storage.getPurchaseReception(req.params.id);
      res.json(reception);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener recepción" });
    }
  });

  app.post("/api/purchase-receptions", authenticateJWT, authorizeAction("purchase_orders", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const bodySchema = z.object({
        reception: insertPurchaseReceptionSchema.omit({ receptionNumber: true, tenantId: true }),
        items: z.array(insertReceptionItemSchema.omit({ receptionId: true, tenantId: true }))
      });
      const { reception, items } = bodySchema.parse(req.body);
      
      if (!await verifyPurchaseOrderTenant(reception.orderId, req, res)) return;
      
      const receptionNumber = await storage.getNextReceptionNumber(tenantId);
      
      const newReception = await storage.createPurchaseReception(
        { ...reception, tenantId, receptionNumber, receivedBy: req.user!.userId },
        items.map(item => ({ ...item, tenantId })),
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
  app.get("/api/suppliers/:id/purchase-history", authenticateJWT, authorizeAction("suppliers", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifySupplierTenant(req.params.id, req, res)) return;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { limit } = req.query;
      const history = await storage.getSupplierPurchaseHistory(
        req.params.id,
        limit ? parseInt(limit as string) : undefined,
        tenantId
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
      const { status, type } = req.query;
      // Abastecedor solo ve vehículos asignados a él; almacén, admin y supervisor ven todos
      const role = req.user?.role;
      const canSeeAll = role === "admin" || role === "supervisor" || role === "almacen";
      const effectiveUserId = canSeeAll ? undefined : getEffectiveUserId(req, "assignedUserId");
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const vehicles = await storage.getVehicles({
        status: status as string,
        type: type as string,
        assignedUserId: effectiveUserId as string,
        tenantId
      });
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener vehículos" });
    }
  });

  // Vehículos con bajo rendimiento — DEBE ir antes de /:id para que Express no lo intercepte
  app.get("/api/vehicles/low-mileage", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const vehicles = await storage.getLowMileageVehicles(tenantId);
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener vehículos con bajo rendimiento" });
    }
  });

  app.get("/api/vehicles/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyVehicleTenant(req.params.id, req, res)) return;
      
      const vehicle = await storage.getVehicle(req.params.id);
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener vehículo" });
    }
  });

  app.post("/api/vehicles", authenticateJWT, authorizeAction("vehicles", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertVehicleSchema.omit({ tenantId: true }).parse(req.body);
      const vehicle = await storage.createVehicle({ ...data, tenantId: req.user!.tenantId });
      res.status(201).json(vehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Error al crear vehículo" });
    }
  });

  app.patch("/api/vehicles/:id", authenticateJWT, authorizeAction("vehicles", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyVehicleTenant(req.params.id, req, res)) return;
      
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

  app.delete("/api/vehicles/:id", authenticateJWT, authorizeAction("vehicles", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyVehicleTenant(req.params.id, req, res)) return;
      
      await storage.deleteVehicle(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar vehículo" });
    }
  });

  // Estadísticas de vehículo
  app.get("/api/vehicles/:id/fuel-stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyVehicleTenant(req.params.id, req, res)) return;
      
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user?.tenantId;
      const records = await storage.getFuelRecords({
        vehicleId: vehicleId as string,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        tenantId
      });
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener registros de combustible" });
    }
  });

  app.get("/api/fuel-records/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyFuelRecordTenant(req.params.id, req, res)) return;
      
      const record = await storage.getFuelRecord(req.params.id);
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener registro de combustible" });
    }
  });

  app.post("/api/fuel-records", authenticateJWT, authorizeAction("fuel", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fuelDecimalField = z.union([z.string(), z.number()]).transform(String);
      const data = insertFuelRecordSchema.omit({ tenantId: true }).extend({
        liters: fuelDecimalField,
        pricePerLiter: fuelDecimalField,
        totalAmount: fuelDecimalField,
        recordDate: z.union([z.string(), z.date()]).transform((val) => {
          const d = new Date(val);
          if (isNaN(d.getTime())) throw new Error("Fecha de carga inválida");
          return d;
        }),
      }).parse(req.body);
      const record = await storage.createFuelRecord({ ...data, tenantId: req.user!.tenantId });
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating fuel record:", error);
      res.status(500).json({ error: "Error al crear registro de combustible" });
    }
  });

  app.patch("/api/fuel-records/:id", authenticateJWT, authorizeAction("fuel", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyFuelRecordTenant(req.params.id, req, res)) return;
      
      const fuelDecimalField = z.union([z.string(), z.number()]).transform(String);
      const validated = insertFuelRecordSchema.extend({
        liters: fuelDecimalField,
        pricePerLiter: fuelDecimalField,
        totalAmount: fuelDecimalField,
        recordDate: z.union([z.string(), z.date()]).transform((val) => {
          const d = new Date(val);
          if (isNaN(d.getTime())) throw new Error("Fecha de carga inválida");
          return d;
        }),
      }).partial().parse(req.body);
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

  app.delete("/api/fuel-records/:id", authenticateJWT, authorizeAction("fuel", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyFuelRecordTenant(req.params.id, req, res)) return;
      
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user?.tenantId;
      const stats = await storage.getFuelStats({
        vehicleId: vehicleId as string,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        tenantId
      });
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas de combustible" });
    }
  });

  // Estadísticas por usuario
  app.get("/api/users/:id/fuel-stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      if (!req.user?.isSuperAdmin && targetUser.tenantId !== req.user?.tenantId) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user?.tenantId;
      const stats = await storage.getFuelStatsPerRoute(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        tenantId
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas por ruta" });
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Se requiere tenantId para acceder al resumen de reportes" });
      }
      const overview = await storage.getReportsOverview(
        tenantId,
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      const breakdown = await storage.getSalesBreakdown({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy: groupBy as 'machine' | 'product' | 'location' | 'day',
        tenantId,
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      const breakdown = await storage.getPurchasesBreakdown({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy: groupBy as 'supplier' | 'product' | 'day',
        tenantId,
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      const breakdown = await storage.getFuelBreakdown({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy: groupBy as 'vehicle' | 'user' | 'route' | 'day',
        tenantId,
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
  app.get("/api/reports/petty-cash", authenticateJWT, authorizeAction("petty_cash", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, groupBy } = pettyCashBreakdownSchema.parse(req.query);
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      const breakdown = await storage.getPettyCashBreakdown({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy: groupBy as 'category' | 'user' | 'day',
        tenantId,
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Se requiere tenantId para acceder al rendimiento de máquinas" });
      }
      const performance = await storage.getMachinePerformance(
        tenantId,
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      const topProducts = await storage.getTopProducts(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        limit,
        tenantId
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      const ranking = await storage.getSupplierRanking(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        tenantId
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
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user!.tenantId;
      const data = await storage.getExportData(type, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        tenantId,
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

  app.get("/api/accounting/overview", authenticateJWT, authorizeAction("accounting", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const overview = await storage.getAccountingOverview(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        tenantId
      );
      res.json(overview);
    } catch (error) {
      console.error("Error getting accounting overview:", error);
      res.status(500).json({ error: "Error al obtener resumen contable" });
    }
  });

  app.get("/api/accounting/machine-sales", authenticateJWT, authorizeAction("accounting", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const sales = await storage.getMachineSalesReport(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        tenantId
      );
      res.json(sales);
    } catch (error) {
      console.error("Error getting machine sales report:", error);
      res.status(500).json({ error: "Error al obtener ventas por máquina" });
    }
  });

  app.get("/api/accounting/expenses", authenticateJWT, authorizeAction("accounting", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, category } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const expenses = await storage.getExpensesReport({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        category: category as string | undefined,
        tenantId
      });
      res.json(expenses);
    } catch (error) {
      console.error("Error getting expenses report:", error);
      res.status(500).json({ error: "Error al obtener reporte de gastos" });
    }
  });

  app.get("/api/accounting/cash-cut", authenticateJWT, authorizeAction("accounting", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, userId } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const report = await storage.getCashCutReport(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        tenantId,
        userId as string | undefined
      );
      res.json(report);
    } catch (error) {
      console.error("Error getting cash cut report:", error);
      res.status(500).json({ error: "Error al obtener corte de caja" });
    }
  });

  app.get("/api/accounting/sales-summary", authenticateJWT, authorizeAction("accounting", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate as string) : new Date();

      const salesConditions: (SQL<unknown> | undefined)[] = [
        gte(machineSales.saleDate, start),
        lte(machineSales.saleDate, end),
      ];
      if (tenantId) salesConditions.push(eq(machineSales.tenantId, tenantId));

      const salesData = await db.select().from(machineSales).where(and(...salesConditions));

      const machinesConditions: (SQL<unknown> | undefined)[] = tenantId ? [eq(machines.tenantId, tenantId)] : [];
      const machinesList = machinesConditions.length
        ? await db.select().from(machines).where(and(...machinesConditions))
        : await db.select().from(machines);
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

  app.get("/api/accounting/cash-summary", authenticateJWT, authorizeAction("accounting", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;

      const collectionsQuery = db.select().from(cashCollections).orderBy(desc(cashCollections.createdAt)).limit(100);
      const collectionsData = tenantId
        ? await db.select().from(cashCollections).where(eq(cashCollections.tenantId, tenantId)).orderBy(desc(cashCollections.createdAt)).limit(100)
        : await collectionsQuery;

      const depositsData = await storage.getBankDeposits({ tenantId, limit: 100 });

      const totalCollected = collectionsData.reduce((sum, c) => sum + Number(c.actualAmount), 0);
      const totalDeposited = depositsData.reduce((sum, d) => sum + Number(d.amount), 0);
      const pendingDeposit = totalCollected - totalDeposited;

      const allMovements = await storage.getCashMovements({ tenantId });
      const recentMovements = allMovements.slice(0, 10);

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
  // Solo admin, supervisor y rh pueden gestionar empleados

  app.get("/api/hr/employees", authenticateJWT, authorizeRoles("admin", "supervisor", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role, isActive, search, tenantId: queryTenantId } = req.query;
      const tenantId = req.user?.isSuperAdmin
        ? (queryTenantId as string | undefined)
        : req.user!.tenantId;
      const employees = await storage.getEmployees({
        role: role as string | undefined,
        isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
        search: search as string | undefined,
        tenantId
      });
      res.json(employees);
    } catch (error) {
      console.error("Error getting employees:", error);
      res.status(500).json({ error: "Error al obtener empleados" });
    }
  });

  app.get("/api/hr/employees/:id", authenticateJWT, authorizeRoles("admin", "supervisor", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyEmployeeTenant(req.params.id, req, res)) return;
      
      const employee = await storage.getEmployee(req.params.id);
      res.json(employee);
    } catch (error) {
      console.error("Error getting employee:", error);
      res.status(500).json({ error: "Error al obtener empleado" });
    }
  });

  app.post("/api/hr/employees", authenticateJWT, authorizeAction("employees", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertEmployeeSchema.parse({ ...req.body, tenantId: req.user!.tenantId });
      
      if (!data.password || data.password.length < 6) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      }
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ error: "El nombre de usuario ya existe" });
      }
      
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const employee = await storage.createEmployee({ ...data, password: hashedPassword });
      
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating employee:", error);
      res.status(500).json({ error: "Error al crear empleado" });
    }
  });

  app.patch("/api/hr/employees/:id", authenticateJWT, authorizeAction("employees", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyEmployeeTenant(req.params.id, req, res)) return;
      
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

  app.delete("/api/hr/employees/:id", authenticateJWT, authorizeAction("employees", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyEmployeeTenant(req.params.id, req, res)) return;
      
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

  app.get("/api/hr/time-tracking", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      // Abastecedor solo ve su propio control de tiempos
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const records = await storage.getTimeTracking({
        userId: effectiveUserId,
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

  app.get("/api/hr/performance", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      // Abastecedor solo ve su propio rendimiento
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const performance = await storage.getEmployeePerformance({
        userId: effectiveUserId,
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

  // HR Stats
  app.get("/api/hr/stats", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await storage.getHRStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting HR stats:", error);
      res.status(500).json({ error: "Error al obtener estadísticas de RRHH" });
    }
  });

  // Employee Profiles
  app.get("/api/hr/profiles", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const profiles = await storage.getEmployeeProfiles(tenantId);
      res.json(profiles);
    } catch (error) {
      console.error("Error getting employee profiles:", error);
      res.status(500).json({ error: "Error al obtener perfiles de empleados" });
    }
  });

  app.get("/api/hr/profiles/:userId", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profile = await storage.getEmployeeProfile(req.params.userId);
      if (!profile) {
        return res.status(404).json({ error: "Perfil no encontrado" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error getting employee profile:", error);
      res.status(500).json({ error: "Error al obtener perfil de empleado" });
    }
  });

  app.post("/api/hr/profiles", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertEmployeeProfileSchema.parse({ ...req.body, tenantId: req.user!.tenantId });
      const profile = await storage.createEmployeeProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating employee profile:", error);
      res.status(500).json({ error: "Error al crear perfil de empleado" });
    }
  });

  app.patch("/api/hr/profiles/:userId", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertEmployeeProfileSchema.partial().parse(req.body);
      const profile = await storage.updateEmployeeProfile(req.params.userId, data);
      if (!profile) {
        return res.status(404).json({ error: "Perfil no encontrado" });
      }
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating employee profile:", error);
      res.status(500).json({ error: "Error al actualizar perfil de empleado" });
    }
  });

  // Asistencia
  app.get("/api/hr/attendance", authenticateJWT, authorizeRoles("admin", "rh", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, startDate, endDate, status } = req.query;
      const attendance = await storage.getAttendance({
        userId: userId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as string | undefined,
        tenantId: req.user?.isSuperAdmin ? undefined : req.user!.tenantId
      });
      res.json(attendance);
    } catch (error) {
      console.error("Error getting attendance:", error);
      res.status(500).json({ error: "Error al obtener asistencia" });
    }
  });

  app.get("/api/hr/attendance/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await storage.getAttendanceRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error getting attendance record:", error);
      res.status(500).json({ error: "Error al obtener registro de asistencia" });
    }
  });

  app.post("/api/hr/attendance", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertEmployeeAttendanceSchema.parse({ ...req.body, tenantId: req.user!.tenantId });
      const attendance = await storage.createAttendance(data);
      res.status(201).json(attendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating attendance:", error);
      res.status(500).json({ error: "Error al crear registro de asistencia" });
    }
  });

  app.patch("/api/hr/attendance/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertEmployeeAttendanceSchema.partial().parse(req.body);
      const attendance = await storage.updateAttendance(req.params.id, data);
      if (!attendance) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }
      res.json(attendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating attendance:", error);
      res.status(500).json({ error: "Error al actualizar registro de asistencia" });
    }
  });

  app.delete("/api/hr/attendance/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const success = await storage.deleteAttendance(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting attendance:", error);
      res.status(500).json({ error: "Error al eliminar registro de asistencia" });
    }
  });

  app.post("/api/hr/attendance/check-in", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.body.userId || req.user?.userId;
      if (!userId) {
        return res.status(400).json({ error: "Se requiere userId" });
      }
      const attendance = await storage.checkIn(userId, new Date());
      res.json(attendance);
    } catch (error) {
      console.error("Error checking in:", error);
      res.status(500).json({ error: "Error al registrar entrada" });
    }
  });

  app.post("/api/hr/attendance/check-out", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.body.userId || req.user?.userId;
      if (!userId) {
        return res.status(400).json({ error: "Se requiere userId" });
      }
      const attendance = await storage.checkOut(userId, new Date());
      if (!attendance) {
        return res.status(404).json({ error: "No se encontró registro de entrada para hoy" });
      }
      res.json(attendance);
    } catch (error) {
      console.error("Error checking out:", error);
      res.status(500).json({ error: "Error al registrar salida" });
    }
  });

  app.get("/api/hr/attendance/summary/:userId", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 1));
      const end = endDate ? new Date(endDate as string) : new Date();
      const summary = await storage.getAttendanceSummary(req.params.userId, start, end);
      res.json(summary);
    } catch (error) {
      console.error("Error getting attendance summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de asistencia" });
    }
  });

  // Nómina
  app.get("/api/hr/payroll", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, startDate, endDate, status } = req.query;
      const records = await storage.getPayrollRecords({
        userId: userId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as string | undefined,
        tenantId: req.user?.isSuperAdmin ? undefined : req.user!.tenantId
      });
      res.json(records);
    } catch (error) {
      console.error("Error getting payroll records:", error);
      res.status(500).json({ error: "Error al obtener registros de nómina" });
    }
  });

  app.get("/api/hr/payroll/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await storage.getPayrollRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error getting payroll record:", error);
      res.status(500).json({ error: "Error al obtener registro de nómina" });
    }
  });

  app.post("/api/hr/payroll", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = { ...req.body };
      if (body.period && !body.periodStart && !body.periodEnd) {
        const [year, month] = String(body.period).split("-").map(Number);
        if (year && month) {
          body.periodStart = new Date(year, month - 1, 1);
          body.periodEnd = new Date(year, month, 0, 23, 59, 59);
        }
        delete body.period;
      }
      if (body.periodStart && !(body.periodStart instanceof Date)) {
        body.periodStart = new Date(body.periodStart);
      }
      if (body.periodEnd && !(body.periodEnd instanceof Date)) {
        body.periodEnd = new Date(body.periodEnd);
      }
      const baseSalary = parseFloat(body.baseSalary) || 0;
      const bonuses = parseFloat(body.bonuses) || 0;
      const deductions = parseFloat(body.deductions) || 0;
      const taxWithholding = parseFloat(body.taxWithholding) || 0;
      const socialSecurity = parseFloat(body.socialSecurity) || 0;
      const overtimePay = parseFloat(body.overtimePay) || 0;
      const netPay = body.netPay
        ? parseFloat(body.netPay)
        : baseSalary + bonuses + overtimePay - deductions - taxWithholding - socialSecurity;
      const data = insertPayrollRecordSchema.parse({
        ...body,
        baseSalary: baseSalary.toFixed(2),
        bonuses: bonuses.toFixed(2),
        deductions: deductions.toFixed(2),
        taxWithholding: taxWithholding.toFixed(2),
        socialSecurity: socialSecurity.toFixed(2),
        overtimePay: overtimePay.toFixed(2),
        netPay: netPay.toFixed(2),
        tenantId: req.user!.tenantId,
      });
      const record = await storage.createPayrollRecord(data);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating payroll record:", error);
      res.status(500).json({ error: "Error al crear registro de nómina" });
    }
  });

  app.patch("/api/hr/payroll/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertPayrollRecordSchema.partial().parse(req.body);
      const record = await storage.updatePayrollRecord(req.params.id, data);
      if (!record) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating payroll record:", error);
      res.status(500).json({ error: "Error al actualizar registro de nómina" });
    }
  });

  app.delete("/api/hr/payroll/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const success = await storage.deletePayrollRecord(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting payroll record:", error);
      res.status(500).json({ error: "Error al eliminar registro de nómina" });
    }
  });

  app.post("/api/hr/payroll/:id/process", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await storage.processPayroll(req.params.id, req.user!.userId);
      if (!record) {
        return res.status(404).json({ error: "Registro no encontrado" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error processing payroll:", error);
      res.status(500).json({ error: "Error al procesar nómina" });
    }
  });

  // Vacaciones
  app.get("/api/hr/vacations", authenticateJWT, authorizeRoles("admin", "rh", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, status, startDate, endDate } = req.query;
      const requests = await storage.getVacationRequests({
        userId: userId as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        tenantId: req.user?.isSuperAdmin ? undefined : req.user!.tenantId
      });
      res.json(requests);
    } catch (error) {
      console.error("Error getting vacation requests:", error);
      res.status(500).json({ error: "Error al obtener solicitudes de vacaciones" });
    }
  });

  app.get("/api/hr/vacations/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const request = await storage.getVacationRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error getting vacation request:", error);
      res.status(500).json({ error: "Error al obtener solicitud de vacaciones" });
    }
  });

  app.post("/api/hr/vacations", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.body.userId || req.user?.userId;
      const body = { ...req.body, userId };
      const startDate = body.startDate ? new Date(body.startDate) : undefined;
      const endDate = body.endDate ? new Date(body.endDate) : undefined;
      if (startDate && endDate && !body.daysRequested) {
        body.daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
      }
      const data = insertVacationRequestSchema.parse({
        ...body,
        startDate,
        endDate,
        tenantId: req.user!.tenantId,
      });
      const request = await storage.createVacationRequest(data);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating vacation request:", error);
      res.status(500).json({ error: "Error al crear solicitud de vacaciones" });
    }
  });

  app.patch("/api/hr/vacations/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertVacationRequestSchema.partial().parse(req.body);
      const request = await storage.updateVacationRequest(req.params.id, data);
      if (!request) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
      }
      res.json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating vacation request:", error);
      res.status(500).json({ error: "Error al actualizar solicitud de vacaciones" });
    }
  });

  app.post("/api/hr/vacations/:id/approve", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const request = await storage.approveVacation(req.params.id, req.user!.userId);
      if (!request) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error approving vacation:", error);
      res.status(500).json({ error: "Error al aprobar vacaciones" });
    }
  });

  app.post("/api/hr/vacations/:id/reject", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "Se requiere motivo de rechazo" });
      }
      const request = await storage.rejectVacation(req.params.id, req.user!.userId, reason);
      if (!request) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error rejecting vacation:", error);
      res.status(500).json({ error: "Error al rechazar vacaciones" });
    }
  });

  app.post("/api/hr/vacations/:id/cancel", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const request = await storage.cancelVacation(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Solicitud no encontrada" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error cancelling vacation:", error);
      res.status(500).json({ error: "Error al cancelar vacaciones" });
    }
  });

  // Evaluaciones de desempeño
  app.get("/api/hr/reviews", authenticateJWT, authorizeRoles("admin", "rh", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, reviewerId, status, period } = req.query;
      const reviews = await storage.getPerformanceReviews({
        userId: userId as string | undefined,
        reviewerId: reviewerId as string | undefined,
        status: status as string | undefined,
        period: period as string | undefined,
        tenantId: req.user?.isSuperAdmin ? undefined : req.user!.tenantId
      });
      res.json(reviews);
    } catch (error) {
      console.error("Error getting performance reviews:", error);
      res.status(500).json({ error: "Error al obtener evaluaciones" });
    }
  });

  app.get("/api/hr/reviews/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const review = await storage.getPerformanceReview(req.params.id);
      if (!review) {
        return res.status(404).json({ error: "Evaluación no encontrada" });
      }
      res.json(review);
    } catch (error) {
      console.error("Error getting performance review:", error);
      res.status(500).json({ error: "Error al obtener evaluación" });
    }
  });

  app.post("/api/hr/reviews", authenticateJWT, authorizeRoles("admin", "rh", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewerId = req.body.reviewerId || req.user?.userId;
      const toDecimalStr = (v: unknown) => v != null && v !== "" ? parseFloat(String(v)).toFixed(1) : undefined;
      const data = insertPerformanceReviewSchema.parse({
        ...req.body,
        reviewerId,
        tenantId: req.user!.tenantId,
        overallScore: toDecimalStr(req.body.overallScore),
        productivityScore: toDecimalStr(req.body.productivityScore),
        initiativeScore: toDecimalStr(req.body.initiativeScore),
        punctualityScore: toDecimalStr(req.body.punctualityScore),
        teamworkScore: toDecimalStr(req.body.teamworkScore),
      });
      const review = await storage.createPerformanceReview(data);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating performance review:", error);
      res.status(500).json({ error: "Error al crear evaluación" });
    }
  });

  app.patch("/api/hr/reviews/:id", authenticateJWT, authorizeRoles("admin", "rh", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertPerformanceReviewSchema.partial().parse(req.body);
      const review = await storage.updatePerformanceReview(req.params.id, data);
      if (!review) {
        return res.status(404).json({ error: "Evaluación no encontrada" });
      }
      res.json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating performance review:", error);
      res.status(500).json({ error: "Error al actualizar evaluación" });
    }
  });

  app.delete("/api/hr/reviews/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const success = await storage.deletePerformanceReview(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting performance review:", error);
      res.status(500).json({ error: "Error al eliminar evaluación" });
    }
  });

  // Documentos de empleados
  app.get("/api/hr/documents", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, documentType } = req.query;
      const documents = await storage.getEmployeeDocuments({
        userId: userId as string | undefined,
        documentType: documentType as string | undefined,
        tenantId: req.user?.isSuperAdmin ? undefined : req.user!.tenantId
      });
      res.json(documents);
    } catch (error) {
      console.error("Error getting employee documents:", error);
      res.status(500).json({ error: "Error al obtener documentos" });
    }
  });

  app.get("/api/hr/documents/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const document = await storage.getEmployeeDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error getting employee document:", error);
      res.status(500).json({ error: "Error al obtener documento" });
    }
  });

  app.post("/api/hr/documents", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uploadedBy = req.user?.userId;
      const expirationDate = req.body.expirationDate ? new Date(req.body.expirationDate) : undefined;
      const data = insertEmployeeDocumentSchema.parse({
        ...req.body,
        expirationDate,
        uploadedBy,
        tenantId: req.user!.tenantId,
      });
      const document = await storage.createEmployeeDocument(data);
      res.status(201).json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating employee document:", error);
      res.status(500).json({ error: "Error al crear documento" });
    }
  });

  app.patch("/api/hr/documents/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = insertEmployeeDocumentSchema.partial().parse(req.body);
      const document = await storage.updateEmployeeDocument(req.params.id, data);
      if (!document) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }
      res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating employee document:", error);
      res.status(500).json({ error: "Error al actualizar documento" });
    }
  });

  app.delete("/api/hr/documents/:id", authenticateJWT, authorizeRoles("admin", "rh"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const success = await storage.deleteEmployeeDocument(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting employee document:", error);
      res.status(500).json({ error: "Error al eliminar documento" });
    }
  });

  // ==================== MÓDULO TAREAS ====================

  app.get("/api/tasks", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, priority, startDate, endDate, type, assignedUserId: queryAssignedUserId } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;

      // Abastecedor solo ve sus propias tareas; otherwise use query param if provided
      const effectiveUserId = getEffectiveUserId(req, "assignedUserId") ?? (queryAssignedUserId as string | undefined);

      // Supervisor solo ve tareas de usuarios de su zona
      const supervisorZone = await getSupervisorZone(req);

      let taskList = await storage.getTasks({
        status: status as string | undefined,
        priority: priority as string | undefined,
        assignedUserId: effectiveUserId,
        type: type as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        tenantId
      });

      // Si es supervisor con zona asignada, filtrar tareas por usuarios de su zona
      if (supervisorZone && !effectiveUserId) {
        const zoneUserIds = await storage.getUserIdsByZone(supervisorZone);
        const zoneUserIdsSet = new Set(zoneUserIds);

        taskList = taskList.filter(task =>
          !task.assignedUserId || zoneUserIdsSet.has(task.assignedUserId)
        );
      }

      res.json(taskList);
    } catch (error) {
      console.error("Error getting tasks:", error);
      res.status(500).json({ error: "Error al obtener tareas" });
    }
  });

  app.get("/api/tasks/today", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      // Abastecedor solo ve sus propias tareas
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const tasks = await storage.getTasksForToday(effectiveUserId, tenantId);
      res.json(tasks);
    } catch (error) {
      console.error("Error getting today tasks:", error);
      res.status(500).json({ error: "Error al obtener tareas de hoy" });
    }
  });

  app.get("/api/tasks/my-history", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { limit } = req.query;
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const taskList = await storage.getTasks({
        assignedUserId: userId,
        tenantId
      });
      // Filtrar solo tareas completadas o canceladas y limitar resultados
      const maxResults = limit ? parseInt(limit as string) : 20;
      const historyTasks = taskList
        .filter(t => t.status === "completada" || t.status === "cancelada")
        .slice(0, maxResults);
      res.json(historyTasks);
    } catch (error) {
      console.error("Error getting task history:", error);
      res.status(500).json({ error: "Error al obtener historial de tareas" });
    }
  });

  app.get("/api/tasks/stats", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      // Abastecedor solo ve sus propias estadísticas
      const effectiveUserId = getEffectiveUserId(req, "userId");
      const stats = await storage.getTaskStats({
        userId: effectiveUserId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        tenantId
      });
      res.json(stats);
    } catch (error) {
      console.error("Error getting task stats:", error);
      res.status(500).json({ error: "Error al obtener estadísticas de tareas" });
    }
  });

  app.get("/api/tasks/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyTaskTenant(req.params.id, req, res)) return;
      
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }
      // Abastecedor solo puede ver sus propias tareas
      if (req.user?.role === "abastecedor" && task.assignedUserId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para ver esta tarea" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error getting task:", error);
      res.status(500).json({ error: "Error al obtener tarea" });
    }
  });

  app.post("/api/tasks", authenticateJWT, authorizeAction("tasks", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant no identificado" });
      }
      const bodyWithParsedDate = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        createdBy: req.user?.userId,
      };
      // Validate without tenantId from body (prevent injection), then append from JWT
      const data = {
        ...insertTaskSchema.omit({ tenantId: true }).parse(bodyWithParsedDate),
        tenantId
      };
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

  app.patch("/api/tasks/:id", authenticateJWT, authorizeAction("tasks", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyTaskTenant(req.params.id, req, res)) return;
      
      // Verificar ownership para abastecedores
      const existingTask = await storage.getTask(req.params.id);
      if (!existingTask) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }
      
      // Abastecedor solo puede modificar sus propias tareas y solo campos limitados
      if (req.user?.role === "abastecedor") {
        if (existingTask.assignedUserId !== req.user.userId) {
          return res.status(403).json({ error: "No tienes permiso para modificar esta tarea" });
        }
        // Abastecedor solo puede cambiar status y notes
        const allowedFields = ["status", "notes"];
        const requestedFields = Object.keys(req.body);
        const invalidFields = requestedFields.filter(f => !allowedFields.includes(f));
        if (invalidFields.length > 0) {
          return res.status(403).json({ error: "No tienes permiso para modificar estos campos" });
        }
      }
      
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

  app.post("/api/tasks/:id/complete", authenticateJWT, authorizeAction("tasks", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyTaskTenant(req.params.id, req, res)) return;
      
      // Verificar ownership para abastecedores
      const existingTask = await storage.getTask(req.params.id);
      if (!existingTask) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }
      
      // Abastecedor solo puede completar sus propias tareas
      if (req.user?.role === "abastecedor" && existingTask.assignedUserId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para completar esta tarea" });
      }
      
      // Usar el usuario autenticado como completedBy
      const completedBy = req.user?.userId || req.body.completedBy;
      if (!completedBy) {
        return res.status(400).json({ error: "Se requiere completedBy" });
      }
      const task = await storage.completeTask(req.params.id, completedBy);
      res.json(task);
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ error: "Error al completar tarea" });
    }
  });

  app.post("/api/tasks/:id/cancel", authenticateJWT, authorizeAction("tasks", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyTaskTenant(req.params.id, req, res)) return;
      
      // Verificar ownership para abastecedores
      const existingTask = await storage.getTask(req.params.id);
      if (!existingTask) {
        return res.status(404).json({ error: "Tarea no encontrada" });
      }
      
      // Abastecedor solo puede cancelar sus propias tareas
      if (req.user?.role === "abastecedor" && existingTask.assignedUserId !== req.user.userId) {
        return res.status(403).json({ error: "No tienes permiso para cancelar esta tarea" });
      }
      
      // Usar el usuario autenticado como cancelledBy
      const cancelledBy = req.user?.userId || req.body.cancelledBy;
      if (!cancelledBy) {
        return res.status(400).json({ error: "Se requiere cancelledBy" });
      }
      const task = await storage.cancelTask(req.params.id, cancelledBy);
      res.json(task);
    } catch (error) {
      console.error("Error cancelling task:", error);
      res.status(500).json({ error: "Error al cancelar tarea" });
    }
  });

  app.delete("/api/tasks/:id", authenticateJWT, authorizeAction("tasks", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyTaskTenant(req.params.id, req, res)) return;
      
      await storage.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Error al eliminar tarea" });
    }
  });

  // ==================== MÓDULO CALENDARIO ====================

  // Schema para el body de eventos de calendario (sin tenantId - siempre viene del JWT)
  const calendarEventBodySchema = z.object({
    title: z.string().min(1, "Título requerido"),
    description: z.string().optional(),
    eventType: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    allDay: z.boolean().optional(),
    color: z.string().optional(),
    userId: z.string().optional(),
    taskId: z.string().optional(),
    isRecurring: z.boolean().optional(),
    recurringPattern: z.string().optional(),
  });

  app.get("/api/calendar/events", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, startDate, endDate, eventType } = req.query;
      // superAdmin recibe null → sin filtro de tenant (ve todos); usuario normal recibe su tenantId
      const tenantId: string | null = req.user?.isSuperAdmin ? null : (req.user?.tenantId ?? null);

      if (tenantId === null && !req.user?.isSuperAdmin) {
        return res.status(400).json({ error: "Tenant requerido" });
      }

      // Supervisor solo ve eventos de usuarios de su zona
      const supervisorZone = await getSupervisorZone(req);

      let events = await storage.getCalendarEvents({
        tenantId,
        userId: userId as string | undefined,
        eventType: eventType as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });

      // Filtrar por zona si es supervisor usando storage layer
      if (supervisorZone) {
        const zoneUserIds = await storage.getUserIdsByZone(supervisorZone);
        const zoneUserIdsSet = new Set(zoneUserIds);

        events = events.filter(event =>
          !event.userId || zoneUserIdsSet.has(event.userId)
        );
      }

      res.json(events);
    } catch (error) {
      console.error("Error getting calendar events:", error);
      res.status(500).json({ error: "Error al obtener eventos" });
    }
  });

  app.get("/api/calendar/events/:id", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyCalendarEventTenant(req.params.id, req, res)) return;
      
      const event = await storage.getCalendarEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      
      // Supervisor solo puede ver eventos de su zona
      const supervisorZone = await getSupervisorZone(req);
      if (supervisorZone && event.userId) {
        const eventUser = await storage.getUser(event.userId);
        if (eventUser && eventUser.assignedZone !== supervisorZone) {
          return res.status(403).json({ error: "No autorizado para ver este evento" });
        }
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error getting calendar event:", error);
      res.status(500).json({ error: "Error al obtener evento" });
    }
  });

  app.post("/api/calendar/events", authenticateJWT, authorizeAction("tasks", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Para super admin se requiere tenantId en el body; para usuarios normales viene del JWT
      const tenantId = req.user?.isSuperAdmin ? (req.body.tenantId as string | undefined) : req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant requerido" });
      }
      const data = calendarEventBodySchema.parse(req.body);
      const event = await storage.createCalendarEvent({ ...data, tenantId });
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating calendar event:", error);
      res.status(500).json({ error: "Error al crear evento" });
    }
  });

  app.patch("/api/calendar/events/:id", authenticateJWT, authorizeAction("tasks", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyCalendarEventTenant(req.params.id, req, res)) return;

      const data = calendarEventBodySchema.partial().parse(req.body);
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

  app.delete("/api/calendar/events/:id", authenticateJWT, authorizeAction("tasks", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!await verifyCalendarEventTenant(req.params.id, req, res)) return;
      
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
  app.get("/api/summary/routes", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const routeConditions = tenantId ? [eq(routesTable.tenantId, tenantId)] : [];
      const routeStopConditions = tenantId ? [eq(routeStops.tenantId, tenantId)] : [];
      const serviceConditions = tenantId ? [eq(serviceRecords.tenantId, tenantId)] : [];

      const [routeStats, todayStops, serviceStats, todayRoutes] = await Promise.all([
        db.select({
          total: count(),
          active: sql<number>`count(*) filter (where ${routesTable.status} in ('en_progreso', 'activa'))`,
        }).from(routesTable).where(routeConditions.length ? and(...routeConditions) : undefined),
        db.select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${routeStops.status} = 'completada')`,
        }).from(routeStops)
          .innerJoin(routesTable, eq(routeStops.routeId, routesTable.id))
          .where(and(...routeStopConditions, gte(routesTable.date, today))),
        db.select({ avgTime: sql<number>`coalesce(avg(${serviceRecords.durationMinutes}), 0)` })
          .from(serviceRecords)
          .where(serviceConditions.length ? and(...serviceConditions, gte(serviceRecords.createdAt, weekAgo)) : gte(serviceRecords.createdAt, weekAgo)),
        db.select({ id: routesTable.id, date: routesTable.date, status: routesTable.status, totalStops: routesTable.totalStops, supplierId: routesTable.supplierId })
          .from(routesTable)
          .where(and(...routeConditions, gte(routesTable.date, today), sql`${routesTable.date} < ${tomorrow}`))
          .orderBy(desc(routesTable.date))
          .limit(10),
      ]);

      const supplierIds = Array.from(new Set(todayRoutes.map(r => r.supplierId).filter(Boolean))) as string[];
      const userNames = new Map<string, string>();
      if (supplierIds.length > 0) {
        const usersData = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, supplierIds));
        usersData.forEach(u => userNames.set(u.id, u.fullName || 'Sin nombre'));
      }

      res.json({
        activeRoutes: Number(routeStats[0]?.active) || 0,
        totalRoutes: routeStats[0]?.total || 0,
        todayStops: todayStops[0]?.total || 0,
        completedStops: Number(todayStops[0]?.completed) || 0,
        pendingStops: (todayStops[0]?.total || 0) - (Number(todayStops[0]?.completed) || 0),
        avgServiceTimeMinutes: Math.round(Number(serviceStats[0]?.avgTime) || 0),
        recentRoutes: todayRoutes.map(r => ({
          id: r.id,
          name: r.supplierId ? `Ruta de ${userNames.get(r.supplierId) || 'Desconocido'}` : `Ruta ${r.id.slice(-4)}`,
          date: r.date?.toISOString() || new Date().toISOString(),
          status: r.status || 'pendiente',
          stopsCount: r.totalStops || 0,
        })),
      });
    } catch (error) {
      if (res.headersSent) return;
      console.error("Error in routes summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de rutas" });
    }
  });

  // Warehouse Summary
  app.get("/api/summary/warehouse", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const products = await storage.getProducts(tenantId);
      const productLots = await storage.getProductLots(undefined, 50, tenantId);
      const movements = await storage.getWarehouseMovements(undefined, 20, tenantId);
      
      const lowStockProducts: any[] = [];
      const productStocks: Record<string, number> = {};
      
      productLots.forEach(lot => {
        if (!productStocks[lot.productId]) {
          productStocks[lot.productId] = 0;
        }
        productStocks[lot.productId] += lot.remainingQuantity ?? lot.quantity ?? 0;
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
        entriesThisWeek: weekMovements.filter(m => String(m.movementType).startsWith("entrada")).length,
        exitsThisWeek: weekMovements.filter(m => String(m.movementType).startsWith("salida")).length
      });
    } catch (error) {
      console.error("Error in warehouse summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de almacén" });
    }
  });

  // Accounting Summary
  app.get("/api/summary/accounting", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const machineSales = await storage.getAllMachineSales(tenantId);
      const cashMovements = await storage.getCashMovements({ tenantId });
      const bankDeposits = await storage.getBankDeposits({ tenantId });
      
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

  // Petty Cash Summary
  app.get("/api/summary/petty-cash", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const fundCond = tenantId ? eq(pettyCashFund.tenantId, tenantId) : undefined;
      const expCond = tenantId ? eq(pettyCashExpenses.tenantId, tenantId) : undefined;

      const [fund, expenseStats, recentExpenses] = await Promise.all([
        db.select().from(pettyCashFund).where(fundCond).limit(1),
        db.select({
          pending: sql<number>`count(*) filter (where ${pettyCashExpenses.status} = 'pendiente')`,
          approved: sql<number>`count(*) filter (where ${pettyCashExpenses.status} = 'aprobado')`,
          weekTotal: sql<number>`coalesce(sum(case when ${pettyCashExpenses.createdAt} >= ${weekAgo} and ${pettyCashExpenses.status} = 'aprobado' then ${pettyCashExpenses.amount} else 0 end), 0)`,
        }).from(pettyCashExpenses).where(expCond),
        db.select({
          id: pettyCashExpenses.id,
          description: pettyCashExpenses.description,
          amount: pettyCashExpenses.amount,
          category: pettyCashExpenses.category,
          status: pettyCashExpenses.status,
        }).from(pettyCashExpenses).where(expCond).orderBy(desc(pettyCashExpenses.createdAt)).limit(5),
      ]);

      const currentFund = fund[0];
      res.json({
        currentBalance: currentFund?.currentBalance?.toString() || "0",
        initialAmount: currentFund?.initialBalance?.toString() || "0",
        weekExpenses: Number(expenseStats[0]?.weekTotal) || 0,
        pendingCount: Number(expenseStats[0]?.pending) || 0,
        approvedCount: Number(expenseStats[0]?.approved) || 0,
        recentExpenses,
      });
    } catch (error) {
      console.error("Error in petty cash summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de caja chica" });
    }
  });

  // Purchases Summary
  app.get("/api/summary/purchases", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      const orderCond = tenantId ? eq(purchaseOrders.tenantId, tenantId) : undefined;
      const receptionCond = tenantId ? eq(purchaseReceptions.tenantId, tenantId) : undefined;

      const [orderStats, monthSpending, pendingReceptions] = await Promise.all([
        db.select({
          total: count(),
          open: sql<number>`count(*) filter (where ${purchaseOrders.status} in ('borrador', 'enviada'))`,
        }).from(purchaseOrders).where(orderCond),
        db.select({
          monthTotal: sql<number>`coalesce(sum(cast(${receptionItems.quantityReceived} as numeric) * cast(${receptionItems.unitCost} as numeric)), 0)`,
        }).from(receptionItems)
          .innerJoin(purchaseReceptions, eq(receptionItems.receptionId, purchaseReceptions.id))
          .where(and(...(receptionCond ? [receptionCond] : []), gte(purchaseReceptions.receptionDate, monthAgo))),
        db.select({ total: count() }).from(purchaseOrders)
          .where(and(...(orderCond ? [orderCond] : []), eq(purchaseOrders.status, 'enviada'))),
      ]);

      res.json({
        openOrders: Number(orderStats[0]?.open) || 0,
        totalOrders: orderStats[0]?.total || 0,
        monthSpending: Number(monthSpending[0]?.monthTotal) || 0,
        pendingReceptions: pendingReceptions[0]?.total || 0,
      });
    } catch (error) {
      if (res.headersSent) return;
      console.error("Error in purchases summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de compras" });
    }
  });

  // Fuel Summary
  app.get("/api/summary/fuel", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      const vehicleCond = tenantId ? eq(vehiclesTable.tenantId, tenantId) : undefined;
      const fuelCond = tenantId ? eq(fuelRecords.tenantId, tenantId) : undefined;

      const [vehicleStats, recentFuel] = await Promise.all([
        db.select({
          total: count(),
          active: sql<number>`count(*) filter (where ${vehiclesTable.isActive} = true)`,
        }).from(vehiclesTable).where(vehicleCond),
        db.select().from(fuelRecords)
          .where(fuelCond ? and(fuelCond, gte(fuelRecords.recordDate, monthAgo)) : gte(fuelRecords.recordDate, monthAgo))
          .limit(500),
      ]);

      let monthCost = 0, monthLiters = 0, effSum = 0, effCount = 0, lowEff = 0;
      for (const r of recentFuel) {
        monthCost += Number(r.totalAmount) || 0;
        monthLiters += Number(r.liters) || 0;
        const eff = Number(r.calculatedMileage) || 0;
        if (eff > 0) { effSum += eff; effCount++; if (eff < 8) lowEff++; }
      }

      res.json({
        totalVehicles: vehicleStats[0]?.total || 0,
        activeVehicles: Number(vehicleStats[0]?.active) || 0,
        monthCost,
        monthLiters,
        avgEfficiency: effCount > 0 ? (effSum / effCount).toFixed(2) : "0",
        lowEfficiencyAlerts: lowEff,
      });
    } catch (error) {
      if (res.headersSent) return;
      console.error("Error in fuel summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de combustible" });
    }
  });

  // HR Summary
  app.get("/api/summary/hr", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const userCond = tenantId ? eq(users.tenantId, tenantId) : undefined;
      const visitCond = tenantId ? eq(machineVisits.tenantId, tenantId) : undefined;
      const taskCond = tenantId ? eq(tasksTable.tenantId, tenantId) : undefined;

      const [employeeStats, visitStats, taskStats, topPerformersData] = await Promise.all([
        db.select({
          total: count(),
          active: sql<number>`count(*) filter (where ${users.isActive} = true)`,
          technicians: sql<number>`count(*) filter (where ${users.role} in ('abastecedor', 'tecnico') and ${users.isActive} = true)`,
          admins: sql<number>`count(*) filter (where ${users.role} = 'admin' and ${users.isActive} = true)`,
          supervisors: sql<number>`count(*) filter (where ${users.role} = 'supervisor' and ${users.isActive} = true)`,
        }).from(users).where(userCond),
        db.select({ total: count() }).from(machineVisits)
          .where(visitCond ? and(visitCond, gte(machineVisits.createdAt, weekAgo)) : gte(machineVisits.createdAt, weekAgo)),
        db.select({ completed: sql<number>`count(*) filter (where ${tasksTable.status} = 'completada')` })
          .from(tasksTable)
          .where(taskCond ? and(taskCond, gte(tasksTable.createdAt, weekAgo)) : gte(tasksTable.createdAt, weekAgo)),
        db.select({ userId: machineVisits.userId })
          .from(machineVisits)
          .where(visitCond ? and(visitCond, gte(machineVisits.createdAt, weekAgo)) : gte(machineVisits.createdAt, weekAgo))
          .groupBy(machineVisits.userId)
          .limit(5),
      ]);

      const userIds = topPerformersData.map(p => p.userId).filter(Boolean) as string[];
      const [usersList, visitsPerUser, tasksPerUser] = await Promise.all([
        userIds.length > 0 ? db.select().from(users).where(inArray(users.id, userIds)) : Promise.resolve([]),
        userIds.length > 0 ? db.select({ userId: machineVisits.userId, cnt: count() }).from(machineVisits)
          .where(visitCond ? and(visitCond, gte(machineVisits.createdAt, weekAgo)) : gte(machineVisits.createdAt, weekAgo))
          .groupBy(machineVisits.userId) : Promise.resolve([]),
        userIds.length > 0 ? db.select({ userId: tasksTable.assignedUserId, cnt: sql<number>`count(*) filter (where ${tasksTable.status} = 'completada')` })
          .from(tasksTable)
          .where(taskCond ? and(taskCond, gte(tasksTable.createdAt, weekAgo)) : gte(tasksTable.createdAt, weekAgo))
          .groupBy(tasksTable.assignedUserId) : Promise.resolve([]),
      ]);

      const usersMap = new Map(usersList.map(u => [u.id, u]));
      const visitsMap = new Map(visitsPerUser.map(v => [v.userId, v.cnt]));
      const tasksMap = new Map(tasksPerUser.map(t => [t.userId, Number(t.cnt) || 0]));

      res.json({
        totalEmployees: employeeStats[0]?.total || 0,
        activeEmployees: Number(employeeStats[0]?.active) || 0,
        weekVisits: visitStats[0]?.total || 0,
        weekTasksCompleted: Number(taskStats[0]?.completed) || 0,
        topPerformers: userIds.slice(0, 5).map(userId => {
          const u = usersMap.get(userId);
          return { id: userId, name: u?.fullName || u?.username || 'Desconocido', role: u?.role || 'empleado', visitsThisWeek: visitsMap.get(userId) || 0, tasksCompleted: tasksMap.get(userId) || 0 };
        }),
        byRole: {
          technicians: Number(employeeStats[0]?.technicians) || 0,
          admins: Number(employeeStats[0]?.admins) || 0,
          supervisors: Number(employeeStats[0]?.supervisors) || 0,
        },
      });
    } catch (error) {
      if (res.headersSent) return;
      console.error("Error in HR summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de RH" });
    }
  });

  // Money & Products Reconciliation Summary
  app.get("/api/summary/reconciliation", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const transferCond = tenantId ? eq(productTransfers.tenantId, tenantId) : undefined;
      const shrinkCond = tenantId ? eq(shrinkageRecords.tenantId, tenantId) : undefined;
      const collCond = tenantId ? eq(cashCollections.tenantId, tenantId) : undefined;

      const [transferStats, shrinkageStats, collectionStats, recentDiscrepancies] = await Promise.all([
        db.select({
          weekTotal: sql<number>`count(*) filter (where ${productTransfers.createdAt} >= ${weekAgo})`,
          pending: sql<number>`count(*) filter (where ${productTransfers.status} = 'pendiente')`,
        }).from(productTransfers).where(transferCond),
        db.select({
          weekTotal: sql<number>`coalesce(sum(case when ${shrinkageRecords.createdAt} >= ${weekAgo} then ${shrinkageRecords.quantity} else 0 end), 0)`,
          totalRecords: count(),
        }).from(shrinkageRecords).where(shrinkCond),
        db.select({
          weekTotal: sql<number>`coalesce(sum(case when ${cashCollections.createdAt} >= ${weekAgo} then ${cashCollections.actualAmount} else 0 end), 0)`,
          totalCount: count(),
        }).from(cashCollections).where(collCond),
        db.select({ id: shrinkageRecords.id, productId: shrinkageRecords.productId, quantity: shrinkageRecords.quantity, reason: shrinkageRecords.reason })
          .from(shrinkageRecords).where(shrinkCond).orderBy(desc(shrinkageRecords.createdAt)).limit(5),
      ]);

      res.json({
        weekTransfers: Number(transferStats[0]?.weekTotal) || 0,
        pendingTransfers: Number(transferStats[0]?.pending) || 0,
        weekShrinkage: Number(shrinkageStats[0]?.weekTotal) || 0,
        shrinkageRecords: shrinkageStats[0]?.totalRecords || 0,
        weekCollections: Number(collectionStats[0]?.weekTotal) || 0,
        collectionsCount: collectionStats[0]?.totalCount || 0,
        recentDiscrepancies,
      });
    } catch (error) {
      console.error("Error in reconciliation summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de conciliación" });
    }
  });

  // Products Summary
  app.get("/api/summary/products", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const products = await storage.getProducts(tenantId);
      const productLots = await storage.getProductLots(undefined, 50, tenantId);
      const machineSales = await storage.getAllMachineSales(tenantId);
      
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
  app.get("/api/summary/machines", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      const [machines, machineSales, alerts] = await Promise.all([
        storage.getMachines(tenantId),
        storage.getAllMachineSales(tenantId),
        db.select().from(machineAlerts).where(
          and(eq(machineAlerts.tenantId, tenantId), eq(machineAlerts.isResolved, false))
        ),
      ]);

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
  const SUPERVISOR_VALID_ZONES = ["Zona Norte", "Zona Sur", "Zona Centro", "Zona Oriente", "Zona Poniente"] as const;
  const supervisorZoneSchema = z.object({
    zone: z.enum(SUPERVISOR_VALID_ZONES).nullable().optional(),
  });

  app.get("/api/supervisors", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { db } = await import("./db");
      const { routes: routesTable, users: usersTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      // Aislamiento multi-tenant: fail-closed para no-superAdmin
      const tenantId = req.user?.isSuperAdmin ? null : req.user?.tenantId;
      if (!req.user?.isSuperAdmin && !tenantId) {
        return res.status(403).json({ error: "Contexto de tenant requerido" });
      }

      // Obtener usuarios del tenant (query directa con filtro de tenantId)
      const rawUsers = tenantId
        ? await db.select().from(usersTable).where(eq(usersTable.tenantId, tenantId))
        : await db.select().from(usersTable);
      const allUsers = rawUsers.map(({ password, ...u }) => u);
      const supervisors = allUsers.filter((u: any) => u.role === "supervisor");
      const abastecedores = allUsers.filter((u: any) => u.role === "abastecedor");

      // Máquinas del tenant (query directa para soporte SuperAdmin sin tenantId)
      const { machines: machinesTable } = await import("@shared/schema");
      const machines = tenantId
        ? await storage.getMachines(tenantId)
        : await db.select().from(machinesTable).limit(2000);

      // Rutas del tenant
      const routesList = tenantId
        ? await db.select().from(routesTable).where(eq(routesTable.tenantId, tenantId)).limit(500)
        : await db.select().from(routesTable).limit(500);

      // Alertas: filtrar por máquinas del tenant (las alertas no tienen tenantId propio)
      const tenantMachineIds = new Set(machines.map(m => m.id));
      const allAlerts = await storage.getMachineAlerts(undefined, undefined, 2000);
      const alerts = allAlerts.filter((a: any) => tenantMachineIds.has(a.machineId));

      // Tareas del tenant
      const tasks = await storage.getTasks(tenantId ? { tenantId } : {});

      const supervisorsWithMetrics = supervisors.map((sup: any) => {
        const zone = sup.assignedZone;
        const zoneMachines = zone ? machines.filter(m => m.zone === zone) : [];
        const zoneAbastecedores = zone ? abastecedores.filter((a: any) => a.assignedZone === zone) : [];
        const supRoutes = routesList.filter((r: any) => r.supervisorId === sup.id);
        const zoneAlerts = zone ? alerts.filter((a: any) => {
          const machine = machines.find(m => m.id === a.machineId);
          return machine?.zone === zone && !a.isResolved;
        }) : [];
        const assignedTasks = tasks.filter((t: any) => t.assignedUserId === sup.id);
        const completedTasks = assignedTasks.filter((t: any) => t.status === "completada");

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

  app.get("/api/supervisors/:id", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { db } = await import("./db");
      const { routes: routesTable, users: usersTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const tenantId = req.user?.isSuperAdmin ? null : req.user?.tenantId;
      if (!req.user?.isSuperAdmin && !tenantId) {
        return res.status(403).json({ error: "Contexto de tenant requerido" });
      }

      const { id } = req.params;
      const supervisor = await storage.getEmployee(id);

      // SECURITY: verificar que el supervisor pertenece al tenant del solicitante
      if (!supervisor || supervisor.role !== "supervisor") {
        return res.status(404).json({ error: "Supervisor no encontrado" });
      }
      if (!req.user?.isSuperAdmin && supervisor.tenantId !== tenantId) {
        return res.status(404).json({ error: "Supervisor no encontrado" });
      }

      // Usuarios del tenant
      const rawUsers = tenantId
        ? await db.select().from(usersTable).where(eq(usersTable.tenantId, tenantId))
        : await db.select().from(usersTable);
      const allUsers = rawUsers.map(({ password, ...u }) => u);

      // Máquinas del tenant (query directa para soporte SuperAdmin sin tenantId)
      const { machines: machinesTable } = await import("@shared/schema");
      const machines = tenantId
        ? await storage.getMachines(tenantId)
        : await db.select().from(machinesTable).limit(2000);

      // Rutas del supervisor dentro del tenant
      const routesList = tenantId
        ? await db.select().from(routesTable).where(
            and(eq(routesTable.supervisorId, id), eq(routesTable.tenantId, tenantId))
          ).limit(50)
        : await db.select().from(routesTable).where(eq(routesTable.supervisorId, id)).limit(50);

      // Alertas filtradas por máquinas del tenant
      const tenantMachineIds = new Set(machines.map(m => m.id));
      const allAlerts = await storage.getMachineAlerts(undefined, undefined, 2000);
      const alerts = allAlerts.filter((a: any) => tenantMachineIds.has(a.machineId));

      // Tareas del supervisor dentro del tenant
      const tasks = await storage.getTasks(
        tenantId ? { tenantId, assignedUserId: id } : { assignedUserId: id }
      );

      const zone = supervisor.assignedZone;
      const zoneMachines = zone ? machines.filter(m => m.zone === zone) : [];
      const abastecedores = zone
        ? allUsers.filter((u: any) => u.role === "abastecedor" && u.assignedZone === zone)
        : [];
      const zoneAlerts = zone ? alerts.filter((a: any) => {
        const machine = machines.find(m => m.id === a.machineId);
        return machine?.zone === zone;
      }) : [];

      const operativeMachines = zoneMachines.filter(m => m.status === "operando").length;
      const completedTasks = tasks.filter((t: any) => t.status === "completada");

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
        tasks: tasks.slice(0, 10),
        metrics: {
          machinesCount: zoneMachines.length,
          operativeMachines,
          operativityRate: zoneMachines.length > 0
            ? Math.round((operativeMachines / zoneMachines.length) * 100)
            : 0,
          abastecedoresCount: abastecedores.length,
          pendingAlerts: zoneAlerts.filter((a: any) => !a.isResolved).length,
          criticalAlerts: zoneAlerts.filter((a: any) => a.priority === "critica" && !a.isResolved).length,
          tasksCompleted: completedTasks.length,
          tasksTotal: tasks.length,
          completionRate: tasks.length > 0
            ? Math.round((completedTasks.length / tasks.length) * 100)
            : 100,
        }
      });
    } catch (error) {
      console.error("Error getting supervisor detail:", error);
      res.status(500).json({ error: "Error al obtener detalle del supervisor" });
    }
  });

  app.patch("/api/supervisors/:id/zone", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { db } = await import("./db");
      const { users: usersTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const tenantId = req.user?.isSuperAdmin ? null : req.user?.tenantId;
      if (!req.user?.isSuperAdmin && !tenantId) {
        return res.status(403).json({ error: "Contexto de tenant requerido" });
      }

      const { id } = req.params;

      // Validar zona con Zod
      let validatedZone: string | null;
      try {
        const parsed = supervisorZoneSchema.parse(req.body);
        validatedZone = parsed.zone ?? null;
      } catch {
        return res.status(400).json({ error: "Zona no válida" });
      }

      // SECURITY: verificar que el supervisor pertenece al tenant del solicitante
      const supervisor = await storage.getEmployee(id);
      if (!supervisor || supervisor.role !== "supervisor") {
        return res.status(404).json({ error: "Supervisor no encontrado" });
      }
      if (!req.user?.isSuperAdmin && supervisor.tenantId !== tenantId) {
        return res.status(404).json({ error: "Supervisor no encontrado" });
      }

      // Actualizar con guard de tenantId para seguridad adicional
      const whereClause = tenantId
        ? and(eq(usersTable.id, id), eq(usersTable.tenantId, tenantId))
        : eq(usersTable.id, id);
      await db.update(usersTable).set({ assignedZone: validatedZone }).where(whereClause);

      res.json({ success: true, message: validatedZone ? "Zona asignada correctamente" : "Zona desasignada correctamente" });
    } catch (error) {
      console.error("Error assigning zone:", error);
      res.status(500).json({ error: "Error al asignar zona" });
    }
  });

  // Global search endpoint
  app.get("/api/search", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { q } = req.query;
      const query = (q as string || "").toLowerCase().trim();
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const results: any[] = [];

      // Search machines
      const machines = await storage.getMachines(req.user!.tenantId);
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
      const searchTenantId = req.user?.isSuperAdmin ? undefined : req.user?.tenantId;
      const products = await storage.getProducts(searchTenantId);
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

  // ==================== SUPER ADMIN ROUTES ====================
  
  // Get global metrics (Super Admin only)
  app.get("/api/super-admin/metrics", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const metrics = await storage.getGlobalMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting global metrics:", error);
      res.status(500).json({ error: "Error al obtener métricas globales" });
    }
  });

  // Get all tenants (Super Admin only)
  app.get("/api/super-admin/tenants", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenants = await storage.getAllTenants();
      
      // Get additional info for each tenant
      const tenantsWithInfo = await Promise.all(tenants.map(async (tenant) => {
        const stats = await storage.getTenantStats(tenant.id);
        const subscription = await storage.getTenantSubscription(tenant.id);
        const plan = subscription ? await storage.getSubscriptionPlan(subscription.planId) : null;
        
        return {
          ...tenant,
          ...stats,
          subscription,
          planName: plan?.name || "Sin plan"
        };
      }));
      
      res.json(tenantsWithInfo);
    } catch (error) {
      console.error("Error getting tenants:", error);
      res.status(500).json({ error: "Error al obtener empresas" });
    }
  });

  // Get single tenant (Super Admin only)
  app.get("/api/super-admin/tenants/:id", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }
      
      const stats = await storage.getTenantStats(tenant.id);
      const subscription = await storage.getTenantSubscription(tenant.id);
      const plan = subscription ? await storage.getSubscriptionPlan(subscription.planId) : null;
      
      res.json({
        ...tenant,
        ...stats,
        subscription,
        plan
      });
    } catch (error) {
      console.error("Error getting tenant:", error);
      res.status(500).json({ error: "Error al obtener empresa" });
    }
  });

  // Create tenant (Super Admin only)
  app.post("/api/super-admin/tenants", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input
      const createTenantSchema = z.object({
        name: z.string().min(1, "Nombre es requerido"),
        slug: z.string().min(1, "Slug es requerido").regex(/^[a-z0-9-]+$/, "Slug solo puede contener letras minúsculas, números y guiones"),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        planId: z.string().optional()
      });
      
      const data = createTenantSchema.parse(req.body);
      
      // Check if slug is unique
      const existing = await storage.getTenantBySlug(data.slug);
      if (existing) {
        return res.status(400).json({ error: "El slug ya está en uso" });
      }
      
      const tenant = await storage.createTenant({
        name: data.name,
        slug: data.slug,
        email: data.email,
        phone: data.phone,
        address: data.address
      });
      
      // Create subscription if plan provided
      if (data.planId) {
        const now = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        await storage.createTenantSubscription({
          tenantId: tenant.id,
          planId: data.planId,
          status: "active",
          startDate: now,
          endDate,
          billingCycle: "monthly"
        });
      }
      
      await storage.seedDefaultEstablishmentStages(tenant.id);

      // Log the action
      await storage.createAuditLog({
        userId: req.user!.userId,
        action: "CREATE_TENANT",
        resourceType: "tenants",
        resourceId: tenant.id,
        details: { name: data.name, slug: data.slug },
        tenantId: tenant.id
      });
      
      res.status(201).json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating tenant:", error);
      res.status(500).json({ error: "Error al crear empresa" });
    }
  });

  // Update tenant (Super Admin only)
  app.patch("/api/super-admin/tenants/:id", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input
      const updateTenantSchema = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        isActive: z.boolean().optional()
      });
      
      const data = updateTenantSchema.parse(req.body);
      
      const updated = await storage.updateTenant(req.params.id, data);
      if (!updated) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }
      
      // Log the action
      await storage.createAuditLog({
        userId: req.user!.userId,
        action: "UPDATE_TENANT",
        resourceType: "tenants",
        resourceId: req.params.id,
        details: data,
        tenantId: req.params.id
      });
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating tenant:", error);
      res.status(500).json({ error: "Error al actualizar empresa" });
    }
  });

  // Deactivate tenant (Super Admin only)
  app.delete("/api/super-admin/tenants/:id", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteTenant(req.params.id);
      
      // Log the action
      await storage.createAuditLog({
        userId: req.user!.userId,
        action: "DELETE_TENANT",
        resourceType: "tenants",
        resourceId: req.params.id,
        tenantId: req.params.id
      });
      
      res.json({ message: "Empresa desactivada correctamente" });
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ error: "Error al desactivar empresa" });
    }
  });

  // Get all subscription plans (Super Admin only)
  app.get("/api/super-admin/plans", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error getting plans:", error);
      res.status(500).json({ error: "Error al obtener planes" });
    }
  });

  // Create subscription plan (Super Admin only)
  app.post("/api/super-admin/plans", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input - decimal fields validated as valid numeric strings
      const decimalSchema = z.union([
        z.number().transform(v => String(v)),
        z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Debe ser un número decimal válido")
      ]);
      
      const createPlanSchema = z.object({
        name: z.string().min(1, "Nombre es requerido"),
        code: z.string().min(1, "Código es requerido"),
        description: z.string().optional(),
        monthlyPrice: decimalSchema,
        yearlyPrice: decimalSchema.optional(),
        maxMachines: z.number().int().positive().optional(),
        maxUsers: z.number().int().positive().optional(),
        maxProducts: z.number().int().positive().optional(),
        maxLocations: z.number().int().positive().optional(),
        features: z.array(z.string()).optional()
      });
      
      const data = createPlanSchema.parse(req.body);
      
      const plan = await storage.createSubscriptionPlan(data);
      
      // Log the action (no tenantId for global plans)
      await storage.createAuditLog({
        userId: req.user!.userId,
        action: "CREATE_PLAN",
        resourceType: "subscription_plans",
        resourceId: plan.id,
        details: data
      });
      
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating plan:", error);
      res.status(500).json({ error: "Error al crear plan" });
    }
  });

  // Update subscription plan (Super Admin only)
  app.patch("/api/super-admin/plans/:id", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input - decimal fields validated as valid numeric strings
      const decimalSchema = z.union([
        z.number().transform(v => String(v)),
        z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Debe ser un número decimal válido")
      ]);
      
      const updatePlanSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        monthlyPrice: decimalSchema.optional(),
        yearlyPrice: decimalSchema.optional(),
        maxMachines: z.number().int().positive().optional(),
        maxUsers: z.number().int().positive().optional(),
        maxProducts: z.number().int().positive().optional(),
        maxLocations: z.number().int().positive().optional(),
        features: z.array(z.string()).optional(),
        isActive: z.boolean().optional()
      });
      
      const data = updatePlanSchema.parse(req.body);
      
      const updated = await storage.updateSubscriptionPlan(req.params.id, data);
      if (!updated) {
        return res.status(404).json({ error: "Plan no encontrado" });
      }
      
      // Log the action (no tenantId for global plans)
      await storage.createAuditLog({
        userId: req.user!.userId,
        action: "UPDATE_PLAN",
        resourceType: "subscription_plans",
        resourceId: req.params.id,
        details: data
      });
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating plan:", error);
      res.status(500).json({ error: "Error al actualizar plan" });
    }
  });

  // Get audit logs (Super Admin only)
  app.get("/api/super-admin/audit-logs", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error getting audit logs:", error);
      res.status(500).json({ error: "Error al obtener logs de auditoría" });
    }
  });

  // Get all platform users (Super Admin only)
  app.get("/api/super-admin/users", authenticateJWT, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get all users across all tenants
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        isSuperAdmin: users.isSuperAdmin,
        isActive: users.isActive,
        createdAt: users.createdAt,
        tenantId: users.tenantId
      }).from(users).orderBy(sql`${users.createdAt} DESC`);
      
      // Get tenant names for each user
      const tenantsMap = new Map<string, string>();
      const tenantsList = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
      tenantsList.forEach(t => tenantsMap.set(t.id, t.name));
      
      const usersWithTenants = allUsers.map(user => ({
        ...user,
        tenantName: user.tenantId ? tenantsMap.get(user.tenantId) || null : null
      }));
      
      res.json(usersWithTenants);
    } catch (error) {
      console.error("Error getting all users:", error);
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  // ==================== NAYAX INTEGRATION ====================

  // Get Nayax config for current tenant
  app.get("/api/nayax/config", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant no identificado" });
      
      const config = await db.select().from(nayaxConfigTable).where(eq(nayaxConfigTable.tenantId, tenantId)).limit(1);
      if (config.length === 0) {
        return res.json({ configured: false, isEnabled: false });
      }
      const { apiToken, ...safeConfig } = config[0];
      res.json({ configured: true, hasToken: !!apiToken, ...safeConfig });
    } catch (error) {
      console.error("Error getting Nayax config:", error);
      res.status(500).json({ error: "Error al obtener configuración de Nayax" });
    }
  });

  // Save/Update Nayax config
  app.post("/api/nayax/config", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant no identificado" });

      const { apiToken, isEnabled, syncIntervalMinutes, autoSyncSales, autoSyncMachines } = req.body;
      
      const existing = await db.select().from(nayaxConfigTable).where(eq(nayaxConfigTable.tenantId, tenantId)).limit(1);
      
      if (existing.length > 0) {
        const updateData: any = { updatedAt: new Date() };
        if (apiToken !== undefined) updateData.apiToken = apiToken;
        if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
        if (syncIntervalMinutes !== undefined) updateData.syncIntervalMinutes = syncIntervalMinutes;
        if (autoSyncSales !== undefined) updateData.autoSyncSales = autoSyncSales;
        if (autoSyncMachines !== undefined) updateData.autoSyncMachines = autoSyncMachines;
        
        await db.update(nayaxConfigTable).set(updateData).where(eq(nayaxConfigTable.tenantId, tenantId));
      } else {
        await db.insert(nayaxConfigTable).values({
          tenantId,
          apiToken: apiToken || null,
          isEnabled: isEnabled || false,
          syncIntervalMinutes: syncIntervalMinutes || 30,
          autoSyncSales: autoSyncSales !== false,
          autoSyncMachines: autoSyncMachines !== false,
        });
      }
      
      res.json({ success: true, message: "Configuración de Nayax guardada" });
    } catch (error) {
      console.error("Error saving Nayax config:", error);
      res.status(500).json({ error: "Error al guardar configuración de Nayax" });
    }
  });

  // Test Nayax connection
  app.post("/api/nayax/test-connection", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant no identificado" });

      const { apiToken } = req.body;
      
      let token = apiToken;
      if (!token) {
        token = await getNayaxToken(tenantId);
      }
      if (!token) {
        return res.status(400).json({ error: "No se ha configurado un token de API de Nayax" });
      }

      const result = await testNayaxConnection(token);
      res.json(result);
    } catch (error) {
      console.error("Error testing Nayax connection:", error);
      res.status(500).json({ error: "Error al probar conexión con Nayax" });
    }
  });

  // Get machines from Nayax
  app.get("/api/nayax/machines", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant no identificado" });

      const token = await getNayaxToken(tenantId);
      if (!token) {
        return res.status(400).json({ error: "No se ha configurado un token de API de Nayax" });
      }

      const nayaxMachines = await getAllNayaxMachines(token);
      res.json(nayaxMachines);
    } catch (error: any) {
      console.error("Error getting Nayax machines:", error);
      res.status(500).json({ error: error.message || "Error al obtener máquinas de Nayax" });
    }
  });

  // Get last sales from Nayax machine
  app.get("/api/nayax/machines/:nayaxMachineId/sales", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant no identificado" });

      const token = await getNayaxToken(tenantId);
      if (!token) {
        return res.status(400).json({ error: "No se ha configurado un token de API de Nayax" });
      }

      const nayaxMachineId = parseInt(req.params.nayaxMachineId);
      if (isNaN(nayaxMachineId)) {
        return res.status(400).json({ error: "ID de máquina Nayax inválido" });
      }

      const sales = await getNayaxMachineLastSales(token, nayaxMachineId);
      res.json(sales);
    } catch (error: any) {
      console.error("Error getting Nayax sales:", error);
      res.status(500).json({ error: error.message || "Error al obtener ventas de Nayax" });
    }
  });

  // Link a Dispensax machine with a Nayax machine
  app.post("/api/nayax/link-machine", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant no identificado" });

      const { dispensaxMachineId, nayaxMachineId, nayaxDeviceSerial } = req.body;

      if (!dispensaxMachineId || !nayaxMachineId) {
        return res.status(400).json({ error: "Se requiere ID de máquina Dispensax y Nayax" });
      }

      const machine = await storage.getMachine(dispensaxMachineId);
      if (!machine || machine.tenantId !== tenantId) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }

      await db.update(machines).set({
        nayaxMachineId: parseInt(nayaxMachineId),
        nayaxDeviceSerial: nayaxDeviceSerial || null,
        nayaxLinkedAt: new Date(),
      }).where(and(eq(machines.id, dispensaxMachineId), eq(machines.tenantId, tenantId)));

      res.json({ success: true, message: "Máquina vinculada con Nayax exitosamente" });
    } catch (error) {
      console.error("Error linking machine:", error);
      res.status(500).json({ error: "Error al vincular máquina" });
    }
  });

  // Unlink a Dispensax machine from Nayax
  app.post("/api/nayax/unlink-machine", authenticateJWT, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant no identificado" });

      const { dispensaxMachineId } = req.body;
      if (!dispensaxMachineId) {
        return res.status(400).json({ error: "Se requiere ID de máquina" });
      }

      const machine = await storage.getMachine(dispensaxMachineId);
      if (!machine || machine.tenantId !== tenantId) {
        return res.status(404).json({ error: "Máquina no encontrada" });
      }

      await db.update(machines).set({
        nayaxMachineId: null,
        nayaxDeviceSerial: null,
        nayaxLinkedAt: null,
      }).where(and(eq(machines.id, dispensaxMachineId), eq(machines.tenantId, tenantId)));

      res.json({ success: true, message: "Máquina desvinculada de Nayax" });
    } catch (error) {
      console.error("Error unlinking machine:", error);
      res.status(500).json({ error: "Error al desvincular máquina" });
    }
  });

  // Get linked machines summary (Dispensax machines with their Nayax info)
  app.get("/api/nayax/linked-machines", authenticateJWT, authorizeRoles("admin", "supervisor"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant no identificado" });

      const linkedMachines = await db.select().from(machines)
        .where(and(
          eq(machines.tenantId, tenantId),
          sql`${machines.nayaxMachineId} IS NOT NULL`
        ));

      res.json(linkedMachines);
    } catch (error) {
      console.error("Error getting linked machines:", error);
      res.status(500).json({ error: "Error al obtener máquinas vinculadas" });
    }
  });

  // ==================== VISORES DE ESTABLECIMIENTO ====================

  // Helper to verify establishment viewer tenant ownership
  async function verifyEstablishmentViewerTenant(viewerId: string, tenantId: string | undefined, isSuperAdmin: boolean): Promise<boolean> {
    if (isSuperAdmin) return true;
    const viewer = await storage.getEstablishmentViewer(viewerId);
    return viewer ? viewer.tenantId === tenantId : false;
  }

  // List all viewers (tenant-scoped)
  app.get("/api/establishment-viewers", authenticateJWT, authorizeAction("establishment_viewers", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.isSuperAdmin ? (req.query.tenantId as string | undefined) : req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant no válido" });
      }
      
      const viewers = await storage.getEstablishmentViewers(tenantId);
      
      // Enrich with user details and assignments
      const enrichedViewers = await Promise.all(viewers.map(async (viewer) => {
        const user = await storage.getUser(viewer.userId);
        const assignments = await storage.getMachineViewerAssignments(viewer.id);
        
        // Get machine details for each assignment
        const assignmentsWithMachines = await Promise.all(assignments.map(async (assignment) => {
          const machine = await storage.getMachine(assignment.machineId);
          return {
            ...assignment,
            machine: machine ? { id: machine.id, code: machine.code, name: machine.name, location: machine.location } : null
          };
        }));
        
        return {
          ...viewer,
          user: user ? { id: user.id, username: user.username, email: user.email, fullName: user.fullName } : null,
          assignments: assignmentsWithMachines
        };
      }));
      
      res.json(enrichedViewers);
    } catch (error) {
      console.error("Error getting establishment viewers:", error);
      res.status(500).json({ error: "Error al obtener visores de establecimiento" });
    }
  });

  // Get single viewer details
  app.get("/api/establishment-viewers/:id", authenticateJWT, authorizeAction("establishment_viewers", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const viewer = await storage.getEstablishmentViewer(req.params.id);
      if (!viewer) {
        return res.status(404).json({ error: "Visor no encontrado" });
      }
      
      if (!verifyTenantOwnership(viewer.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(403).json({ error: "No tienes acceso a este visor" });
      }
      
      const user = await storage.getUser(viewer.userId);
      const assignments = await storage.getMachineViewerAssignments(viewer.id);
      
      const assignmentsWithMachines = await Promise.all(assignments.map(async (assignment) => {
        const machine = await storage.getMachine(assignment.machineId);
        return {
          ...assignment,
          machine: machine ? { id: machine.id, code: machine.code, name: machine.name, location: machine.location } : null
        };
      }));
      
      res.json({
        ...viewer,
        user: user ? { id: user.id, username: user.username, email: user.email, fullName: user.fullName } : null,
        assignments: assignmentsWithMachines
      });
    } catch (error) {
      console.error("Error getting establishment viewer:", error);
      res.status(500).json({ error: "Error al obtener visor de establecimiento" });
    }
  });

  // Create viewer (also creates user with visor_establecimiento role)
  app.post("/api/establishment-viewers", authenticateJWT, authorizeAction("establishment_viewers", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant no válido" });
      }
      
      const createViewerSchema = z.object({
        establishmentName: z.string().min(1, "Nombre del establecimiento es requerido"),
        username: z.string().min(3, "Usuario debe tener al menos 3 caracteres"),
        password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
        email: z.string().email("Email no válido").optional(),
        fullName: z.string().optional(),
        phone: z.string().optional(),
        defaultCommissionPercent: z.string().optional().default("5.00"),
        notes: z.string().optional(),
        machineIds: z.array(z.string()).optional().default([])
      });
      
      const data = createViewerSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ error: "El nombre de usuario ya existe" });
      }
      
      // Create user with visor_establecimiento role
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        username: data.username,
        password: hashedPassword,
        email: data.email || null,
        fullName: data.fullName || data.establishmentName,
        phone: data.phone || null,
        role: "visor_establecimiento",
        tenantId: tenantId,
        isActive: true
      });
      
      // Create establishment viewer
      const viewer = await storage.createEstablishmentViewer({
        tenantId: tenantId,
        userId: user.id,
        establishmentName: data.establishmentName,
        defaultCommissionPercent: data.defaultCommissionPercent,
        notes: data.notes || null,
        isActive: true
      });
      
      // Create machine assignments if provided
      const assignments = [];
      for (const machineId of data.machineIds) {
        const machine = await storage.getMachine(machineId);
        if (machine && machine.tenantId === tenantId) {
          const assignment = await storage.createMachineViewerAssignment({
            tenantId: tenantId,
            viewerId: viewer.id,
            machineId: machineId,
            commissionPercent: data.defaultCommissionPercent,
            isActive: true
          });
          assignments.push(assignment);
        }
      }
      
      res.status(201).json({
        ...viewer,
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName },
        assignments
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating establishment viewer:", error);
      res.status(500).json({ error: "Error al crear visor de establecimiento" });
    }
  });

  // Update viewer
  app.patch("/api/establishment-viewers/:id", authenticateJWT, authorizeAction("establishment_viewers", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const viewer = await storage.getEstablishmentViewer(req.params.id);
      if (!viewer) {
        return res.status(404).json({ error: "Visor no encontrado" });
      }
      
      if (!verifyTenantOwnership(viewer.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(403).json({ error: "No tienes acceso a este visor" });
      }
      
      const updateViewerSchema = z.object({
        establishmentName: z.string().min(1).optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        defaultCommissionPercent: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional()
      });
      
      const data = updateViewerSchema.parse(req.body);
      
      const updated = await storage.updateEstablishmentViewer(req.params.id, data);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating establishment viewer:", error);
      res.status(500).json({ error: "Error al actualizar visor de establecimiento" });
    }
  });

  // Delete viewer (soft delete)
  app.delete("/api/establishment-viewers/:id", authenticateJWT, authorizeAction("establishment_viewers", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const viewer = await storage.getEstablishmentViewer(req.params.id);
      if (!viewer) {
        return res.status(404).json({ error: "Visor no encontrado" });
      }
      
      if (!verifyTenantOwnership(viewer.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(403).json({ error: "No tienes acceso a este visor" });
      }
      
      await storage.deleteEstablishmentViewer(req.params.id);
      res.json({ success: true, message: "Visor desactivado correctamente" });
    } catch (error) {
      console.error("Error deleting establishment viewer:", error);
      res.status(500).json({ error: "Error al eliminar visor de establecimiento" });
    }
  });

  // Assign machines to viewer
  app.post("/api/establishment-viewers/:id/assignments", authenticateJWT, authorizeAction("establishment_viewers", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const viewer = await storage.getEstablishmentViewer(req.params.id);
      if (!viewer) {
        return res.status(404).json({ error: "Visor no encontrado" });
      }
      
      if (!verifyTenantOwnership(viewer.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(403).json({ error: "No tienes acceso a este visor" });
      }
      
      const assignSchema = z.object({
        machineIds: z.array(z.string()).min(1, "Debe proporcionar al menos una máquina"),
        commissionPercent: z.string().optional()
      });
      
      const data = assignSchema.parse(req.body);
      const commissionPercent = data.commissionPercent || viewer.defaultCommissionPercent || "5.00";
      
      // Get existing assignments to avoid duplicates
      const existingAssignments = await storage.getMachineViewerAssignments(viewer.id);
      const existingMachineIds = existingAssignments.map(a => a.machineId);
      
      const newAssignments = [];
      for (const machineId of data.machineIds) {
        if (!existingMachineIds.includes(machineId)) {
          const machine = await storage.getMachine(machineId);
          if (machine && machine.tenantId === viewer.tenantId) {
            const assignment = await storage.createMachineViewerAssignment({
              tenantId: viewer.tenantId,
              viewerId: viewer.id,
              machineId: machineId,
              commissionPercent: commissionPercent,
              isActive: true
            });
            newAssignments.push(assignment);
          }
        }
      }
      
      res.status(201).json(newAssignments);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error assigning machines to viewer:", error);
      res.status(500).json({ error: "Error al asignar máquinas al visor" });
    }
  });

  // Remove machine assignment
  app.delete("/api/establishment-viewers/:viewerId/assignments/:assignmentId", authenticateJWT, authorizeAction("establishment_viewers", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const viewer = await storage.getEstablishmentViewer(req.params.viewerId);
      if (!viewer) {
        return res.status(404).json({ error: "Visor no encontrado" });
      }
      
      if (!verifyTenantOwnership(viewer.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(403).json({ error: "No tienes acceso a este visor" });
      }
      
      const assignment = await storage.getMachineViewerAssignment(req.params.assignmentId);
      if (!assignment || assignment.viewerId !== viewer.id) {
        return res.status(404).json({ error: "Asignación no encontrada" });
      }
      
      await storage.deleteMachineViewerAssignment(req.params.assignmentId);
      res.json({ success: true, message: "Asignación eliminada correctamente" });
    } catch (error) {
      console.error("Error removing machine assignment:", error);
      res.status(500).json({ error: "Error al eliminar asignación" });
    }
  });

  // Update commission percent for assignment
  app.patch("/api/establishment-viewers/:viewerId/assignments/:assignmentId", authenticateJWT, authorizeAction("establishment_viewers", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const viewer = await storage.getEstablishmentViewer(req.params.viewerId);
      if (!viewer) {
        return res.status(404).json({ error: "Visor no encontrado" });
      }
      
      if (!verifyTenantOwnership(viewer.tenantId, req.user?.tenantId, req.user?.isSuperAdmin || false)) {
        return res.status(403).json({ error: "No tienes acceso a este visor" });
      }
      
      const assignment = await storage.getMachineViewerAssignment(req.params.assignmentId);
      if (!assignment || assignment.viewerId !== viewer.id) {
        return res.status(404).json({ error: "Asignación no encontrada" });
      }
      
      const updateSchema = z.object({
        commissionPercent: z.string().regex(/^\d+(\.\d{1,2})?$/, "Porcentaje de comisión inválido")
      });
      
      const data = updateSchema.parse(req.body);
      
      const updated = await storage.updateMachineViewerAssignment(req.params.assignmentId, {
        commissionPercent: data.commissionPercent
      });
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating commission:", error);
      res.status(500).json({ error: "Error al actualizar comisión" });
    }
  });

  // ==================== VIEWER INVITE FLOW ====================

  // Create viewer invite
  app.post("/api/viewer-invites", authenticateJWT, authorizeAction("establishment_viewers", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant no válido" });
      }
      
      const inviteSchema = z.object({
        email: z.string().email("Email no válido"),
        establishmentName: z.string().min(1, "Nombre del establecimiento es requerido"),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        machineIds: z.array(z.string()).min(1, "Debe asignar al menos una máquina"),
        commissionPercent: z.string().optional().default("5.00")
      });
      
      const data = inviteSchema.parse(req.body);
      
      // Verify all machines belong to this tenant
      for (const machineId of data.machineIds) {
        const machine = await storage.getMachine(machineId);
        if (!machine || machine.tenantId !== tenantId) {
          return res.status(400).json({ error: `Máquina ${machineId} no encontrada o no pertenece a este tenant` });
        }
      }
      
      // Generate unique token
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      
      // Create invite with metadata
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
      
      const invite = await storage.createTenantInvite({
        tenantId: tenantId,
        email: data.email,
        role: "visor_establecimiento",
        token: token,
        invitedBy: req.user!.userId,
        metadata: {
          viewerType: "establishment",
          establishmentName: data.establishmentName,
          contactName: data.contactName || "",
          phone: data.phone || "",
          machineIds: data.machineIds,
          commissionPercent: data.commissionPercent
        },
        expiresAt: expiresAt
      });
      
      res.status(201).json({
        ...invite,
        inviteUrl: `/invite/${token}`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating viewer invite:", error);
      res.status(500).json({ error: "Error al crear invitación" });
    }
  });

  // Accept viewer invite
  app.post("/api/viewer-invites/:token/accept", async (req: Request, res: Response) => {
    try {
      const acceptSchema = z.object({
        username: z.string().min(3, "Usuario debe tener al menos 3 caracteres"),
        password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
        fullName: z.string().optional()
      });
      
      const data = acceptSchema.parse(req.body);
      
      // Get invite by token
      const invite = await storage.getTenantInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ error: "Invitación no encontrada" });
      }
      
      // Check if already accepted
      if (invite.acceptedAt) {
        return res.status(400).json({ error: "Esta invitación ya fue aceptada" });
      }
      
      // Check if expired
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ error: "Esta invitación ha expirado" });
      }
      
      // Verify it's a viewer invite
      if (invite.role !== "visor_establecimiento") {
        return res.status(400).json({ error: "Este endpoint es solo para invitaciones de visor" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ error: "El nombre de usuario ya existe" });
      }
      
      // Extract metadata
      const metadata = invite.metadata as {
        viewerType: string;
        establishmentName: string;
        contactName?: string;
        phone?: string;
        machineIds: string[];
        commissionPercent: string;
      } | null;
      
      if (!metadata || metadata.viewerType !== "establishment") {
        return res.status(400).json({ error: "Datos de invitación inválidos" });
      }
      
      // Create user
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        username: data.username,
        password: hashedPassword,
        email: invite.email,
        fullName: data.fullName || metadata.establishmentName,
        role: "visor_establecimiento",
        tenantId: invite.tenantId,
        isActive: true
      });
      
      // Create establishment viewer
      const viewer = await storage.createEstablishmentViewer({
        tenantId: invite.tenantId,
        userId: user.id,
        establishmentName: metadata.establishmentName,
        defaultCommissionPercent: metadata.commissionPercent,
        isActive: true
      });
      
      // Create machine assignments
      for (const machineId of metadata.machineIds) {
        await storage.createMachineViewerAssignment({
          tenantId: invite.tenantId,
          viewerId: viewer.id,
          machineId: machineId,
          commissionPercent: metadata.commissionPercent,
          isActive: true
        });
      }
      
      // Mark invite as accepted
      await storage.markTenantInviteAccepted(invite.id);
      
      res.json({
        success: true,
        message: "Cuenta creada exitosamente",
        viewer: {
          ...viewer,
          user: { id: user.id, username: user.username, email: user.email }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error accepting viewer invite:", error);
      res.status(500).json({ error: "Error al aceptar invitación" });
    }
  });

  // ==================== VIEWER SALES DASHBOARD ====================

  // Get assigned machines for current viewer
  app.get("/api/viewer/my-machines", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user?.role !== "visor_establecimiento") {
        return res.status(403).json({ error: "Este endpoint es solo para visores de establecimiento" });
      }
      
      const viewer = await storage.getEstablishmentViewerByUserId(req.user.userId);
      if (!viewer) {
        return res.status(404).json({ error: "No se encontró visor para este usuario" });
      }
      
      const assignments = await storage.getMachineViewerAssignments(viewer.id);
      
      const machinesWithDetails = await Promise.all(assignments.map(async (assignment) => {
        const machine = await storage.getMachine(assignment.machineId);
        return {
          assignmentId: assignment.id,
          machineId: assignment.machineId,
          commissionPercent: assignment.commissionPercent,
          machine: machine ? {
            id: machine.id,
            code: machine.code,
            name: machine.name,
            status: machine.status,
            zone: machine.zone
          } : null
        };
      }));
      
      res.json({
        viewer: {
          id: viewer.id,
          establishmentName: viewer.establishmentName,
          defaultCommissionPercent: viewer.defaultCommissionPercent
        },
        machines: machinesWithDetails.filter(m => m.machine !== null)
      });
    } catch (error) {
      console.error("Error getting viewer machines:", error);
      res.status(500).json({ error: "Error al obtener máquinas asignadas" });
    }
  });

  // Get sales summary with commissions
  app.get("/api/viewer/sales-summary", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user?.role !== "visor_establecimiento") {
        return res.status(403).json({ error: "Este endpoint es solo para visores de establecimiento" });
      }
      
      const viewer = await storage.getEstablishmentViewerByUserId(req.user.userId);
      if (!viewer) {
        return res.status(404).json({ error: "No se encontró visor para este usuario" });
      }
      
      // Parse date filters
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (startDateStr) {
        startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);
      }
      
      if (endDateStr) {
        endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
      }
      
      // If no dates provided, default to current month
      if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      
      const assignments = await storage.getMachineViewerAssignments(viewer.id);
      
      let totalSales = 0;
      let totalCommission = 0;
      
      const machinesSummary = await Promise.all(assignments.map(async (assignment) => {
        const machine = await storage.getMachine(assignment.machineId);
        if (!machine) return null;
        
        // Get sales for this machine in the date range
        const sales = await storage.getMachineSales(assignment.machineId, startDate, endDate);
        
        const machineTotalSales = sales.reduce((sum, sale) => {
          return sum + parseFloat(sale.totalAmount?.toString() || "0");
        }, 0);
        
        const commissionPercent = parseFloat(assignment.commissionPercent || viewer.defaultCommissionPercent || "5.00");
        const machineCommission = machineTotalSales * (commissionPercent / 100);
        
        totalSales += machineTotalSales;
        totalCommission += machineCommission;
        
        return {
          id: assignment.id,
          machineId: machine.id,
          machineName: machine.name || machine.code || machine.id,
          machineCode: machine.code || machine.id,
          location: machine.location || "",
          totalSales: machineTotalSales,
          commissionPercent: commissionPercent,
          commission: machineCommission,
          salesCount: sales.length
        };
      }));
      
      res.json({
        viewer: {
          id: viewer.id,
          establishmentName: viewer.establishmentName
        },
        dateRange: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString()
        },
        machines: machinesSummary.filter(m => m !== null),
        totalSales: totalSales,
        totalCommission: totalCommission
      });
    } catch (error) {
      console.error("Error getting viewer sales summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de ventas" });
    }
  });

  // =====================
  // TIPOS DE MÁQUINA
  // =====================

  app.get("/api/machine-types", authenticateJWT, requireTenant, authorizeAction("settings", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      await storage.seedDefaultMachineTypes(tenantId);
      const includeInactive = req.query.all === "true" && (req.user!.role === "admin" || req.user!.isSuperAdmin);
      const types = await storage.getMachineTypeOptions(tenantId, includeInactive);
      res.json(types);
    } catch (error) {
      console.error("Error getting machine types:", error);
      res.status(500).json({ error: "Error al obtener tipos de máquina" });
    }
  });

  app.post("/api/machine-types", authenticateJWT, requireTenant, authorizeAction("settings", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const data = insertMachineTypeOptionSchema.omit({ tenantId: true }).parse(req.body);
      const existing = await db.select({ id: machineTypeOptionsTable.id })
        .from(machineTypeOptionsTable)
        .where(and(eq(machineTypeOptionsTable.tenantId, tenantId), eq(machineTypeOptionsTable.value, data.value)))
        .limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "Ya existe un tipo con ese identificador" });
      }
      const allTypes = await storage.getMachineTypeOptions(tenantId, true);
      const nextOrder = allTypes.length > 0 ? Math.max(...allTypes.map(t => t.sortOrder ?? 0)) + 1 : 0;
      const created = await storage.createMachineTypeOption({ ...data, tenantId, sortOrder: nextOrder });
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating machine type:", error);
      res.status(500).json({ error: "Error al crear tipo de máquina" });
    }
  });

  app.patch("/api/machine-types/:id", authenticateJWT, requireTenant, authorizeAction("settings", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const existing = await db.select().from(machineTypeOptionsTable).where(eq(machineTypeOptionsTable.id, id)).limit(1);
      if (!existing[0] || existing[0].tenantId !== tenantId) {
        return res.status(404).json({ error: "Tipo de máquina no encontrado" });
      }
      const data = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
      const updated = await storage.updateMachineTypeOption(id, data);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating machine type:", error);
      res.status(500).json({ error: "Error al actualizar tipo de máquina" });
    }
  });

  app.post("/api/machine-types/:id/toggle", authenticateJWT, requireTenant, authorizeAction("settings", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const existing = await db.select().from(machineTypeOptionsTable).where(eq(machineTypeOptionsTable.id, id)).limit(1);
      if (!existing[0] || existing[0].tenantId !== tenantId) {
        return res.status(404).json({ error: "Tipo de máquina no encontrado" });
      }
      const newActive = !existing[0].isActive;
      if (!newActive) {
        const machineCount = await db.select({ id: machines.id })
          .from(machines)
          .where(and(eq(machines.tenantId, tenantId), eq(machines.type, existing[0].value)))
          .limit(1);
        if (machineCount.length > 0) {
          return res.status(409).json({ error: "No se puede desactivar: hay máquinas usando este tipo" });
        }
      }
      const updated = await storage.updateMachineTypeOption(id, { isActive: newActive });
      res.json(updated);
    } catch (error) {
      console.error("Error toggling machine type:", error);
      res.status(500).json({ error: "Error al cambiar estado del tipo" });
    }
  });

  app.post("/api/machine-types/:id/reorder", authenticateJWT, requireTenant, authorizeAction("settings", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const { direction } = z.object({ direction: z.enum(["up", "down"]) }).parse(req.body);
      const allTypes = await storage.getMachineTypeOptions(tenantId, true);
      const idx = allTypes.findIndex(t => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: "Tipo de máquina no encontrado" });
      }
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= allTypes.length) {
        return res.json({ success: true });
      }
      const current = allTypes[idx];
      const swap = allTypes[swapIdx];
      await Promise.all([
        storage.updateMachineTypeOption(current.id, { sortOrder: swap.sortOrder ?? swapIdx }),
        storage.updateMachineTypeOption(swap.id, { sortOrder: current.sortOrder ?? idx }),
      ]);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error reordering machine type:", error);
      res.status(500).json({ error: "Error al reordenar tipos de máquina" });
    }
  });

  app.delete("/api/machine-types/:id", authenticateJWT, requireTenant, authorizeAction("settings", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const existing = await db.select().from(machineTypeOptionsTable).where(eq(machineTypeOptionsTable.id, id)).limit(1);
      if (!existing[0] || existing[0].tenantId !== tenantId) {
        return res.status(404).json({ error: "Tipo de máquina no encontrado" });
      }
      const machineCount = await db.select({ id: machines.id })
        .from(machines)
        .where(and(eq(machines.tenantId, tenantId), eq(machines.type, existing[0].value)))
        .limit(1);
      if (machineCount.length > 0) {
        return res.status(409).json({ error: "No se puede eliminar: hay máquinas usando este tipo" });
      }
      await storage.deleteMachineTypeOption(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting machine type:", error);
      res.status(500).json({ error: "Error al eliminar tipo de máquina" });
    }
  });

  // =====================
  // ESTABLECIMIENTOS (CRM Pipeline) ROUTES
  // =====================

  app.get("/api/establishment-stages", authenticateJWT, requireTenant, authorizeAction("establishments", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      await storage.seedDefaultEstablishmentStages(tenantId);
      const stages = await storage.getEstablishmentStages(tenantId);
      res.json(stages);
    } catch (error) {
      console.error("Error getting establishment stages:", error);
      res.status(500).json({ error: "Error al obtener etapas" });
    }
  });

  app.post("/api/establishment-stages", authenticateJWT, requireTenant, authorizeAction("establishments", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const data = insertEstablishmentStageSchema.parse({ ...req.body, tenantId });
      const created = await storage.createEstablishmentStage(data);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating stage:", error);
      res.status(500).json({ error: "Error al crear etapa" });
    }
  });

  app.patch("/api/establishment-stages/:id", authenticateJWT, requireTenant, authorizeAction("establishments", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const stages = await storage.getEstablishmentStages(tenantId);
      const stage = stages.find(s => s.id === req.params.id);
      if (!stage) {
        return res.status(404).json({ error: "Etapa no encontrada" });
      }
      const allowedFields = z.object({
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        sortOrder: z.coerce.number().optional(),
        isActive: z.boolean().optional(),
      });
      const data = allowedFields.parse(req.body);
      const [updated] = await db.update(establishmentStagesTable)
        .set(data)
        .where(eq(establishmentStagesTable.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating stage:", error);
      res.status(500).json({ error: "Error al actualizar etapa" });
    }
  });

  app.delete("/api/establishment-stages/:id", authenticateJWT, requireTenant, authorizeAction("establishments", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const stages = await storage.getEstablishmentStages(tenantId);
      const stage = stages.find(s => s.id === req.params.id);
      if (!stage) {
        return res.status(404).json({ error: "Etapa no encontrada" });
      }
      if (stage.isDefault) {
        return res.status(400).json({ error: "No se puede eliminar la etapa predeterminada" });
      }
      await db.update(establishmentStagesTable)
        .set({ isActive: false })
        .where(eq(establishmentStagesTable.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting stage:", error);
      res.status(500).json({ error: "Error al eliminar etapa" });
    }
  });

  app.get("/api/establishments", authenticateJWT, requireTenant, authorizeAction("establishments", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { stageId, priority, assignedUserId, search, page, pageSize } = req.query;
      const results = await storage.getEstablishments({
        tenantId,
        stageId: stageId as string | undefined,
        priority: priority as string | undefined,
        assignedUserId: assignedUserId as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      });
      res.json(results);
    } catch (error) {
      console.error("Error getting establishments:", error);
      res.status(500).json({ error: "Error al obtener establecimientos" });
    }
  });

  app.get("/api/establishments/stats", authenticateJWT, requireTenant, authorizeAction("establishments", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const stats = await storage.getEstablishmentStats(tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting establishment stats:", error);
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  app.get("/api/establishments/:id", authenticateJWT, requireTenant, authorizeAction("establishments", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const est = await storage.getEstablishment(req.params.id);
      if (!est || est.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      const [followups, documents] = await Promise.all([
        storage.getEstablishmentFollowups(req.params.id),
        storage.getEstablishmentDocuments(req.params.id),
      ]);
      res.json({ ...est, followups, documents });
    } catch (error) {
      console.error("Error getting establishment:", error);
      res.status(500).json({ error: "Error al obtener establecimiento" });
    }
  });

  app.post("/api/establishments", authenticateJWT, requireTenant, authorizeAction("establishments", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      await storage.seedDefaultEstablishmentStages(tenantId);

      const body = { ...req.body, tenantId };
      if (body.nextActionDate && typeof body.nextActionDate === "string") {
        body.nextActionDate = new Date(body.nextActionDate);
      } else if (!body.nextActionDate || body.nextActionDate === "") {
        delete body.nextActionDate;
      }
      if (!body.nextAction || body.nextAction === "") {
        delete body.nextAction;
      }
      const data = insertEstablishmentSchema.parse(body);

      if (data.stageId) {
        const stages = await storage.getEstablishmentStages(tenantId);
        if (!stages.find(s => s.id === data.stageId)) {
          return res.status(400).json({ error: "Etapa no válida para este tenant" });
        }
      } else {
        const stages = await storage.getEstablishmentStages(tenantId);
        const defaultStage = stages.find(s => s.isDefault) || stages[0];
        if (defaultStage) data.stageId = defaultStage.id;
      }

      if (data.assignedUserId) {
        const assignedUser = await storage.getUser(data.assignedUserId);
        if (!assignedUser || assignedUser.tenantId !== tenantId) {
          return res.status(400).json({ error: "Usuario asignado no válido para este tenant" });
        }
      }

      const created = await storage.createEstablishment(data);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating establishment:", error);
      res.status(500).json({ error: "Error al crear establecimiento" });
    }
  });

  const establishmentPatchSchema = z.object({
    name: z.string().min(1).optional(),
    businessType: z.string().optional(),
    status: z.string().optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().or(z.literal("")).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    zone: z.string().optional(),
    gpsCoordinates: z.string().optional(),
    priority: z.enum(["alta", "media", "baja"]).optional(),
    estimatedMachines: z.coerce.number().min(1).optional(),
    monthlyEstimatedSales: z.string().optional(),
    commissionPercent: z.string().optional(),
    nextAction: z.string().optional().nullable(),
    nextActionDate: z.string().optional().nullable(),
    notes: z.string().optional(),
    stageId: z.string().optional(),
    assignedUserId: z.string().optional(),
  });

  app.patch("/api/establishments/:id", authenticateJWT, requireTenant, authorizeAction("establishments", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      const data = establishmentPatchSchema.parse(req.body);

      if (data.stageId) {
        const stages = await storage.getEstablishmentStages(tenantId);
        if (!stages.find(s => s.id === data.stageId)) {
          return res.status(400).json({ error: "Etapa no válida para este tenant" });
        }
      }
      if (data.assignedUserId) {
        const assignedUser = await storage.getUser(data.assignedUserId);
        if (!assignedUser || assignedUser.tenantId !== tenantId) {
          return res.status(400).json({ error: "Usuario asignado no válido para este tenant" });
        }
      }

      const updatePayload: Record<string, unknown> = { ...data };
      if (data.nextActionDate && data.nextActionDate !== "") {
        updatePayload.nextActionDate = new Date(data.nextActionDate);
      } else if (data.nextActionDate === null || data.nextActionDate === "") {
        updatePayload.nextActionDate = null;
      }
      if (data.nextAction === "") {
        updatePayload.nextAction = null;
      }

      const updated = await storage.updateEstablishment(req.params.id, updatePayload);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating establishment:", error);
      res.status(500).json({ error: "Error al actualizar establecimiento" });
    }
  });

  app.patch("/api/establishments/:id/stage", authenticateJWT, requireTenant, authorizeAction("establishments", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      const { stageId } = req.body;
      if (!stageId) return res.status(400).json({ error: "stageId requerido" });
      const tenantStages = await storage.getEstablishmentStages(tenantId);
      if (!tenantStages.find(s => s.id === stageId)) {
        return res.status(400).json({ error: "Etapa no válida" });
      }
      const updated = await storage.moveEstablishmentStage(req.params.id, stageId);
      res.json(updated);
    } catch (error) {
      console.error("Error moving establishment stage:", error);
      res.status(500).json({ error: "Error al cambiar etapa" });
    }
  });

  app.post("/api/establishments/:id/convert", authenticateJWT, requireTenant, authorizeAction("establishments", "approve"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      if (existing.convertedToLocationId) {
        return res.status(400).json({ error: "Este establecimiento ya fue convertido" });
      }
      const stages = await storage.getEstablishmentStages(tenantId);
      const currentStage = stages.find(s => s.id === existing.stageId);
      if (!currentStage || !currentStage.isConversionReady) {
        return res.status(400).json({ error: "El establecimiento no está en una etapa habilitada para conversión" });
      }
      const result = await storage.convertEstablishmentToLocation(req.params.id, tenantId);
      res.json(result);
    } catch (error: unknown) {
      console.error("Error converting establishment:", error);
      const msg = error instanceof Error ? error.message : "Error al convertir establecimiento";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/establishments/:id", authenticateJWT, requireTenant, authorizeAction("establishments", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      await storage.deleteEstablishment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting establishment:", error);
      res.status(500).json({ error: "Error al eliminar establecimiento" });
    }
  });

  // Followups
  app.get("/api/establishments/:id/followups", authenticateJWT, requireTenant, authorizeAction("establishments", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      const followups = await storage.getEstablishmentFollowups(req.params.id);
      res.json(followups);
    } catch (error) {
      console.error("Error getting followups:", error);
      res.status(500).json({ error: "Error al obtener seguimientos" });
    }
  });

  app.post("/api/establishments/:id/followups", authenticateJWT, requireTenant, authorizeAction("establishments", "create"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      const followupBody = { ...req.body, tenantId, establishmentId: req.params.id, userId: req.user!.userId };
      if (followupBody.nextFollowupDate && typeof followupBody.nextFollowupDate === "string") {
        followupBody.nextFollowupDate = new Date(followupBody.nextFollowupDate);
      } else if (!followupBody.nextFollowupDate || followupBody.nextFollowupDate === "") {
        delete followupBody.nextFollowupDate;
      }
      if (!followupBody.nextAction || followupBody.nextAction === "") {
        delete followupBody.nextAction;
      }
      const data = insertEstablishmentFollowupSchema.parse(followupBody);
      const created = await storage.createEstablishmentFollowup(data);
      res.json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error creating followup:", error);
      res.status(500).json({ error: "Error al crear seguimiento" });
    }
  });

  // Documents (with Object Storage)
  app.get("/api/establishments/:id/documents", authenticateJWT, requireTenant, authorizeAction("establishments", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      const docs = await storage.getEstablishmentDocuments(req.params.id);
      res.json(docs);
    } catch (error) {
      console.error("Error getting documents:", error);
      res.status(500).json({ error: "Error al obtener documentos" });
    }
  });

  const multer = (await import("multer")).default;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/establishments/:id/documents", authenticateJWT, requireTenant, authorizeAction("establishments", "create"), upload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }

      const file = (req as Express.Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.status(400).json({ error: "Archivo requerido" });
      }

      const { Client } = await import("@replit/object-storage");
      const objClient = new Client();
      const fileKey = `.private/${tenantId}/establishments/${req.params.id}/${Date.now()}_${file.originalname}`;

      await objClient.uploadFromBytes(fileKey, file.buffer);

      const documentType = req.body?.documentType || "otro";
      const doc = await storage.createEstablishmentDocument({
        tenantId,
        establishmentId: req.params.id,
        fileName: file.originalname,
        originalName: file.originalname,
        fileKey,
        fileSize: file.size,
        mimeType: file.mimetype,
        documentType,
        uploadedByUserId: req.user!.userId,
      });

      res.status(201).json(doc);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Error al subir documento" });
    }
  });

  app.patch("/api/establishments/:id/documents/:docId", authenticateJWT, requireTenant, authorizeAction("establishments", "edit"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }
      const docs = await storage.getEstablishmentDocuments(req.params.id);
      const doc = docs.find((d) => d.id === req.params.docId);
      if (!doc) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }
      const docUpdateSchema = z.object({
        status: z.enum(["pendiente", "enviado", "recibido", "firmado", "rechazado"]).optional(),
        documentType: z.string().optional(),
        notes: z.string().optional(),
      });
      const data = docUpdateSchema.parse(req.body);
      const [updated] = await db.update(establishmentDocsTable)
        .set(data)
        .where(eq(establishmentDocsTable.id, req.params.docId))
        .returning();
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Error updating document:", error);
      res.status(500).json({ error: "Error al actualizar documento" });
    }
  });

  app.delete("/api/establishments/:id/documents/:docId", authenticateJWT, requireTenant, authorizeAction("establishments", "delete"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }

      const docs = await storage.getEstablishmentDocuments(req.params.id);
      const doc = docs.find((d) => d.id === req.params.docId);
      if (!doc) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }

      try {
        const { Client } = await import("@replit/object-storage");
        const objClient = new Client();
        await objClient.delete(doc.fileKey);
      } catch (e) {
        console.warn("Could not delete file from storage:", e);
      }

      await storage.deleteEstablishmentDocument(req.params.docId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Error al eliminar documento" });
    }
  });

  app.get("/api/establishments/:id/documents/:docId/download", authenticateJWT, requireTenant, authorizeAction("establishments", "view"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const existing = await storage.getEstablishment(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: "Establecimiento no encontrado" });
      }

      const docs = await storage.getEstablishmentDocuments(req.params.id);
      const doc = docs.find((d) => d.id === req.params.docId);
      if (!doc) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }

      const { Client } = await import("@replit/object-storage");
      const objClient = new Client();
      const result = await objClient.downloadAsBytes(doc.fileKey);
      
      if (!result.ok) {
        return res.status(404).json({ error: "Archivo no encontrado en almacenamiento" });
      }

      res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName}"`);
      res.send(Buffer.from(result.value));
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ error: "Error al descargar documento" });
    }
  });

  return httpServer;
}
