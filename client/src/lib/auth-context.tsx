import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "./queryClient";

export type UserRole = "admin" | "supervisor" | "abastecedor" | "almacen" | "contabilidad" | "rh";

export interface User {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  phone?: string | null;
  role: UserRole;
  isActive?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

interface RegisterData {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: UserRole;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("dispensax_token");
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem("dispensax_token");
          localStorage.removeItem("dispensax_user");
        }
      } catch (error) {
        console.error("Error validating token:", error);
        localStorage.removeItem("dispensax_token");
        localStorage.removeItem("dispensax_user");
      }
      
      setIsLoading(false);
    };

    validateToken();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIsLoading(false);
        return { success: false, error: data.error || "Error al iniciar sesión" };
      }

      setUser(data.user);
      localStorage.setItem("dispensax_token", data.token);
      localStorage.setItem("dispensax_user", JSON.stringify(data.user));
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
      return { success: false, error: "Error de conexión. Intenta de nuevo." };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setIsLoading(false);
        return { success: false, error: result.error || "Error al registrar usuario" };
      }

      setUser(result.user);
      localStorage.setItem("dispensax_token", result.token);
      localStorage.setItem("dispensax_user", JSON.stringify(result.user));
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.error("Register error:", error);
      setIsLoading(false);
      return { success: false, error: "Error de conexión. Intenta de nuevo." };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("dispensax_user");
    localStorage.removeItem("dispensax_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
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

export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    admin: "Administrador",
    supervisor: "Supervisor",
    abastecedor: "Abastecedor/Técnico",
    almacen: "Almacenista",
    contabilidad: "Contador",
    rh: "Recursos Humanos",
  };
  return roleNames[role] || role;
}

export function getRoleDefaultRoute(role: UserRole): string {
  const routes: Record<UserRole, string> = {
    admin: "/",
    supervisor: "/supervisor",
    abastecedor: "/abastecedor",
    almacen: "/almacen-panel",
    contabilidad: "/contabilidad-panel",
    rh: "/rh",
  };
  return routes[role] || "/";
}

export function canAccessRoute(role: UserRole, route: string): boolean {
  const adminRoutes = ["/", "/maquinas", "/tareas", "/todas-tareas", "/calendario", "/almacen", "/almacen-panel",
    "/abastecedor", "/dinero-productos", "/compras", "/combustible", "/contabilidad", "/contabilidad-panel",
    "/caja-chica", "/rh", "/reportes", "/configuracion", "/supervisor"];
  
  const supervisorRoutes = ["/supervisor", "/maquinas", "/tareas", "/todas-tareas", "/calendario", 
    "/almacen", "/abastecedor", "/dinero-productos", "/combustible", "/rh", "/configuracion"];
  
  const abastecedorRoutes = ["/abastecedor", "/tareas", "/calendario", "/configuracion"];
  
  const almacenRoutes = ["/almacen", "/almacen-panel", "/compras", "/tareas", "/calendario", "/configuracion"];
  
  const contabilidadRoutes = ["/contabilidad", "/contabilidad-panel", "/caja-chica", "/dinero-productos", "/tareas", "/calendario", "/configuracion"];
  
  const rhRoutes = ["/rh", "/tareas", "/calendario", "/configuracion"];

  const routePermissions: Record<UserRole, string[]> = {
    admin: adminRoutes,
    supervisor: supervisorRoutes,
    abastecedor: abastecedorRoutes,
    almacen: almacenRoutes,
    contabilidad: contabilidadRoutes,
    rh: rhRoutes,
  };

  const basePath = "/" + route.split("/")[1];
  return routePermissions[role]?.includes(basePath) || false;
}
