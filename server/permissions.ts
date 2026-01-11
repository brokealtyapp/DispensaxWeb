/**
 * Server-side permissions middleware
 * Re-exports from shared/permissions and provides Express middleware
 */

import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";
import { 
  canPerformAction, 
  type UserRole, 
  type Resource, 
  type Action 
} from "@shared/permissions";

export { canPerformAction, type UserRole, type Resource, type Action };

/**
 * Middleware que verifica si el usuario tiene permiso para realizar una acción
 */
export function authorizeAction(resource: Resource, action: Action) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const role = req.user.role as UserRole;
    
    if (!canPerformAction(role, resource, action)) {
      return res.status(403).json({ 
        error: `No tienes permiso para ${getActionText(action)} ${getResourceText(resource)}` 
      });
    }

    next();
  };
}

/**
 * Helper para verificar permisos en el request handler
 */
export function checkPermission(req: AuthenticatedRequest, resource: Resource, action: Action): boolean {
  if (!req.user) return false;
  return canPerformAction(req.user.role as UserRole, resource, action);
}

function getActionText(action: Action): string {
  const texts: Record<Action, string> = {
    view: "ver",
    create: "crear",
    edit: "editar",
    delete: "eliminar",
    approve: "aprobar",
    export: "exportar",
  };
  return texts[action] || action;
}

function getResourceText(resource: Resource): string {
  const texts: Record<Resource, string> = {
    machines: "máquinas",
    locations: "ubicaciones",
    routes: "rutas",
    stops: "paradas",
    employees: "empleados",
    users: "usuarios",
    suppliers: "proveedores",
    products: "productos",
    warehouse: "almacén",
    warehouse_movements: "movimientos de almacén",
    cash_collections: "recolecciones de efectivo",
    issue_reports: "reportes de incidencias",
    petty_cash: "caja chica",
    petty_cash_approval: "aprobaciones de caja chica",
    accounting: "contabilidad",
    fuel: "combustible",
    vehicles: "vehículos",
    purchase_orders: "órdenes de compra",
    reports: "reportes",
    settings: "configuración",
    tasks: "tareas",
    service_records: "registros de servicio",
    attendance: "asistencia",
    payroll: "nómina",
    vacations: "vacaciones",
    performance_reviews: "evaluaciones de desempeño",
    employee_documents: "documentos de empleados",
    employee_profiles: "perfiles de empleados",
    machine_sales: "ventas de máquinas",
    establishment_viewers: "visores de establecimiento",
  };
  return texts[resource] || resource;
}
