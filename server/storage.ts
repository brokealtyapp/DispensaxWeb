import { 
  type User, type InsertUser, type InsertEmployee,
  type Location, type InsertLocation,
  type Product, type InsertProduct,
  type Machine, type InsertMachine,
  type MachineInventory, type InsertMachineInventory,
  type MachineAlert, type InsertMachineAlert,
  type MachineVisit, type InsertMachineVisit,
  type MachineSale, type InsertMachineSale,
  type Supplier, type InsertSupplier,
  type WarehouseInventory, type InsertWarehouseInventory,
  type ProductLot, type InsertProductLot,
  type WarehouseMovement, type InsertWarehouseMovement,
  type Route, type InsertRoute,
  type RouteStop, type InsertRouteStop,
  type ServiceRecord, type InsertServiceRecord,
  type CashCollection, type InsertCashCollection,
  type ProductLoad, type InsertProductLoad,
  type IssueReport, type InsertIssueReport,
  type SupplierInventory, type InsertSupplierInventory,
  type CashMovement, type InsertCashMovement,
  type BankDeposit, type InsertBankDeposit,
  type ProductTransfer, type InsertProductTransfer,
  type ShrinkageRecord, type InsertShrinkageRecord,
  type PettyCashExpense, type InsertPettyCashExpense,
  type PettyCashFund, type InsertPettyCashFund,
  type PettyCashTransaction, type InsertPettyCashTransaction,
  type PurchaseOrder, type InsertPurchaseOrder,
  type PurchaseOrderItem, type InsertPurchaseOrderItem,
  type PurchaseReception, type InsertPurchaseReception,
  type ReceptionItem, type InsertReceptionItem,
  type Vehicle, type InsertVehicle,
  type FuelRecord, type InsertFuelRecord,
  type Task, type InsertTask,
  type CalendarEvent, type InsertCalendarEvent,
  type PasswordResetToken,
  type RefreshToken, type InsertRefreshToken,
  type EmployeeAttendance, type InsertEmployeeAttendance,
  type PayrollRecord, type InsertPayrollRecord,
  type VacationRequest, type InsertVacationRequest,
  type PerformanceReview, type InsertPerformanceReview,
  type EmployeeDocument, type InsertEmployeeDocument,
  type EmployeeProfile, type InsertEmployeeProfile,
  users, locations, products, machines, machineInventory, machineAlerts, machineVisits, machineSales,
  suppliers, warehouseInventory, productLots, warehouseMovements,
  routes, routeStops, serviceRecords, cashCollections, productLoads, issueReports, supplierInventory,
  cashMovements, bankDeposits, productTransfers, shrinkageRecords,
  pettyCashExpenses, pettyCashFund, pettyCashTransactions,
  purchaseOrders, purchaseOrderItems, purchaseReceptions, receptionItems,
  vehicles, fuelRecords,
  tasks, calendarEvents, passwordResetTokens, refreshTokens,
  employeeAttendance, payrollRecords, vacationRequests, performanceReviews, employeeDocuments, employeeProfiles
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, asc, or, inArray } from "drizzle-orm";

// =====================
// SECURITY: User without password for API responses
// =====================
export type SafeUser = Omit<User, 'password'>;

function excludePassword(user: User): SafeUser;
function excludePassword(user: User | null | undefined): SafeUser | undefined;
function excludePassword(user: User | null | undefined): SafeUser | undefined {
  if (!user) return undefined;
  const { password, ...safeUser } = user;
  return safeUser;
}

// =====================
// TIMEZONE UTILITIES (GMT-4 / America/Santo_Domingo)
// =====================
const TIMEZONE = 'America/Santo_Domingo';

function getTodayInTimezone(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dateStr = formatter.format(now);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserIdsByZone(zone: string): Promise<string[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: { fullName?: string; email?: string; username?: string; phone?: string }): Promise<User | undefined>;
  
  getLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<boolean>;
  
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  getMachines(filters?: { status?: string; zone?: string }): Promise<Machine[]>;
  getMachine(id: string): Promise<Machine | undefined>;
  getMachineWithDetails(id: string): Promise<any>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: string, machine: Partial<InsertMachine>): Promise<Machine | undefined>;
  deleteMachine(id: string): Promise<boolean>;
  
  getMachineInventory(machineId: string): Promise<(MachineInventory & { product: Product })[]>;
  updateMachineInventory(machineId: string, productId: string, quantity: number): Promise<MachineInventory | undefined>;
  setMachineInventory(inventory: InsertMachineInventory): Promise<MachineInventory>;
  
  getMachineAlerts(machineId?: string, resolved?: boolean, limit?: number): Promise<MachineAlert[]>;
  createMachineAlert(alert: InsertMachineAlert): Promise<MachineAlert>;
  resolveAlert(id: string, userId: string): Promise<MachineAlert | undefined>;
  resolveAlertSimple(id: string): Promise<MachineAlert | undefined>;
  
  getMachineVisits(machineId: string): Promise<MachineVisit[]>;
  createMachineVisit(visit: InsertMachineVisit): Promise<MachineVisit>;
  endMachineVisit(id: string, endTime: Date, notes?: string): Promise<MachineVisit | undefined>;
  
  getMachineSales(machineId: string, startDate?: Date, endDate?: Date): Promise<MachineSale[]>;
  getAllMachineSales(): Promise<MachineSale[]>;
  createMachineSale(sale: InsertMachineSale): Promise<MachineSale>;
  getMachineSalesSummary(machineId: string): Promise<{ today: number; week: number; month: number }>;
  
  // Almacén - Proveedores
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;
  
  // Almacén - Inventario
  getWarehouseInventory(): Promise<(WarehouseInventory & { product: Product })[]>;
  getWarehouseInventoryItem(productId: string): Promise<WarehouseInventory | undefined>;
  updateWarehouseStock(productId: string, quantity: number): Promise<WarehouseInventory>;
  updateWarehouseInventory(productId: string, data: { currentStock?: number; minStock?: number; maxStock?: number; reorderPoint?: number }): Promise<WarehouseInventory>;
  getLowStockAlerts(): Promise<(WarehouseInventory & { product: Product })[]>;
  
  // Almacén - Lotes
  getProductLots(productId?: string): Promise<(ProductLot & { product: Product; supplier?: Supplier })[]>;
  getProductLot(id: string): Promise<ProductLot | undefined>;
  createProductLot(lot: InsertProductLot): Promise<ProductLot>;
  updateProductLot(id: string, lot: Partial<InsertProductLot>): Promise<ProductLot | undefined>;
  getExpiringLots(days: number, limit?: number): Promise<(ProductLot & { product: Product })[]>;
  
  // Almacén - Movimientos (Kardex)
  getWarehouseMovements(productId?: string, limit?: number): Promise<(WarehouseMovement & { product: Product })[]>;
  createWarehouseMovement(movement: InsertWarehouseMovement): Promise<WarehouseMovement>;
  registerPurchaseEntry(data: { productId: string; quantity: number; unitCost: number; supplierId?: string; lotNumber: string; expirationDate?: Date; notes?: string; userId?: string }): Promise<WarehouseMovement>;
  registerSupplierExit(data: { productId: string; quantity: number; destinationUserId?: string; notes?: string; userId?: string; movementType?: "salida_abastecedor" | "salida_maquina" }): Promise<WarehouseMovement>;
  registerInventoryAdjustment(data: { productId: string; physicalCount: number; reason: string; notes?: string; userId?: string }): Promise<WarehouseMovement>;

  // ==================== MÓDULO ABASTECEDOR ====================
  
  // Rutas
  getRoutes(userId?: string, date?: Date, status?: string): Promise<any[]>;
  getRoute(id: string): Promise<any>;
  getTodayRoute(userId: string): Promise<any>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, route: Partial<InsertRoute>): Promise<Route | undefined>;
  startRoute(id: string): Promise<Route | undefined>;
  completeRoute(id: string): Promise<Route | undefined>;
  
  // Paradas de Ruta
  getRouteStops(routeId: string): Promise<any[]>;
  getRouteStopsBatch(routeIds: string[]): Promise<Record<string, any[]>>;
  getRouteStop(id: string): Promise<any>;
  createRouteStop(stop: InsertRouteStop): Promise<RouteStop>;
  updateRouteStop(id: string, stop: Partial<RouteStop>): Promise<RouteStop | undefined>;
  startStop(id: string): Promise<RouteStop | undefined>;
  completeStop(id: string): Promise<RouteStop | undefined>;
  
  // Registros de Servicio
  getServiceRecords(userId?: string, machineId?: string, limit?: number): Promise<any[]>;
  getServiceRecord(id: string): Promise<any>;
  getActiveService(userId: string, routeStopId?: string): Promise<ServiceRecord | undefined>;
  startService(data: InsertServiceRecord): Promise<ServiceRecord>;
  endService(id: string, notes?: string, signature?: string, responsibleName?: string, checklistData?: string): Promise<ServiceRecord | undefined>;
  
  // Recolección de Efectivo
  getCashCollections(userId?: string, machineId?: string, startDate?: Date, endDate?: Date, limit?: number): Promise<any[]>;
  createCashCollection(collection: InsertCashCollection): Promise<CashCollection>;
  getCashCollectionsSummary(userId: string, startDate?: Date, endDate?: Date): Promise<{ total: number; count: number; difference: number }>;
  
  // Carga/Retiro de Productos
  getProductLoads(serviceRecordId?: string, machineId?: string, userId?: string): Promise<any[]>;
  createProductLoad(load: InsertProductLoad): Promise<ProductLoad>;
  
  // Reportes de Problemas
  getIssueReports(machineId?: string, status?: string, userId?: string): Promise<any[]>;
  getIssueReport(id: string): Promise<any>;
  createIssueReport(report: InsertIssueReport): Promise<IssueReport>;
  resolveIssue(id: string, userId: string, resolution: string): Promise<IssueReport | undefined>;
  
  // Inventario del Abastecedor
  getSupplierInventory(userId: string): Promise<any[]>;
  updateSupplierInventoryItem(userId: string, productId: string, quantity: number, lotId?: string): Promise<SupplierInventory>;
  loadProductsFromWarehouse(userId: string, productId: string, quantity: number): Promise<void>;
  unloadProductsToMachine(userId: string, machineId: string, productId: string, quantity: number): Promise<void>;
  
  // Estadísticas del Abastecedor
  getSupplierStats(userId: string, startDate?: Date, endDate?: Date): Promise<any>;
  
  // ==================== MÓDULO PRODUCTOS Y DINERO ====================
  
  // Movimientos de Efectivo
  getCashMovements(filters?: { userId?: string; type?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<any[]>;
  getCashMovement(id: string): Promise<any>;
  createCashMovement(movement: InsertCashMovement): Promise<CashMovement>;
  updateCashMovementStatus(id: string, status: string): Promise<CashMovement | undefined>;
  reconcileCashMovement(id: string, reconciledBy: string): Promise<CashMovement | undefined>;
  getCashMovementsSummary(startDate?: Date, endDate?: Date): Promise<{ total: number; pending: number; delivered: number; deposited: number; differences: number }>;
  
  // Depósitos Bancarios
  getBankDeposits(filters?: { userId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<any[]>;
  getBankDeposit(id: string): Promise<any>;
  createBankDeposit(deposit: InsertBankDeposit): Promise<BankDeposit>;
  reconcileBankDeposit(id: string, reconciledAmount: number): Promise<BankDeposit | undefined>;
  
  // Transferencias de Productos
  getProductTransfers(filters?: { type?: string; productId?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<any[]>;
  getProductTransfer(id: string): Promise<any>;
  createProductTransfer(transfer: InsertProductTransfer): Promise<ProductTransfer>;
  
  // Mermas
  getShrinkageRecords(filters?: { type?: string; productId?: string; status?: string; limit?: number; startDate?: Date; endDate?: Date }): Promise<any[]>;
  getShrinkageRecord(id: string): Promise<any>;
  createShrinkageRecord(record: InsertShrinkageRecord): Promise<ShrinkageRecord>;
  approveShrinkage(id: string, approvedBy: string): Promise<ShrinkageRecord | undefined>;
  getShrinkageSummary(startDate?: Date, endDate?: Date): Promise<{ totalRecords: number; totalQuantity: number; totalCost: number; pendingCount: number; byType: Record<string, { count: number; quantity: number; cost: number }> }>;
  
  // Conciliación
  getDailyReconciliation(date: Date, endDate?: Date): Promise<any>;
  getSupplierReconciliation(userId: string, date: Date): Promise<any>;
  
  // ==================== MÓDULO CAJA CHICA ====================
  
  // Gastos de Caja Chica
  getPettyCashExpenses(filters?: { userId?: string; category?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<any[]>;
  getPettyCashExpense(id: string): Promise<any>;
  createPettyCashExpense(expense: InsertPettyCashExpense): Promise<PettyCashExpense>;
  approvePettyCashExpense(id: string, approvedBy: string): Promise<PettyCashExpense | undefined>;
  rejectPettyCashExpense(id: string, rejectedBy: string, reason: string): Promise<PettyCashExpense | undefined>;
  markPettyCashExpenseAsPaid(id: string): Promise<PettyCashExpense | undefined>;
  
  // Fondo de Caja Chica
  getPettyCashFund(): Promise<PettyCashFund | undefined>;
  initializePettyCashFund(fund: InsertPettyCashFund): Promise<PettyCashFund>;
  updatePettyCashBalance(amount: number, type: 'add' | 'subtract'): Promise<PettyCashFund | undefined>;
  replenishPettyCashFund(amount: number, userId: string): Promise<PettyCashFund | undefined>;
  
  // Transacciones de Caja Chica
  getPettyCashTransactions(limit?: number): Promise<any[]>;
  createPettyCashTransaction(transaction: InsertPettyCashTransaction): Promise<PettyCashTransaction>;
  getPettyCashStats(): Promise<{ currentBalance: number; todayExpenses: number; pendingApprovals: number; monthlyExpenses: number }>;
  
  // ==================== MÓDULO COMPRAS ====================
  
  // Órdenes de Compra
  getPurchaseOrders(filters?: { supplierId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<any[]>;
  getPurchaseOrder(id: string): Promise<any>;
  createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  updatePurchaseOrderStatus(id: string, status: string, userId?: string, reason?: string): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string): Promise<boolean>;
  getNextOrderNumber(): Promise<string>;
  
  // Items de Orden de Compra
  getPurchaseOrderItems(orderId: string): Promise<any[]>;
  addPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: string, data: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined>;
  removePurchaseOrderItem(id: string): Promise<boolean>;
  recalculateOrderTotals(orderId: string): Promise<void>;
  
  // Recepciones de Mercancía
  getPurchaseReceptions(filters?: { orderId?: string; startDate?: Date; endDate?: Date }): Promise<any[]>;
  getPurchaseReception(id: string): Promise<any>;
  createPurchaseReception(reception: InsertPurchaseReception, items: Omit<InsertReceptionItem, 'receptionId'>[], userId?: string): Promise<PurchaseReception>;
  getNextReceptionNumber(): Promise<string>;
  
  // Estadísticas de Compras
  getPurchaseStats(startDate?: Date, endDate?: Date): Promise<{ totalOrders: number; totalAmount: number; pendingOrders: number; topSuppliers: any[] }>;
  getSupplierPurchaseHistory(supplierId: string, limit?: number): Promise<any[]>;
  getLowStockProducts(): Promise<any[]>;
  
  // ==================== MÓDULO COMBUSTIBLE ====================
  
  // Vehículos
  getVehicles(filters?: { status?: string; type?: string; assignedUserId?: string }): Promise<any[]>;
  getVehicle(id: string): Promise<any>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;
  
  // Registros de Combustible
  getFuelRecords(filters?: { vehicleId?: string; userId?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<any[]>;
  getFuelRecord(id: string): Promise<any>;
  createFuelRecord(record: InsertFuelRecord): Promise<FuelRecord>;
  updateFuelRecord(id: string, data: Partial<InsertFuelRecord>): Promise<FuelRecord | undefined>;
  deleteFuelRecord(id: string): Promise<boolean>;
  
  // Estadísticas de Combustible
  getFuelStats(filters?: { vehicleId?: string; userId?: string; startDate?: Date; endDate?: Date }): Promise<{
    totalLiters: number;
    totalAmount: number;
    averageMileage: number;
    recordCount: number;
    costPerKm: number;
  }>;
  getVehicleFuelStats(vehicleId: string, startDate?: Date, endDate?: Date): Promise<any>;
  getUserFuelStats(userId: string, startDate?: Date, endDate?: Date): Promise<any>;
  getFuelStatsPerRoute(startDate?: Date, endDate?: Date): Promise<any[]>;
  getLowMileageVehicles(): Promise<any[]>;
  
  // ==================== MÓDULO REPORTES ====================
  
  getReportsOverview(startDate?: Date, endDate?: Date): Promise<{
    totalSales: number;
    totalPurchases: number;
    totalFuelCost: number;
    totalPettyCash: number;
    machineCount: number;
    activeRoutes: number;
    productCount: number;
    lowStockAlerts: number;
    pendingOrders: number;
    pendingExpenses: number;
    profitMargin: number;
  }>;
  
  getSalesBreakdown(filters?: { 
    startDate?: Date; 
    endDate?: Date; 
    groupBy?: 'machine' | 'product' | 'location' | 'day' 
  }): Promise<any[]>;
  
  getPurchasesBreakdown(filters?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'supplier' | 'product' | 'day';
  }): Promise<any[]>;
  
  getFuelBreakdown(filters?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'vehicle' | 'user' | 'route' | 'day';
  }): Promise<any[]>;
  
  getPettyCashBreakdown(filters?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'category' | 'user' | 'day';
  }): Promise<any[]>;
  
  getMachinePerformance(startDate?: Date, endDate?: Date): Promise<any[]>;
  
  getTopProducts(startDate?: Date, endDate?: Date, limit?: number): Promise<any[]>;
  
  getSupplierRanking(startDate?: Date, endDate?: Date): Promise<any[]>;
  
  getExportData(type: 'sales' | 'purchases' | 'fuel' | 'pettycash' | 'inventory', filters?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]>;
  
  // ==================== MÓDULO CONTABILIDAD ====================
  
  getAccountingOverview(startDate?: Date, endDate?: Date): Promise<{
    totalIngresos: number;
    totalGastos: number;
    utilidadNeta: number;
    margen: number;
    transacciones: number;
    promedioTicket: number;
    tendenciaIngresos: number;
    tendenciaGastos: number;
    monthlyData: { month: string; ventas: number; gastos: number }[];
    categoryData: { name: string; value: number }[];
  }>;
  
  getMachineSalesReport(startDate?: Date, endDate?: Date): Promise<any[]>;
  
  getExpensesReport(filters?: { startDate?: Date; endDate?: Date; category?: string }): Promise<any[]>;
  
  getCashCutReport(startDate?: Date, endDate?: Date): Promise<{
    totalEsperado: number;
    totalRecolectado: number;
    diferencia: number;
    detallePorMaquina: any[];
    detallePorAbastecedor: any[];
  }>;
  
  // ==================== MÓDULO RRHH ====================
  
  // Empleados (SafeUser excluye password para seguridad)
  getEmployees(filters?: { role?: string; isActive?: boolean; search?: string }): Promise<SafeUser[]>;
  getEmployee(id: string): Promise<SafeUser | undefined>;
  createEmployee(employee: InsertEmployee): Promise<SafeUser>;
  updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<SafeUser | undefined>;
  deleteEmployee(id: string): Promise<boolean>;
  
  // Perfiles de empleados
  getEmployeeProfile(userId: string): Promise<EmployeeProfile | undefined>;
  getEmployeeProfiles(): Promise<(EmployeeProfile & { user: SafeUser })[]>;
  createEmployeeProfile(profile: InsertEmployeeProfile): Promise<EmployeeProfile>;
  updateEmployeeProfile(userId: string, data: Partial<InsertEmployeeProfile>): Promise<EmployeeProfile | undefined>;
  
  // Asistencia
  getAttendance(filters?: { userId?: string; startDate?: Date; endDate?: Date; status?: string }): Promise<(EmployeeAttendance & { user: SafeUser })[]>;
  getAttendanceRecord(id: string): Promise<EmployeeAttendance | undefined>;
  createAttendance(attendance: InsertEmployeeAttendance): Promise<EmployeeAttendance>;
  updateAttendance(id: string, data: Partial<InsertEmployeeAttendance>): Promise<EmployeeAttendance | undefined>;
  deleteAttendance(id: string): Promise<boolean>;
  checkIn(userId: string, date: Date): Promise<EmployeeAttendance>;
  checkOut(userId: string, date: Date): Promise<EmployeeAttendance | undefined>;
  getAttendanceSummary(userId: string, startDate: Date, endDate: Date): Promise<{
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    totalHours: number;
    overtimeHours: number;
  }>;
  
  // Nómina
  getPayrollRecords(filters?: { userId?: string; startDate?: Date; endDate?: Date; status?: string }): Promise<(PayrollRecord & { user: SafeUser })[]>;
  getPayrollRecord(id: string): Promise<PayrollRecord | undefined>;
  createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord>;
  updatePayrollRecord(id: string, data: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined>;
  deletePayrollRecord(id: string): Promise<boolean>;
  processPayroll(id: string, processedBy: string): Promise<PayrollRecord | undefined>;
  
  // Vacaciones
  getVacationRequests(filters?: { userId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<(VacationRequest & { user: SafeUser })[]>;
  getVacationRequest(id: string): Promise<VacationRequest | undefined>;
  createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest>;
  updateVacationRequest(id: string, data: Partial<InsertVacationRequest>): Promise<VacationRequest | undefined>;
  approveVacation(id: string, approvedBy: string): Promise<VacationRequest | undefined>;
  rejectVacation(id: string, approvedBy: string, reason: string): Promise<VacationRequest | undefined>;
  cancelVacation(id: string): Promise<VacationRequest | undefined>;
  
  // Evaluaciones de desempeño
  getPerformanceReviews(filters?: { userId?: string; reviewerId?: string; status?: string; period?: string }): Promise<(PerformanceReview & { user: SafeUser; reviewer: SafeUser })[]>;
  getPerformanceReview(id: string): Promise<PerformanceReview | undefined>;
  createPerformanceReview(review: InsertPerformanceReview): Promise<PerformanceReview>;
  updatePerformanceReview(id: string, data: Partial<InsertPerformanceReview>): Promise<PerformanceReview | undefined>;
  deletePerformanceReview(id: string): Promise<boolean>;
  
  // Documentos
  getEmployeeDocuments(filters?: { userId?: string; documentType?: string }): Promise<(EmployeeDocument & { user: SafeUser })[]>;
  getEmployeeDocument(id: string): Promise<EmployeeDocument | undefined>;
  createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument>;
  updateEmployeeDocument(id: string, data: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined>;
  deleteEmployeeDocument(id: string): Promise<boolean>;
  
  // Estadísticas RRHH
  getHRStats(): Promise<{
    totalEmployees: number;
    activeEmployees: number;
    pendingVacations: number;
    todayAttendance: number;
    pendingPayrolls: number;
  }>;
  
  // Legacy compatibility
  getTimeTracking(filters?: { userId?: string; startDate?: Date; endDate?: Date }): Promise<any[]>;
  getEmployeePerformance(filters?: { userId?: string; startDate?: Date; endDate?: Date }): Promise<any[]>;
  
  // ==================== MÓDULO TAREAS ====================
  
  getTasks(filters?: { status?: string; priority?: string; assignedUserId?: string; startDate?: Date; endDate?: Date; type?: string }): Promise<any[]>;
  getTask(id: string): Promise<any>;
  getTasksForToday(userId?: string): Promise<any[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  completeTask(id: string, completedBy: string): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  getTaskStats(filters?: { userId?: string; startDate?: Date; endDate?: Date }): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    overdue: number;
  }>;
  
  // ==================== MÓDULO CALENDARIO ====================
  
  getCalendarEvents(filters?: { userId?: string; startDate?: Date; endDate?: Date; eventType?: string }): Promise<any[]>;
  getCalendarEvent(id: string): Promise<any>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<boolean>;
  
  // ==================== PASSWORD RESET ====================
  
  getUserByEmail(email: string): Promise<User | undefined>;
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<boolean>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<boolean>;
  deleteExpiredPasswordResetTokens(): Promise<number>;
  
  // ==================== REFRESH TOKENS (JWT) ====================
  
  createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string; ipAddress?: string }): Promise<RefreshToken>;
  getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined>;
  revokeRefreshToken(tokenHash: string): Promise<boolean>;
  revokeAllUserRefreshTokens(userId: string): Promise<number>;
  deleteExpiredRefreshTokens(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: { fullName?: string; email?: string; username?: string; phone?: string }): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getUserIdsByZone(zone: string): Promise<string[]> {
    const result = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.assignedZone, zone));
    return result.map(u => u.id);
  }

  async getLocations(): Promise<Location[]> {
    return db.select().from(locations).orderBy(locations.name);
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined> {
    const [updated] = await db.update(locations).set(location).where(eq(locations.id, id)).returning();
    return updated;
  }

  async deleteLocation(id: string): Promise<boolean> {
    const result = await db.delete(locations).where(eq(locations.id, id));
    return true;
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).where(eq(products.isActive, true)).orderBy(products.name);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
    return true;
  }

  async getMachines(filters?: { status?: string; zone?: string }): Promise<Machine[]> {
    let query = db.select().from(machines).where(eq(machines.isActive, true));
    
    if (filters?.status) {
      query = db.select().from(machines).where(and(eq(machines.isActive, true), eq(machines.status, filters.status)));
    }
    if (filters?.zone) {
      query = db.select().from(machines).where(and(eq(machines.isActive, true), eq(machines.zone, filters.zone)));
    }
    if (filters?.status && filters?.zone) {
      query = db.select().from(machines).where(and(eq(machines.isActive, true), eq(machines.status, filters.status), eq(machines.zone, filters.zone)));
    }
    
    return query.orderBy(machines.name);
  }

  async getMachine(id: string): Promise<Machine | undefined> {
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    return machine;
  }

  async getMachineWithDetails(id: string): Promise<any> {
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    if (!machine) return undefined;

    const location = machine.locationId 
      ? await this.getLocation(machine.locationId)
      : undefined;
    
    const inventory = await this.getMachineInventory(id);
    const alerts = await this.getMachineAlerts(id, false);
    const visits = await this.getMachineVisits(id);
    const salesSummary = await this.getMachineSalesSummary(id);

    const totalCapacity = inventory.reduce((sum, inv) => sum + (inv.maxCapacity || 0), 0);
    const currentStock = inventory.reduce((sum, inv) => sum + (inv.currentQuantity || 0), 0);
    const inventoryPercentage = totalCapacity > 0 ? Math.round((currentStock / totalCapacity) * 100) : 0;

    return {
      ...machine,
      location,
      inventory,
      alerts,
      recentVisits: visits.slice(0, 10),
      salesSummary,
      inventoryPercentage,
    };
  }

  async createMachine(machine: InsertMachine): Promise<Machine> {
    const [newMachine] = await db.insert(machines).values(machine).returning();
    return newMachine;
  }

  async updateMachine(id: string, machine: Partial<InsertMachine>): Promise<Machine | undefined> {
    const [updated] = await db.update(machines).set(machine).where(eq(machines.id, id)).returning();
    return updated;
  }

  async deleteMachine(id: string): Promise<boolean> {
    await db.update(machines).set({ isActive: false }).where(eq(machines.id, id));
    return true;
  }

  async getMachineInventory(machineId: string): Promise<(MachineInventory & { product: Product })[]> {
    const inventory = await db.select().from(machineInventory).where(eq(machineInventory.machineId, machineId));
    
    const result = await Promise.all(inventory.map(async (inv) => {
      const product = await this.getProduct(inv.productId);
      return { ...inv, product: product! };
    }));
    
    return result.filter(inv => inv.product);
  }

  async updateMachineInventory(machineId: string, productId: string, quantity: number): Promise<MachineInventory | undefined> {
    const [updated] = await db.update(machineInventory)
      .set({ currentQuantity: quantity, lastUpdated: new Date() })
      .where(and(eq(machineInventory.machineId, machineId), eq(machineInventory.productId, productId)))
      .returning();
    return updated;
  }

  async setMachineInventory(inventory: InsertMachineInventory): Promise<MachineInventory> {
    const existing = await db.select().from(machineInventory)
      .where(and(eq(machineInventory.machineId, inventory.machineId), eq(machineInventory.productId, inventory.productId)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(machineInventory)
        .set({ ...inventory, lastUpdated: new Date() })
        .where(eq(machineInventory.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [newInventory] = await db.insert(machineInventory).values(inventory).returning();
    return newInventory;
  }

  async getMachineAlerts(machineId?: string, resolved?: boolean, limit: number = 50): Promise<MachineAlert[]> {
    if (machineId && resolved !== undefined) {
      return db.select().from(machineAlerts)
        .where(and(eq(machineAlerts.machineId, machineId), eq(machineAlerts.isResolved, resolved)))
        .orderBy(desc(machineAlerts.createdAt))
        .limit(limit);
    }
    if (machineId) {
      return db.select().from(machineAlerts)
        .where(eq(machineAlerts.machineId, machineId))
        .orderBy(desc(machineAlerts.createdAt))
        .limit(limit);
    }
    if (resolved !== undefined) {
      return db.select().from(machineAlerts)
        .where(eq(machineAlerts.isResolved, resolved))
        .orderBy(desc(machineAlerts.createdAt))
        .limit(limit);
    }
    return db.select().from(machineAlerts).orderBy(desc(machineAlerts.createdAt)).limit(limit);
  }

  async createMachineAlert(alert: InsertMachineAlert): Promise<MachineAlert> {
    const [newAlert] = await db.insert(machineAlerts).values(alert).returning();
    return newAlert;
  }

  async resolveAlert(id: string, userId: string): Promise<MachineAlert | undefined> {
    const [updated] = await db.update(machineAlerts)
      .set({ isResolved: true, resolvedAt: new Date(), resolvedBy: userId })
      .where(eq(machineAlerts.id, id))
      .returning();
    return updated;
  }

  async resolveAlertSimple(id: string): Promise<MachineAlert | undefined> {
    const [updated] = await db.update(machineAlerts)
      .set({ isResolved: true, resolvedAt: new Date() })
      .where(eq(machineAlerts.id, id))
      .returning();
    return updated;
  }

  async getMachineVisits(machineId: string): Promise<MachineVisit[]> {
    return db.select().from(machineVisits)
      .where(eq(machineVisits.machineId, machineId))
      .orderBy(desc(machineVisits.startTime))
      .limit(50);
  }

  async createMachineVisit(visit: InsertMachineVisit): Promise<MachineVisit> {
    const [newVisit] = await db.insert(machineVisits).values(visit).returning();
    return newVisit;
  }

  async endMachineVisit(id: string, endTime: Date, notes?: string): Promise<MachineVisit | undefined> {
    const [visit] = await db.select().from(machineVisits).where(eq(machineVisits.id, id));
    if (!visit) return undefined;

    const durationMinutes = Math.round((endTime.getTime() - new Date(visit.startTime).getTime()) / 60000);
    
    const [updated] = await db.update(machineVisits)
      .set({ endTime, durationMinutes, notes: notes || visit.notes })
      .where(eq(machineVisits.id, id))
      .returning();
    return updated;
  }

  async getMachineSales(machineId: string, startDate?: Date, endDate?: Date): Promise<MachineSale[]> {
    let conditions = [eq(machineSales.machineId, machineId)];
    
    if (startDate) {
      conditions.push(gte(machineSales.saleDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(machineSales.saleDate, endDate));
    }
    
    return db.select().from(machineSales)
      .where(and(...conditions))
      .orderBy(desc(machineSales.saleDate));
  }

  async getAllMachineSales(): Promise<MachineSale[]> {
    return db.select().from(machineSales)
      .orderBy(desc(machineSales.saleDate));
  }

  async createMachineSale(sale: InsertMachineSale): Promise<MachineSale> {
    const [newSale] = await db.insert(machineSales).values(sale).returning();
    return newSale;
  }

  async getMachineSalesSummary(machineId: string): Promise<{ today: number; week: number; month: number }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const todaySales = await db.select({ total: sql<string>`COALESCE(SUM(${machineSales.totalAmount}), 0)` })
      .from(machineSales)
      .where(and(eq(machineSales.machineId, machineId), gte(machineSales.saleDate, todayStart)));

    const weekSales = await db.select({ total: sql<string>`COALESCE(SUM(${machineSales.totalAmount}), 0)` })
      .from(machineSales)
      .where(and(eq(machineSales.machineId, machineId), gte(machineSales.saleDate, weekStart)));

    const monthSales = await db.select({ total: sql<string>`COALESCE(SUM(${machineSales.totalAmount}), 0)` })
      .from(machineSales)
      .where(and(eq(machineSales.machineId, machineId), gte(machineSales.saleDate, monthStart)));

    return {
      today: parseFloat(todaySales[0]?.total || "0"),
      week: parseFloat(weekSales[0]?.total || "0"),
      month: parseFloat(monthSales[0]?.total || "0"),
    };
  }

  // ==================== MÓDULO ALMACÉN ====================

  // Proveedores
  async getSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(suppliers.name);
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db.insert(suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updated] = await db.update(suppliers).set(supplier).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
    return true;
  }

  // Inventario de Almacén
  async getWarehouseInventory(): Promise<(WarehouseInventory & { product: Product })[]> {
    const inventory = await db.select().from(warehouseInventory);
    
    const result = await Promise.all(inventory.map(async (inv) => {
      const product = await this.getProduct(inv.productId);
      return { ...inv, product: product! };
    }));
    
    return result.filter(inv => inv.product);
  }

  async getWarehouseInventoryItem(productId: string): Promise<WarehouseInventory | undefined> {
    const [item] = await db.select().from(warehouseInventory).where(eq(warehouseInventory.productId, productId));
    return item;
  }

  async updateWarehouseStock(productId: string, quantity: number): Promise<WarehouseInventory> {
    const existing = await this.getWarehouseInventoryItem(productId);
    
    if (existing) {
      const [updated] = await db.update(warehouseInventory)
        .set({ currentStock: quantity, lastUpdated: new Date() })
        .where(eq(warehouseInventory.productId, productId))
        .returning();
      return updated;
    }
    
    const [newInventory] = await db.insert(warehouseInventory)
      .values({ productId, currentStock: quantity })
      .returning();
    return newInventory;
  }

  async updateWarehouseInventory(productId: string, data: { currentStock?: number; minStock?: number; maxStock?: number; reorderPoint?: number }): Promise<WarehouseInventory> {
    const existing = await this.getWarehouseInventoryItem(productId);
    
    const updateData: any = { lastUpdated: new Date() };
    if (data.currentStock !== undefined) updateData.currentStock = data.currentStock;
    if (data.minStock !== undefined) updateData.minStock = data.minStock;
    if (data.maxStock !== undefined) updateData.maxStock = data.maxStock;
    if (data.reorderPoint !== undefined) updateData.reorderPoint = data.reorderPoint;
    
    if (existing) {
      const [updated] = await db.update(warehouseInventory)
        .set(updateData)
        .where(eq(warehouseInventory.productId, productId))
        .returning();
      return updated;
    }
    
    const [newInventory] = await db.insert(warehouseInventory)
      .values({ 
        productId, 
        currentStock: data.currentStock ?? 0,
        minStock: data.minStock,
        maxStock: data.maxStock,
        reorderPoint: data.reorderPoint,
      })
      .returning();
    return newInventory;
  }

  async getLowStockAlerts(): Promise<(WarehouseInventory & { product: Product })[]> {
    // Usar JOIN para evitar N+1 queries
    const results = await db.select({
        inventory: warehouseInventory,
        product: products
      })
      .from(warehouseInventory)
      .leftJoin(products, eq(warehouseInventory.productId, products.id))
      .limit(50);
    
    return results
      .filter(r => r.product && (r.inventory.currentStock || 0) <= (r.inventory.reorderPoint || 20))
      .map(r => ({ ...r.inventory, product: r.product! }));
  }

  // Lotes de Productos
  async getProductLots(productId?: string, limit: number = 50): Promise<(ProductLot & { product: Product; supplier?: Supplier })[]> {
    // Usar JOIN para evitar N+1 queries
    const baseQuery = db.select({
        lot: productLots,
        product: products,
        supplier: suppliers
      })
      .from(productLots)
      .leftJoin(products, eq(productLots.productId, products.id))
      .leftJoin(suppliers, eq(productLots.supplierId, suppliers.id));
    
    const results = productId
      ? await baseQuery
          .where(and(eq(productLots.productId, productId), eq(productLots.isActive, true)))
          .orderBy(asc(productLots.expirationDate))
          .limit(limit)
      : await baseQuery
          .where(eq(productLots.isActive, true))
          .orderBy(asc(productLots.expirationDate))
          .limit(limit);
    
    return results
      .filter(r => r.product)
      .map(r => ({ ...r.lot, product: r.product!, supplier: r.supplier || undefined }));
  }

  async getProductLot(id: string): Promise<ProductLot | undefined> {
    const [lot] = await db.select().from(productLots).where(eq(productLots.id, id));
    return lot;
  }

  async createProductLot(lot: InsertProductLot): Promise<ProductLot> {
    const [newLot] = await db.insert(productLots)
      .values({ ...lot, remainingQuantity: lot.quantity })
      .returning();
    return newLot;
  }

  async updateProductLot(id: string, lot: Partial<InsertProductLot>): Promise<ProductLot | undefined> {
    const [updated] = await db.update(productLots).set(lot).where(eq(productLots.id, id)).returning();
    return updated;
  }

  async getExpiringLots(days: number, limit: number = 30): Promise<(ProductLot & { product: Product })[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    // Usar JOIN para evitar N+1 queries
    const results = await db.select({
        lot: productLots,
        product: products
      })
      .from(productLots)
      .leftJoin(products, eq(productLots.productId, products.id))
      .where(and(
        eq(productLots.isActive, true),
        lte(productLots.expirationDate, futureDate),
        gte(productLots.remainingQuantity, 1)
      ))
      .orderBy(asc(productLots.expirationDate))
      .limit(limit);
    
    return results
      .filter(r => r.product)
      .map(r => ({ ...r.lot, product: r.product! }));
  }

  // Movimientos de Almacén (Kardex)
  async getWarehouseMovements(productId?: string, limit: number = 20): Promise<(WarehouseMovement & { product: Product })[]> {
    // Usar JOIN en lugar de Promise.all para evitar N+1 queries
    const query = productId
      ? db.select({
          movement: warehouseMovements,
          product: products
        })
        .from(warehouseMovements)
        .leftJoin(products, eq(warehouseMovements.productId, products.id))
        .where(eq(warehouseMovements.productId, productId))
        .orderBy(desc(warehouseMovements.createdAt))
        .limit(limit)
      : db.select({
          movement: warehouseMovements,
          product: products
        })
        .from(warehouseMovements)
        .leftJoin(products, eq(warehouseMovements.productId, products.id))
        .orderBy(desc(warehouseMovements.createdAt))
        .limit(limit);
    
    const results = await query;
    
    return results
      .filter(r => r.product)
      .map(r => ({ ...r.movement, product: r.product! }));
  }

  async createWarehouseMovement(movement: InsertWarehouseMovement): Promise<WarehouseMovement> {
    const [newMovement] = await db.insert(warehouseMovements).values(movement).returning();
    return newMovement;
  }

  async registerPurchaseEntry(data: { 
    productId: string; 
    quantity: number; 
    unitCost: number; 
    supplierId?: string; 
    lotNumber: string; 
    expirationDate?: Date; 
    notes?: string;
    userId?: string;
  }): Promise<WarehouseMovement> {
    const currentInventory = await this.getWarehouseInventoryItem(data.productId);
    const previousStock = currentInventory?.currentStock || 0;
    const newStock = previousStock + data.quantity;

    // Crear lote
    const lot = await this.createProductLot({
      productId: data.productId,
      lotNumber: data.lotNumber,
      quantity: data.quantity,
      costPrice: String(data.unitCost),
      expirationDate: data.expirationDate,
      supplierId: data.supplierId,
      notes: data.notes,
    });

    // Actualizar inventario
    await this.updateWarehouseStock(data.productId, newStock);

    // Registrar movimiento con userId para auditoría
    const movement = await this.createWarehouseMovement({
      productId: data.productId,
      lotId: lot.id,
      movementType: "entrada_compra",
      quantity: data.quantity,
      previousStock,
      newStock,
      unitCost: String(data.unitCost),
      totalCost: String(data.quantity * data.unitCost),
      supplierId: data.supplierId,
      userId: data.userId,
      notes: data.notes,
    });

    return movement;
  }

  async registerSupplierExit(data: { 
    productId: string; 
    quantity: number; 
    destinationUserId?: string; 
    notes?: string;
    userId?: string;
    movementType?: "salida_abastecedor" | "salida_maquina";
  }): Promise<WarehouseMovement> {
    const currentInventory = await this.getWarehouseInventoryItem(data.productId);
    const previousStock = currentInventory?.currentStock || 0;
    
    if (previousStock < data.quantity) {
      throw new Error("Stock insuficiente");
    }
    
    const newStock = previousStock - data.quantity;

    // Actualizar inventario
    await this.updateWarehouseStock(data.productId, newStock);

    // Descontar de lotes (FEFO - primero los más próximos a caducar, ya ordenados por expirationDate)
    const lots = await this.getProductLots(data.productId);
    let remaining = data.quantity;
    let runningStock = previousStock;
    const lotDeductions: { lotId: string; lotNumber: string; quantity: number; unitCost: string | null }[] = [];
    
    for (const lot of lots) {
      if (remaining <= 0) break;
      
      const toDeduct = Math.min(remaining, lot.remainingQuantity);
      await db.update(productLots)
        .set({ remainingQuantity: lot.remainingQuantity - toDeduct })
        .where(eq(productLots.id, lot.id));
      
      lotDeductions.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        quantity: toDeduct,
        unitCost: lot.costPrice,
      });
      remaining -= toDeduct;
    }

    // Registrar movimiento con trazabilidad de lotes usados
    // Creamos UN movimiento principal con los detalles de todos los lotes en notes
    const lotDetails = lotDeductions.map(l => `Lote ${l.lotNumber}: ${l.quantity} uds`).join(", ");
    const movement = await this.createWarehouseMovement({
      productId: data.productId,
      lotId: lotDeductions.length === 1 ? lotDeductions[0].lotId : undefined,
      movementType: data.movementType || "salida_abastecedor",
      quantity: data.quantity,
      previousStock,
      newStock,
      destinationUserId: data.destinationUserId,
      userId: data.userId,
      notes: data.notes ? `${data.notes} | Lotes: ${lotDetails}` : `Lotes: ${lotDetails}`,
    });

    // NOTA: La actualización del inventario del abastecedor se hace en loadProductsFromWarehouse
    // para evitar duplicación cuando se llama directamente a registerSupplierExit

    return movement;
  }

  async registerInventoryAdjustment(data: { 
    productId: string; 
    physicalCount: number; 
    reason: string;
    notes?: string;
    userId?: string;
  }): Promise<WarehouseMovement> {
    const currentInventory = await this.getWarehouseInventoryItem(data.productId);
    const previousStock = currentInventory?.currentStock || 0;
    const newStock = data.physicalCount;
    const difference = newStock - previousStock;
    
    // Actualizar inventario con el conteo físico
    await this.updateWarehouseStock(data.productId, newStock);

    // Registrar movimiento de ajuste con información detallada
    const movement = await this.createWarehouseMovement({
      productId: data.productId,
      movementType: "ajuste_inventario",
      quantity: Math.abs(difference),
      previousStock,
      newStock,
      userId: data.userId,
      reference: data.reason,
      notes: `${difference >= 0 ? "Ajuste positivo" : "Ajuste negativo"} (${difference > 0 ? "+" : ""}${difference} unidades)` + 
             (data.notes ? ` - ${data.notes}` : ""),
    });

    return movement;
  }

  // ==================== MÓDULO ABASTECEDOR ====================

  // Rutas
  async getRoutes(userId?: string, date?: Date, status?: string): Promise<any[]> {
    let conditions: any[] = [];
    
    if (userId) conditions.push(eq(routes.supplierId, userId));
    if (status) conditions.push(eq(routes.status, status));
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(routes.date, startOfDay));
      conditions.push(lte(routes.date, endOfDay));
    }
    
    const result = conditions.length > 0
      ? await db.select().from(routes).where(and(...conditions)).orderBy(desc(routes.date)).limit(50)
      : await db.select().from(routes).orderBy(desc(routes.date)).limit(50);
    
    if (result.length === 0) return [];
    
    // Precargar todos los datos necesarios en paralelo (evita N+1)
    const routeIds = result.map(r => r.id);
    const userIds = Array.from(new Set([
      ...result.map(r => r.supplierId),
      ...result.filter(r => r.supervisorId).map(r => r.supervisorId!)
    ]));
    
    const [allUsers, allStops, allMachines, allLocations] = await Promise.all([
      db.select().from(users).where(sql`${users.id} = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::text[])`),
      db.select().from(routeStops).where(sql`${routeStops.routeId} = ANY(ARRAY[${sql.join(routeIds.map(id => sql`${id}`), sql`, `)}]::text[])`).orderBy(asc(routeStops.order)),
      db.select().from(machines),
      db.select().from(locations)
    ]);
    
    // Crear Maps para lookups O(1)
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const machineMap = new Map(allMachines.map(m => [m.id, m]));
    const locationMap = new Map(allLocations.map(l => [l.id, l]));
    
    // Agrupar paradas por ruta
    const stopsByRoute = new Map<string, any[]>();
    for (const stop of allStops) {
      const machine = machineMap.get(stop.machineId);
      const location = machine?.locationId ? locationMap.get(machine.locationId) : undefined;
      const stopWithMachine = {
        ...stop,
        machine: machine ? { ...machine, location } : undefined
      };
      if (!stopsByRoute.has(stop.routeId)) {
        stopsByRoute.set(stop.routeId, []);
      }
      stopsByRoute.get(stop.routeId)!.push(stopWithMachine);
    }
    
    // Construir resultado final
    return result.map(route => ({
      ...route,
      supplier: userMap.get(route.supplierId),
      supervisor: route.supervisorId ? userMap.get(route.supervisorId) : undefined,
      stops: stopsByRoute.get(route.id) || []
    }));
  }

  async getRoute(id: string): Promise<any> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    if (!route) return undefined;
    
    const supplier = await this.getUser(route.supplierId);
    const supervisor = route.supervisorId ? await this.getUser(route.supervisorId) : undefined;
    const stops = await this.getRouteStops(route.id);
    
    return { ...route, supplier, supervisor, stops };
  }

  async getTodayRoute(userId: string): Promise<any> {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [route] = await db.select().from(routes)
      .where(and(
        eq(routes.supplierId, userId),
        gte(routes.date, startOfDay),
        lte(routes.date, endOfDay)
      ));
    
    if (!route) return undefined;
    
    return this.getRoute(route.id);
  }

  async createRoute(route: InsertRoute): Promise<Route> {
    const [newRoute] = await db.insert(routes).values(route).returning();
    return newRoute;
  }

  async updateRoute(id: string, route: Partial<InsertRoute>): Promise<Route | undefined> {
    const [updated] = await db.update(routes).set(route).where(eq(routes.id, id)).returning();
    return updated;
  }

  async startRoute(id: string): Promise<Route | undefined> {
    const [updated] = await db.update(routes)
      .set({ status: "en_progreso", startTime: new Date() })
      .where(eq(routes.id, id))
      .returning();
    return updated;
  }

  async completeRoute(id: string): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    if (!route || !route.startTime) return undefined;
    
    const endTime = new Date();
    const actualDuration = Math.round((endTime.getTime() - new Date(route.startTime).getTime()) / 60000);
    
    const [updated] = await db.update(routes)
      .set({ status: "completada", endTime, actualDuration })
      .where(eq(routes.id, id))
      .returning();
    return updated;
  }

  // Paradas de Ruta
  async getRouteStops(routeId: string): Promise<any[]> {
    const stops = await db.select().from(routeStops)
      .where(eq(routeStops.routeId, routeId))
      .orderBy(asc(routeStops.order));
    
    const stopsWithDetails = await Promise.all(stops.map(async (stop) => {
      const machine = await this.getMachineWithDetails(stop.machineId);
      return { ...stop, machine };
    }));
    
    return stopsWithDetails;
  }

  async getRouteStopsBatch(routeIds: string[]): Promise<Record<string, any[]>> {
    if (routeIds.length === 0) return {};
    
    // Obtener todas las paradas para los routeIds en una sola query
    const allStops = await db.select().from(routeStops)
      .where(inArray(routeStops.routeId, routeIds))
      .orderBy(asc(routeStops.order));
    
    // Obtener todos los machineIds únicos
    const machineIds = Array.from(new Set(allStops.map(s => s.machineId)));
    
    // Obtener detalles de todas las máquinas en paralelo
    const machinesWithDetails = await Promise.all(
      machineIds.map(id => this.getMachineWithDetails(id))
    );
    const machineMap = new Map(machinesWithDetails.map(m => [m?.id, m]));
    
    // Agrupar por routeId y adjuntar detalles de máquina
    const result: Record<string, any[]> = {};
    routeIds.forEach(id => { result[id] = []; });
    
    allStops.forEach(stop => {
      const machine = machineMap.get(stop.machineId);
      result[stop.routeId].push({ ...stop, machine });
    });
    
    return result;
  }

  async getRouteStop(id: string): Promise<any> {
    const [stop] = await db.select().from(routeStops).where(eq(routeStops.id, id));
    if (!stop) return undefined;
    
    const machine = await this.getMachineWithDetails(stop.machineId);
    return { ...stop, machine };
  }

  async createRouteStop(stop: InsertRouteStop): Promise<RouteStop> {
    const [newStop] = await db.insert(routeStops).values(stop).returning();
    return newStop;
  }

  async updateRouteStop(id: string, stop: Partial<RouteStop>): Promise<RouteStop | undefined> {
    const [updated] = await db.update(routeStops).set(stop).where(eq(routeStops.id, id)).returning();
    return updated;
  }

  async startStop(id: string): Promise<RouteStop | undefined> {
    const [updated] = await db.update(routeStops)
      .set({ status: "en_progreso", actualArrival: new Date() })
      .where(eq(routeStops.id, id))
      .returning();
    return updated;
  }

  async completeStop(id: string): Promise<RouteStop | undefined> {
    const [stop] = await db.select().from(routeStops).where(eq(routeStops.id, id));
    if (!stop || !stop.actualArrival) return undefined;
    
    const actualDeparture = new Date();
    const durationMinutes = Math.round((actualDeparture.getTime() - new Date(stop.actualArrival).getTime()) / 60000);
    
    const [updated] = await db.update(routeStops)
      .set({ status: "completada", actualDeparture, durationMinutes })
      .where(eq(routeStops.id, id))
      .returning();
    
    // Actualizar contador de paradas completadas en la ruta
    const routeData = await this.getRoute(stop.routeId);
    if (routeData) {
      await db.update(routes)
        .set({ completedStops: (routeData.completedStops || 0) + 1 })
        .where(eq(routes.id, stop.routeId));
    }
    
    return updated;
  }

  async deleteRoute(id: string): Promise<boolean> {
    await db.delete(routeStops).where(eq(routeStops.routeId, id));
    const result = await db.delete(routes).where(eq(routes.id, id));
    return true;
  }

  async deleteRouteStop(id: string): Promise<boolean> {
    const [stop] = await db.select().from(routeStops).where(eq(routeStops.id, id));
    if (!stop) return false;
    
    await db.delete(routeStops).where(eq(routeStops.id, id));
    
    const routeData = await this.getRoute(stop.routeId);
    if (routeData && routeData.totalStops && routeData.totalStops > 0) {
      await db.update(routes)
        .set({ totalStops: routeData.totalStops - 1 })
        .where(eq(routes.id, stop.routeId));
    }
    
    return true;
  }

  // Registros de Servicio
  async getServiceRecords(userId?: string, machineId?: string, limit?: number): Promise<any[]> {
    let conditions: any[] = [];
    
    if (userId) conditions.push(eq(serviceRecords.userId, userId));
    if (machineId) conditions.push(eq(serviceRecords.machineId, machineId));
    
    const query = conditions.length > 0
      ? db.select().from(serviceRecords).where(and(...conditions))
      : db.select().from(serviceRecords);
    
    const records = await query.orderBy(desc(serviceRecords.startTime)).limit(limit || 50);
    
    const recordsWithDetails = await Promise.all(records.map(async (record) => {
      const machine = await this.getMachine(record.machineId);
      const user = await this.getUser(record.userId);
      const loads = await this.getProductLoads(record.id);
      const cash = await db.select().from(cashCollections).where(eq(cashCollections.serviceRecordId, record.id));
      const issues = await db.select().from(issueReports).where(eq(issueReports.serviceRecordId, record.id));
      return { ...record, machine, user, productLoads: loads, cashCollections: cash, issues };
    }));
    
    return recordsWithDetails;
  }

  async getServiceRecord(id: string): Promise<any> {
    const [record] = await db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    if (!record) return undefined;
    
    const machine = await this.getMachineWithDetails(record.machineId);
    const user = await this.getUser(record.userId);
    const loads = await this.getProductLoads(id);
    const cash = await db.select().from(cashCollections).where(eq(cashCollections.serviceRecordId, id));
    const issues = await db.select().from(issueReports).where(eq(issueReports.serviceRecordId, id));
    
    return { ...record, machine, user, productLoads: loads, cashCollections: cash, issues };
  }

  async getActiveService(userId: string, routeStopId?: string): Promise<ServiceRecord | undefined> {
    const conditions = [eq(serviceRecords.userId, userId), eq(serviceRecords.status, "en_progreso")];
    if (routeStopId) {
      conditions.push(eq(serviceRecords.routeStopId, routeStopId));
    }
    const [record] = await db.select().from(serviceRecords).where(and(...conditions));
    return record;
  }

  async startService(data: InsertServiceRecord): Promise<ServiceRecord> {
    const [record] = await db.insert(serviceRecords).values(data).returning();
    
    // Actualizar última visita de la máquina
    await db.update(machines)
      .set({ lastVisit: new Date() })
      .where(eq(machines.id, data.machineId));
    
    // Actualizar estado de la parada si existe
    if (data.routeStopId) {
      await db.update(routeStops)
        .set({ status: "en_progreso", actualArrival: new Date() })
        .where(eq(routeStops.id, data.routeStopId));
    }
    
    return record;
  }

  async endService(id: string, notes?: string, signature?: string, responsibleName?: string, checklistData?: string): Promise<ServiceRecord | undefined> {
    const [record] = await db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    if (!record) return undefined;
    
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - new Date(record.startTime).getTime()) / 60000);
    
    const [updated] = await db.update(serviceRecords)
      .set({ 
        endTime, 
        durationMinutes, 
        status: "completado",
        notes: notes || record.notes,
        signature: signature || null,
        responsibleName: responsibleName || null,
        checklistData: checklistData || record.checklistData,
      })
      .where(eq(serviceRecords.id, id))
      .returning();
    
    // Actualizar estado de la parada si existe
    if (record.routeStopId) {
      const [stop] = await db.select().from(routeStops).where(eq(routeStops.id, record.routeStopId));
      if (stop && stop.actualArrival) {
        const actualDeparture = new Date();
        const stopDuration = Math.round((actualDeparture.getTime() - new Date(stop.actualArrival).getTime()) / 60000);
        
        await db.update(routeStops)
          .set({ status: "completada", actualDeparture, durationMinutes: stopDuration })
          .where(eq(routeStops.id, record.routeStopId));
        
        // Actualizar contador de paradas completadas en la ruta
        const routeData = await this.getRoute(stop.routeId);
        if (routeData) {
          await db.update(routes)
            .set({ completedStops: (routeData.completedStops || 0) + 1 })
            .where(eq(routes.id, stop.routeId));
        }
      }
    }
    
    return updated;
  }

  // Recolección de Efectivo
  async getCashCollections(userId?: string, machineId?: string, startDate?: Date, endDate?: Date, limit: number = 30): Promise<any[]> {
    let conditions: any[] = [];
    
    if (userId) conditions.push(eq(cashCollections.userId, userId));
    if (machineId) conditions.push(eq(cashCollections.machineId, machineId));
    if (startDate) conditions.push(gte(cashCollections.createdAt, startDate));
    if (endDate) conditions.push(lte(cashCollections.createdAt, endDate));
    
    // Usar JOIN para evitar N+1 queries
    const query = conditions.length > 0
      ? db.select({
          collection: cashCollections,
          machine: machines
        })
        .from(cashCollections)
        .leftJoin(machines, eq(cashCollections.machineId, machines.id))
        .where(and(...conditions))
        .orderBy(desc(cashCollections.createdAt))
        .limit(limit)
      : db.select({
          collection: cashCollections,
          machine: machines
        })
        .from(cashCollections)
        .leftJoin(machines, eq(cashCollections.machineId, machines.id))
        .orderBy(desc(cashCollections.createdAt))
        .limit(limit);
    
    const results = await query;
    
    return results.map(r => ({
      ...r.collection,
      machine: r.machine
    }));
  }

  async createCashCollection(collection: InsertCashCollection): Promise<CashCollection> {
    const difference = collection.expectedAmount 
      ? parseFloat(collection.actualAmount) - parseFloat(collection.expectedAmount)
      : null;
    
    const [newCollection] = await db.insert(cashCollections)
      .values({ ...collection, difference: difference?.toString() })
      .returning();
    return newCollection;
  }

  async getCashCollectionsSummary(userId: string, startDate?: Date, endDate?: Date): Promise<{ total: number; count: number; difference: number }> {
    let conditions = [eq(cashCollections.userId, userId)];
    if (startDate) conditions.push(gte(cashCollections.createdAt, startDate));
    if (endDate) conditions.push(lte(cashCollections.createdAt, endDate));
    
    const result = await db.select({
      total: sql<string>`COALESCE(SUM(${cashCollections.actualAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
      difference: sql<string>`COALESCE(SUM(${cashCollections.difference}), 0)`
    }).from(cashCollections).where(and(...conditions));
    
    return {
      total: parseFloat(result[0]?.total || "0"),
      count: result[0]?.count || 0,
      difference: parseFloat(result[0]?.difference || "0")
    };
  }

  // Carga/Retiro de Productos
  async getProductLoads(serviceRecordId?: string, machineId?: string, userId?: string): Promise<any[]> {
    let conditions: any[] = [];
    
    if (serviceRecordId) conditions.push(eq(productLoads.serviceRecordId, serviceRecordId));
    if (machineId) conditions.push(eq(productLoads.machineId, machineId));
    if (userId) conditions.push(eq(productLoads.userId, userId));
    
    const query = conditions.length > 0
      ? db.select().from(productLoads).where(and(...conditions))
      : db.select().from(productLoads);
    
    const loads = await query.orderBy(desc(productLoads.createdAt));
    
    const loadsWithDetails = await Promise.all(loads.map(async (load) => {
      const product = await this.getProduct(load.productId);
      return { ...load, product };
    }));
    
    return loadsWithDetails;
  }

  async createProductLoad(load: InsertProductLoad): Promise<ProductLoad> {
    const [newLoad] = await db.insert(productLoads).values(load).returning();
    
    // Actualizar inventario de la máquina
    const currentInventory = await this.getMachineInventory(load.machineId);
    const existingItem = currentInventory.find(inv => inv.productId === load.productId);
    
    if (existingItem) {
      const newQuantity = load.loadType === "cargado"
        ? (existingItem.currentQuantity || 0) + load.quantity
        : Math.max(0, (existingItem.currentQuantity || 0) - load.quantity);
      
      await this.updateMachineInventory(load.machineId, load.productId, newQuantity);
    } else if (load.loadType === "cargado") {
      await this.setMachineInventory({
        machineId: load.machineId,
        productId: load.productId,
        currentQuantity: load.quantity,
        maxCapacity: 20,
        minLevel: 5,
      });
    }
    
    // Sincronizar con inventario de almacén (restar del almacén cuando se carga a máquina)
    if (load.loadType === "cargado" && load.quantity > 0) {
      try {
        const machine = await this.getMachine(load.machineId);
        const machineName = machine?.name || load.machineId;
        
        // Registrar salida del almacén usando FEFO
        await this.registerSupplierExit({
          productId: load.productId,
          quantity: load.quantity,
          userId: load.userId,
          movementType: "salida_maquina",
          notes: `Carga a máquina: ${machineName}` + (load.notes ? ` - ${load.notes}` : ""),
        });
      } catch (error) {
        console.error("Error syncing warehouse inventory on product load:", error);
        // No lanzar error - la carga a máquina ya se registró, el sync de almacén puede fallar
      }
    }
    
    return newLoad;
  }

  // Reportes de Problemas
  async getIssueReports(machineId?: string, status?: string, userId?: string): Promise<any[]> {
    let conditions: any[] = [];
    
    if (machineId) conditions.push(eq(issueReports.machineId, machineId));
    if (status) conditions.push(eq(issueReports.status, status));
    if (userId) conditions.push(eq(issueReports.userId, userId));
    
    const query = conditions.length > 0
      ? db.select().from(issueReports).where(and(...conditions))
      : db.select().from(issueReports);
    
    const reports = await query.orderBy(desc(issueReports.createdAt));
    
    const reportsWithDetails = await Promise.all(reports.map(async (report) => {
      const machine = await this.getMachine(report.machineId);
      const user = await this.getUser(report.userId);
      const resolvedByUser = report.resolvedBy ? await this.getUser(report.resolvedBy) : undefined;
      return { ...report, machine, user, resolvedByUser };
    }));
    
    return reportsWithDetails;
  }
  
  async getIssueReportsByService(serviceRecordId: string): Promise<any[]> {
    const reports = await db.select().from(issueReports)
      .where(eq(issueReports.serviceRecordId, serviceRecordId))
      .orderBy(desc(issueReports.createdAt));
    
    return Promise.all(reports.map(async (report) => {
      const machine = await this.getMachine(report.machineId);
      const user = await this.getUser(report.userId);
      return { ...report, machine, user };
    }));
  }

  async getIssueReport(id: string): Promise<any> {
    const [report] = await db.select().from(issueReports).where(eq(issueReports.id, id));
    if (!report) return undefined;
    
    const machine = await this.getMachine(report.machineId);
    const user = await this.getUser(report.userId);
    const resolvedByUser = report.resolvedBy ? await this.getUser(report.resolvedBy) : undefined;
    
    return { ...report, machine, user, resolvedByUser };
  }

  async createIssueReport(report: InsertIssueReport): Promise<IssueReport> {
    const [newReport] = await db.insert(issueReports).values(report).returning();
    
    // Crear alerta en la máquina si es de alta prioridad
    if (report.priority === "alta" || report.priority === "critica") {
      await this.createMachineAlert({
        machineId: report.machineId,
        type: report.issueType,
        priority: report.priority,
        message: report.description,
      });
      
      // Actualizar estado de la máquina si es crítico
      if (report.priority === "critica") {
        await this.updateMachine(report.machineId, { status: "necesita_servicio" });
      }
    }
    
    return newReport;
  }

  async resolveIssue(id: string, userId: string, resolution: string): Promise<IssueReport | undefined> {
    const [updated] = await db.update(issueReports)
      .set({ 
        status: "resuelto", 
        resolvedAt: new Date(), 
        resolvedBy: userId,
        resolution 
      })
      .where(eq(issueReports.id, id))
      .returning();
    return updated;
  }

  // Inventario del Abastecedor
  async getSupplierInventory(userId: string): Promise<any[]> {
    const inventory = await db.select().from(supplierInventory)
      .where(eq(supplierInventory.userId, userId));
    
    const inventoryWithDetails = await Promise.all(inventory.map(async (item) => {
      const product = await this.getProduct(item.productId);
      const lot = item.lotId ? await this.getProductLot(item.lotId) : undefined;
      return { ...item, product, lot };
    }));
    
    return inventoryWithDetails.filter(item => item.product);
  }

  async updateSupplierInventoryItem(userId: string, productId: string, quantity: number, lotId?: string): Promise<SupplierInventory> {
    const [existing] = await db.select().from(supplierInventory)
      .where(and(eq(supplierInventory.userId, userId), eq(supplierInventory.productId, productId)));
    
    if (existing) {
      const [updated] = await db.update(supplierInventory)
        .set({ quantity, lotId, lastUpdated: new Date() })
        .where(eq(supplierInventory.id, existing.id))
        .returning();
      return updated;
    }
    
    const [newItem] = await db.insert(supplierInventory)
      .values({ userId, productId, quantity, lotId })
      .returning();
    return newItem;
  }

  async loadProductsFromWarehouse(userId: string, productId: string, quantity: number): Promise<void> {
    // Registrar salida del almacén hacia el abastecedor
    await this.registerSupplierExit({ productId, quantity, destinationUserId: userId });
    
    // Agregar al inventario del abastecedor
    const currentInv = await this.getSupplierInventory(userId);
    const existingItem = currentInv.find(inv => inv.productId === productId);
    const newQuantity = existingItem ? (existingItem.quantity || 0) + quantity : quantity;
    
    await this.updateSupplierInventoryItem(userId, productId, newQuantity);
  }

  async unloadProductsToMachine(userId: string, machineId: string, productId: string, quantity: number): Promise<void> {
    // Reducir inventario del abastecedor
    const currentInv = await this.getSupplierInventory(userId);
    const existingItem = currentInv.find(inv => inv.productId === productId);
    
    if (!existingItem || (existingItem.quantity || 0) < quantity) {
      throw new Error("Inventario insuficiente del abastecedor");
    }
    
    await this.updateSupplierInventoryItem(userId, productId, (existingItem.quantity || 0) - quantity);
    
    // Agregar al inventario de la máquina
    const machineInv = await this.getMachineInventory(machineId);
    const machineItem = machineInv.find(inv => inv.productId === productId);
    
    if (machineItem) {
      await this.updateMachineInventory(machineId, productId, (machineItem.currentQuantity || 0) + quantity);
    } else {
      await this.setMachineInventory({
        machineId,
        productId,
        currentQuantity: quantity,
        maxCapacity: 20,
        minLevel: 5,
      });
    }
  }

  // Estadísticas del Abastecedor
  async getSupplierStats(userId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate || new Date();
    
    // Total de servicios
    const services = await db.select({ count: sql<number>`COUNT(*)` })
      .from(serviceRecords)
      .where(and(
        eq(serviceRecords.userId, userId),
        gte(serviceRecords.startTime, start),
        lte(serviceRecords.startTime, end)
      ));
    
    // Tiempo total trabajado
    const timeWorked = await db.select({ 
      total: sql<number>`COALESCE(SUM(${serviceRecords.durationMinutes}), 0)` 
    })
      .from(serviceRecords)
      .where(and(
        eq(serviceRecords.userId, userId),
        gte(serviceRecords.startTime, start),
        lte(serviceRecords.startTime, end)
      ));
    
    // Efectivo recolectado
    const cashSummary = await this.getCashCollectionsSummary(userId, start, end);
    
    // Productos cargados
    const productsLoaded = await db.select({ 
      total: sql<number>`COALESCE(SUM(${productLoads.quantity}), 0)` 
    })
      .from(productLoads)
      .where(and(
        eq(productLoads.userId, userId),
        eq(productLoads.loadType, "cargado"),
        gte(productLoads.createdAt, start),
        lte(productLoads.createdAt, end)
      ));
    
    // Reportes creados
    const issuesReported = await db.select({ count: sql<number>`COUNT(*)` })
      .from(issueReports)
      .where(and(
        eq(issueReports.userId, userId),
        gte(issueReports.createdAt, start),
        lte(issueReports.createdAt, end)
      ));
    
    // Máquinas visitadas (únicas)
    const machinesVisited = await db.select({ count: sql<number>`COUNT(DISTINCT ${serviceRecords.machineId})` })
      .from(serviceRecords)
      .where(and(
        eq(serviceRecords.userId, userId),
        gte(serviceRecords.startTime, start),
        lte(serviceRecords.startTime, end)
      ));
    
    return {
      servicesCompleted: services[0]?.count || 0,
      totalTimeMinutes: timeWorked[0]?.total || 0,
      cashCollected: cashSummary.total,
      cashDifference: cashSummary.difference,
      productsLoaded: productsLoaded[0]?.total || 0,
      issuesReported: issuesReported[0]?.count || 0,
      machinesVisited: machinesVisited[0]?.count || 0,
    };
  }

  // ==================== MÓDULO PRODUCTOS Y DINERO ====================

  // Movimientos de Efectivo
  async getCashMovements(filters?: { userId?: string; type?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<any[]> {
    let conditions: any[] = [];
    
    if (filters?.userId) conditions.push(eq(cashMovements.userId, filters.userId));
    if (filters?.type) conditions.push(eq(cashMovements.type, filters.type));
    if (filters?.status) conditions.push(eq(cashMovements.status, filters.status));
    if (filters?.startDate) conditions.push(gte(cashMovements.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(cashMovements.createdAt, filters.endDate));
    
    const query = conditions.length > 0
      ? db.select().from(cashMovements).where(and(...conditions))
      : db.select().from(cashMovements);
    
    const movements = await query.orderBy(desc(cashMovements.createdAt));
    
    const movementsWithDetails = await Promise.all(movements.map(async (mov) => {
      const user = await this.getUser(mov.userId);
      const machine = mov.machineId ? await this.getMachine(mov.machineId) : undefined;
      const reconciliatedByUser = mov.reconciliatedBy ? await this.getUser(mov.reconciliatedBy) : undefined;
      return { ...mov, user, machine, reconciliatedByUser };
    }));
    
    return movementsWithDetails;
  }

  async getCashMovement(id: string): Promise<any> {
    const [movement] = await db.select().from(cashMovements).where(eq(cashMovements.id, id));
    if (!movement) return undefined;
    
    const user = await this.getUser(movement.userId);
    const machine = movement.machineId ? await this.getMachine(movement.machineId) : undefined;
    const reconciliatedByUser = movement.reconciliatedBy ? await this.getUser(movement.reconciliatedBy) : undefined;
    
    return { ...movement, user, machine, reconciliatedByUser };
  }

  async createCashMovement(movement: InsertCashMovement): Promise<CashMovement> {
    const difference = movement.expectedAmount && movement.amount
      ? parseFloat(movement.amount) - parseFloat(movement.expectedAmount)
      : null;
    
    const [newMovement] = await db.insert(cashMovements)
      .values({ ...movement, difference: difference?.toString() })
      .returning();
    return newMovement;
  }

  async updateCashMovementStatus(id: string, status: string): Promise<CashMovement | undefined> {
    const [updated] = await db.update(cashMovements)
      .set({ status })
      .where(eq(cashMovements.id, id))
      .returning();
    return updated;
  }

  async reconcileCashMovement(id: string, reconciledBy: string): Promise<CashMovement | undefined> {
    const [updated] = await db.update(cashMovements)
      .set({ status: "conciliado", reconciliatedAt: new Date(), reconciliatedBy: reconciledBy })
      .where(eq(cashMovements.id, id))
      .returning();
    return updated;
  }

  async getCashMovementsSummary(startDate?: Date, endDate?: Date): Promise<{ total: number; pending: number; delivered: number; deposited: number; differences: number }> {
    // Usar zona horaria GMT-4 (República Dominicana)
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
    
    // Si no se pasan fechas, usar últimos 30 días para mostrar datos reales
    // Si se pasan fechas, usar el rango exacto
    let start: Date;
    let end: Date;
    let depositDateCondition;
    
    if (startDate || endDate) {
      // Rango específico solicitado
      start = startDate || new Date(todayStr + 'T00:00:00-04:00');
      end = endDate || new Date(todayStr + 'T23:59:59.999-04:00');
      depositDateCondition = and(gte(bankDeposits.depositDate, start), lte(bankDeposits.depositDate, end));
    } else {
      // Default: últimos 30 días para mostrar datos reales
      start = new Date(new Date().setDate(new Date().getDate() - 30));
      end = new Date();
      depositDateCondition = and(gte(bankDeposits.depositDate, start), lte(bankDeposits.depositDate, end));
    }
    
    // Obtener movimientos del rango
    const movements = await db.select().from(cashMovements)
      .where(and(gte(cashMovements.createdAt, start), lte(cashMovements.createdAt, end)));
    
    // Obtener depósitos bancarios del rango
    const deposits = await db.select().from(bankDeposits)
      .where(depositDateCondition);
    
    const totalDeposited = deposits.reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0);
    
    return {
      total: movements.reduce((sum, m) => sum + parseFloat(m.amount || "0"), 0),
      pending: movements.filter(m => m.status === "pendiente").reduce((sum, m) => sum + parseFloat(m.amount || "0"), 0),
      delivered: movements.filter(m => m.status === "entregado").reduce((sum, m) => sum + parseFloat(m.amount || "0"), 0),
      deposited: totalDeposited,
      differences: movements.reduce((sum, m) => sum + parseFloat(m.difference || "0"), 0),
    };
  }

  // Depósitos Bancarios
  async getBankDeposits(filters?: { userId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<any[]> {
    let conditions: any[] = [];
    
    if (filters?.userId) conditions.push(eq(bankDeposits.userId, filters.userId));
    if (filters?.status) conditions.push(eq(bankDeposits.status, filters.status));
    if (filters?.startDate) conditions.push(gte(bankDeposits.depositDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(bankDeposits.depositDate, filters.endDate));
    
    const query = conditions.length > 0
      ? db.select().from(bankDeposits).where(and(...conditions))
      : db.select().from(bankDeposits);
    
    const deposits = await query.orderBy(desc(bankDeposits.depositDate));
    
    const depositsWithDetails = await Promise.all(deposits.map(async (dep) => {
      const user = await this.getUser(dep.userId);
      return { ...dep, user };
    }));
    
    return depositsWithDetails;
  }

  async getBankDeposit(id: string): Promise<any> {
    const [deposit] = await db.select().from(bankDeposits).where(eq(bankDeposits.id, id));
    if (!deposit) return undefined;
    
    const user = await this.getUser(deposit.userId);
    return { ...deposit, user };
  }

  async createBankDeposit(deposit: InsertBankDeposit): Promise<BankDeposit> {
    const [newDeposit] = await db.insert(bankDeposits).values(deposit).returning();
    return newDeposit;
  }

  async reconcileBankDeposit(id: string, reconciledAmount: number): Promise<BankDeposit | undefined> {
    const [updated] = await db.update(bankDeposits)
      .set({ 
        status: "conciliado", 
        reconciliatedAt: new Date(), 
        reconciliatedAmount: reconciledAmount.toString() 
      })
      .where(eq(bankDeposits.id, id))
      .returning();
    return updated;
  }

  // Transferencias de Productos
  async getProductTransfers(filters?: { type?: string; productId?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<any[]> {
    let conditions: any[] = [];
    
    if (filters?.type) conditions.push(eq(productTransfers.transferType, filters.type));
    if (filters?.productId) conditions.push(eq(productTransfers.productId, filters.productId));
    if (filters?.startDate) conditions.push(gte(productTransfers.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(productTransfers.createdAt, filters.endDate));
    
    const limit = filters?.limit || 30;
    
    // Usar JOIN para productos en lugar de N+1 queries
    const query = conditions.length > 0
      ? db.select({
          transfer: productTransfers,
          product: products
        })
        .from(productTransfers)
        .leftJoin(products, eq(productTransfers.productId, products.id))
        .where(and(...conditions))
        .orderBy(desc(productTransfers.createdAt))
        .limit(limit)
      : db.select({
          transfer: productTransfers,
          product: products
        })
        .from(productTransfers)
        .leftJoin(products, eq(productTransfers.productId, products.id))
        .orderBy(desc(productTransfers.createdAt))
        .limit(limit);
    
    const results = await query;
    
    return results.map(r => ({
      ...r.transfer,
      product: r.product
    }));
  }

  async getProductTransfer(id: string): Promise<any> {
    const [transfer] = await db.select().from(productTransfers).where(eq(productTransfers.id, id));
    if (!transfer) return undefined;
    
    const product = await this.getProduct(transfer.productId);
    const sourceUser = transfer.sourceUserId ? await this.getUser(transfer.sourceUserId) : undefined;
    const destinationUser = transfer.destinationUserId ? await this.getUser(transfer.destinationUserId) : undefined;
    
    return { ...transfer, product, sourceUser, destinationUser };
  }

  async createProductTransfer(transfer: InsertProductTransfer): Promise<ProductTransfer> {
    const [newTransfer] = await db.insert(productTransfers).values(transfer).returning();
    return newTransfer;
  }

  // Mermas
  async getShrinkageRecords(filters?: { type?: string; productId?: string; status?: string; limit?: number; startDate?: Date; endDate?: Date }): Promise<any[]> {
    let conditions: any[] = [];
    
    if (filters?.type) conditions.push(eq(shrinkageRecords.shrinkageType, filters.type));
    if (filters?.productId) conditions.push(eq(shrinkageRecords.productId, filters.productId));
    if (filters?.status) conditions.push(eq(shrinkageRecords.status, filters.status));
    if (filters?.startDate) conditions.push(gte(shrinkageRecords.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(shrinkageRecords.createdAt, filters.endDate));
    
    const limit = filters?.limit || 50;
    
    // Usar JOIN para productos en lugar de N+1 queries
    const query = conditions.length > 0
      ? db.select({
          record: shrinkageRecords,
          product: products
        })
        .from(shrinkageRecords)
        .leftJoin(products, eq(shrinkageRecords.productId, products.id))
        .where(and(...conditions))
        .orderBy(desc(shrinkageRecords.createdAt))
        .limit(limit)
      : db.select({
          record: shrinkageRecords,
          product: products
        })
        .from(shrinkageRecords)
        .leftJoin(products, eq(shrinkageRecords.productId, products.id))
        .orderBy(desc(shrinkageRecords.createdAt))
        .limit(limit);
    
    const results = await query;
    
    return results.map(r => ({
      ...r.record,
      product: r.product
    }));
  }

  async getShrinkageRecord(id: string): Promise<any> {
    const [record] = await db.select().from(shrinkageRecords).where(eq(shrinkageRecords.id, id));
    if (!record) return undefined;
    
    const product = await this.getProduct(record.productId);
    const user = await this.getUser(record.userId);
    
    return { ...record, product, user };
  }

  async createShrinkageRecord(record: InsertShrinkageRecord): Promise<ShrinkageRecord> {
    const product = await this.getProduct(record.productId);
    const unitCost = record.unitCost || product?.costPrice || "0";
    const totalLoss = (parseFloat(unitCost) * record.quantity).toString();
    
    const [newRecord] = await db.insert(shrinkageRecords)
      .values({ ...record, unitCost, totalLoss })
      .returning();
    return newRecord;
  }

  async approveShrinkage(id: string, approvedBy: string): Promise<ShrinkageRecord | undefined> {
    const [updated] = await db.update(shrinkageRecords)
      .set({ status: "aprobado", approvedBy })
      .where(eq(shrinkageRecords.id, id))
      .returning();
    return updated;
  }

  async getShrinkageSummary(startDate?: Date, endDate?: Date): Promise<{ 
    totalRecords: number; 
    totalQuantity: number; 
    totalCost: number; 
    pendingCount: number;
    byType: Record<string, { count: number; quantity: number; cost: number }>;
  }> {
    const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate || new Date();
    
    const records = await db.select().from(shrinkageRecords)
      .where(and(gte(shrinkageRecords.createdAt, start), lte(shrinkageRecords.createdAt, end)));
    
    const byType: Record<string, { count: number; quantity: number; cost: number }> = {};
    records.forEach(r => {
      if (!byType[r.shrinkageType]) {
        byType[r.shrinkageType] = { count: 0, quantity: 0, cost: 0 };
      }
      byType[r.shrinkageType].count++;
      byType[r.shrinkageType].quantity += r.quantity;
      byType[r.shrinkageType].cost += parseFloat(r.totalLoss || "0");
    });
    
    return {
      totalRecords: records.length,
      totalQuantity: records.reduce((sum, r) => sum + r.quantity, 0),
      totalCost: records.reduce((sum, r) => sum + parseFloat(r.totalLoss || "0"), 0),
      pendingCount: records.filter(r => r.status === 'pendiente').length,
      byType,
    };
  }

  // Conciliación
  async getDailyReconciliation(date: Date, endDate?: Date): Promise<any> {
    // Usar zona horaria GMT-4 (República Dominicana) para comparación de fechas
    let start: Date;
    let end: Date;
    let depositDateCondition;
    
    if (endDate) {
      // Rango específico solicitado
      start = date;
      end = endDate;
      depositDateCondition = and(gte(bankDeposits.depositDate, start), lte(bankDeposits.depositDate, end));
    } else {
      // Día específico o últimos 30 días si no hay datos hoy
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
      const startOfDay = new Date(dateStr + 'T00:00:00-04:00');
      const endOfDay = new Date(dateStr + 'T23:59:59.999-04:00');
      
      // Verificar si hay datos del día solicitado
      const dayCollections = await db.select().from(cashCollections)
        .where(and(gte(cashCollections.createdAt, startOfDay), lte(cashCollections.createdAt, endOfDay)));
      const dayMovements = await db.select().from(cashMovements)
        .where(and(gte(cashMovements.createdAt, startOfDay), lte(cashMovements.createdAt, endOfDay)));
      
      // Si hay datos del día, usar ese día; si no, usar últimos 30 días
      if (dayCollections.length > 0 || dayMovements.length > 0) {
        start = startOfDay;
        end = endOfDay;
        depositDateCondition = sql`DATE(${bankDeposits.depositDate}) = ${dateStr}`;
      } else {
        // Sin datos del día: mostrar últimos 30 días
        start = new Date(new Date().setDate(new Date().getDate() - 30));
        end = new Date();
        depositDateCondition = and(gte(bankDeposits.depositDate, start), lte(bankDeposits.depositDate, end));
      }
    }
    
    const collections = await db.select().from(cashCollections)
      .where(and(gte(cashCollections.createdAt, start), lte(cashCollections.createdAt, end)));
    
    const movements = await db.select().from(cashMovements)
      .where(and(gte(cashMovements.createdAt, start), lte(cashMovements.createdAt, end)));
    
    const deposits = await db.select().from(bankDeposits)
      .where(depositDateCondition);
    
    return {
      date: end,
      totalCollected: collections.reduce((sum, c) => sum + parseFloat(c.actualAmount || "0"), 0),
      totalExpected: collections.reduce((sum, c) => sum + parseFloat(c.expectedAmount || "0"), 0),
      totalDifference: collections.reduce((sum, c) => sum + parseFloat(c.difference || "0"), 0),
      totalDeposited: deposits.reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0),
      pendingMovements: movements.filter(m => m.status === "pendiente").length,
      collectionsCount: collections.length,
      movementsCount: movements.length,
      depositsCount: deposits.length,
    };
  }

  async getSupplierReconciliation(userId: string, date: Date): Promise<any> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const collections = await db.select().from(cashCollections)
      .where(and(
        eq(cashCollections.userId, userId),
        gte(cashCollections.createdAt, startOfDay),
        lte(cashCollections.createdAt, endOfDay)
      ));
    
    const user = await this.getUser(userId);
    
    const collectionsWithMachines = await Promise.all(collections.map(async (c) => {
      const machine = await this.getMachine(c.machineId);
      return { ...c, machine };
    }));
    
    return {
      user,
      date,
      collections: collectionsWithMachines,
      totalCollected: collections.reduce((sum, c) => sum + parseFloat(c.actualAmount || "0"), 0),
      totalExpected: collections.reduce((sum, c) => sum + parseFloat(c.expectedAmount || "0"), 0),
      totalDifference: collections.reduce((sum, c) => sum + parseFloat(c.difference || "0"), 0),
      machinesVisited: collections.length,
    };
  }

  // ==================== MÓDULO CAJA CHICA ====================

  // Gastos de Caja Chica
  async getPettyCashExpenses(filters?: { userId?: string; category?: string; status?: string; startDate?: Date; endDate?: Date }, limit: number = 30): Promise<any[]> {
    let conditions: any[] = [];
    
    if (filters?.userId) conditions.push(eq(pettyCashExpenses.userId, filters.userId));
    if (filters?.category) conditions.push(eq(pettyCashExpenses.category, filters.category));
    if (filters?.status) conditions.push(eq(pettyCashExpenses.status, filters.status));
    if (filters?.startDate) conditions.push(gte(pettyCashExpenses.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(pettyCashExpenses.createdAt, filters.endDate));
    
    // Usar JOIN para evitar N+1 queries (antes hacía 3 queries por cada gasto)
    const baseQuery = db.select({
        expense: pettyCashExpenses,
        user: users,
        machine: machines
      })
      .from(pettyCashExpenses)
      .leftJoin(users, eq(pettyCashExpenses.userId, users.id))
      .leftJoin(machines, eq(pettyCashExpenses.machineId, machines.id));
    
    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(pettyCashExpenses.createdAt)).limit(limit)
      : await baseQuery.orderBy(desc(pettyCashExpenses.createdAt)).limit(limit);
    
    return results.map(r => ({
      ...r.expense,
      user: r.user || undefined,
      machine: r.machine || undefined
    }));
  }

  async getPettyCashExpense(id: string): Promise<any> {
    const [expense] = await db.select().from(pettyCashExpenses).where(eq(pettyCashExpenses.id, id));
    if (!expense) return undefined;
    
    const user = await this.getUser(expense.userId);
    const machine = expense.machineId ? await this.getMachine(expense.machineId) : undefined;
    
    return { ...expense, user, machine };
  }

  async createPettyCashExpense(expense: InsertPettyCashExpense): Promise<PettyCashExpense> {
    const [newExpense] = await db.insert(pettyCashExpenses).values(expense).returning();
    return newExpense;
  }

  async approvePettyCashExpense(id: string, approvedBy: string): Promise<PettyCashExpense | undefined> {
    const [updated] = await db.update(pettyCashExpenses)
      .set({ status: "aprobado", approvedBy, approvedAt: new Date() })
      .where(eq(pettyCashExpenses.id, id))
      .returning();
    return updated;
  }

  async rejectPettyCashExpense(id: string, rejectedBy: string, reason: string): Promise<PettyCashExpense | undefined> {
    const [updated] = await db.update(pettyCashExpenses)
      .set({ status: "rechazado", rejectedBy, rejectedAt: new Date(), rejectionReason: reason })
      .where(eq(pettyCashExpenses.id, id))
      .returning();
    return updated;
  }

  async markPettyCashExpenseAsPaid(id: string): Promise<PettyCashExpense | undefined> {
    const expense = await this.getPettyCashExpense(id);
    if (!expense || expense.status !== "aprobado") return undefined;
    
    const [updated] = await db.update(pettyCashExpenses)
      .set({ status: "pagado", paidAt: new Date() })
      .where(eq(pettyCashExpenses.id, id))
      .returning();
    
    // Actualizar el saldo de caja chica
    await this.updatePettyCashBalance(parseFloat(expense.amount), 'subtract');
    
    // Registrar la transacción
    const fund = await this.getPettyCashFund();
    if (fund) {
      await this.createPettyCashTransaction({
        type: "gasto",
        amount: expense.amount,
        previousBalance: (parseFloat(fund.currentBalance) + parseFloat(expense.amount)).toString(),
        newBalance: fund.currentBalance,
        expenseId: id,
        userId: expense.userId,
        reference: `Gasto: ${expense.description}`,
      });
    }
    
    return updated;
  }

  // Fondo de Caja Chica
  async getPettyCashFund(): Promise<PettyCashFund | undefined> {
    const [fund] = await db.select().from(pettyCashFund).limit(1);
    return fund;
  }

  async initializePettyCashFund(fund: InsertPettyCashFund): Promise<PettyCashFund> {
    const existing = await this.getPettyCashFund();
    if (existing) {
      const [updated] = await db.update(pettyCashFund)
        .set({ ...fund, updatedAt: new Date() })
        .where(eq(pettyCashFund.id, existing.id))
        .returning();
      return updated;
    }
    
    const [newFund] = await db.insert(pettyCashFund).values(fund).returning();
    return newFund;
  }

  async updatePettyCashBalance(amount: number, type: 'add' | 'subtract'): Promise<PettyCashFund | undefined> {
    const fund = await this.getPettyCashFund();
    if (!fund) return undefined;
    
    const currentBalance = parseFloat(fund.currentBalance);
    const newBalance = type === 'add' ? currentBalance + amount : currentBalance - amount;
    
    const [updated] = await db.update(pettyCashFund)
      .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
      .where(eq(pettyCashFund.id, fund.id))
      .returning();
    return updated;
  }

  async replenishPettyCashFund(amount: number, userId: string): Promise<PettyCashFund | undefined> {
    const fund = await this.getPettyCashFund();
    if (!fund) return undefined;
    
    const previousBalance = parseFloat(fund.currentBalance);
    const newBalance = previousBalance + amount;
    
    const [updated] = await db.update(pettyCashFund)
      .set({ 
        currentBalance: newBalance.toString(), 
        lastReplenishmentDate: new Date(),
        lastReplenishmentAmount: amount.toString(),
        updatedAt: new Date() 
      })
      .where(eq(pettyCashFund.id, fund.id))
      .returning();
    
    // Registrar la transacción
    await this.createPettyCashTransaction({
      type: "reposicion",
      amount: amount.toString(),
      previousBalance: previousBalance.toString(),
      newBalance: newBalance.toString(),
      userId,
      reference: "Reposición de fondo",
    });
    
    return updated;
  }

  // Transacciones de Caja Chica
  async getPettyCashTransactions(limit?: number): Promise<any[]> {
    const query = limit
      ? db.select().from(pettyCashTransactions).orderBy(desc(pettyCashTransactions.createdAt)).limit(limit)
      : db.select().from(pettyCashTransactions).orderBy(desc(pettyCashTransactions.createdAt));
    
    const transactions = await query;
    
    const transactionsWithDetails = await Promise.all(transactions.map(async (t) => {
      const user = await this.getUser(t.userId);
      const expense = t.expenseId ? await this.getPettyCashExpense(t.expenseId) : undefined;
      return { ...t, user, expense };
    }));
    
    return transactionsWithDetails;
  }

  async createPettyCashTransaction(transaction: InsertPettyCashTransaction): Promise<PettyCashTransaction> {
    const [newTransaction] = await db.insert(pettyCashTransactions).values(transaction).returning();
    return newTransaction;
  }

  async getPettyCashStats(): Promise<{ currentBalance: number; todayExpenses: number; pendingApprovals: number; monthlyExpenses: number }> {
    const fund = await this.getPettyCashFund();
    const currentBalance = fund ? parseFloat(fund.currentBalance) : 0;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const todayExpensesResult = await db.select({ total: sql<string>`COALESCE(SUM(${pettyCashExpenses.amount}), 0)` })
      .from(pettyCashExpenses)
      .where(and(
        eq(pettyCashExpenses.status, "pagado"),
        gte(pettyCashExpenses.paidAt, todayStart)
      ));
    
    const pendingResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(pettyCashExpenses)
      .where(eq(pettyCashExpenses.status, "pendiente"));
    
    const monthlyExpensesResult = await db.select({ total: sql<string>`COALESCE(SUM(${pettyCashExpenses.amount}), 0)` })
      .from(pettyCashExpenses)
      .where(and(
        eq(pettyCashExpenses.status, "pagado"),
        gte(pettyCashExpenses.paidAt, monthStart)
      ));
    
    return {
      currentBalance,
      todayExpenses: parseFloat(todayExpensesResult[0]?.total || "0"),
      pendingApprovals: pendingResult[0]?.count || 0,
      monthlyExpenses: parseFloat(monthlyExpensesResult[0]?.total || "0"),
    };
  }

  // ==================== MÓDULO COMPRAS ====================

  async getPurchaseOrders(filters?: { supplierId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<any[]> {
    let conditions = [];
    
    if (filters?.supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
    }
    if (filters?.status) {
      conditions.push(eq(purchaseOrders.status, filters.status as any));
    }
    if (filters?.startDate) {
      conditions.push(gte(purchaseOrders.issueDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(purchaseOrders.issueDate, filters.endDate));
    }
    
    const orders = conditions.length > 0
      ? await db.select().from(purchaseOrders).where(and(...conditions)).orderBy(desc(purchaseOrders.createdAt))
      : await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
    
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      const supplier = await this.getSupplier(order.supplierId);
      const items = await this.getPurchaseOrderItems(order.id);
      const createdByUser = await this.getUser(order.createdBy);
      return { ...order, supplier, items, createdByUser, itemCount: items.length };
    }));
    
    return ordersWithDetails;
  }

  async getPurchaseOrder(id: string): Promise<any> {
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!order) return undefined;
    
    const supplier = await this.getSupplier(order.supplierId);
    const items = await this.getPurchaseOrderItems(order.id);
    const createdByUser = await this.getUser(order.createdBy);
    const receptions = await this.getPurchaseReceptions({ orderId: id });
    
    return { ...order, supplier, items, createdByUser, receptions };
  }

  async createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [newOrder] = await db.insert(purchaseOrders).values(order).returning();
    return newOrder;
  }

  async updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [updated] = await db.update(purchaseOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return updated;
  }

  async updatePurchaseOrderStatus(id: string, status: string, userId?: string, reason?: string): Promise<PurchaseOrder | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === "enviada" && userId) {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }
    if (status === "cancelada") {
      updateData.cancelledBy = userId;
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = reason;
    }
    
    const [updated] = await db.update(purchaseOrders)
      .set(updateData)
      .where(eq(purchaseOrders.id, id))
      .returning();
    return updated;
  }

  async deletePurchaseOrder(id: string): Promise<boolean> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
    const result = await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    return true;
  }

  async getNextOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.select({ count: sql<number>`COUNT(*)` })
      .from(purchaseOrders)
      .where(sql`EXTRACT(YEAR FROM ${purchaseOrders.createdAt}) = ${year}`);
    
    const count = (result[0]?.count || 0) + 1;
    return `OC-${year}-${String(count).padStart(4, "0")}`;
  }

  async getPurchaseOrderItems(orderId: string): Promise<any[]> {
    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
    
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await this.getProduct(item.productId);
      return { ...item, product };
    }));
    
    return itemsWithProducts;
  }

  async addPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [newItem] = await db.insert(purchaseOrderItems).values(item).returning();
    await this.recalculateOrderTotals(item.orderId);
    return newItem;
  }

  async updatePurchaseOrderItem(id: string, data: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined> {
    const [existing] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    if (!existing) return undefined;
    
    const [updated] = await db.update(purchaseOrderItems)
      .set(data)
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    
    await this.recalculateOrderTotals(existing.orderId);
    return updated;
  }

  async removePurchaseOrderItem(id: string): Promise<boolean> {
    const [existing] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    if (!existing) return false;
    
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    await this.recalculateOrderTotals(existing.orderId);
    return true;
  }

  async recalculateOrderTotals(orderId: string): Promise<void> {
    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId));
    
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    const taxAmount = subtotal * 0.16; // 16% IVA
    const total = subtotal + taxAmount;
    
    await db.update(purchaseOrders)
      .set({
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(purchaseOrders.id, orderId));
  }

  async getPurchaseReceptions(filters?: { orderId?: string; startDate?: Date; endDate?: Date }): Promise<any[]> {
    let conditions = [];
    
    if (filters?.orderId) {
      conditions.push(eq(purchaseReceptions.orderId, filters.orderId));
    }
    if (filters?.startDate) {
      conditions.push(gte(purchaseReceptions.receptionDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(purchaseReceptions.receptionDate, filters.endDate));
    }
    
    const receptions = conditions.length > 0
      ? await db.select().from(purchaseReceptions).where(and(...conditions)).orderBy(desc(purchaseReceptions.createdAt))
      : await db.select().from(purchaseReceptions).orderBy(desc(purchaseReceptions.createdAt));
    
    const receptionsWithDetails = await Promise.all(receptions.map(async (reception) => {
      const order = await this.getPurchaseOrder(reception.orderId);
      const receivedByUser = await this.getUser(reception.receivedBy);
      const items = await db.select().from(receptionItems).where(eq(receptionItems.receptionId, reception.id));
      
      const itemsWithProducts = await Promise.all(items.map(async (item) => {
        const product = await this.getProduct(item.productId);
        return { ...item, product };
      }));
      
      return { ...reception, order, receivedByUser, items: itemsWithProducts };
    }));
    
    return receptionsWithDetails;
  }

  async getPurchaseReception(id: string): Promise<any> {
    const [reception] = await db.select().from(purchaseReceptions).where(eq(purchaseReceptions.id, id));
    if (!reception) return undefined;
    
    const order = await this.getPurchaseOrder(reception.orderId);
    const receivedByUser = await this.getUser(reception.receivedBy);
    const items = await db.select().from(receptionItems).where(eq(receptionItems.receptionId, id));
    
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await this.getProduct(item.productId);
      return { ...item, product };
    }));
    
    return { ...reception, order, receivedByUser, items: itemsWithProducts };
  }

  async createPurchaseReception(reception: InsertPurchaseReception, items: Omit<InsertReceptionItem, 'receptionId'>[], userId?: string): Promise<PurchaseReception> {
    const [newReception] = await db.insert(purchaseReceptions).values(reception).returning();
    
    // Obtener datos de la orden para supplierId
    const order = await this.getPurchaseOrder(reception.orderId);
    
    for (const item of items) {
      await db.insert(receptionItems).values({
        ...item,
        receptionId: newReception.id
      });
      
      // Actualizar cantidad recibida en el item de la orden
      const [orderItem] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, item.orderItemId));
      if (orderItem) {
        const newReceivedQty = (orderItem.receivedQuantity || 0) + item.quantityReceived;
        await db.update(purchaseOrderItems)
          .set({ receivedQuantity: newReceivedQty })
          .where(eq(purchaseOrderItems.id, item.orderItemId));
      }
      
      // Leer stock ANTES de actualizar para registrar correctamente el movimiento
      const currentInventory = await this.getWarehouseInventoryItem(item.productId);
      const previousStock = currentInventory?.currentStock || 0;
      const newStock = previousStock + item.quantityReceived;
      
      // Crear lote de producto automáticamente (generar número de lote si no existe)
      const lotNumber = item.lotNumber || `REC-${newReception.receptionNumber}-${item.productId.slice(-4)}`;
      const lot = await this.createProductLot({
        productId: item.productId,
        lotNumber,
        quantity: item.quantityReceived,
        costPrice: item.unitCost?.toString(),
        expirationDate: item.expirationDate,
        supplierId: order?.supplierId,
        purchaseDate: new Date(),
        notes: `Recepción ${newReception.receptionNumber}` + (item.notes ? ` - ${item.notes}` : "")
      });
      
      // Actualizar inventario del almacén con el nuevo stock total
      await this.updateWarehouseStock(item.productId, newStock);
      
      // Registrar movimiento de almacén con trazabilidad completa
      await this.createWarehouseMovement({
        productId: item.productId,
        lotId: lot.id,
        movementType: "entrada_compra",
        quantity: item.quantityReceived,
        previousStock,
        newStock,
        unitCost: item.unitCost?.toString(),
        totalCost: item.unitCost ? String(item.quantityReceived * parseFloat(item.unitCost.toString())) : undefined,
        supplierId: order?.supplierId,
        userId,
        reference: `Recepción ${newReception.receptionNumber}`,
        notes: item.notes
      });
    }
    
    // Verificar si la orden está completa
    const orderItems = await this.getPurchaseOrderItems(reception.orderId);
    const allReceived = orderItems.every(item => (item.receivedQuantity || 0) >= item.quantity);
    const someReceived = orderItems.some(item => (item.receivedQuantity || 0) > 0);
    
    if (allReceived) {
      await this.updatePurchaseOrderStatus(reception.orderId, "recibida");
    } else if (someReceived) {
      await this.updatePurchaseOrderStatus(reception.orderId, "parcialmente_recibida");
    }
    
    return newReception;
  }

  async getNextReceptionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.select({ count: sql<number>`COUNT(*)` })
      .from(purchaseReceptions)
      .where(sql`EXTRACT(YEAR FROM ${purchaseReceptions.createdAt}) = ${year}`);
    
    const count = (result[0]?.count || 0) + 1;
    return `REC-${year}-${String(count).padStart(4, "0")}`;
  }

  async getPurchaseStats(startDate?: Date, endDate?: Date): Promise<{ totalOrders: number; totalAmount: number; pendingOrders: number; topSuppliers: any[] }> {
    let conditions = [];
    if (startDate) conditions.push(gte(purchaseOrders.createdAt, startDate));
    if (endDate) conditions.push(lte(purchaseOrders.createdAt, endDate));
    
    const ordersQuery = conditions.length > 0
      ? db.select().from(purchaseOrders).where(and(...conditions))
      : db.select().from(purchaseOrders);
    
    const orders = await ordersQuery;
    
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
    const pendingOrders = orders.filter(o => o.status === "borrador" || o.status === "enviada").length;
    
    // Top 5 proveedores por monto
    const supplierTotals: Record<string, { supplierId: string; total: number; count: number }> = {};
    for (const order of orders) {
      if (!supplierTotals[order.supplierId]) {
        supplierTotals[order.supplierId] = { supplierId: order.supplierId, total: 0, count: 0 };
      }
      supplierTotals[order.supplierId].total += parseFloat(order.total || "0");
      supplierTotals[order.supplierId].count++;
    }
    
    const topSuppliersData = Object.values(supplierTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    
    const topSuppliers = await Promise.all(topSuppliersData.map(async (s) => {
      const supplier = await this.getSupplier(s.supplierId);
      return { ...s, supplier };
    }));
    
    return { totalOrders, totalAmount, pendingOrders, topSuppliers };
  }

  async getSupplierPurchaseHistory(supplierId: string, limit?: number): Promise<any[]> {
    const query = limit
      ? db.select().from(purchaseOrders)
          .where(eq(purchaseOrders.supplierId, supplierId))
          .orderBy(desc(purchaseOrders.createdAt))
          .limit(limit)
      : db.select().from(purchaseOrders)
          .where(eq(purchaseOrders.supplierId, supplierId))
          .orderBy(desc(purchaseOrders.createdAt));
    
    const orders = await query;
    
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const items = await this.getPurchaseOrderItems(order.id);
      return { ...order, items, itemCount: items.length };
    }));
    
    return ordersWithItems;
  }

  async getLowStockProducts(): Promise<any[]> {
    const inventory = await db.select().from(warehouseInventory);
    
    const lowStockItems = inventory.filter(item => 
      (item.currentStock || 0) <= (item.reorderPoint || 20)
    );
    
    const itemsWithProducts = await Promise.all(lowStockItems.map(async (item) => {
      const product = await this.getProduct(item.productId);
      return { ...item, product };
    }));
    
    return itemsWithProducts;
  }

  // ==================== MÓDULO COMBUSTIBLE ====================

  async getVehicles(filters?: { status?: string; type?: string; assignedUserId?: string }): Promise<any[]> {
    let conditions: any[] = [eq(vehicles.isActive, true)];
    
    if (filters?.status) conditions.push(eq(vehicles.status, filters.status));
    if (filters?.type) conditions.push(eq(vehicles.type, filters.type));
    if (filters?.assignedUserId) conditions.push(eq(vehicles.assignedUserId, filters.assignedUserId));
    
    const vehiclesList = await db.select().from(vehicles)
      .where(and(...conditions))
      .orderBy(vehicles.plate);
    
    const vehiclesWithUser = await Promise.all(vehiclesList.map(async (v) => {
      const user = v.assignedUserId ? await this.getUser(v.assignedUserId) : null;
      return { ...v, assignedUser: user };
    }));
    
    return vehiclesWithUser;
  }

  async getVehicle(id: string): Promise<any> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    if (!vehicle) return undefined;
    
    const user = vehicle.assignedUserId ? await this.getUser(vehicle.assignedUserId) : null;
    const recentFuelRecords = await this.getFuelRecords({ vehicleId: id, limit: 5 });
    
    return { ...vehicle, assignedUser: user, recentFuelRecords };
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await db.insert(vehicles).values(vehicle).returning();
    return newVehicle;
  }

  async updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [updated] = await db.update(vehicles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    return updated;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    await db.update(vehicles)
      .set({ isActive: false })
      .where(eq(vehicles.id, id));
    return true;
  }

  async getFuelRecords(filters?: { vehicleId?: string; userId?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<any[]> {
    let conditions: any[] = [];
    
    if (filters?.vehicleId) conditions.push(eq(fuelRecords.vehicleId, filters.vehicleId));
    if (filters?.userId) conditions.push(eq(fuelRecords.userId, filters.userId));
    if (filters?.startDate) conditions.push(gte(fuelRecords.recordDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(fuelRecords.recordDate, filters.endDate));
    
    const records = await db.select().from(fuelRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fuelRecords.recordDate))
      .limit(filters?.limit || 100);
    
    // Precargar todas las entidades relacionadas en paralelo para evitar N+1
    const vehicleIds = Array.from(new Set(records.map(r => r.vehicleId)));
    const userIds = Array.from(new Set(records.map(r => r.userId)));
    const routeIds = Array.from(new Set(records.filter(r => r.routeId).map(r => r.routeId!)));
    
    const [vehiclesList, usersList, routesList] = await Promise.all([
      vehicleIds.length > 0 ? db.select().from(vehicles).where(inArray(vehicles.id, vehicleIds)) : [],
      userIds.length > 0 ? db.select().from(users).where(inArray(users.id, userIds)) : [],
      routeIds.length > 0 ? db.select().from(routes).where(inArray(routes.id, routeIds)) : []
    ]);
    
    const vehicleMap = new Map(vehiclesList.map(v => [v.id, v]));
    const userMap = new Map(usersList.map(u => [u.id, u]));
    const routeMap = new Map(routesList.map(r => [r.id, r]));
    
    return records.map(r => {
      const vehicle = vehicleMap.get(r.vehicleId);
      const user = userMap.get(r.userId);
      const route = r.routeId ? routeMap.get(r.routeId) : null;
      return {
        ...r,
        vehicle: vehicle ? { id: vehicle.id, plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model } : null,
        user: user ? { id: user.id, username: user.username, fullName: user.fullName } : null,
        route: route ? { id: route.id, date: route.date, status: route.status } : null
      };
    });
  }

  async getFuelRecord(id: string): Promise<any> {
    const [record] = await db.select().from(fuelRecords).where(eq(fuelRecords.id, id));
    if (!record) return undefined;
    
    const vehicle = await this.getVehicle(record.vehicleId);
    const user = await this.getUser(record.userId);
    const route = record.routeId ? await this.getRoute(record.routeId) : null;
    
    return { ...record, vehicle, user, route };
  }

  async createFuelRecord(record: InsertFuelRecord): Promise<FuelRecord> {
    // Obtener el último registro del vehículo para calcular distancia
    const lastRecords = await db.select().from(fuelRecords)
      .where(eq(fuelRecords.vehicleId, record.vehicleId))
      .orderBy(desc(fuelRecords.recordDate))
      .limit(1);
    
    const previousOdometer = lastRecords.length > 0 ? lastRecords[0].odometerReading : null;
    const distanceTraveled = previousOdometer 
      ? (record.odometerReading - previousOdometer).toString() 
      : null;
    
    // Calcular rendimiento km/l si tenemos distancia y es tanque lleno
    let calculatedMileage = null;
    if (distanceTraveled && record.isFull !== false) {
      const km = parseFloat(distanceTraveled);
      const liters = parseFloat(record.liters.toString());
      if (liters > 0) {
        calculatedMileage = (km / liters).toFixed(2);
      }
    }
    
    const [newRecord] = await db.insert(fuelRecords).values({
      ...record,
      previousOdometer,
      distanceTraveled,
      calculatedMileage
    }).returning();
    
    // Actualizar odómetro del vehículo
    await db.update(vehicles)
      .set({ currentOdometer: record.odometerReading, updatedAt: new Date() })
      .where(eq(vehicles.id, record.vehicleId));
    
    return newRecord;
  }

  async updateFuelRecord(id: string, data: Partial<InsertFuelRecord>): Promise<FuelRecord | undefined> {
    const [updated] = await db.update(fuelRecords)
      .set(data)
      .where(eq(fuelRecords.id, id))
      .returning();
    return updated;
  }

  async deleteFuelRecord(id: string): Promise<boolean> {
    await db.delete(fuelRecords).where(eq(fuelRecords.id, id));
    return true;
  }

  async getFuelStats(filters?: { vehicleId?: string; userId?: string; startDate?: Date; endDate?: Date }): Promise<{
    totalLiters: number;
    totalAmount: number;
    averageMileage: number;
    recordCount: number;
    costPerKm: number;
  }> {
    let conditions: any[] = [];
    
    if (filters?.vehicleId) conditions.push(eq(fuelRecords.vehicleId, filters.vehicleId));
    if (filters?.userId) conditions.push(eq(fuelRecords.userId, filters.userId));
    if (filters?.startDate) conditions.push(gte(fuelRecords.recordDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(fuelRecords.recordDate, filters.endDate));
    
    const records = conditions.length > 0
      ? await db.select().from(fuelRecords).where(and(...conditions))
      : await db.select().from(fuelRecords);
    
    const totalLiters = records.reduce((sum, r) => sum + parseFloat(r.liters?.toString() || "0"), 0);
    const totalAmount = records.reduce((sum, r) => sum + parseFloat(r.totalAmount?.toString() || "0"), 0);
    const totalDistance = records.reduce((sum, r) => sum + parseFloat(r.distanceTraveled?.toString() || "0"), 0);
    
    const mileageRecords = records.filter(r => r.calculatedMileage && parseFloat(r.calculatedMileage.toString()) > 0);
    const averageMileage = mileageRecords.length > 0
      ? mileageRecords.reduce((sum, r) => sum + parseFloat(r.calculatedMileage!.toString()), 0) / mileageRecords.length
      : 0;
    
    const costPerKm = totalDistance > 0 ? totalAmount / totalDistance : 0;
    
    return {
      totalLiters,
      totalAmount,
      averageMileage,
      recordCount: records.length,
      costPerKm
    };
  }

  async getVehicleFuelStats(vehicleId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const vehicle = await this.getVehicle(vehicleId);
    const stats = await this.getFuelStats({ vehicleId, startDate, endDate });
    const records = await this.getFuelRecords({ vehicleId, startDate, endDate });
    
    // Calcular promedio del último mes
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const lastMonthStats = await this.getFuelStats({ vehicleId, startDate: oneMonthAgo });
    
    // Detectar si el rendimiento está por debajo del esperado
    const expectedMileage = parseFloat(vehicle?.expectedMileage?.toString() || "0");
    const isLowMileage = expectedMileage > 0 && stats.averageMileage < expectedMileage * 0.85;
    
    return {
      vehicle,
      ...stats,
      lastMonthStats,
      expectedMileage,
      isLowMileage,
      mileageVariance: expectedMileage > 0 ? ((stats.averageMileage - expectedMileage) / expectedMileage * 100).toFixed(1) : 0,
      records
    };
  }

  async getUserFuelStats(userId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const user = await this.getUser(userId);
    const stats = await this.getFuelStats({ userId, startDate, endDate });
    const records = await this.getFuelRecords({ userId, startDate, endDate, limit: 10 });
    
    // Agrupar por vehículo
    const byVehicle: Record<string, { vehicleId: string; liters: number; amount: number; count: number }> = {};
    const allRecords = await this.getFuelRecords({ userId, startDate, endDate });
    
    for (const record of allRecords) {
      if (!byVehicle[record.vehicleId]) {
        byVehicle[record.vehicleId] = { vehicleId: record.vehicleId, liters: 0, amount: 0, count: 0 };
      }
      byVehicle[record.vehicleId].liters += parseFloat(record.liters?.toString() || "0");
      byVehicle[record.vehicleId].amount += parseFloat(record.totalAmount?.toString() || "0");
      byVehicle[record.vehicleId].count++;
    }
    
    const vehicleStats = await Promise.all(Object.values(byVehicle).map(async (v) => {
      const vehicle = await this.getVehicle(v.vehicleId);
      return { ...v, vehicle: { plate: vehicle?.plate, brand: vehicle?.brand, model: vehicle?.model } };
    }));
    
    return {
      user,
      ...stats,
      vehicleStats,
      recentRecords: records
    };
  }

  async getFuelStatsPerRoute(startDate?: Date, endDate?: Date): Promise<any[]> {
    let conditions: any[] = [];
    if (startDate) conditions.push(gte(fuelRecords.recordDate, startDate));
    if (endDate) conditions.push(lte(fuelRecords.recordDate, endDate));
    
    const records = conditions.length > 0
      ? await db.select().from(fuelRecords).where(and(...conditions))
      : await db.select().from(fuelRecords);
    
    // Agrupar por ruta
    const byRoute: Record<string, { routeId: string; liters: number; amount: number; distance: number; count: number }> = {};
    
    for (const record of records) {
      if (!record.routeId) continue;
      
      if (!byRoute[record.routeId]) {
        byRoute[record.routeId] = { routeId: record.routeId, liters: 0, amount: 0, distance: 0, count: 0 };
      }
      byRoute[record.routeId].liters += parseFloat(record.liters?.toString() || "0");
      byRoute[record.routeId].amount += parseFloat(record.totalAmount?.toString() || "0");
      byRoute[record.routeId].distance += parseFloat(record.distanceTraveled?.toString() || "0");
      byRoute[record.routeId].count++;
    }
    
    const routeStats = await Promise.all(Object.values(byRoute).map(async (r) => {
      const route = await this.getRoute(r.routeId);
      const costPerKm = r.distance > 0 ? r.amount / r.distance : 0;
      return { ...r, route, costPerKm };
    }));
    
    return routeStats.sort((a, b) => b.amount - a.amount);
  }

  async getLowMileageVehicles(): Promise<any[]> {
    const vehiclesList = await this.getVehicles();
    
    const vehiclesWithStats = await Promise.all(vehiclesList.map(async (v) => {
      const stats = await this.getFuelStats({ vehicleId: v.id });
      const expectedMileage = parseFloat(v.expectedMileage?.toString() || "0");
      const isLowMileage = expectedMileage > 0 && stats.averageMileage < expectedMileage * 0.85;
      
      return {
        ...v,
        averageMileage: stats.averageMileage,
        expectedMileage,
        isLowMileage,
        mileagePercentage: expectedMileage > 0 ? (stats.averageMileage / expectedMileage * 100).toFixed(1) : 100
      };
    }));
    
    return vehiclesWithStats
      .filter(v => v.isLowMileage)
      .sort((a, b) => a.averageMileage - b.averageMileage);
  }

  // ==================== MÓDULO REPORTES ====================

  async getReportsOverview(startDate?: Date, endDate?: Date): Promise<{
    totalSales: number;
    totalPurchases: number;
    totalFuelCost: number;
    totalPettyCash: number;
    machineCount: number;
    activeRoutes: number;
    productCount: number;
    lowStockAlerts: number;
    pendingOrders: number;
    pendingExpenses: number;
    profitMargin: number;
  }> {
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate || new Date();

    const allMachines = await this.getMachines();
    const allProducts = await this.getProducts();
    const allRoutes = await this.getRoutes();
    
    const allSales = await db.select().from(machineSales)
      .where(and(
        gte(machineSales.saleDate, start),
        lte(machineSales.saleDate, end)
      ));
    const totalSales = allSales.reduce((sum, s) => sum + parseFloat(s.totalAmount?.toString() || "0"), 0);
    
    const ordersList = await db.select().from(purchaseOrders)
      .where(and(
        gte(purchaseOrders.createdAt, start),
        lte(purchaseOrders.createdAt, end)
      ));
    const totalPurchases = ordersList
      .filter(o => o.status === 'recibida' || o.status === 'parcialmente_recibida')
      .reduce((sum, o) => sum + (parseFloat(o.subtotal?.toString() || "0") + parseFloat(o.taxAmount?.toString() || "0")), 0);
    const pendingOrders = ordersList.filter(o => o.status === 'borrador' || o.status === 'enviada').length;
    
    const fuelRecordsList = await db.select().from(fuelRecords)
      .where(and(
        gte(fuelRecords.recordDate, start),
        lte(fuelRecords.recordDate, end)
      ));
    const totalFuelCost = fuelRecordsList.reduce((sum, r) => sum + parseFloat(r.totalAmount?.toString() || "0"), 0);
    
    const pettyCashList = await db.select().from(pettyCashExpenses)
      .where(and(
        gte(pettyCashExpenses.createdAt, start),
        lte(pettyCashExpenses.createdAt, end)
      ));
    const totalPettyCash = pettyCashList
      .filter(e => e.status === 'approved' || e.status === 'aprobado')
      .reduce((sum, e) => sum + parseFloat(e.amount?.toString() || "0"), 0);
    const pendingExpenses = pettyCashList.filter(e => e.status === 'pending' || e.status === 'pendiente').length;
    
    const lowStockProducts = await this.getLowStockProducts();
    
    const profitMargin = totalSales > 0 ? ((totalSales - totalPurchases - totalFuelCost - totalPettyCash) / totalSales * 100) : 0;

    return {
      totalSales,
      totalPurchases,
      totalFuelCost,
      totalPettyCash,
      machineCount: allMachines.length,
      activeRoutes: allRoutes.filter(r => r.status === 'en_progreso' || r.status === 'pendiente').length,
      productCount: allProducts.length,
      lowStockAlerts: lowStockProducts.length,
      pendingOrders,
      pendingExpenses,
      profitMargin: parseFloat(profitMargin.toFixed(2))
    };
  }

  async getSalesBreakdown(filters?: { 
    startDate?: Date; 
    endDate?: Date; 
    groupBy?: 'machine' | 'product' | 'location' | 'day' 
  }): Promise<any[]> {
    const start = filters?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = filters?.endDate || new Date();
    const groupBy = filters?.groupBy || 'machine';

    const [allSales, allMachines, allProducts] = await Promise.all([
      db.select().from(machineSales)
        .where(and(
          gte(machineSales.saleDate, start),
          lte(machineSales.saleDate, end)
        )),
      db.select().from(machines),
      db.select().from(products)
    ]);

    const machineMap = new Map(allMachines.map(m => [m.id, m]));
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    if (groupBy === 'machine') {
      const byMachine: Record<string, { machineId: string; totalAmount: number; quantity: number }> = {};
      for (const sale of allSales) {
        const machineId = sale.machineId;
        if (!machineId) continue;
        if (!byMachine[machineId]) {
          byMachine[machineId] = { machineId, totalAmount: 0, quantity: 0 };
        }
        byMachine[machineId].totalAmount += parseFloat(sale.totalAmount?.toString() || "0");
        byMachine[machineId].quantity += sale.quantity || 0;
      }
      
      const result = Object.values(byMachine).map(item => ({
        ...item,
        machine: machineMap.get(item.machineId) || null
      }));
      return result.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    if (groupBy === 'product') {
      const byProduct: Record<string, { productId: string; totalAmount: number; quantity: number }> = {};
      for (const sale of allSales) {
        const productId = sale.productId;
        if (!productId) continue;
        if (!byProduct[productId]) {
          byProduct[productId] = { productId, totalAmount: 0, quantity: 0 };
        }
        byProduct[productId].totalAmount += parseFloat(sale.totalAmount?.toString() || "0");
        byProduct[productId].quantity += sale.quantity || 0;
      }
      
      const result = Object.values(byProduct).map(item => ({
        ...item,
        product: productMap.get(item.productId) || null
      }));
      return result.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    if (groupBy === 'day') {
      const byDay: Record<string, { date: string; totalAmount: number; quantity: number }> = {};
      for (const sale of allSales) {
        if (!sale.saleDate) continue;
        const dateKey = sale.saleDate.toISOString().split('T')[0];
        if (!byDay[dateKey]) {
          byDay[dateKey] = { date: dateKey, totalAmount: 0, quantity: 0 };
        }
        byDay[dateKey].totalAmount += parseFloat(sale.totalAmount?.toString() || "0");
        byDay[dateKey].quantity += sale.quantity || 0;
      }
      return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    }

    return allSales;
  }

  async getPurchasesBreakdown(filters?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'supplier' | 'product' | 'day';
  }): Promise<any[]> {
    const start = filters?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = filters?.endDate || new Date();
    const groupBy = filters?.groupBy || 'supplier';

    const [orders, allSuppliers] = await Promise.all([
      db.select().from(purchaseOrders)
        .where(and(
          gte(purchaseOrders.createdAt, start),
          lte(purchaseOrders.createdAt, end)
        )),
      db.select().from(suppliers)
    ]);

    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]));

    if (groupBy === 'supplier') {
      const bySupplier: Record<string, { supplierId: string; totalAmount: number; orderCount: number }> = {};
      for (const order of orders) {
        if (!bySupplier[order.supplierId]) {
          bySupplier[order.supplierId] = { supplierId: order.supplierId, totalAmount: 0, orderCount: 0 };
        }
        bySupplier[order.supplierId].totalAmount += (parseFloat(order.subtotal?.toString() || "0") + parseFloat(order.taxAmount?.toString() || "0"));
        bySupplier[order.supplierId].orderCount++;
      }
      
      const result = Object.values(bySupplier).map(item => ({
        ...item,
        supplier: supplierMap.get(item.supplierId) || null
      }));
      return result.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    if (groupBy === 'day') {
      const byDay: Record<string, { date: string; totalAmount: number; orderCount: number }> = {};
      for (const order of orders) {
        if (!order.createdAt) continue;
        const dateKey = order.createdAt.toISOString().split('T')[0];
        if (!byDay[dateKey]) {
          byDay[dateKey] = { date: dateKey, totalAmount: 0, orderCount: 0 };
        }
        byDay[dateKey].totalAmount += (parseFloat(order.subtotal?.toString() || "0") + parseFloat(order.taxAmount?.toString() || "0"));
        byDay[dateKey].orderCount++;
      }
      return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    }

    return orders;
  }

  async getFuelBreakdown(filters?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'vehicle' | 'user' | 'route' | 'day';
  }): Promise<any[]> {
    const start = filters?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = filters?.endDate || new Date();
    const groupBy = filters?.groupBy || 'vehicle';

    const [records, allVehicles, allUsers] = await Promise.all([
      db.select().from(fuelRecords)
        .where(and(
          gte(fuelRecords.recordDate, start),
          lte(fuelRecords.recordDate, end)
        )),
      db.select().from(vehicles),
      db.select().from(users)
    ]);

    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    if (groupBy === 'vehicle') {
      const byVehicle: Record<string, { vehicleId: string; totalAmount: number; totalLiters: number; recordCount: number }> = {};
      for (const record of records) {
        if (!byVehicle[record.vehicleId]) {
          byVehicle[record.vehicleId] = { vehicleId: record.vehicleId, totalAmount: 0, totalLiters: 0, recordCount: 0 };
        }
        byVehicle[record.vehicleId].totalAmount += parseFloat(record.totalAmount?.toString() || "0");
        byVehicle[record.vehicleId].totalLiters += parseFloat(record.liters?.toString() || "0");
        byVehicle[record.vehicleId].recordCount++;
      }
      
      const result = Object.values(byVehicle).map(item => ({
        ...item,
        vehicle: vehicleMap.get(item.vehicleId) || null
      }));
      return result.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    if (groupBy === 'user') {
      const byUser: Record<string, { userId: string; totalAmount: number; totalLiters: number; recordCount: number }> = {};
      for (const record of records) {
        const userId = record.userId || 'unknown';
        if (!byUser[userId]) {
          byUser[userId] = { userId, totalAmount: 0, totalLiters: 0, recordCount: 0 };
        }
        byUser[userId].totalAmount += parseFloat(record.totalAmount?.toString() || "0");
        byUser[userId].totalLiters += parseFloat(record.liters?.toString() || "0");
        byUser[userId].recordCount++;
      }
      
      const result = Object.values(byUser).map(item => ({
        ...item,
        user: item.userId !== 'unknown' ? (userMap.get(item.userId) || null) : null
      }));
      return result.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    if (groupBy === 'day') {
      const byDay: Record<string, { date: string; totalAmount: number; totalLiters: number; recordCount: number }> = {};
      for (const record of records) {
        const dateKey = record.recordDate.toISOString().split('T')[0];
        if (!byDay[dateKey]) {
          byDay[dateKey] = { date: dateKey, totalAmount: 0, totalLiters: 0, recordCount: 0 };
        }
        byDay[dateKey].totalAmount += parseFloat(record.totalAmount?.toString() || "0");
        byDay[dateKey].totalLiters += parseFloat(record.liters?.toString() || "0");
        byDay[dateKey].recordCount++;
      }
      return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    }

    return records;
  }

  async getPettyCashBreakdown(filters?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'category' | 'user' | 'day';
  }): Promise<any[]> {
    const start = filters?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = filters?.endDate || new Date();
    const groupBy = filters?.groupBy || 'category';

    const [expenses, allUsers] = await Promise.all([
      db.select().from(pettyCashExpenses)
        .where(and(
          gte(pettyCashExpenses.createdAt, start),
          lte(pettyCashExpenses.createdAt, end),
          or(
            eq(pettyCashExpenses.status, 'approved'),
            eq(pettyCashExpenses.status, 'aprobado')
          )
        )),
      db.select().from(users)
    ]);

    const userMap = new Map(allUsers.map(u => [u.id, u]));

    if (groupBy === 'category') {
      const byCategory: Record<string, { category: string; totalAmount: number; expenseCount: number }> = {};
      for (const expense of expenses) {
        const cat = expense.category || 'otros';
        if (!byCategory[cat]) {
          byCategory[cat] = { category: cat, totalAmount: 0, expenseCount: 0 };
        }
        byCategory[cat].totalAmount += parseFloat(expense.amount?.toString() || "0");
        byCategory[cat].expenseCount++;
      }
      return Object.values(byCategory).sort((a, b) => b.totalAmount - a.totalAmount);
    }

    if (groupBy === 'user') {
      const byUser: Record<string, { userId: string; totalAmount: number; expenseCount: number }> = {};
      for (const expense of expenses) {
        const userId = expense.userId;
        if (!byUser[userId]) {
          byUser[userId] = { userId, totalAmount: 0, expenseCount: 0 };
        }
        byUser[userId].totalAmount += parseFloat(expense.amount?.toString() || "0");
        byUser[userId].expenseCount++;
      }
      
      const result = Object.values(byUser).map(item => ({
        ...item,
        user: userMap.get(item.userId) || null
      }));
      return result.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    if (groupBy === 'day') {
      const byDay: Record<string, { date: string; totalAmount: number; expenseCount: number }> = {};
      for (const expense of expenses) {
        if (!expense.createdAt) continue;
        const dateKey = expense.createdAt.toISOString().split('T')[0];
        if (!byDay[dateKey]) {
          byDay[dateKey] = { date: dateKey, totalAmount: 0, expenseCount: 0 };
        }
        byDay[dateKey].totalAmount += parseFloat(expense.amount?.toString() || "0");
        byDay[dateKey].expenseCount++;
      }
      return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    }

    return expenses;
  }

  async getMachinePerformance(startDate?: Date, endDate?: Date): Promise<any[]> {
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate || new Date();

    const [allMachines, allSales, allAlerts] = await Promise.all([
      this.getMachines(),
      db.select().from(machineSales)
        .where(and(
          gte(machineSales.saleDate, start),
          lte(machineSales.saleDate, end)
        )),
      db.select().from(machineAlerts)
        .where(eq(machineAlerts.isResolved, false))
    ]);

    const alertsByMachine = new Map<string, number>();
    for (const alert of allAlerts) {
      const count = alertsByMachine.get(alert.machineId) || 0;
      alertsByMachine.set(alert.machineId, count + 1);
    }

    const salesByMachine = new Map<string, { total: number; quantity: number; count: number }>();
    for (const sale of allSales) {
      if (!sale.machineId) continue;
      const existing = salesByMachine.get(sale.machineId) || { total: 0, quantity: 0, count: 0 };
      existing.total += parseFloat(sale.totalAmount?.toString() || "0");
      existing.quantity += sale.quantity || 0;
      existing.count++;
      salesByMachine.set(sale.machineId, existing);
    }

    const machineStats = allMachines.map(machine => {
      const salesData = salesByMachine.get(machine.id) || { total: 0, quantity: 0, count: 0 };
      const activeAlerts = alertsByMachine.get(machine.id) || 0;

      return {
        machine,
        totalSales: salesData.total,
        totalQuantity: salesData.quantity,
        transactionCount: salesData.count,
        activeAlerts,
        avgTransactionValue: salesData.count > 0 ? salesData.total / salesData.count : 0
      };
    });

    return machineStats.sort((a, b) => b.totalSales - a.totalSales);
  }

  async getTopProducts(startDate?: Date, endDate?: Date, limit: number = 10): Promise<any[]> {
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate || new Date();

    const [allSales, allProducts] = await Promise.all([
      db.select().from(machineSales)
        .where(and(
          gte(machineSales.saleDate, start),
          lte(machineSales.saleDate, end)
        )),
      db.select().from(products)
    ]);

    const productMap = new Map(allProducts.map(p => [p.id, p]));

    const byProduct: Record<string, { productId: string; totalAmount: number; quantity: number }> = {};
    for (const sale of allSales) {
      const productId = sale.productId;
      if (!productId) continue;
      if (!byProduct[productId]) {
        byProduct[productId] = { productId, totalAmount: 0, quantity: 0 };
      }
      byProduct[productId].totalAmount += parseFloat(sale.totalAmount?.toString() || "0");
      byProduct[productId].quantity += sale.quantity || 0;
    }

    const sorted = Object.values(byProduct).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, limit);
    
    const result = sorted.map(item => ({
      ...item,
      product: productMap.get(item.productId) || null
    }));

    return result;
  }

  async getSupplierRanking(startDate?: Date, endDate?: Date): Promise<any[]> {
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate || new Date();

    const [orders, allSuppliers] = await Promise.all([
      db.select().from(purchaseOrders)
        .where(and(
          gte(purchaseOrders.createdAt, start),
          lte(purchaseOrders.createdAt, end)
        )),
      db.select().from(suppliers)
    ]);

    const supplierMap = new Map(allSuppliers.map(s => [s.id, s]));

    const bySupplier: Record<string, { supplierId: string; totalAmount: number; orderCount: number; receivedCount: number }> = {};
    for (const order of orders) {
      if (!bySupplier[order.supplierId]) {
        bySupplier[order.supplierId] = { supplierId: order.supplierId, totalAmount: 0, orderCount: 0, receivedCount: 0 };
      }
      bySupplier[order.supplierId].totalAmount += (parseFloat(order.subtotal?.toString() || "0") + parseFloat(order.taxAmount?.toString() || "0"));
      bySupplier[order.supplierId].orderCount++;
      if (order.status === 'recibida') bySupplier[order.supplierId].receivedCount++;
    }

    const result = Object.values(bySupplier).map(item => {
      const fulfillmentRate = item.orderCount > 0 ? (item.receivedCount / item.orderCount * 100) : 0;
      return { 
        ...item, 
        supplier: supplierMap.get(item.supplierId) || null, 
        fulfillmentRate: parseFloat(fulfillmentRate.toFixed(1)) 
      };
    });

    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getExportData(type: 'sales' | 'purchases' | 'fuel' | 'pettycash' | 'inventory', filters?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const start = filters?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = filters?.endDate || new Date();

    switch (type) {
      case 'sales': {
        const [sales, allMachines, allProducts] = await Promise.all([
          db.select().from(machineSales)
            .where(and(
              gte(machineSales.saleDate, start),
              lte(machineSales.saleDate, end)
            ))
            .orderBy(machineSales.saleDate),
          db.select().from(machines),
          db.select().from(products)
        ]);
        const machineMap = new Map(allMachines.map(m => [m.id, m]));
        const productMap = new Map(allProducts.map(p => [p.id, p]));
        return sales.map(s => ({
          fecha: s.saleDate ? s.saleDate.toISOString().split('T')[0] : '',
          maquina: machineMap.get(s.machineId)?.code || s.machineId || '',
          producto: productMap.get(s.productId || '')?.name || s.productId || '',
          cantidad: s.quantity,
          monto: parseFloat(s.totalAmount?.toString() || "0")
        }));
      }

      case 'purchases': {
        const [purchases, allSuppliers] = await Promise.all([
          db.select().from(purchaseOrders)
            .where(and(
              gte(purchaseOrders.createdAt, start),
              lte(purchaseOrders.createdAt, end)
            ))
            .orderBy(purchaseOrders.createdAt),
          db.select().from(suppliers)
        ]);
        const supplierMap = new Map(allSuppliers.map(s => [s.id, s]));
        return purchases.map(p => ({
          fecha: p.createdAt ? p.createdAt.toISOString().split('T')[0] : '',
          orden: p.orderNumber,
          proveedor: supplierMap.get(p.supplierId)?.name || p.supplierId,
          estado: p.status,
          monto: parseFloat(p.subtotal?.toString() || "0") + parseFloat(p.taxAmount?.toString() || "0")
        }));
      }

      case 'fuel': {
        const [fuel, allVehicles] = await Promise.all([
          db.select().from(fuelRecords)
            .where(and(
              gte(fuelRecords.recordDate, start),
              lte(fuelRecords.recordDate, end)
            ))
            .orderBy(fuelRecords.recordDate),
          db.select().from(vehicles)
        ]);
        const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
        return fuel.map(f => ({
          fecha: f.recordDate.toISOString().split('T')[0],
          vehiculo: vehicleMap.get(f.vehicleId)?.plate || f.vehicleId,
          litros: parseFloat(f.liters?.toString() || "0"),
          monto: parseFloat(f.totalAmount?.toString() || "0"),
          odometro: f.odometerReading
        }));
      }

      case 'pettycash': {
        const pettycash = await db.select().from(pettyCashExpenses)
          .where(and(
            gte(pettyCashExpenses.createdAt, start),
            lte(pettyCashExpenses.createdAt, end)
          ))
          .orderBy(pettyCashExpenses.createdAt);
        return pettycash.map(p => ({
          fecha: p.createdAt ? p.createdAt.toISOString().split('T')[0] : '',
          descripcion: p.description,
          categoria: p.category,
          estado: p.status,
          monto: parseFloat(p.amount?.toString() || "0")
        }));
      }

      case 'inventory': {
        const inventory = await this.getWarehouseInventory();
        return inventory.map(i => ({
          producto: i.product?.name || i.productId,
          codigo: i.product?.code,
          cantidad: i.currentStock,
          minimo: i.minStock,
          ubicacion: ''
        }));
      }

      default:
        return [];
    }
  }

  // ==================== MÓDULO CONTABILIDAD ====================

  async getAccountingOverview(startDate?: Date, endDate?: Date): Promise<{
    totalIngresos: number;
    totalGastos: number;
    utilidadNeta: number;
    margen: number;
    transacciones: number;
    promedioTicket: number;
    tendenciaIngresos: number;
    tendenciaGastos: number;
    monthlyData: { month: string; ventas: number; gastos: number }[];
    categoryData: { name: string; value: number }[];
  }> {
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = endDate || new Date();
    
    const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
    const prevEnd = start;

    const sales = await db.select().from(machineSales)
      .where(and(
        gte(machineSales.saleDate, start),
        lte(machineSales.saleDate, end)
      ));
    
    const prevSales = await db.select().from(machineSales)
      .where(and(
        gte(machineSales.saleDate, prevStart),
        lte(machineSales.saleDate, prevEnd)
      ));

    const totalIngresos = sales.reduce((acc, s) => acc + parseFloat(s.totalAmount?.toString() || "0"), 0);
    const prevIngresos = prevSales.reduce((acc, s) => acc + parseFloat(s.totalAmount?.toString() || "0"), 0);

    const pettyCashExp = await db.select().from(pettyCashExpenses)
      .where(and(
        gte(pettyCashExpenses.createdAt, start),
        lte(pettyCashExpenses.createdAt, end),
        eq(pettyCashExpenses.status, "pagado")
      ));

    const prevPettyCash = await db.select().from(pettyCashExpenses)
      .where(and(
        gte(pettyCashExpenses.createdAt, prevStart),
        lte(pettyCashExpenses.createdAt, prevEnd),
        eq(pettyCashExpenses.status, "pagado")
      ));

    const purchaseExp = await db.select().from(purchaseOrders)
      .where(and(
        gte(purchaseOrders.createdAt, start),
        lte(purchaseOrders.createdAt, end),
        eq(purchaseOrders.status, "recibida")
      ));

    const prevPurchases = await db.select().from(purchaseOrders)
      .where(and(
        gte(purchaseOrders.createdAt, prevStart),
        lte(purchaseOrders.createdAt, prevEnd),
        eq(purchaseOrders.status, "recibida")
      ));

    const fuelExp = await db.select().from(fuelRecords)
      .where(and(
        gte(fuelRecords.recordDate, start),
        lte(fuelRecords.recordDate, end)
      ));

    const prevFuel = await db.select().from(fuelRecords)
      .where(and(
        gte(fuelRecords.recordDate, prevStart),
        lte(fuelRecords.recordDate, prevEnd)
      ));

    const egresosPettyCash = pettyCashExp.reduce((acc, e) => acc + parseFloat(e.amount?.toString() || "0"), 0);
    const egresosCompras = purchaseExp.reduce((acc, p) => acc + parseFloat(p.total?.toString() || "0"), 0);
    const egresosCombustible = fuelExp.reduce((acc, f) => acc + parseFloat(f.totalAmount?.toString() || "0"), 0);
    const totalGastos = egresosPettyCash + egresosCompras + egresosCombustible;

    const prevEgresosPettyCash = prevPettyCash.reduce((acc, e) => acc + parseFloat(e.amount?.toString() || "0"), 0);
    const prevEgresosCompras = prevPurchases.reduce((acc, p) => acc + parseFloat(p.total?.toString() || "0"), 0);
    const prevEgresosCombustible = prevFuel.reduce((acc, f) => acc + parseFloat(f.totalAmount?.toString() || "0"), 0);
    const prevGastos = prevEgresosPettyCash + prevEgresosCompras + prevEgresosCombustible;

    const tendenciaIngresos = prevIngresos > 0 ? ((totalIngresos - prevIngresos) / prevIngresos * 100) : 0;
    const tendenciaGastos = prevGastos > 0 ? ((totalGastos - prevGastos) / prevGastos * 100) : 0;

    const utilidadNeta = totalIngresos - totalGastos;
    const margen = totalIngresos > 0 ? (utilidadNeta / totalIngresos * 100) : 0;
    const promedioTicket = sales.length > 0 ? totalIngresos / sales.length : 0;

    const monthlyData = this.generateMonthlyData(sales, pettyCashExp, purchaseExp, fuelExp);
    
    const categoryData = this.generateCategoryData(egresosPettyCash, egresosCompras, egresosCombustible, totalGastos);

    return {
      totalIngresos,
      totalGastos,
      utilidadNeta,
      margen: parseFloat(margen.toFixed(1)),
      transacciones: sales.length,
      promedioTicket: parseFloat(promedioTicket.toFixed(2)),
      tendenciaIngresos: parseFloat(tendenciaIngresos.toFixed(1)),
      tendenciaGastos: parseFloat(tendenciaGastos.toFixed(1)),
      monthlyData,
      categoryData,
    };
  }

  private generateMonthlyData(
    sales: any[], 
    pettyCash: any[], 
    purchases: any[], 
    fuel: any[]
  ): { month: string; ventas: number; gastos: number }[] {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyMap: Record<string, { ventas: number; gastos: number }> = {};

    for (const sale of sales) {
      const date = sale.saleDate ? new Date(sale.saleDate) : null;
      if (date) {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthlyMap[key]) monthlyMap[key] = { ventas: 0, gastos: 0 };
        monthlyMap[key].ventas += parseFloat(sale.totalAmount?.toString() || "0");
      }
    }

    for (const exp of pettyCash) {
      const date = exp.createdAt ? new Date(exp.createdAt) : null;
      if (date) {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthlyMap[key]) monthlyMap[key] = { ventas: 0, gastos: 0 };
        monthlyMap[key].gastos += parseFloat(exp.amount?.toString() || "0");
      }
    }

    for (const po of purchases) {
      const date = po.createdAt ? new Date(po.createdAt) : null;
      if (date) {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthlyMap[key]) monthlyMap[key] = { ventas: 0, gastos: 0 };
        monthlyMap[key].gastos += parseFloat(po.total?.toString() || "0");
      }
    }

    for (const f of fuel) {
      const date = f.recordDate ? new Date(f.recordDate) : null;
      if (date) {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthlyMap[key]) monthlyMap[key] = { ventas: 0, gastos: 0 };
        monthlyMap[key].gastos += parseFloat(f.totalAmount?.toString() || "0");
      }
    }

    const sortedKeys = Object.keys(monthlyMap).sort();
    return sortedKeys.slice(-6).map(key => {
      const [year, monthIdx] = key.split('-').map(Number);
      return {
        month: monthNames[monthIdx],
        ventas: Math.round(monthlyMap[key].ventas),
        gastos: Math.round(monthlyMap[key].gastos)
      };
    });
  }

  private generateCategoryData(
    pettyCash: number, 
    purchases: number, 
    fuel: number, 
    total: number
  ): { name: string; value: number }[] {
    if (total === 0) return [];
    
    const categories = [
      { name: 'Compras', value: purchases },
      { name: 'Caja Chica', value: pettyCash },
      { name: 'Combustible', value: fuel },
    ].filter(c => c.value > 0);

    return categories.map(c => ({
      name: c.name,
      value: Math.round((c.value / total) * 100)
    }));
  }

  async getMachineSalesReport(startDate?: Date, endDate?: Date): Promise<any[]> {
    const end = endDate || new Date();
    const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);
    
    const monthStart = new Date(today);
    monthStart.setMonth(monthStart.getMonth() - 1);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const [allMachines, allLocations, allSales] = await Promise.all([
      db.select().from(machines),
      db.select().from(locations),
      db.select().from(machineSales)
        .where(gte(machineSales.saleDate, prevWeekStart))
    ]);

    const locationMap = new Map(allLocations.map(l => [l.id, l.name]));

    const salesByMachine = new Map<string, {
      today: number; week: number; month: number; period: number;
      prevWeek: number; periodCount: number;
    }>();

    for (const sale of allSales) {
      const saleDate = sale.saleDate ? new Date(sale.saleDate) : null;
      if (!saleDate || !sale.machineId) continue;

      const amount = parseFloat(sale.totalAmount?.toString() || "0");
      
      if (!salesByMachine.has(sale.machineId)) {
        salesByMachine.set(sale.machineId, {
          today: 0, week: 0, month: 0, period: 0, prevWeek: 0, periodCount: 0
        });
      }
      const data = salesByMachine.get(sale.machineId)!;

      if (saleDate >= today) data.today += amount;
      if (saleDate >= weekStart) data.week += amount;
      if (saleDate >= monthStart) data.month += amount;
      if (saleDate >= start && saleDate <= end) {
        data.period += amount;
        data.periodCount++;
      }
      if (saleDate >= prevWeekStart && saleDate < weekStart) data.prevWeek += amount;
    }

    const result = allMachines.map(machine => {
      const sales = salesByMachine.get(machine.id) || {
        today: 0, week: 0, month: 0, period: 0, prevWeek: 0, periodCount: 0
      };

      return {
        id: machine.id,
        machine: machine.name || machine.code,
        code: machine.code,
        location: machine.locationId ? (locationMap.get(machine.locationId) || "Sin ubicación") : "Sin ubicación",
        today: Math.round(sales.today * 100) / 100,
        week: Math.round(sales.week * 100) / 100,
        month: Math.round(sales.month * 100) / 100,
        total: Math.round(sales.period * 100) / 100,
        status: sales.week >= sales.prevWeek ? "up" : "down",
        transacciones: sales.periodCount
      };
    });

    return result.sort((a, b) => b.month - a.month);
  }

  async getExpensesReport(filters?: { startDate?: Date; endDate?: Date; category?: string }): Promise<any[]> {
    const start = filters?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = filters?.endDate || new Date();

    const expenses: any[] = [];

    const pettyCashConditions = [
      gte(pettyCashExpenses.createdAt, start),
      lte(pettyCashExpenses.createdAt, end),
    ];
    if (filters?.category) {
      pettyCashConditions.push(eq(pettyCashExpenses.category, filters.category));
    }
    
    const pettyCash = await db.select().from(pettyCashExpenses)
      .where(and(...pettyCashConditions))
      .orderBy(desc(pettyCashExpenses.createdAt));

    for (const exp of pettyCash) {
      expenses.push({
        id: exp.id,
        fuente: "caja_chica",
        concepto: exp.description,
        category: exp.category,
        amount: parseFloat(exp.amount?.toString() || "0"),
        date: exp.createdAt?.toISOString().split('T')[0] || "",
        status: exp.status
      });
    }

    if (!filters?.category || filters.category === "compras") {
      const purchases = await db.select().from(purchaseOrders)
        .where(and(
          gte(purchaseOrders.createdAt, start),
          lte(purchaseOrders.createdAt, end)
        ))
        .orderBy(desc(purchaseOrders.createdAt));

      for (const po of purchases) {
        const supplier = await this.getSupplier(po.supplierId);
        expenses.push({
          id: po.id,
          fuente: "compras",
          concepto: `Orden ${po.orderNumber} - ${supplier?.name || "Proveedor"}`,
          category: "compras",
          amount: parseFloat(po.total?.toString() || "0"),
          date: po.createdAt?.toISOString().split('T')[0] || "",
          status: po.status
        });
      }
    }

    if (!filters?.category || filters.category === "combustible") {
      const fuel = await db.select().from(fuelRecords)
        .where(and(
          gte(fuelRecords.recordDate, start),
          lte(fuelRecords.recordDate, end)
        ))
        .orderBy(desc(fuelRecords.recordDate));

      for (const f of fuel) {
        const vehicle = await this.getVehicle(f.vehicleId);
        expenses.push({
          id: f.id,
          fuente: "combustible",
          concepto: `Carga ${vehicle?.plate || f.vehicleId} - ${parseFloat(f.liters?.toString() || "0").toFixed(1)}L`,
          category: "combustible",
          amount: parseFloat(f.totalAmount?.toString() || "0"),
          date: f.recordDate.toISOString().split('T')[0],
          status: "pagado"
        });
      }
    }

    return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getCashCutReport(startDate?: Date, endDate?: Date): Promise<{
    totalEsperado: number;
    totalRecolectado: number;
    diferencia: number;
    detallePorMaquina: any[];
    detallePorAbastecedor: any[];
  }> {
    const start = startDate || new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate || new Date();

    const collections = await db.select().from(cashCollections)
      .where(and(
        gte(cashCollections.createdAt, start),
        lte(cashCollections.createdAt, end)
      ));

    const totalRecolectado = collections.reduce((acc, c) => acc + parseFloat(c.actualAmount?.toString() || "0"), 0);
    const totalEsperado = collections.reduce((acc, c) => acc + parseFloat(c.expectedAmount?.toString() || "0"), 0);

    const byMachine: Record<string, { machineId: string; recolectado: number; esperado: number; diferencia: number }> = {};
    const byUser: Record<string, { userId: string; recolectado: number; esperado: number; diferencia: number; maquinas: number }> = {};

    for (const c of collections) {
      if (c.machineId) {
        if (!byMachine[c.machineId]) {
          byMachine[c.machineId] = { machineId: c.machineId, recolectado: 0, esperado: 0, diferencia: 0 };
        }
        byMachine[c.machineId].recolectado += parseFloat(c.actualAmount?.toString() || "0");
        byMachine[c.machineId].esperado += parseFloat(c.expectedAmount?.toString() || "0");
        byMachine[c.machineId].diferencia = byMachine[c.machineId].recolectado - byMachine[c.machineId].esperado;
      }

      if (c.userId) {
        if (!byUser[c.userId]) {
          byUser[c.userId] = { userId: c.userId, recolectado: 0, esperado: 0, diferencia: 0, maquinas: 0 };
        }
        byUser[c.userId].recolectado += parseFloat(c.actualAmount?.toString() || "0");
        byUser[c.userId].esperado += parseFloat(c.expectedAmount?.toString() || "0");
        byUser[c.userId].diferencia = byUser[c.userId].recolectado - byUser[c.userId].esperado;
        byUser[c.userId].maquinas++;
      }
    }

    const detallePorMaquina = await Promise.all(Object.values(byMachine).map(async (item) => {
      const machine = await this.getMachine(item.machineId);
      return { ...item, machine: machine?.name || machine?.code || item.machineId };
    }));

    const detallePorAbastecedor = await Promise.all(Object.values(byUser).map(async (item) => {
      const user = await this.getUser(item.userId);
      return { ...item, abastecedor: user?.fullName || user?.username || item.userId };
    }));

    return {
      totalEsperado,
      totalRecolectado,
      diferencia: totalRecolectado - totalEsperado,
      detallePorMaquina,
      detallePorAbastecedor
    };
  }

  // ==================== MÓDULO RRHH ====================

  async getEmployees(filters?: { role?: string; isActive?: boolean; search?: string }): Promise<SafeUser[]> {
    const conditions: any[] = [];
    
    if (filters?.role) {
      conditions.push(eq(users.role, filters.role));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(users.isActive, filters.isActive));
    }
    
    let query = db.select().from(users);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const result = await query.orderBy(asc(users.fullName));
    
    let filtered = result;
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = result.filter(u => 
        u.fullName?.toLowerCase().includes(searchLower) ||
        u.username.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.map(u => excludePassword(u));
  }

  async getEmployee(id: string): Promise<SafeUser | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return excludePassword(user);
  }

  async createEmployee(employee: InsertEmployee): Promise<SafeUser> {
    const [created] = await db.insert(users).values(employee).returning();
    return excludePassword(created);
  }

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<SafeUser | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return excludePassword(updated);
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const [updated] = await db.update(users)
      .set({ isActive: false })
      .where(eq(users.id, id))
      .returning();
    return !!updated;
  }

  async getTimeTracking(filters?: { userId?: string; startDate?: Date; endDate?: Date }): Promise<any[]> {
    const start = filters?.startDate || new Date(new Date().setDate(new Date().getDate() - 7));
    const end = filters?.endDate || new Date();

    const conditions = [
      gte(serviceRecords.startTime, start),
      lte(serviceRecords.startTime, end)
    ];

    if (filters?.userId) {
      conditions.push(eq(serviceRecords.userId, filters.userId));
    }

    const records = await db.select({
      id: serviceRecords.id,
      userId: serviceRecords.userId,
      machineId: serviceRecords.machineId,
      startTime: serviceRecords.startTime,
      endTime: serviceRecords.endTime,
      durationMinutes: serviceRecords.durationMinutes,
      userName: users.fullName,
      userUsername: users.username,
      machineName: machines.name,
      machineCode: machines.code
    })
    .from(serviceRecords)
    .leftJoin(users, eq(serviceRecords.userId, users.id))
    .leftJoin(machines, eq(serviceRecords.machineId, machines.id))
    .where(and(...conditions))
    .orderBy(desc(serviceRecords.startTime))
    .limit(100);

    return records.map((r) => {
      const startTime = r.startTime ? new Date(r.startTime) : null;
      const endTime = r.endTime ? new Date(r.endTime) : null;
      
      let hours = 0;
      if (startTime && endTime) {
        hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      } else if (r.durationMinutes) {
        hours = r.durationMinutes / 60;
      }

      return {
        id: r.id,
        employee: r.userName || r.userUsername || r.userId,
        employeeId: r.userId,
        date: startTime?.toISOString().split('T')[0] || "",
        checkIn: startTime?.toTimeString().slice(0, 5) || "",
        checkOut: endTime?.toTimeString().slice(0, 5) || "",
        hours: parseFloat(hours.toFixed(2)),
        machine: r.machineName || r.machineCode || null,
        machineId: r.machineId
      };
    });
  }

  async getEmployeePerformance(filters?: { userId?: string; startDate?: Date; endDate?: Date }): Promise<any[]> {
    const start = filters?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = filters?.endDate || new Date();

    const userConditions = [eq(users.role, "abastecedor"), eq(users.isActive, true)];
    if (filters?.userId) {
      userConditions.push(eq(users.id, filters.userId));
    }

    const abastecedores = await db.select().from(users)
      .where(and(...userConditions))
      .limit(20);

    const serviceStats = await db.select({
      userId: serviceRecords.userId,
      totalMachines: sql<number>`count(*)::int`,
      totalDuration: sql<number>`coalesce(sum(${serviceRecords.durationMinutes}), 0)::int`,
      daysWorked: sql<number>`count(distinct date(${serviceRecords.startTime}))::int`
    })
    .from(serviceRecords)
    .where(and(
      gte(serviceRecords.startTime, start),
      lte(serviceRecords.startTime, end)
    ))
    .groupBy(serviceRecords.userId);

    const collectionStats = await db.select({
      userId: cashCollections.userId,
      totalCollected: sql<number>`coalesce(sum(${cashCollections.actualAmount}), 0)::numeric`,
      totalExpected: sql<number>`coalesce(sum(${cashCollections.expectedAmount}), 0)::numeric`
    })
    .from(cashCollections)
    .where(and(
      gte(cashCollections.createdAt, start),
      lte(cashCollections.createdAt, end)
    ))
    .groupBy(cashCollections.userId);

    const serviceMap = new Map(serviceStats.map(s => [s.userId, s]));
    const collectionMap = new Map(collectionStats.map(c => [c.userId, c]));

    const result = abastecedores.map((user) => {
      const service = serviceMap.get(user.id) || { totalMachines: 0, totalDuration: 0, daysWorked: 0 };
      const collection = collectionMap.get(user.id) || { totalCollected: 0, totalExpected: 0 };

      const totalMachines = service.totalMachines;
      const avgTime = totalMachines > 0 ? service.totalDuration / totalMachines : 0;
      const machinesPerDay = service.daysWorked > 0 ? totalMachines / service.daysWorked : 0;

      const totalCollected = parseFloat(collection.totalCollected?.toString() || "0");
      const totalExpected = parseFloat(collection.totalExpected?.toString() || "0");
      const efficiency = totalExpected > 0 ? (totalCollected / totalExpected * 100) : 100;

      return {
        id: user.id,
        employee: user.fullName || user.username,
        machinesDay: parseFloat(machinesPerDay.toFixed(1)),
        avgTime: Math.round(avgTime),
        efficiency: parseFloat(efficiency.toFixed(1)),
        totalMachines,
        totalCollected,
        rating: efficiency >= 95 ? 5 : efficiency >= 85 ? 4 : efficiency >= 75 ? 3.5 : efficiency >= 60 ? 3 : 2.5
      };
    });

    return result.sort((a, b) => b.efficiency - a.efficiency);
  }

  // Perfiles de empleados
  async getEmployeeProfile(userId: string): Promise<EmployeeProfile | undefined> {
    const [profile] = await db.select().from(employeeProfiles).where(eq(employeeProfiles.userId, userId));
    return profile;
  }

  async getEmployeeProfiles(): Promise<(EmployeeProfile & { user: SafeUser })[]> {
    const result = await db.select({
      profile: employeeProfiles,
      user: users
    })
    .from(employeeProfiles)
    .leftJoin(users, eq(employeeProfiles.userId, users.id))
    .orderBy(asc(users.fullName));
    
    return result.map(r => ({ ...r.profile, user: excludePassword(r.user!)! }));
  }

  async createEmployeeProfile(profile: InsertEmployeeProfile): Promise<EmployeeProfile> {
    const [created] = await db.insert(employeeProfiles).values(profile).returning();
    return created;
  }

  async updateEmployeeProfile(userId: string, data: Partial<InsertEmployeeProfile>): Promise<EmployeeProfile | undefined> {
    const [updated] = await db.update(employeeProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeProfiles.userId, userId))
      .returning();
    return updated;
  }

  // Asistencia
  async getAttendance(filters?: { userId?: string; startDate?: Date; endDate?: Date; status?: string }): Promise<(EmployeeAttendance & { user: SafeUser })[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(employeeAttendance.userId, filters.userId));
    }
    if (filters?.startDate) {
      conditions.push(gte(employeeAttendance.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(employeeAttendance.date, filters.endDate));
    }
    if (filters?.status) {
      conditions.push(eq(employeeAttendance.status, filters.status));
    }
    
    const result = await db.select({
      attendance: employeeAttendance,
      user: users
    })
    .from(employeeAttendance)
    .leftJoin(users, eq(employeeAttendance.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(employeeAttendance.date))
    .limit(200);
    
    return result.map(r => ({ ...r.attendance, user: excludePassword(r.user!)! }));
  }

  async getAttendanceRecord(id: string): Promise<EmployeeAttendance | undefined> {
    const [record] = await db.select().from(employeeAttendance).where(eq(employeeAttendance.id, id));
    return record;
  }

  async createAttendance(attendance: InsertEmployeeAttendance): Promise<EmployeeAttendance> {
    const [created] = await db.insert(employeeAttendance).values(attendance).returning();
    return created;
  }

  async updateAttendance(id: string, data: Partial<InsertEmployeeAttendance>): Promise<EmployeeAttendance | undefined> {
    const [updated] = await db.update(employeeAttendance)
      .set(data)
      .where(eq(employeeAttendance.id, id))
      .returning();
    return updated;
  }

  async deleteAttendance(id: string): Promise<boolean> {
    await db.delete(employeeAttendance).where(eq(employeeAttendance.id, id));
    return true;
  }

  async checkIn(userId: string, date: Date): Promise<EmployeeAttendance> {
    const today = getTodayInTimezone();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [existing] = await db.select().from(employeeAttendance)
      .where(and(
        eq(employeeAttendance.userId, userId),
        gte(employeeAttendance.date, today),
        lte(employeeAttendance.date, tomorrow)
      ));
    
    if (existing) {
      const [updated] = await db.update(employeeAttendance)
        .set({ checkIn: date })
        .where(eq(employeeAttendance.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(employeeAttendance).values({
      userId,
      date: today,
      checkIn: date,
      status: "presente"
    }).returning();
    return created;
  }

  async checkOut(userId: string, date: Date): Promise<EmployeeAttendance | undefined> {
    const today = getTodayInTimezone();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [existing] = await db.select().from(employeeAttendance)
      .where(and(
        eq(employeeAttendance.userId, userId),
        gte(employeeAttendance.date, today),
        lte(employeeAttendance.date, tomorrow)
      ));
    
    if (!existing) return undefined;
    
    let hoursWorked = "0";
    if (existing.checkIn) {
      const diff = date.getTime() - new Date(existing.checkIn).getTime();
      hoursWorked = (diff / (1000 * 60 * 60)).toFixed(2);
    }
    
    const [updated] = await db.update(employeeAttendance)
      .set({ checkOut: date, hoursWorked })
      .where(eq(employeeAttendance.id, existing.id))
      .returning();
    return updated;
  }

  async getAttendanceSummary(userId: string, startDate: Date, endDate: Date): Promise<{
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    totalHours: number;
    overtimeHours: number;
  }> {
    const records = await db.select().from(employeeAttendance)
      .where(and(
        eq(employeeAttendance.userId, userId),
        gte(employeeAttendance.date, startDate),
        lte(employeeAttendance.date, endDate)
      ));
    
    const totalDays = records.length;
    const presentDays = records.filter(r => r.status === "presente").length;
    const absentDays = records.filter(r => r.status === "ausente").length;
    const lateDays = records.filter(r => r.status === "tarde").length;
    const totalHours = records.reduce((acc, r) => acc + parseFloat(r.hoursWorked?.toString() || "0"), 0);
    const overtimeHours = records.reduce((acc, r) => acc + parseFloat(r.overtimeHours?.toString() || "0"), 0);
    
    return { totalDays, presentDays, absentDays, lateDays, totalHours, overtimeHours };
  }

  // Nómina
  async getPayrollRecords(filters?: { userId?: string; startDate?: Date; endDate?: Date; status?: string }): Promise<(PayrollRecord & { user: SafeUser })[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(payrollRecords.userId, filters.userId));
    }
    if (filters?.startDate) {
      conditions.push(gte(payrollRecords.periodStart, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(payrollRecords.periodEnd, filters.endDate));
    }
    if (filters?.status) {
      conditions.push(eq(payrollRecords.status, filters.status));
    }
    
    const result = await db.select({
      payroll: payrollRecords,
      user: users
    })
    .from(payrollRecords)
    .leftJoin(users, eq(payrollRecords.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(payrollRecords.periodStart))
    .limit(100);
    
    return result.map(r => ({ ...r.payroll, user: excludePassword(r.user!)! }));
  }

  async getPayrollRecord(id: string): Promise<PayrollRecord | undefined> {
    const [record] = await db.select().from(payrollRecords).where(eq(payrollRecords.id, id));
    return record;
  }

  async createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord> {
    const [created] = await db.insert(payrollRecords).values(record).returning();
    return created;
  }

  async updatePayrollRecord(id: string, data: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined> {
    const [updated] = await db.update(payrollRecords)
      .set(data)
      .where(eq(payrollRecords.id, id))
      .returning();
    return updated;
  }

  async deletePayrollRecord(id: string): Promise<boolean> {
    await db.delete(payrollRecords).where(eq(payrollRecords.id, id));
    return true;
  }

  async processPayroll(id: string, processedBy: string): Promise<PayrollRecord | undefined> {
    const [updated] = await db.update(payrollRecords)
      .set({ status: "procesado", processedBy, paymentDate: new Date() })
      .where(eq(payrollRecords.id, id))
      .returning();
    return updated;
  }

  // Vacaciones
  async getVacationRequests(filters?: { userId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<(VacationRequest & { user: SafeUser })[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(vacationRequests.userId, filters.userId));
    }
    if (filters?.status) {
      conditions.push(eq(vacationRequests.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(gte(vacationRequests.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(vacationRequests.endDate, filters.endDate));
    }
    
    const result = await db.select({
      vacation: vacationRequests,
      user: users
    })
    .from(vacationRequests)
    .leftJoin(users, eq(vacationRequests.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vacationRequests.createdAt))
    .limit(100);
    
    return result.map(r => ({ ...r.vacation, user: excludePassword(r.user!)! }));
  }

  async getVacationRequest(id: string): Promise<VacationRequest | undefined> {
    const [request] = await db.select().from(vacationRequests).where(eq(vacationRequests.id, id));
    return request;
  }

  async createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest> {
    const [created] = await db.insert(vacationRequests).values(request).returning();
    return created;
  }

  async updateVacationRequest(id: string, data: Partial<InsertVacationRequest>): Promise<VacationRequest | undefined> {
    const [updated] = await db.update(vacationRequests)
      .set(data)
      .where(eq(vacationRequests.id, id))
      .returning();
    return updated;
  }

  async approveVacation(id: string, approvedBy: string): Promise<VacationRequest | undefined> {
    const [updated] = await db.update(vacationRequests)
      .set({ status: "aprobado", approvedBy, approvedAt: new Date() })
      .where(eq(vacationRequests.id, id))
      .returning();
    
    if (updated) {
      const profile = await this.getEmployeeProfile(updated.userId);
      if (profile) {
        await this.updateEmployeeProfile(updated.userId, {
          vacationDaysUsed: (profile.vacationDaysUsed || 0) + updated.daysRequested
        });
      }
    }
    
    return updated;
  }

  async rejectVacation(id: string, approvedBy: string, reason: string): Promise<VacationRequest | undefined> {
    const [updated] = await db.update(vacationRequests)
      .set({ status: "rechazado", approvedBy, approvedAt: new Date(), rejectionReason: reason })
      .where(eq(vacationRequests.id, id))
      .returning();
    return updated;
  }

  async cancelVacation(id: string): Promise<VacationRequest | undefined> {
    const [updated] = await db.update(vacationRequests)
      .set({ status: "cancelado" })
      .where(eq(vacationRequests.id, id))
      .returning();
    return updated;
  }

  // Evaluaciones de desempeño
  async getPerformanceReviews(filters?: { userId?: string; reviewerId?: string; status?: string; period?: string }): Promise<(PerformanceReview & { user: SafeUser; reviewer: SafeUser })[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(performanceReviews.userId, filters.userId));
    }
    if (filters?.reviewerId) {
      conditions.push(eq(performanceReviews.reviewerId, filters.reviewerId));
    }
    if (filters?.status) {
      conditions.push(eq(performanceReviews.status, filters.status));
    }
    if (filters?.period) {
      conditions.push(eq(performanceReviews.reviewPeriod, filters.period));
    }
    
    const result = await db.select({
      review: performanceReviews,
      user: users
    })
    .from(performanceReviews)
    .leftJoin(users, eq(performanceReviews.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(performanceReviews.createdAt))
    .limit(100);
    
    const reviewerIds = Array.from(new Set(result.map(r => r.review.reviewerId)));
    const reviewers = reviewerIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, reviewerIds))
      : [];
    const reviewerMap = new Map(reviewers.map(r => [r.id, excludePassword(r)!]));
    
    return result.map(r => ({
      ...r.review,
      user: excludePassword(r.user!)!,
      reviewer: reviewerMap.get(r.review.reviewerId)!
    }));
  }

  async getPerformanceReview(id: string): Promise<PerformanceReview | undefined> {
    const [review] = await db.select().from(performanceReviews).where(eq(performanceReviews.id, id));
    return review;
  }

  async createPerformanceReview(review: InsertPerformanceReview): Promise<PerformanceReview> {
    const [created] = await db.insert(performanceReviews).values(review).returning();
    return created;
  }

  async updatePerformanceReview(id: string, data: Partial<InsertPerformanceReview>): Promise<PerformanceReview | undefined> {
    const [updated] = await db.update(performanceReviews)
      .set(data)
      .where(eq(performanceReviews.id, id))
      .returning();
    return updated;
  }

  async deletePerformanceReview(id: string): Promise<boolean> {
    await db.delete(performanceReviews).where(eq(performanceReviews.id, id));
    return true;
  }

  // Documentos de empleados
  async getEmployeeDocuments(filters?: { userId?: string; documentType?: string }): Promise<(EmployeeDocument & { user: SafeUser })[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(employeeDocuments.userId, filters.userId));
    }
    if (filters?.documentType) {
      conditions.push(eq(employeeDocuments.documentType, filters.documentType));
    }
    
    const result = await db.select({
      document: employeeDocuments,
      user: users
    })
    .from(employeeDocuments)
    .leftJoin(users, eq(employeeDocuments.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(employeeDocuments.createdAt))
    .limit(200);
    
    return result.map(r => ({ ...r.document, user: excludePassword(r.user!)! }));
  }

  async getEmployeeDocument(id: string): Promise<EmployeeDocument | undefined> {
    const [document] = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, id));
    return document;
  }

  async createEmployeeDocument(document: InsertEmployeeDocument): Promise<EmployeeDocument> {
    const [created] = await db.insert(employeeDocuments).values(document).returning();
    return created;
  }

  async updateEmployeeDocument(id: string, data: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined> {
    const [updated] = await db.update(employeeDocuments)
      .set(data)
      .where(eq(employeeDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteEmployeeDocument(id: string): Promise<boolean> {
    await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
    return true;
  }

  // Estadísticas RRHH
  async getHRStats(): Promise<{
    totalEmployees: number;
    activeEmployees: number;
    pendingVacations: number;
    todayAttendance: number;
    pendingPayrolls: number;
  }> {
    const today = getTodayInTimezone();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [employeeStats] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`sum(case when ${users.isActive} = true then 1 else 0 end)::int`
    }).from(users);
    
    const [vacationStats] = await db.select({
      pending: sql<number>`count(*)::int`
    }).from(vacationRequests).where(eq(vacationRequests.status, "pendiente"));
    
    const [attendanceStats] = await db.select({
      today: sql<number>`count(*)::int`
    }).from(employeeAttendance)
    .where(and(
      gte(employeeAttendance.date, today),
      lte(employeeAttendance.date, tomorrow)
    ));
    
    const [payrollStats] = await db.select({
      pending: sql<number>`count(*)::int`
    }).from(payrollRecords).where(eq(payrollRecords.status, "pendiente"));
    
    return {
      totalEmployees: employeeStats?.total || 0,
      activeEmployees: employeeStats?.active || 0,
      pendingVacations: vacationStats?.pending || 0,
      todayAttendance: attendanceStats?.today || 0,
      pendingPayrolls: payrollStats?.pending || 0
    };
  }

  // ==================== MÓDULO TAREAS ====================

  async getTasks(filters?: { status?: string; priority?: string; assignedUserId?: string; startDate?: Date; endDate?: Date; type?: string }): Promise<any[]> {
    const conditions: any[] = [];
    
    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(tasks.priority, filters.priority));
    }
    if (filters?.assignedUserId) {
      conditions.push(eq(tasks.assignedUserId, filters.assignedUserId));
    }
    if (filters?.type) {
      conditions.push(eq(tasks.type, filters.type));
    }
    if (filters?.startDate) {
      conditions.push(gte(tasks.dueDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(tasks.dueDate, filters.endDate));
    }

    const taskList = conditions.length > 0
      ? await db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.dueDate))
      : await db.select().from(tasks).orderBy(desc(tasks.dueDate));

    return Promise.all(taskList.map(async (task) => {
      const assignedUser = task.assignedUserId ? await this.getUser(task.assignedUserId) : null;
      const machine = task.machineId ? await this.getMachine(task.machineId) : null;
      const route = task.routeId ? await this.getRoute(task.routeId) : null;
      const creator = task.createdBy ? await this.getUser(task.createdBy) : null;

      return {
        ...task,
        assignedUser: assignedUser ? { id: assignedUser.id, name: assignedUser.fullName || assignedUser.username } : null,
        machine: machine ? { id: machine.id, name: machine.name, code: machine.code } : null,
        route: route ? { id: route.id, name: route.name } : null,
        creator: creator ? { id: creator.id, name: creator.fullName || creator.username } : null
      };
    }));
  }

  async getTask(id: string): Promise<any> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return undefined;

    const assignedUser = task.assignedUserId ? await this.getUser(task.assignedUserId) : null;
    const machine = task.machineId ? await this.getMachine(task.machineId) : null;
    const route = task.routeId ? await this.getRoute(task.routeId) : null;
    const creator = task.createdBy ? await this.getUser(task.createdBy) : null;
    const completer = task.completedBy ? await this.getUser(task.completedBy) : null;

    return {
      ...task,
      assignedUser: assignedUser ? { id: assignedUser.id, name: assignedUser.fullName || assignedUser.username } : null,
      machine: machine ? { id: machine.id, name: machine.name, code: machine.code } : null,
      route: route ? { id: route.id, name: route.name } : null,
      creator: creator ? { id: creator.id, name: creator.fullName || creator.username } : null,
      completer: completer ? { id: completer.id, name: completer.fullName || completer.username } : null
    };
  }

  async getTasksForToday(userId?: string): Promise<any[]> {
    // Use timezone-aware date for "today"
    // For DATE-only columns stored as midnight UTC, we need to use the UTC date representation
    const todayInTZ = getTodayInTimezone();
    const year = todayInTZ.getFullYear();
    const month = todayInTZ.getMonth();
    const day = todayInTZ.getDate();
    
    // Create dates that will match UTC midnight representation of the target date
    const nextDateUTC = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));

    // Include today's tasks AND overdue tasks (pending/in_progress from past days)
    const conditions: any[] = [
      lte(tasks.dueDate, nextDateUTC),
      or(eq(tasks.status, "pendiente"), eq(tasks.status, "en_progreso"))
    ];

    if (userId) {
      conditions.push(eq(tasks.assignedUserId, userId));
    }

    const taskList = await db.select().from(tasks)
      .where(and(...conditions))
      .orderBy(
        asc(tasks.dueDate), // Overdue first
        sql`CASE tasks.priority WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END`,
        asc(tasks.startTime)
      )
      .limit(20);

    return Promise.all(taskList.map(async (task) => {
      const assignedUser = task.assignedUserId ? await this.getUser(task.assignedUserId) : null;
      const machine = task.machineId ? await this.getMachine(task.machineId) : null;

      return {
        ...task,
        assignedUser: assignedUser ? { id: assignedUser.id, name: assignedUser.fullName || assignedUser.username, initials: (assignedUser.fullName || assignedUser.username || "").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) } : null,
        machine: machine ? { id: machine.id, name: machine.name, code: machine.code } : null
      };
    }));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async completeTask(id: string, completedBy: string): Promise<Task | undefined> {
    const [updated] = await db.update(tasks)
      .set({ 
        status: "completada", 
        completedAt: new Date(), 
        completedBy,
        updatedAt: new Date() 
      })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async cancelTask(id: string, cancelledBy: string): Promise<Task | undefined> {
    const [updated] = await db.update(tasks)
      .set({ 
        status: "cancelada", 
        updatedAt: new Date(),
        notes: `Cancelada por usuario`
      })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    await db.delete(tasks).where(eq(tasks.id, id));
    return true;
  }

  async getTaskStats(filters?: { userId?: string; startDate?: Date; endDate?: Date }): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    overdue: number;
  }> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(tasks.assignedUserId, filters.userId));
    }
    if (filters?.startDate) {
      conditions.push(gte(tasks.dueDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(tasks.dueDate, filters.endDate));
    }

    const taskList = conditions.length > 0
      ? await db.select().from(tasks).where(and(...conditions))
      : await db.select().from(tasks);

    const now = new Date();
    const overdue = taskList.filter(t => 
      t.dueDate && new Date(t.dueDate) < now && 
      (t.status === "pendiente" || t.status === "en_progreso")
    ).length;

    return {
      total: taskList.length,
      pending: taskList.filter(t => t.status === "pendiente").length,
      inProgress: taskList.filter(t => t.status === "en_progreso").length,
      completed: taskList.filter(t => t.status === "completada").length,
      cancelled: taskList.filter(t => t.status === "cancelada").length,
      overdue
    };
  }

  // ==================== MÓDULO CALENDARIO ====================

  async getCalendarEvents(filters?: { userId?: string; startDate?: Date; endDate?: Date; eventType?: string }): Promise<any[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(calendarEvents.userId, filters.userId));
    }
    if (filters?.eventType) {
      conditions.push(eq(calendarEvents.eventType, filters.eventType));
    }
    if (filters?.startDate) {
      conditions.push(gte(calendarEvents.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(calendarEvents.startDate, filters.endDate));
    }

    const events = conditions.length > 0
      ? await db.select().from(calendarEvents).where(and(...conditions)).orderBy(asc(calendarEvents.startDate))
      : await db.select().from(calendarEvents).orderBy(asc(calendarEvents.startDate));

    return Promise.all(events.map(async (event) => {
      const user = event.userId ? await this.getUser(event.userId) : null;
      const task = event.taskId ? await this.getTask(event.taskId) : null;

      return {
        ...event,
        user: user ? { id: user.id, name: user.fullName || user.username, initials: (user.fullName || user.username || "").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) } : null,
        task: task ? { id: task.id, title: task.title } : null
      };
    }));
  }

  async getCalendarEvent(id: string): Promise<any> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    if (!event) return undefined;

    const user = event.userId ? await this.getUser(event.userId) : null;
    const task = event.taskId ? await this.getTask(event.taskId) : null;

    return {
      ...event,
      user: user ? { id: user.id, name: user.fullName || user.username } : null,
      task
    };
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const [newEvent] = await db.insert(calendarEvents).values(event).returning();
    return newEvent;
  }

  async updateCalendarEvent(id: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const [updated] = await db.update(calendarEvents)
      .set(data)
      .where(eq(calendarEvents.id, id))
      .returning();
    return updated;
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
    return true;
  }

  // ==================== PASSWORD RESET ====================

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    }).returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async markPasswordResetTokenUsed(token: string): Promise<boolean> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
    return true;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<boolean> {
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
    return true;
  }

  async deleteExpiredPasswordResetTokens(): Promise<number> {
    const result = await db.delete(passwordResetTokens)
      .where(lte(passwordResetTokens.expiresAt, new Date()));
    return 0;
  }

  // ==================== REFRESH TOKENS (JWT) ====================

  async createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string; ipAddress?: string }): Promise<RefreshToken> {
    const [token] = await db.insert(refreshTokens).values({
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
    }).returning();
    return token;
  }

  async getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    const [token] = await db.select().from(refreshTokens)
      .where(and(
        eq(refreshTokens.tokenHash, tokenHash),
        sql`${refreshTokens.revokedAt} IS NULL`,
        gte(refreshTokens.expiresAt, new Date())
      ));
    return token;
  }

  async revokeRefreshToken(tokenHash: string): Promise<boolean> {
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
    return true;
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<number> {
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(refreshTokens.userId, userId),
        sql`${refreshTokens.revokedAt} IS NULL`
      ));
    return 0;
  }

  async deleteExpiredRefreshTokens(): Promise<number> {
    await db.delete(refreshTokens)
      .where(lte(refreshTokens.expiresAt, new Date()));
    return 0;
  }
}

export const storage = new DatabaseStorage();
