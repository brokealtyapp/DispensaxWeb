import { useState } from "react";
import { useLocation } from "wouter";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { useAuth, getRoleDefaultRoute } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AuthPageProps {
  onSuccess?: () => void;
}

export function AuthPage({ onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot-password">("login");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const handleLoginSuccess = () => {
    if (user) {
      const defaultRoute = getRoleDefaultRoute(user.role);
      setLocation(defaultRoute);
    } else {
      onSuccess?.();
    }
  };

  const handleRegisterSuccess = () => {
    if (user) {
      const defaultRoute = getRoleDefaultRoute(user.role);
      setLocation(defaultRoute);
    } else {
      onSuccess?.();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" />
          <p className="text-muted-foreground mt-2 text-center">
            Sistema de Gestión de Máquinas Expendedoras
          </p>
        </div>
        
        {mode === "forgot-password" ? (
          <ForgotPasswordForm
            onBackToLogin={() => setMode("login")}
          />
        ) : (
          <div className="w-full max-w-md">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" data-testid="tab-login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Registrarse</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm
                  onSuccess={handleLoginSuccess}
                  onForgotPassword={() => setMode("forgot-password")}
                />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm
                  onSuccess={handleRegisterSuccess}
                  onSwitchToLogin={() => setMode("login")}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
