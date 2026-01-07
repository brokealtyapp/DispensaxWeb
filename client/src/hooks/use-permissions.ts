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
  const isLoading = user === undefined;
  const isAuthenticated = user !== null && user !== undefined;
  const role = (user?.role || "abastecedor") as UserRole;

  return {
    /**
     * Indica si los permisos están cargando
     */
    isLoading,

    /**
     * Indica si el usuario está autenticado
     */
    isAuthenticated,

    /**
     * Indica si los permisos están listos para usar
     */
    isReady: !isLoading,

    /**
     * Verifica si el usuario puede realizar una acción en un recurso
     */
    can: (resource: Resource, action: Action): boolean => {
      if (!isAuthenticated) return false;
      return canPerformAction(role, resource, action);
    },

    /**
     * Verifica si el usuario puede ver un recurso
     */
    canView: (resource: Resource): boolean => {
      if (!isAuthenticated) return false;
      return canPerformAction(role, resource, "view");
    },

    /**
     * Verifica si el usuario puede crear en un recurso
     */
    canCreate: (resource: Resource): boolean => {
      if (!isAuthenticated) return false;
      return canPerformAction(role, resource, "create");
    },

    /**
     * Verifica si el usuario puede editar un recurso
     */
    canEdit: (resource: Resource): boolean => {
      if (!isAuthenticated) return false;
      return canPerformAction(role, resource, "edit");
    },

    /**
     * Verifica si el usuario puede eliminar en un recurso
     */
    canDelete: (resource: Resource): boolean => {
      if (!isAuthenticated) return false;
      return canPerformAction(role, resource, "delete");
    },

    /**
     * Verifica si el usuario puede aprobar en un recurso
     */
    canApprove: (resource: Resource): boolean => {
      if (!isAuthenticated) return false;
      return canPerformAction(role, resource, "approve");
    },

    /**
     * Verifica si el usuario puede exportar un recurso
     */
    canExport: (resource: Resource): boolean => {
      if (!isAuthenticated) return false;
      return canPerformAction(role, resource, "export");
    },

    /**
     * Obtiene todas las acciones permitidas para un recurso
     */
    getAllowedActions: (resource: Resource): Action[] => {
      if (!isAuthenticated) return [];
      return getAllowedActions(role, resource);
    },

    /**
     * Verifica si el usuario tiene acceso a un recurso
     */
    hasAccess: (resource: Resource): boolean => {
      if (!isAuthenticated) return false;
      return canAccessResource(role, resource);
    },

    /**
     * Verifica si el usuario es administrador
     */
    isAdmin: isAuthenticated && isAdminRole(role),

    /**
     * Verifica si el usuario puede supervisar a otros
     */
    canSupervise: isAuthenticated && canSuperviseUsers(role),

    /**
     * Obtiene los recursos accesibles
     */
    accessibleResources: isAuthenticated ? getAccessibleResources(role) : [],

    /**
     * Rol actual del usuario
     */
    role,
  };
}

export type { UserRole, Resource, Action };
