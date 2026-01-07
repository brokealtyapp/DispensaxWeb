import { useAuth } from "@/lib/auth-context";
import { 
  canPerformAction, 
  getAllowedActions, 
  canAccessResource,
  isAdminRole,
  canSuperviseUsers,
  getAccessibleResources,
  type UserRole, 
  type Resource, 
  type Action 
} from "@shared/permissions";

/**
 * Hook para verificar permisos del usuario actual
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = (user?.role || "abastecedor") as UserRole;

  return {
    /**
     * Verifica si el usuario puede realizar una acción en un recurso
     */
    can: (resource: Resource, action: Action): boolean => {
      return canPerformAction(role, resource, action);
    },

    /**
     * Verifica si el usuario puede ver un recurso
     */
    canView: (resource: Resource): boolean => {
      return canPerformAction(role, resource, "view");
    },

    /**
     * Verifica si el usuario puede crear en un recurso
     */
    canCreate: (resource: Resource): boolean => {
      return canPerformAction(role, resource, "create");
    },

    /**
     * Verifica si el usuario puede editar un recurso
     */
    canEdit: (resource: Resource): boolean => {
      return canPerformAction(role, resource, "edit");
    },

    /**
     * Verifica si el usuario puede eliminar en un recurso
     */
    canDelete: (resource: Resource): boolean => {
      return canPerformAction(role, resource, "delete");
    },

    /**
     * Verifica si el usuario puede aprobar en un recurso
     */
    canApprove: (resource: Resource): boolean => {
      return canPerformAction(role, resource, "approve");
    },

    /**
     * Verifica si el usuario puede exportar un recurso
     */
    canExport: (resource: Resource): boolean => {
      return canPerformAction(role, resource, "export");
    },

    /**
     * Obtiene todas las acciones permitidas para un recurso
     */
    getAllowedActions: (resource: Resource): Action[] => {
      return getAllowedActions(role, resource);
    },

    /**
     * Verifica si el usuario tiene acceso a un recurso
     */
    hasAccess: (resource: Resource): boolean => {
      return canAccessResource(role, resource);
    },

    /**
     * Verifica si el usuario es administrador
     */
    isAdmin: isAdminRole(role),

    /**
     * Verifica si el usuario puede supervisar a otros
     */
    canSupervise: canSuperviseUsers(role),

    /**
     * Obtiene los recursos accesibles
     */
    accessibleResources: getAccessibleResources(role),

    /**
     * Rol actual del usuario
     */
    role,
  };
}

export type { UserRole, Resource, Action };
