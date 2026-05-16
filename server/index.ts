import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import { requestTimeout } from "./middleware";
import { startCacheUpdater } from "./cache";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { checkAndSendRouteAlerts } from "./routeAlertService";
import { tenants } from "@shared/schema";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(requestTimeout);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Backfill idempotente: inicializa standard_quantity para filas existentes.
// Tarea #92: la "carga estándar" requiere que cada item tenga un objetivo;
// si la columna fue añadida tras `db:push`, las filas viejas quedan en NULL.
async function backfillStandardQuantity() {
  try {
    const result = await db.execute(sql`
      UPDATE machine_inventory
      SET standard_quantity = COALESCE(max_capacity, 20)
      WHERE standard_quantity IS NULL
    `);
    const affected = (result as { rowCount?: number }).rowCount ?? 0;
    if (affected > 0) {
      log(`[backfill] standard_quantity inicializado en ${affected} filas`);
    }
  } catch (err) {
    log(`[backfill] error inicializando standard_quantity: ${(err as Error).message}`);
  }
}

// Backfill idempotente: inicializa tray_count y lanes_per_tray para máquinas existentes.
// Tarea #96: cada máquina necesita un layout para registrar cambios de carril
// y auditorías de bandejas; si las columnas fueron añadidas tras `db:push`,
// las filas viejas quedan en NULL.
async function backfillMachineLayout() {
  try {
    const result = await db.execute(sql`
      UPDATE machines
      SET tray_count = COALESCE(tray_count, 6),
          lanes_per_tray = COALESCE(lanes_per_tray, 8)
      WHERE tray_count IS NULL OR lanes_per_tray IS NULL
    `);
    const affected = (result as { rowCount?: number }).rowCount ?? 0;
    if (affected > 0) {
      log(`[backfill] layout (tray_count/lanes_per_tray) inicializado en ${affected} máquinas`);
    }
  } catch (err) {
    log(`[backfill] error inicializando layout de máquinas: ${(err as Error).message}`);
  }
}

(async () => {
  startCacheUpdater();
  await backfillStandardQuantity();
  await backfillMachineLayout();

  // Job periódico: verificar alertas SLA de rutas cada 30 minutos
  setInterval(async () => {
    try {
      const allTenants = await db.select({ id: tenants.id }).from(tenants);
      await Promise.allSettled(allTenants.map(t => checkAndSendRouteAlerts(t.id)));
    } catch (err) {
      console.error("[SLA-Rutas] Error en job periódico:", err);
    }
  }, 30 * 60 * 1000);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
