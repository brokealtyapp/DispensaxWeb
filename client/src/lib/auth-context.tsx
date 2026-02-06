import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { queryClient } from "./queryClient";

export type UserRole = "admin" | "supervisor" | "abastecedor" | "almacen" | "contabilidad" | "rh" | "visor_establecimiento";

export interface User {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  phone?: string | null;
  role: UserRole;
  isActive?: boolean;
  assignedVehicleId?: string | null;
  assignedZoneId?: string | null;
  tenantId?: string | null;
  isSuperAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  getAuthHeaders: () => { Authorization: string } | {};
}

interface RegisterData {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: UserRole;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let accessTokenInMemory: string | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  const setToken = (token: string | null) => {
    accessTokenInMemory = token;
    setAccessToken(token);
  };

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.accessToken);
        return data.accessToken;
      } else {
        setToken(null);
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  const getAuthHeaders = useCallback(() => {
    if (accessTokenInMemory) {
      return { Authorization: `Bearer ${accessTokenInMemory}` };
    }
    return {};
  }, []);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initAuth = async () => {
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        try {
          const response = await fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            setToken(null);
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user:", error);
          setToken(null);
          setUser(null);
        }
      }
      
      setIsLoading(false);
    };

    initAuth();
  }, [refreshAccessToken]);

  useEffect(() => {
    if (!accessToken) return;

    const REFRESH_INTERVAL = 13 * 60 * 1000;
    const intervalId = setInterval(() => {
      refreshAccessToken();
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [accessToken, refreshAccessToken]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Error parsing login response:", jsonError);
        return { success: false, error: "Error en la respuesta del servidor" };
      }

      if (!response.ok) {
        return { success: false, error: data.error || "Error al iniciar sesión" };
      }

      setUser(data.user);
      setToken(data.accessToken);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      console.error("Login error:", errorMessage, error);
      return { success: false, error: "Error de conexión. Intenta de nuevo." };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Error al registrar usuario" };
      }

      setUser(result.user);
      setToken(result.accessToken);
      return { success: true };
    } catch (error) {
      console.error("Register error:", error);
      return { success: false, error: "Error de conexión. Intenta de nuevo." };
    }
  };

  const logout = async (): Promise<void> => {
    // JWT Best Practice: Limpiar estado del cliente PRIMERO (síncrono e inmediato)
    // La UI responde instantáneamente sin esperar al servidor
    setUser(null);
    setToken(null);
    setIsLoading(false);
    
    // CRÍTICO: Cancelar TODAS las peticiones pendientes de React Query
    // Esto libera el servidor inmediatamente y evita que nuevas peticiones queden en cola
    queryClient.cancelQueries();
    queryClient.clear();
    
    // Fire-and-forget: revocar refresh token en el servidor en segundo plano
    // No bloqueamos el UI - el access token expira en 15 min de todas formas
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch((error) => {
      console.error("Logout server revocation failed (non-blocking):", error);
    });
    
    // Retorna inmediatamente - no esperamos la respuesta del servidor
    return Promise.resolve();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        accessToken,
        login,
        register,
        logout,
        refreshAccessToken,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function getAccessToken(): string | null {
  return accessTokenInMemory;
}

export function setAccessTokenExternal(token: string | null): void {
  accessTokenInMemory = token;
}

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    admin: "Administrador",
    supervisor: "Supervisor",
    abastecedor: "Abastecedor/Técnico",
    almacen: "Almacenista",
    contabilidad: "Contador",
    rh: "Recursos Humanos",
    visor_establecimiento: "Visor Establecimiento",
  };
  return roleNames[role] || role;
}

export function getRoleDefaultRoute(role: UserRole, isSuperAdmin?: boolean): string {
  if (isSuperAdmin) {
    return "/super-admin";
  }
  const routes: Record<UserRole, string> = {
    admin: "/",
    supervisor: "/supervisor",
    abastecedor: "/abastecedor",
    almacen: "/almacen-panel",
    contabilidad: "/contabilidad-panel",
    rh: "/rh",
    visor_establecimiento: "/mi-panel",
  };
  return routes[role] || "/";
}

export function canAccessRoute(role: UserRole, route: string, isSuperAdmin?: boolean): boolean {
  const adminRoutes = ["/", "/maquinas", "/tareas", "/todas-tareas", "/calendario", "/almacen", "/almacen-panel",
    "/abastecedor", "/abastecedores", "/dinero-productos", "/compras", "/combustible", "/contabilidad", "/contabilidad-panel",
    "/caja-chica", "/rh", "/reportes", "/configuracion", "/supervisor", "/productos", "/supervisores", "/usuarios", "/rutas", "/monitoreo-servicios", "/visores", "/nayax"];
  
  const superAdminRoutes = ["/super-admin", "/super-admin/tenants", "/super-admin/plans", "/super-admin/metrics"];
  
  const supervisorRoutes = ["/supervisor", "/maquinas", "/tareas", "/todas-tareas", "/calendario", 
    "/almacen", "/abastecedor", "/abastecedores", "/dinero-productos", "/combustible", "/rh", "/configuracion", "/productos", "/rutas", "/monitoreo-servicios"];
  
  const abastecedorRoutes = ["/abastecedor", "/mi-vehiculo", "/tareas", "/calendario", "/configuracion"];
  
  const almacenRoutes = ["/almacen", "/almacen-panel", "/compras", "/tareas", "/calendario", "/configuracion", "/productos"];
  
  const contabilidadRoutes = ["/contabilidad", "/contabilidad-panel", "/caja-chica", "/dinero-productos", "/tareas", "/calendario", "/configuracion"];
  
  const rhRoutes = ["/rh", "/tareas", "/mis-tareas", "/calendario", "/configuracion"];

  const visorEstablecimientoRoutes = ["/mi-panel"];

  const basePath = "/" + route.split("/")[1];

  // Super Admin can access everything
  if (isSuperAdmin) {
    const allRoutes = [...adminRoutes, ...superAdminRoutes];
    return allRoutes.includes(basePath);
  }

  const routePermissions: Record<UserRole, string[]> = {
    admin: adminRoutes,
    supervisor: supervisorRoutes,
    abastecedor: abastecedorRoutes,
    almacen: almacenRoutes,
    contabilidad: contabilidadRoutes,
    rh: rhRoutes,
    visor_establecimiento: visorEstablecimientoRoutes,
  };

  return routePermissions[role]?.includes(basePath) || false;
}
