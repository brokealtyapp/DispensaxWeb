import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  role: text("role").default("abastecedor"),
  assignedZone: text("assigned_zone"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertEmployeeSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type User = typeof users.$inferSelect;

export const machineStatusEnum = pgEnum("machine_status", [
  "operando",
  "necesita_servicio", 
  "vacia",
  "fuera_de_linea",
  "mantenimiento"
]);

export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  zone: text("zone"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

export const productCategories = pgEnum("product_category", [
  "bebidas_frias",
  "bebidas_calientes",
  "snacks",
  "dulces",
  "otros"
]);

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").unique(),
  category: text("category").default("bebidas_frias"),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const machineTypes = pgEnum("machine_type", [
  "bebidas_frias",
  "bebidas_calientes",
  "snacks",
  "mixta"
]);

export const machines = pgTable("machines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").unique(),
  type: text("type").default("mixta"),
  status: text("status").default("operando"),
  locationId: varchar("location_id").references(() => locations.id),
  zone: text("zone"),
  lastVisit: timestamp("last_visit"),
  lastMaintenanceDate: timestamp("last_maintenance_date"),
  installationDate: timestamp("installation_date"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMachineSchema = createInsertSchema(machines).omit({
  id: true,
  createdAt: true,
});

export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type Machine = typeof machines.$inferSelect;

export const machineInventory = pgTable("machine_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  currentQuantity: integer("current_quantity").default(0),
  maxCapacity: integer("max_capacity").default(20),
  minLevel: integer("min_level").default(5),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertMachineInventorySchema = createInsertSchema(machineInventory).omit({
  id: true,
  lastUpdated: true,
});

export type InsertMachineInventory = z.infer<typeof insertMachineInventorySchema>;
export type MachineInventory = typeof machineInventory.$inferSelect;

export const alertTypes = pgEnum("alert_type", [
  "producto_agotado",
  "inventario_bajo",
  "falla_tecnica",
  "coin_box_llena",
  "poco_cambio",
  "mantenimiento_requerido"
]);

export const alertPriorities = pgEnum("alert_priority", [
  "baja",
  "media",
  "alta",
  "critica"
]);

export const machineAlerts = pgTable("machine_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  type: text("type").notNull(),
  priority: text("priority").default("media"),
  message: text("message").notNull(),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMachineAlertSchema = createInsertSchema(machineAlerts).omit({
  id: true,
  createdAt: true,
  isResolved: true,
  resolvedAt: true,
  resolvedBy: true,
});

export type InsertMachineAlert = z.infer<typeof insertMachineAlertSchema>;
export type MachineAlert = typeof machineAlerts.$inferSelect;

export const visitTypes = pgEnum("visit_type", [
  "abastecimiento",
  "mantenimiento",
  "reparacion",
  "limpieza",
  "recoleccion_dinero",
  "inspeccion"
]);

export const machineVisits = pgTable("machine_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  visitType: text("visit_type").default("abastecimiento"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  cashCollected: decimal("cash_collected", { precision: 10, scale: 2 }),
  productsLoaded: integer("products_loaded"),
  productsRemoved: integer("products_removed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMachineVisitSchema = createInsertSchema(machineVisits).omit({
  id: true,
  createdAt: true,
  endTime: true,
});

export type InsertMachineVisit = z.infer<typeof insertMachineVisitSchema>;
export type MachineVisit = typeof machineVisits.$inferSelect;

export const machineSales = pgTable("machine_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  productId: varchar("product_id").references(() => products.id),
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  saleDate: timestamp("sale_date").defaultNow(),
});

export const insertMachineSaleSchema = createInsertSchema(machineSales).omit({
  id: true,
  saleDate: true,
});

export type InsertMachineSale = z.infer<typeof insertMachineSaleSchema>;
export type MachineSale = typeof machineSales.$inferSelect;

export const machinesRelations = relations(machines, ({ one, many }) => ({
  location: one(locations, {
    fields: [machines.locationId],
    references: [locations.id],
  }),
  inventory: many(machineInventory),
  alerts: many(machineAlerts),
  visits: many(machineVisits),
  sales: many(machineSales),
}));

export const machineInventoryRelations = relations(machineInventory, ({ one }) => ({
  machine: one(machines, {
    fields: [machineInventory.machineId],
    references: [machines.id],
  }),
  product: one(products, {
    fields: [machineInventory.productId],
    references: [products.id],
  }),
}));

export const machineAlertsRelations = relations(machineAlerts, ({ one }) => ({
  machine: one(machines, {
    fields: [machineAlerts.machineId],
    references: [machines.id],
  }),
  resolvedByUser: one(users, {
    fields: [machineAlerts.resolvedBy],
    references: [users.id],
  }),
}));

export const machineVisitsRelations = relations(machineVisits, ({ one }) => ({
  machine: one(machines, {
    fields: [machineVisits.machineId],
    references: [machines.id],
  }),
  user: one(users, {
    fields: [machineVisits.userId],
    references: [users.id],
  }),
}));

export const machineSalesRelations = relations(machineSales, ({ one }) => ({
  machine: one(machines, {
    fields: [machineSales.machineId],
    references: [machines.id],
  }),
  product: one(products, {
    fields: [machineSales.productId],
    references: [products.id],
  }),
}));

// ==================== MÓDULO ALMACÉN ====================

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").unique(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  city: text("city"),
  taxId: text("tax_id"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export const warehouseInventory = pgTable("warehouse_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  currentStock: integer("current_stock").default(0),
  minStock: integer("min_stock").default(10),
  maxStock: integer("max_stock").default(100),
  reorderPoint: integer("reorder_point").default(20),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertWarehouseInventorySchema = createInsertSchema(warehouseInventory).omit({
  id: true,
  lastUpdated: true,
});

export type InsertWarehouseInventory = z.infer<typeof insertWarehouseInventorySchema>;
export type WarehouseInventory = typeof warehouseInventory.$inferSelect;

export const productLots = pgTable("product_lots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  lotNumber: text("lot_number").notNull(),
  quantity: integer("quantity").notNull(),
  remainingQuantity: integer("remaining_quantity").notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  expirationDate: timestamp("expiration_date"),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  purchaseDate: timestamp("purchase_date").defaultNow(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductLotSchema = createInsertSchema(productLots).omit({
  id: true,
  createdAt: true,
  remainingQuantity: true,
});

export type InsertProductLot = z.infer<typeof insertProductLotSchema>;
export type ProductLot = typeof productLots.$inferSelect;

export const movementTypes = pgEnum("movement_type", [
  "entrada_compra",
  "entrada_devolucion",
  "salida_abastecedor",
  "salida_merma",
  "salida_caducidad",
  "salida_danio",
  "ajuste_inventario",
  "transferencia"
]);

export const warehouseMovements = pgTable("warehouse_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  lotId: varchar("lot_id").references(() => productLots.id),
  movementType: text("movement_type").notNull(),
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  reference: text("reference"),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  userId: varchar("user_id").references(() => users.id),
  destinationUserId: varchar("destination_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWarehouseMovementSchema = createInsertSchema(warehouseMovements).omit({
  id: true,
  createdAt: true,
});

export type InsertWarehouseMovement = z.infer<typeof insertWarehouseMovementSchema>;
export type WarehouseMovement = typeof warehouseMovements.$inferSelect;

// Relaciones del módulo Almacén
export const warehouseInventoryRelations = relations(warehouseInventory, ({ one }) => ({
  product: one(products, {
    fields: [warehouseInventory.productId],
    references: [products.id],
  }),
}));

export const productLotsRelations = relations(productLots, ({ one }) => ({
  product: one(products, {
    fields: [productLots.productId],
    references: [products.id],
  }),
  supplier: one(suppliers, {
    fields: [productLots.supplierId],
    references: [suppliers.id],
  }),
}));

export const warehouseMovementsRelations = relations(warehouseMovements, ({ one }) => ({
  product: one(products, {
    fields: [warehouseMovements.productId],
    references: [products.id],
  }),
  lot: one(productLots, {
    fields: [warehouseMovements.lotId],
    references: [productLots.id],
  }),
  supplier: one(suppliers, {
    fields: [warehouseMovements.supplierId],
    references: [suppliers.id],
  }),
  user: one(users, {
    fields: [warehouseMovements.userId],
    references: [users.id],
  }),
  destinationUser: one(users, {
    fields: [warehouseMovements.destinationUserId],
    references: [users.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  lots: many(productLots),
  movements: many(warehouseMovements),
}));

// ==================== MÓDULO ABASTECEDOR ====================

export const routeStatusEnum = pgEnum("route_status", [
  "pendiente",
  "en_progreso",
  "completada",
  "cancelada"
]);

export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  supplierId: varchar("supplier_id").references(() => users.id).notNull(),
  supervisorId: varchar("supervisor_id").references(() => users.id),
  status: text("status").default("pendiente"),
  totalStops: integer("total_stops").default(0),
  completedStops: integer("completed_stops").default(0),
  estimatedDuration: integer("estimated_duration_minutes"),
  actualDuration: integer("actual_duration_minutes"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  completedStops: true,
  actualDuration: true,
  startTime: true,
  endTime: true,
});

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

export const stopStatusEnum = pgEnum("stop_status", [
  "pendiente",
  "en_progreso",
  "completada",
  "omitida"
]);

export const routeStops = pgTable("route_stops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id").references(() => routes.id).notNull(),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  order: integer("order").notNull(),
  status: text("status").default("pendiente"),
  estimatedArrival: timestamp("estimated_arrival"),
  actualArrival: timestamp("actual_arrival"),
  actualDeparture: timestamp("actual_departure"),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRouteStopSchema = createInsertSchema(routeStops).omit({
  id: true,
  createdAt: true,
  actualArrival: true,
  actualDeparture: true,
  durationMinutes: true,
});

export type InsertRouteStop = z.infer<typeof insertRouteStopSchema>;
export type RouteStop = typeof routeStops.$inferSelect;

export const serviceTypeEnum = pgEnum("service_type", [
  "abastecimiento",
  "limpieza",
  "mantenimiento",
  "reparacion",
  "inspeccion",
  "recoleccion_efectivo"
]);

export const serviceRecords = pgTable("service_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeStopId: varchar("route_stop_id").references(() => routeStops.id),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  serviceType: text("service_type").default("abastecimiento"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  status: text("status").default("en_progreso"),
  notes: text("notes"),
  signature: text("signature"),
  responsibleName: text("responsible_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServiceRecordSchema = createInsertSchema(serviceRecords).omit({
  id: true,
  createdAt: true,
  endTime: true,
  durationMinutes: true,
});

export type InsertServiceRecord = z.infer<typeof insertServiceRecordSchema>;
export type ServiceRecord = typeof serviceRecords.$inferSelect;

export const cashCollections = pgTable("cash_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRecordId: varchar("service_record_id").references(() => serviceRecords.id),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  expectedAmount: decimal("expected_amount", { precision: 10, scale: 2 }),
  actualAmount: decimal("actual_amount", { precision: 10, scale: 2 }).notNull(),
  difference: decimal("difference", { precision: 10, scale: 2 }),
  coinAmount: decimal("coin_amount", { precision: 10, scale: 2 }),
  billAmount: decimal("bill_amount", { precision: 10, scale: 2 }),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCashCollectionSchema = createInsertSchema(cashCollections).omit({
  id: true,
  createdAt: true,
});

export type InsertCashCollection = z.infer<typeof insertCashCollectionSchema>;
export type CashCollection = typeof cashCollections.$inferSelect;

export const productLoadTypeEnum = pgEnum("product_load_type", [
  "cargado",
  "retirado_caduco",
  "retirado_dañado",
  "retirado_sobrante",
  "ajuste"
]);

export const productLoads = pgTable("product_loads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRecordId: varchar("service_record_id").references(() => serviceRecords.id),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  loadType: text("load_type").default("cargado"),
  quantity: integer("quantity").notNull(),
  lotId: varchar("lot_id").references(() => productLots.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductLoadSchema = createInsertSchema(productLoads).omit({
  id: true,
  createdAt: true,
});

export type InsertProductLoad = z.infer<typeof insertProductLoadSchema>;
export type ProductLoad = typeof productLoads.$inferSelect;

export const issueTypeEnum = pgEnum("issue_type", [
  "falla_tecnica",
  "suciedad",
  "pieza_faltante",
  "vandalismo",
  "error_sistema",
  "otro"
]);

export const issuePriorityEnum = pgEnum("issue_priority", [
  "baja",
  "media",
  "alta",
  "critica"
]);

export const issueReports = pgTable("issue_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRecordId: varchar("service_record_id").references(() => serviceRecords.id),
  machineId: varchar("machine_id").references(() => machines.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  issueType: text("issue_type").notNull(),
  priority: text("priority").default("media"),
  description: text("description").notNull(),
  photoUrl: text("photo_url"),
  status: text("status").default("pendiente"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIssueReportSchema = createInsertSchema(issueReports).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
  resolution: true,
});

export type InsertIssueReport = z.infer<typeof insertIssueReportSchema>;
export type IssueReport = typeof issueReports.$inferSelect;

export const supplierInventory = pgTable("supplier_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").default(0),
  lotId: varchar("lot_id").references(() => productLots.id),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertSupplierInventorySchema = createInsertSchema(supplierInventory).omit({
  id: true,
  lastUpdated: true,
});

export type InsertSupplierInventory = z.infer<typeof insertSupplierInventorySchema>;
export type SupplierInventory = typeof supplierInventory.$inferSelect;

// Relaciones del módulo Abastecedor
export const routesRelations = relations(routes, ({ one, many }) => ({
  supplier: one(users, {
    fields: [routes.supplierId],
    references: [users.id],
    relationName: "supplierRoutes",
  }),
  supervisor: one(users, {
    fields: [routes.supervisorId],
    references: [users.id],
    relationName: "supervisorRoutes",
  }),
  stops: many(routeStops),
}));

export const routeStopsRelations = relations(routeStops, ({ one, many }) => ({
  route: one(routes, {
    fields: [routeStops.routeId],
    references: [routes.id],
  }),
  machine: one(machines, {
    fields: [routeStops.machineId],
    references: [machines.id],
  }),
  serviceRecords: many(serviceRecords),
}));

export const serviceRecordsRelations = relations(serviceRecords, ({ one, many }) => ({
  routeStop: one(routeStops, {
    fields: [serviceRecords.routeStopId],
    references: [routeStops.id],
  }),
  machine: one(machines, {
    fields: [serviceRecords.machineId],
    references: [machines.id],
  }),
  user: one(users, {
    fields: [serviceRecords.userId],
    references: [users.id],
  }),
  cashCollections: many(cashCollections),
  productLoads: many(productLoads),
  issueReports: many(issueReports),
}));

export const cashCollectionsRelations = relations(cashCollections, ({ one }) => ({
  serviceRecord: one(serviceRecords, {
    fields: [cashCollections.serviceRecordId],
    references: [serviceRecords.id],
  }),
  machine: one(machines, {
    fields: [cashCollections.machineId],
    references: [machines.id],
  }),
  user: one(users, {
    fields: [cashCollections.userId],
    references: [users.id],
  }),
}));

export const productLoadsRelations = relations(productLoads, ({ one }) => ({
  serviceRecord: one(serviceRecords, {
    fields: [productLoads.serviceRecordId],
    references: [serviceRecords.id],
  }),
  machine: one(machines, {
    fields: [productLoads.machineId],
    references: [machines.id],
  }),
  product: one(products, {
    fields: [productLoads.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [productLoads.userId],
    references: [users.id],
  }),
  lot: one(productLots, {
    fields: [productLoads.lotId],
    references: [productLots.id],
  }),
}));

export const issueReportsRelations = relations(issueReports, ({ one }) => ({
  serviceRecord: one(serviceRecords, {
    fields: [issueReports.serviceRecordId],
    references: [serviceRecords.id],
  }),
  machine: one(machines, {
    fields: [issueReports.machineId],
    references: [machines.id],
  }),
  user: one(users, {
    fields: [issueReports.userId],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [issueReports.resolvedBy],
    references: [users.id],
    relationName: "resolvedIssues",
  }),
}));

export const supplierInventoryRelations = relations(supplierInventory, ({ one }) => ({
  user: one(users, {
    fields: [supplierInventory.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [supplierInventory.productId],
    references: [products.id],
  }),
  lot: one(productLots, {
    fields: [supplierInventory.lotId],
    references: [productLots.id],
  }),
}));

// ==================== MÓDULO PRODUCTOS Y DINERO (TRANSVERSAL) ====================

export const cashMovementTypeEnum = pgEnum("cash_movement_type", [
  "recoleccion_maquina",
  "entrega_oficina",
  "deposito_bancario",
  "ajuste_positivo",
  "ajuste_negativo",
  "gasto_caja_chica"
]);

export const cashMovementStatusEnum = pgEnum("cash_movement_status", [
  "pendiente",
  "entregado",
  "depositado",
  "conciliado"
]);

export const cashMovements = pgTable("cash_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  status: text("status").default("pendiente"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  expectedAmount: decimal("expected_amount", { precision: 10, scale: 2 }),
  difference: decimal("difference", { precision: 10, scale: 2 }),
  userId: varchar("user_id").references(() => users.id).notNull(),
  machineId: varchar("machine_id").references(() => machines.id),
  cashCollectionId: varchar("cash_collection_id").references(() => cashCollections.id),
  bankDepositId: varchar("bank_deposit_id"),
  reference: text("reference"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  reconciliatedAt: timestamp("reconciliated_at"),
  reconciliatedBy: varchar("reconciliated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCashMovementSchema = createInsertSchema(cashMovements).omit({
  id: true,
  createdAt: true,
  reconciliatedAt: true,
  reconciliatedBy: true,
});

export type InsertCashMovement = z.infer<typeof insertCashMovementSchema>;
export type CashMovement = typeof cashMovements.$inferSelect;

export const bankDeposits = pgTable("bank_deposits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  depositDate: timestamp("deposit_date").notNull(),
  reference: text("reference"),
  receiptUrl: text("receipt_url"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: text("status").default("pendiente"),
  reconciliatedAmount: decimal("reconciliated_amount", { precision: 10, scale: 2 }),
  reconciliatedAt: timestamp("reconciliated_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBankDepositSchema = createInsertSchema(bankDeposits).omit({
  id: true,
  createdAt: true,
  reconciliatedAt: true,
  reconciliatedAmount: true,
});

export type InsertBankDeposit = z.infer<typeof insertBankDepositSchema>;
export type BankDeposit = typeof bankDeposits.$inferSelect;

export const transferTypeEnum = pgEnum("transfer_type", [
  "almacen_a_abastecedor",
  "abastecedor_a_maquina",
  "maquina_a_abastecedor",
  "abastecedor_a_almacen",
  "devolucion"
]);

export const productTransfers = pgTable("product_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transferType: text("transfer_type").notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  lotId: varchar("lot_id").references(() => productLots.id),
  sourceUserId: varchar("source_user_id").references(() => users.id),
  destinationUserId: varchar("destination_user_id").references(() => users.id),
  sourceMachineId: varchar("source_machine_id").references(() => machines.id),
  destinationMachineId: varchar("destination_machine_id").references(() => machines.id),
  serviceRecordId: varchar("service_record_id").references(() => serviceRecords.id),
  reference: text("reference"),
  notes: text("notes"),
  status: text("status").default("completado"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductTransferSchema = createInsertSchema(productTransfers).omit({
  id: true,
  createdAt: true,
});

export type InsertProductTransfer = z.infer<typeof insertProductTransferSchema>;
export type ProductTransfer = typeof productTransfers.$inferSelect;

export const shrinkageTypeEnum = pgEnum("shrinkage_type", [
  "caducidad",
  "danio",
  "robo",
  "perdida",
  "error_conteo",
  "otro"
]);

export const shrinkageRecords = pgTable("shrinkage_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shrinkageType: text("shrinkage_type").notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalLoss: decimal("total_loss", { precision: 10, scale: 2 }),
  lotId: varchar("lot_id").references(() => productLots.id),
  machineId: varchar("machine_id").references(() => machines.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  photoUrl: text("photo_url"),
  reason: text("reason"),
  notes: text("notes"),
  status: text("status").default("pendiente"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertShrinkageRecordSchema = createInsertSchema(shrinkageRecords).omit({
  id: true,
  createdAt: true,
  approvedBy: true,
  totalLoss: true,
});

export type InsertShrinkageRecord = z.infer<typeof insertShrinkageRecordSchema>;
export type ShrinkageRecord = typeof shrinkageRecords.$inferSelect;

// Relaciones Productos y Dinero
export const cashMovementsRelations = relations(cashMovements, ({ one }) => ({
  user: one(users, {
    fields: [cashMovements.userId],
    references: [users.id],
  }),
  machine: one(machines, {
    fields: [cashMovements.machineId],
    references: [machines.id],
  }),
  cashCollection: one(cashCollections, {
    fields: [cashMovements.cashCollectionId],
    references: [cashCollections.id],
  }),
  reconciliatedByUser: one(users, {
    fields: [cashMovements.reconciliatedBy],
    references: [users.id],
    relationName: "reconciliatedCashMovements",
  }),
}));

export const bankDepositsRelations = relations(bankDeposits, ({ one }) => ({
  user: one(users, {
    fields: [bankDeposits.userId],
    references: [users.id],
  }),
}));

export const productTransfersRelations = relations(productTransfers, ({ one }) => ({
  product: one(products, {
    fields: [productTransfers.productId],
    references: [products.id],
  }),
  lot: one(productLots, {
    fields: [productTransfers.lotId],
    references: [productLots.id],
  }),
  sourceUser: one(users, {
    fields: [productTransfers.sourceUserId],
    references: [users.id],
    relationName: "sourceTransfers",
  }),
  destinationUser: one(users, {
    fields: [productTransfers.destinationUserId],
    references: [users.id],
    relationName: "destinationTransfers",
  }),
  sourceMachine: one(machines, {
    fields: [productTransfers.sourceMachineId],
    references: [machines.id],
    relationName: "sourceTransferMachine",
  }),
  destinationMachine: one(machines, {
    fields: [productTransfers.destinationMachineId],
    references: [machines.id],
    relationName: "destinationTransferMachine",
  }),
  serviceRecord: one(serviceRecords, {
    fields: [productTransfers.serviceRecordId],
    references: [serviceRecords.id],
  }),
}));

export const shrinkageRecordsRelations = relations(shrinkageRecords, ({ one }) => ({
  product: one(products, {
    fields: [shrinkageRecords.productId],
    references: [products.id],
  }),
  lot: one(productLots, {
    fields: [shrinkageRecords.lotId],
    references: [productLots.id],
  }),
  machine: one(machines, {
    fields: [shrinkageRecords.machineId],
    references: [machines.id],
  }),
  user: one(users, {
    fields: [shrinkageRecords.userId],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [shrinkageRecords.approvedBy],
    references: [users.id],
    relationName: "approvedShrinkages",
  }),
}));

// ==================== MÓDULO CAJA CHICA ====================

export const expenseCategoryEnum = pgEnum("expense_category", [
  "herramientas",
  "reparaciones",
  "viaticos",
  "combustible",
  "limpieza",
  "papeleria",
  "otros"
]);

export const pettyCashExpenses = pgTable("petty_cash_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  receiptUrl: text("receipt_url"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  machineId: varchar("machine_id").references(() => machines.id),
  vehicleId: varchar("vehicle_id"),
  status: text("status").default("pendiente"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPettyCashExpenseSchema = createInsertSchema(pettyCashExpenses).omit({
  id: true,
  createdAt: true,
  approvedBy: true,
  approvedAt: true,
  rejectedBy: true,
  rejectedAt: true,
  rejectionReason: true,
  paidAt: true,
});

export type InsertPettyCashExpense = z.infer<typeof insertPettyCashExpenseSchema>;
export type PettyCashExpense = typeof pettyCashExpenses.$inferSelect;

export const pettyCashFund = pgTable("petty_cash_fund", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  initialBalance: decimal("initial_balance", { precision: 10, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).notNull(),
  minBalance: decimal("min_balance", { precision: 10, scale: 2 }).default("500"),
  lastReplenishmentDate: timestamp("last_replenishment_date"),
  lastReplenishmentAmount: decimal("last_replenishment_amount", { precision: 10, scale: 2 }),
  managedBy: varchar("managed_by").references(() => users.id),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPettyCashFundSchema = createInsertSchema(pettyCashFund).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPettyCashFund = z.infer<typeof insertPettyCashFundSchema>;
export type PettyCashFund = typeof pettyCashFund.$inferSelect;

export const pettyCashTransactions = pgTable("petty_cash_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  previousBalance: decimal("previous_balance", { precision: 10, scale: 2 }).notNull(),
  newBalance: decimal("new_balance", { precision: 10, scale: 2 }).notNull(),
  expenseId: varchar("expense_id").references(() => pettyCashExpenses.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPettyCashTransactionSchema = createInsertSchema(pettyCashTransactions).omit({
  id: true,
  createdAt: true,
});

export type InsertPettyCashTransaction = z.infer<typeof insertPettyCashTransactionSchema>;
export type PettyCashTransaction = typeof pettyCashTransactions.$inferSelect;

// Relaciones Caja Chica
export const pettyCashExpensesRelations = relations(pettyCashExpenses, ({ one }) => ({
  user: one(users, {
    fields: [pettyCashExpenses.userId],
    references: [users.id],
  }),
  machine: one(machines, {
    fields: [pettyCashExpenses.machineId],
    references: [machines.id],
  }),
  approvedByUser: one(users, {
    fields: [pettyCashExpenses.approvedBy],
    references: [users.id],
    relationName: "approvedExpenses",
  }),
  rejectedByUser: one(users, {
    fields: [pettyCashExpenses.rejectedBy],
    references: [users.id],
    relationName: "rejectedExpenses",
  }),
}));

export const pettyCashFundRelations = relations(pettyCashFund, ({ one }) => ({
  manager: one(users, {
    fields: [pettyCashFund.managedBy],
    references: [users.id],
  }),
}));

export const pettyCashTransactionsRelations = relations(pettyCashTransactions, ({ one }) => ({
  expense: one(pettyCashExpenses, {
    fields: [pettyCashTransactions.expenseId],
    references: [pettyCashExpenses.id],
  }),
  user: one(users, {
    fields: [pettyCashTransactions.userId],
    references: [users.id],
  }),
}));

// ==================== MÓDULO COMPRAS ====================

export const purchaseOrderStatus = pgEnum("purchase_order_status", [
  "borrador",
  "enviada",
  "parcialmente_recibida",
  "recibida",
  "cancelada"
]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  supplierId: varchar("supplier_id").references(() => suppliers.id).notNull(),
  status: purchaseOrderStatus("status").default("borrador").notNull(),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedBy: true,
  approvedAt: true,
  cancelledBy: true,
  cancelledAt: true,
  cancellationReason: true,
});

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => purchaseOrders.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  receivedQuantity: integer("received_quantity").default(0),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
  receivedQuantity: true,
});

export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

export const purchaseReceptions = pgTable("purchase_receptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => purchaseOrders.id).notNull(),
  receptionNumber: text("reception_number").notNull().unique(),
  receptionDate: timestamp("reception_date").defaultNow().notNull(),
  invoiceNumber: text("invoice_number"),
  invoiceDate: timestamp("invoice_date"),
  invoiceAmount: decimal("invoice_amount", { precision: 12, scale: 2 }),
  receivedBy: varchar("received_by").references(() => users.id).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPurchaseReceptionSchema = createInsertSchema(purchaseReceptions).omit({
  id: true,
  createdAt: true,
});

export type InsertPurchaseReception = z.infer<typeof insertPurchaseReceptionSchema>;
export type PurchaseReception = typeof purchaseReceptions.$inferSelect;

export const receptionItems = pgTable("reception_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receptionId: varchar("reception_id").references(() => purchaseReceptions.id).notNull(),
  orderItemId: varchar("order_item_id").references(() => purchaseOrderItems.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantityReceived: integer("quantity_received").notNull(),
  lotNumber: text("lot_number"),
  expirationDate: timestamp("expiration_date"),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReceptionItemSchema = createInsertSchema(receptionItems).omit({
  id: true,
  createdAt: true,
});

export type InsertReceptionItem = z.infer<typeof insertReceptionItemSchema>;
export type ReceptionItem = typeof receptionItems.$inferSelect;

// Relaciones Compras
export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  createdByUser: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
    relationName: "createdOrders",
  }),
  approvedByUser: one(users, {
    fields: [purchaseOrders.approvedBy],
    references: [users.id],
    relationName: "approvedOrders",
  }),
  items: many(purchaseOrderItems),
  receptions: many(purchaseReceptions),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one, many }) => ({
  order: one(purchaseOrders, {
    fields: [purchaseOrderItems.orderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderItems.productId],
    references: [products.id],
  }),
  receptionItems: many(receptionItems),
}));

export const purchaseReceptionsRelations = relations(purchaseReceptions, ({ one, many }) => ({
  order: one(purchaseOrders, {
    fields: [purchaseReceptions.orderId],
    references: [purchaseOrders.id],
  }),
  receivedByUser: one(users, {
    fields: [purchaseReceptions.receivedBy],
    references: [users.id],
  }),
  items: many(receptionItems),
}));

export const receptionItemsRelations = relations(receptionItems, ({ one }) => ({
  reception: one(purchaseReceptions, {
    fields: [receptionItems.receptionId],
    references: [purchaseReceptions.id],
  }),
  orderItem: one(purchaseOrderItems, {
    fields: [receptionItems.orderItemId],
    references: [purchaseOrderItems.id],
  }),
  product: one(products, {
    fields: [receptionItems.productId],
    references: [products.id],
  }),
}));

// ==================== MÓDULO DE COMBUSTIBLE ====================

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "camioneta",
  "van",
  "camion",
  "motocicleta",
  "auto"
]);

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "activo",
  "mantenimiento",
  "inactivo"
]);

export const fuelTypeEnum = pgEnum("fuel_type", [
  "gasolina_regular",
  "gasolina_premium",
  "diesel"
]);

export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plate: text("plate").notNull().unique(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  year: integer("year"),
  type: text("type").default("camioneta"),
  color: text("color"),
  status: text("status").default("activo"),
  fuelType: text("fuel_type").default("gasolina_regular"),
  tankCapacity: decimal("tank_capacity", { precision: 5, scale: 2 }),
  expectedMileage: decimal("expected_mileage", { precision: 5, scale: 2 }),
  currentOdometer: integer("current_odometer").default(0),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  insuranceExpiry: timestamp("insurance_expiry"),
  lastServiceDate: timestamp("last_service_date"),
  nextServiceOdometer: integer("next_service_odometer"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

export const fuelRecords = pgTable("fuel_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  routeId: varchar("route_id").references(() => routes.id),
  recordDate: timestamp("record_date").defaultNow().notNull(),
  fuelType: text("fuel_type").default("gasolina_regular"),
  liters: decimal("liters", { precision: 8, scale: 3 }).notNull(),
  pricePerLiter: decimal("price_per_liter", { precision: 6, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  odometerReading: integer("odometer_reading").notNull(),
  previousOdometer: integer("previous_odometer"),
  distanceTraveled: decimal("distance_traveled", { precision: 8, scale: 2 }),
  calculatedMileage: decimal("calculated_mileage", { precision: 5, scale: 2 }),
  ticketNumber: text("ticket_number"),
  ticketPhotoUrl: text("ticket_photo_url"),
  odometerPhotoUrl: text("odometer_photo_url"),
  gasStation: text("gas_station"),
  isFull: boolean("is_full").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFuelRecordSchema = createInsertSchema(fuelRecords).omit({
  id: true,
  createdAt: true,
  distanceTraveled: true,
  calculatedMileage: true,
  previousOdometer: true,
});

export type InsertFuelRecord = z.infer<typeof insertFuelRecordSchema>;
export type FuelRecord = typeof fuelRecords.$inferSelect;

// Relaciones Combustible
export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [vehicles.assignedUserId],
    references: [users.id],
  }),
  fuelRecords: many(fuelRecords),
}));

export const fuelRecordsRelations = relations(fuelRecords, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [fuelRecords.vehicleId],
    references: [vehicles.id],
  }),
  user: one(users, {
    fields: [fuelRecords.userId],
    references: [users.id],
  }),
  route: one(routes, {
    fields: [fuelRecords.routeId],
    references: [routes.id],
  }),
}));

// =====================
// TAREAS (TASKS)
// =====================

export const taskPriorityEnum = pgEnum("task_priority", [
  "baja",
  "media",
  "alta",
  "urgente"
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pendiente",
  "en_progreso",
  "completada",
  "cancelada"
]);

export const taskTypeEnum = pgEnum("task_type", [
  "abastecimiento",
  "mantenimiento",
  "recoleccion",
  "revision",
  "limpieza",
  "reparacion",
  "reunion",
  "otro"
]);

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").default("otro"),
  priority: text("priority").default("media"),
  status: text("status").default("pendiente"),
  dueDate: timestamp("due_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  machineId: varchar("machine_id").references(() => machines.id),
  routeId: varchar("route_id").references(() => routes.id),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completedBy: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignedUser: one(users, {
    fields: [tasks.assignedUserId],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  machine: one(machines, {
    fields: [tasks.machineId],
    references: [machines.id],
  }),
  route: one(routes, {
    fields: [tasks.routeId],
    references: [routes.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdTasks",
  }),
  completer: one(users, {
    fields: [tasks.completedBy],
    references: [users.id],
    relationName: "completedTasks",
  }),
}));

// =====================
// EVENTOS CALENDARIO
// =====================

export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").default("otro"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  allDay: boolean("all_day").default(false),
  color: text("color"),
  userId: varchar("user_id").references(() => users.id),
  taskId: varchar("task_id").references(() => tasks.id),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [calendarEvents.taskId],
    references: [tasks.id],
  }),
}));

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));
