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
  insertProductLotSchema
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

  return httpServer;
}
