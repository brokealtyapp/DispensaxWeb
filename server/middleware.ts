import { Request, Response, NextFunction } from "express";

const CRITICAL_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/auth/refresh', '/api/auth/me'];
const CRITICAL_TIMEOUT_MS = 10000;
const NORMAL_TIMEOUT_MS = 30000;

export function requestTimeout(req: Request, res: Response, next: NextFunction): void {
  const isCritical = CRITICAL_PATHS.some(path => req.path.startsWith(path));
  const timeoutMs = isCritical ? CRITICAL_TIMEOUT_MS : NORMAL_TIMEOUT_MS;

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      timedOut = true;
      console.error(`[Timeout] Request ${req.method} ${req.path} excedió ${timeoutMs}ms`);
      res.status(503).json({ 
        error: "La solicitud tardó demasiado. Por favor intenta de nuevo.",
        timeout: true 
      });
    }
  }, timeoutMs);

  res.on('finish', () => clearTimeout(timeoutId));
  res.on('close', () => clearTimeout(timeoutId));

  (res as any).timedOut = () => timedOut;

  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    
    if (duration > 5000) {
      console.warn(`[SLOW] ${req.method} ${req.path} ${status} in ${duration}ms`);
    }
  });

  next();
}
