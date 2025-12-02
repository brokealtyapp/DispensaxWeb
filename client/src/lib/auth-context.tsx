import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "admin" | "supervisor" | "abastecedor" | "almacen" | "contabilidad" | "rh";

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
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
    const storedUser = localStorage.getItem("dispensax_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    
    // todo: remove mock functionality - replace with actual API call
    if (username && password) {
      const mockUser: User = {
        id: "1",
        username,
        fullName: "Carlos Rodríguez",
        email: `${username}@dispensax.com`,
        role: "admin",
        avatar: undefined,
      };
      setUser(mockUser);
      localStorage.setItem("dispensax_user", JSON.stringify(mockUser));
      localStorage.setItem("dispensax_token", "mock-jwt-token");
      setIsLoading(false);
      return true;
    }
    setIsLoading(false);
    return false;
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    
    // todo: remove mock functionality - replace with actual API call
    const mockUser: User = {
      id: "1",
      username: data.username,
      fullName: data.fullName,
      email: data.email,
      role: data.role,
      avatar: undefined,
    };
    setUser(mockUser);
    localStorage.setItem("dispensax_user", JSON.stringify(mockUser));
    localStorage.setItem("dispensax_token", "mock-jwt-token");
    setIsLoading(false);
    return true;
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
