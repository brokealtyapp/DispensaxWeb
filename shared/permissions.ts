/**
 * Sistema de Permisos Granular para Dispensax
 * Define qué acciones puede realizar cada rol en cada recurso
 */

export type UserRole = "admin" | "supervisor" | "abastecedor" | "almacen" | "contabilidad" | "rh";

export type Action = "view" | "create" | "edit" | "delete" | "approve" | "export";

export type Resource = 
  | "machines"
  | "routes" 
  | "stops"
  | "employees"
  | "users"
  | "suppliers"
  | "products"
  | "warehouse"
  | "warehouse_movements"
  | "cash_collections"
  | "issue_reports"
  | "petty_cash"
  | "petty_cash_approval"
  | "accounting"
  | "fuel"
  | "vehicles"
  | "purchase_orders"
  | "reports"
  | "settings"
  | "tasks"
  | "service_records";

/**
 * Matriz de permisos: define qué acciones puede realizar cada rol en cada recurso
 * true = permitido, false = no permitido
 */
const permissionMatrix: Record<UserRole, Record<Resource, Partial<Record<Action, boolean>>>> = {
  admin: {
    machines: { view: true, create: true, edit: true, delete: true },
    routes: { view: true, create: true, edit: true, delete: true },
    stops: { view: true, create: true, edit: true, delete: true },
    employees: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true },
    suppliers: { view: true, create: true, edit: true, delete: true },
    products: { view: true, create: true, edit: true, delete: true },
    warehouse: { view: true, create: true, edit: true, delete: true },
    warehouse_movements: { view: true, create: true, edit: true, delete: true },
    cash_collections: { view: true, create: true, edit: true, delete: true, approve: true },
    issue_reports: { view: true, create: true, edit: true, delete: true, approve: true },
    petty_cash: { view: true, create: true, edit: true, delete: true },
    petty_cash_approval: { view: true, approve: true },
    accounting: { view: true, create: true, edit: true, delete: true, export: true },
    fuel: { view: true, create: true, edit: true, delete: true },
    vehicles: { view: true, create: true, edit: true, delete: true },
    purchase_orders: { view: true, create: true, edit: true, delete: true, approve: true },
    reports: { view: true, export: true },
    settings: { view: true, edit: true },
    tasks: { view: true, create: true, edit: true, delete: true },
    service_records: { view: true, create: true, edit: true, delete: true },
  },
  
  supervisor: {
    machines: { view: true, create: false, edit: true, delete: false },
    routes: { view: true, create: false, edit: true, delete: false },
    stops: { view: true, create: true, edit: true, delete: true },
    employees: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    suppliers: { view: true, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    warehouse: { view: true, create: false, edit: false, delete: false },
    warehouse_movements: { view: true, create: false, edit: false, delete: false },
    cash_collections: { view: true, create: false, edit: false, delete: false, approve: false },
    issue_reports: { view: true, create: true, edit: true, delete: false, approve: true },
    petty_cash: { view: true, create: false, edit: false, delete: false },
    petty_cash_approval: { view: true, approve: false },
    accounting: { view: false, create: false, edit: false, delete: false, export: false },
    fuel: { view: true, create: true, edit: true, delete: false },
    vehicles: { view: true, create: false, edit: true, delete: false },
    purchase_orders: { view: true, create: false, edit: false, delete: false, approve: false },
    reports: { view: true, export: false },
    settings: { view: true, edit: false },
    tasks: { view: true, create: true, edit: true, delete: true },
    service_records: { view: true, create: false, edit: false, delete: false },
  },
  
  abastecedor: {
    machines: { view: true, create: false, edit: false, delete: false },
    routes: { view: true, create: false, edit: false, delete: false },
    stops: { view: true, create: false, edit: true, delete: false },
    employees: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    suppliers: { view: false, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    warehouse: { view: false, create: false, edit: false, delete: false },
    warehouse_movements: { view: false, create: false, edit: false, delete: false },
    cash_collections: { view: true, create: true, edit: false, delete: false },
    issue_reports: { view: true, create: true, edit: false, delete: false },
    petty_cash: { view: false, create: false, edit: false, delete: false },
    petty_cash_approval: { view: false, approve: false },
    accounting: { view: false, create: false, edit: false, delete: false },
    fuel: { view: false, create: false, edit: false, delete: false },
    vehicles: { view: false, create: false, edit: false, delete: false },
    purchase_orders: { view: false, create: false, edit: false, delete: false },
    reports: { view: false, export: false },
    settings: { view: true, edit: false },
    tasks: { view: true, create: false, edit: true, delete: false },
    service_records: { view: true, create: true, edit: true, delete: false },
  },
  
  almacen: {
    machines: { view: false, create: false, edit: false, delete: false },
    routes: { view: false, create: false, edit: false, delete: false },
    stops: { view: false, create: false, edit: false, delete: false },
    employees: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    suppliers: { view: true, create: true, edit: true, delete: true },
    products: { view: true, create: true, edit: true, delete: true },
    warehouse: { view: true, create: true, edit: true, delete: true },
    warehouse_movements: { view: true, create: true, edit: true, delete: false },
    cash_collections: { view: false, create: false, edit: false, delete: false },
    issue_reports: { view: false, create: false, edit: false, delete: false },
    petty_cash: { view: false, create: false, edit: false, delete: false },
    petty_cash_approval: { view: false, approve: false },
    accounting: { view: false, create: false, edit: false, delete: false },
    fuel: { view: false, create: false, edit: false, delete: false },
    vehicles: { view: false, create: false, edit: false, delete: false },
    purchase_orders: { view: true, create: true, edit: true, delete: true, approve: true },
    reports: { view: true, export: true },
    settings: { view: true, edit: false },
    tasks: { view: true, create: true, edit: true, delete: true },
    service_records: { view: false, create: false, edit: false, delete: false },
  },
  
  contabilidad: {
    machines: { view: true, create: false, edit: false, delete: false },
    routes: { view: false, create: false, edit: false, delete: false },
    stops: { view: false, create: false, edit: false, delete: false },
    employees: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    suppliers: { view: true, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    warehouse: { view: true, create: false, edit: false, delete: false },
    warehouse_movements: { view: true, create: false, edit: false, delete: false },
    cash_collections: { view: true, create: false, edit: false, delete: false, approve: true },
    issue_reports: { view: true, create: false, edit: false, delete: false },
    petty_cash: { view: true, create: true, edit: true, delete: true },
    petty_cash_approval: { view: true, approve: true },
    accounting: { view: true, create: true, edit: true, delete: true, export: true },
    fuel: { view: true, create: false, edit: false, delete: false },
    vehicles: { view: true, create: false, edit: false, delete: false },
    purchase_orders: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, export: true },
    settings: { view: true, edit: false },
    tasks: { view: true, create: true, edit: true, delete: true },
    service_records: { view: false, create: false, edit: false, delete: false },
  },
  
  rh: {
    machines: { view: false, create: false, edit: false, delete: false },
    routes: { view: false, create: false, edit: false, delete: false },
    stops: { view: false, create: false, edit: false, delete: false },
    employees: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: false },
    suppliers: { view: false, create: false, edit: false, delete: false },
    products: { view: false, create: false, edit: false, delete: false },
    warehouse: { view: false, create: false, edit: false, delete: false },
    warehouse_movements: { view: false, create: false, edit: false, delete: false },
    cash_collections: { view: false, create: false, edit: false, delete: false },
    issue_reports: { view: false, create: false, edit: false, delete: false },
    petty_cash: { view: false, create: false, edit: false, delete: false },
    petty_cash_approval: { view: false, approve: false },
    accounting: { view: false, create: false, edit: false, delete: false },
    fuel: { view: false, create: false, edit: false, delete: false },
    vehicles: { view: false, create: false, edit: false, delete: false },
    purchase_orders: { view: false, create: false, edit: false, delete: false },
    reports: { view: true, export: false },
    settings: { view: true, edit: false },
    tasks: { view: true, create: true, edit: true, delete: true },
    service_records: { view: false, create: false, edit: false, delete: false },
  },
};

/**
 * Verifica si un rol puede realizar una acción en un recurso
 */
export function canPerformAction(role: UserRole, resource: Resource, action: Action): boolean {
  const rolePermissions = permissionMatrix[role];
  if (!rolePermissions) return false;
  
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;
  
  return resourcePermissions[action] === true;
}

/**
 * Obtiene todas las acciones permitidas para un rol en un recurso
 */
export function getAllowedActions(role: UserRole, resource: Resource): Action[] {
  const rolePermissions = permissionMatrix[role];
  if (!rolePermissions) return [];
  
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return [];
  
  return (Object.entries(resourcePermissions) as [Action, boolean][])
    .filter(([_, allowed]) => allowed)
    .map(([action]) => action);
}

/**
 * Verifica si un rol puede acceder a un recurso (cualquier acción)
 */
export function canAccessResource(role: UserRole, resource: Resource): boolean {
  return canPerformAction(role, resource, "view");
}

/**
 * Verifica si es un rol de administración (admin o supervisor con privilegios elevados)
 */
export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Verifica si el rol puede supervisar a otros usuarios
 */
export function canSuperviseUsers(role: UserRole): boolean {
  return role === "admin" || role === "supervisor";
}

/**
 * Obtiene los recursos a los que un rol tiene acceso
 */
export function getAccessibleResources(role: UserRole): Resource[] {
  const rolePermissions = permissionMatrix[role];
  if (!rolePermissions) return [];
  
  return (Object.entries(rolePermissions) as [Resource, Partial<Record<Action, boolean>>][])
    .filter(([_, permissions]) => permissions.view === true)
    .map(([resource]) => resource);
}
