import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
  insertIssueReportSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

  app.get("/api/machines", async (req: Request, res: Response) => {
    try {
      const { status, zone } = req.query;
      const filters = {
        status: status as string | undefined,
        zone: zone as string | undefined,
      };
      const machines = await storage.getMachines(filters);
      
      const machinesWithDetails = await Promise.all(
        machines.map(async (machine) => {
          const details = await storage.getMachineWithDetails(machine.id);
          return details;
        })
      );
      
      res.json(machinesWithDetails);
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
      const alerts = await storage.getMachineAlerts(
        undefined,
        resolved === "true" ? true : resolved === "false" ? false : undefined
      );
      res.json(alerts);
    } catch (error) {
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
      const data = insertMachineVisitSchema.parse({
        ...req.body,
        machineId: req.params.id,
      });
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

  // Proveedores
  app.get("/api/suppliers", async (req: Request, res: Response) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener proveedores" });
    }
  });

  app.get("/api/suppliers/:id", async (req: Request, res: Response) => {
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

  app.post("/api/suppliers", async (req: Request, res: Response) => {
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

  app.patch("/api/suppliers/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/suppliers/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteSupplier(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar proveedor" });
    }
  });

  // Inventario de Almacén
  app.get("/api/warehouse/inventory", async (req: Request, res: Response) => {
    try {
      const inventory = await storage.getWarehouseInventory();
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener inventario de almacén" });
    }
  });

  app.get("/api/warehouse/low-stock", async (req: Request, res: Response) => {
    try {
      const lowStock = await storage.getLowStockAlerts();
      res.json(lowStock);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener alertas de stock bajo" });
    }
  });

  app.patch("/api/warehouse/inventory/:productId", async (req: Request, res: Response) => {
    try {
      const { quantity, minStock, maxStock, reorderPoint } = req.body;
      const inventory = await storage.updateWarehouseStock(req.params.productId, quantity);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al actualizar stock" });
    }
  });

  // Lotes de Productos
  app.get("/api/warehouse/lots", async (req: Request, res: Response) => {
    try {
      const { productId } = req.query;
      const lots = await storage.getProductLots(productId as string | undefined);
      res.json(lots);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener lotes" });
    }
  });

  app.get("/api/warehouse/lots/expiring", async (req: Request, res: Response) => {
    try {
      const { days } = req.query;
      const expiringLots = await storage.getExpiringLots(parseInt(days as string) || 30);
      res.json(expiringLots);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener lotes por vencer" });
    }
  });

  app.post("/api/warehouse/lots", async (req: Request, res: Response) => {
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

  // Movimientos (Kardex)
  app.get("/api/warehouse/movements", async (req: Request, res: Response) => {
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

  // Entrada de mercancía (compra)
  app.post("/api/warehouse/entry", async (req: Request, res: Response) => {
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
      });
      
      res.status(201).json(movement);
    } catch (error) {
      console.error("Error registering entry:", error);
      res.status(500).json({ error: "Error al registrar entrada" });
    }
  });

  // Salida hacia abastecedor
  app.post("/api/warehouse/exit", async (req: Request, res: Response) => {
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

  // Estadísticas del almacén
  app.get("/api/warehouse/stats", async (req: Request, res: Response) => {
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

  // ==================== MÓDULO ABASTECEDOR ====================

  // Rutas
  app.get("/api/supplier/routes", async (req: Request, res: Response) => {
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

  app.get("/api/supplier/routes/:id", async (req: Request, res: Response) => {
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

  app.get("/api/supplier/today-route/:userId", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/routes", async (req: Request, res: Response) => {
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

  app.patch("/api/supplier/routes/:id", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/routes/:id/start", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/routes/:id/complete", async (req: Request, res: Response) => {
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
  app.get("/api/supplier/routes/:routeId/stops", async (req: Request, res: Response) => {
    try {
      const stops = await storage.getRouteStops(req.params.routeId);
      res.json(stops);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener paradas" });
    }
  });

  app.get("/api/supplier/stops/:id", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/routes/:routeId/stops", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/stops/:id/start", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/stops/:id/complete", async (req: Request, res: Response) => {
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

  // Registros de Servicio
  app.get("/api/supplier/services", async (req: Request, res: Response) => {
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

  app.get("/api/supplier/services/:id", async (req: Request, res: Response) => {
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

  app.get("/api/supplier/active-service/:userId", async (req: Request, res: Response) => {
    try {
      const service = await storage.getActiveService(req.params.userId);
      res.json(service || null);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener servicio activo" });
    }
  });

  app.post("/api/supplier/services", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/services/:id/end", async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;
      const service = await storage.endService(req.params.id, notes);
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: "Error al finalizar servicio" });
    }
  });

  // Recolección de Efectivo
  app.get("/api/supplier/cash", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/cash", async (req: Request, res: Response) => {
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

  app.get("/api/supplier/cash/summary/:userId", async (req: Request, res: Response) => {
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
  app.get("/api/supplier/loads", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/loads", async (req: Request, res: Response) => {
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
  app.get("/api/supplier/issues", async (req: Request, res: Response) => {
    try {
      const { machineId, status } = req.query;
      const issues = await storage.getIssueReports(
        machineId as string | undefined,
        status as string | undefined
      );
      res.json(issues);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener reportes" });
    }
  });

  app.get("/api/supplier/issues/:id", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/issues", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/issues/:id/resolve", async (req: Request, res: Response) => {
    try {
      const { userId, resolution } = req.body;
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
  app.get("/api/supplier/inventory/:userId", async (req: Request, res: Response) => {
    try {
      const inventory = await storage.getSupplierInventory(req.params.userId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener inventario del abastecedor" });
    }
  });

  app.post("/api/supplier/inventory/load", async (req: Request, res: Response) => {
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

  app.post("/api/supplier/inventory/unload", async (req: Request, res: Response) => {
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

  // Estadísticas del Abastecedor
  app.get("/api/supplier/stats/:userId", async (req: Request, res: Response) => {
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
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  return httpServer;
}
