import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";

if (!process.env.SESSION_SECRET) {
  throw new Error("CRITICAL: SESSION_SECRET environment variable is required for security. Please set it before starting the application.");
}

const JWT_SECRET = process.env.SESSION_SECRET;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export function signAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(64).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return { token, hash, expiresAt };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de acceso requerido" });
  }
  
  const token = authHeader.split(" ")[1];
  const payload = verifyAccessToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
  
  req.user = payload;
  next();
}

export function authorizeRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tienes permiso para acceder a este recurso" });
    }
    
    next();
  };
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}

/**
 * Middleware que valida propiedad de datos: 
 * - Admin y Supervisor pueden ver datos de cualquier usuario
 * - Abastecedor solo puede ver sus propios datos
 * @param paramName - Nombre del parámetro de ruta que contiene el userId (default: 'userId')
 */
export function authorizeOwnership(paramName: string = "userId") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    
    const targetUserId = req.params[paramName];
    const currentUserId = req.user.userId;
    const currentRole = req.user.role;
    
    // Admin y supervisor pueden ver datos de cualquier usuario
    if (currentRole === "admin" || currentRole === "supervisor") {
      return next();
    }
    
    // Abastecedor solo puede ver sus propios datos
    if (targetUserId && targetUserId !== currentUserId) {
      return res.status(403).json({ 
        error: "No tienes permiso para acceder a datos de otro usuario" 
      });
    }
    
    next();
  };
}

/**
 * Helper para obtener el userId efectivo para consultas:
 * - Si es admin/supervisor, usa el userId del parámetro (o todos si no hay)
 * - Si es abastecedor, siempre usa su propio userId del token
 */
export function getEffectiveUserId(req: AuthenticatedRequest, paramName: string = "userId"): string | undefined {
  if (!req.user) return undefined;
  
  const targetUserId = req.params[paramName] || req.query[paramName] as string;
  const currentRole = req.user.role;
  
  // Admin y supervisor pueden consultar cualquier usuario
  if (currentRole === "admin" || currentRole === "supervisor") {
    return targetUserId || undefined; // undefined = todos
  }
  
  // Abastecedor siempre ve solo sus propios datos
  return req.user.userId;
}

export const REFRESH_TOKEN_COOKIE = "refreshToken";
export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

/**
 * Helper para obtener la zona asignada del supervisor actual.
 * Retorna undefined si el usuario no es supervisor o no tiene zona asignada.
 */
export async function getSupervisorZone(req: AuthenticatedRequest): Promise<string | undefined> {
  if (!req.user || req.user.role !== "supervisor") {
    return undefined;
  }
  
  const { storage } = await import("./storage");
  const fullUser = await storage.getUser(req.user.userId);
  return fullUser?.assignedZone || undefined;
}
