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
  role: text("role").default("abastecedor"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
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
  durationMinutes: true,
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
