import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "forgot-password">("login");

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
          <LoginForm
            onForgotPassword={() => setMode("forgot-password")}
          />
        )}
      </main>
    </div>
  );
}
