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
  insertCalendarEventSchema
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

  // Transferencias de Productos
  app.get("/api/product-transfers", async (req: Request, res: Response) => {
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

  app.get("/api/product-transfers/:id", async (req: Request, res: Response) => {
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

  app.post("/api/product-transfers", async (req: Request, res: Response) => {
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

  // Mermas
  app.get("/api/shrinkage", async (req: Request, res: Response) => {
    try {
      const { type, productId, status } = req.query;
      const filters = {
        type: type as string | undefined,
        productId: productId as string | undefined,
        status: status as string | undefined,
      };
      const records = await storage.getShrinkageRecords(filters);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener mermas" });
    }
  });

  app.get("/api/shrinkage/summary", async (req: Request, res: Response) => {
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

  app.get("/api/shrinkage/:id", async (req: Request, res: Response) => {
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

  app.post("/api/shrinkage", async (req: Request, res: Response) => {
    try {
      const data = insertShrinkageRecordSchema.parse(req.body);
      const record = await storage.createShrinkageRecord(data);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Error al registrar merma" });
    }
  });

  app.post("/api/shrinkage/:id/approve", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Falta el usuario que aprueba" });
      }
      const record = await storage.approveShrinkage(req.params.id, userId);
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

  // ==================== MÓDULO COMPRAS ====================

  // Órdenes de Compra
  app.get("/api/purchase-orders", async (req: Request, res: Response) => {
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

  app.get("/api/purchase-orders/next-number", async (req: Request, res: Response) => {
    try {
      const orderNumber = await storage.getNextOrderNumber();
      res.json({ orderNumber });
    } catch (error) {
      res.status(500).json({ error: "Error al generar número de orden" });
    }
  });

  app.get("/api/purchase-orders/stats", async (req: Request, res: Response) => {
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

  app.get("/api/purchase-orders/low-stock", async (req: Request, res: Response) => {
    try {
      const products = await storage.getLowStockProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener productos con bajo stock" });
    }
  });

  app.get("/api/purchase-orders/:id", async (req: Request, res: Response) => {
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

  app.post("/api/purchase-orders", async (req: Request, res: Response) => {
    try {
      const data = insertPurchaseOrderSchema.omit({ orderNumber: true }).parse(req.body);
      const orderNumber = await storage.getNextOrderNumber();
      const order = await storage.createPurchaseOrder({
        ...data,
        orderNumber
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

  app.patch("/api/purchase-orders/:id", async (req: Request, res: Response) => {
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

  app.patch("/api/purchase-orders/:id/status", async (req: Request, res: Response) => {
    try {
      const statusSchema = z.object({
        status: z.enum(["borrador", "enviada", "parcialmente_recibida", "recibida", "cancelada"]),
        userId: z.string().optional(),
        reason: z.string().optional()
      });
      const { status, userId, reason } = statusSchema.parse(req.body);
      const order = await storage.updatePurchaseOrderStatus(req.params.id, status, userId, reason);
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

  app.delete("/api/purchase-orders/:id", async (req: Request, res: Response) => {
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
  app.get("/api/purchase-orders/:id/items", async (req: Request, res: Response) => {
    try {
      const items = await storage.getPurchaseOrderItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener items de la orden" });
    }
  });

  app.post("/api/purchase-orders/:id/items", async (req: Request, res: Response) => {
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

  app.patch("/api/purchase-order-items/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/purchase-order-items/:id", async (req: Request, res: Response) => {
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
  app.get("/api/purchase-receptions", async (req: Request, res: Response) => {
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

  app.get("/api/purchase-receptions/next-number", async (req: Request, res: Response) => {
    try {
      const receptionNumber = await storage.getNextReceptionNumber();
      res.json({ receptionNumber });
    } catch (error) {
      res.status(500).json({ error: "Error al generar número de recepción" });
    }
  });

  app.get("/api/purchase-receptions/:id", async (req: Request, res: Response) => {
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

  app.post("/api/purchase-receptions", async (req: Request, res: Response) => {
    try {
      const bodySchema = z.object({
        reception: insertPurchaseReceptionSchema.omit({ receptionNumber: true }),
        items: z.array(insertReceptionItemSchema.omit({ receptionId: true }))
      });
      const { reception, items } = bodySchema.parse(req.body);
      const receptionNumber = await storage.getNextReceptionNumber();
      
      const newReception = await storage.createPurchaseReception(
        { ...reception, receptionNumber },
        items
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
  app.get("/api/suppliers/:id/purchase-history", async (req: Request, res: Response) => {
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
  app.get("/api/vehicles", async (req: Request, res: Response) => {
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

  app.get("/api/vehicles/:id", async (req: Request, res: Response) => {
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

  app.post("/api/vehicles", async (req: Request, res: Response) => {
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

  app.patch("/api/vehicles/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/vehicles/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteVehicle(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar vehículo" });
    }
  });

  // Estadísticas de vehículo
  app.get("/api/vehicles/:id/fuel-stats", async (req: Request, res: Response) => {
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
  app.get("/api/fuel-records", async (req: Request, res: Response) => {
    try {
      const { vehicleId, userId, startDate, endDate, limit } = req.query;
      const records = await storage.getFuelRecords({
        vehicleId: vehicleId as string,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener registros de combustible" });
    }
  });

  app.get("/api/fuel-records/:id", async (req: Request, res: Response) => {
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

  app.post("/api/fuel-records", async (req: Request, res: Response) => {
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

  app.delete("/api/fuel-records/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteFuelRecord(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar registro de combustible" });
    }
  });

  // Estadísticas generales de combustible
  app.get("/api/fuel-stats", async (req: Request, res: Response) => {
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
  app.get("/api/users/:id/fuel-stats", async (req: Request, res: Response) => {
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
  app.get("/api/fuel-stats/by-route", async (req: Request, res: Response) => {
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
  app.get("/api/vehicles/low-mileage", async (req: Request, res: Response) => {
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
  app.get("/api/reports/overview", async (req: Request, res: Response) => {
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
  app.get("/api/reports/sales", async (req: Request, res: Response) => {
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
  app.get("/api/reports/purchases", async (req: Request, res: Response) => {
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
  app.get("/api/reports/fuel", async (req: Request, res: Response) => {
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
  app.get("/api/reports/petty-cash", async (req: Request, res: Response) => {
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
  app.get("/api/reports/machine-performance", async (req: Request, res: Response) => {
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
  app.get("/api/reports/top-products", async (req: Request, res: Response) => {
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
  app.get("/api/reports/supplier-ranking", async (req: Request, res: Response) => {
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
  app.get("/api/reports/export", async (req: Request, res: Response) => {
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
      res.json(records);
    } catch (error) {
      console.error("Error getting time tracking:", error);
      res.status(500).json({ error: "Error al obtener control de tiempos" });
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
      res.json(performance);
    } catch (error) {
      console.error("Error getting performance:", error);
      res.status(500).json({ error: "Error al obtener rendimiento" });
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
      const data = insertTaskSchema.parse(req.body);
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
      const data = insertTaskSchema.partial().parse(req.body);
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

  return httpServer;
}
