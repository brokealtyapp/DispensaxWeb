import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AuthPageProps {
  onSuccess?: () => void;
}

export function AuthPage({ onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        {mode === "login" ? (
          <LoginForm
            onSwitchToRegister={() => setMode("register")}
            onSuccess={onSuccess}
          />
        ) : (
          <RegisterForm
            onSwitchToLogin={() => setMode("login")}
            onSuccess={onSuccess}
          />
        )}
      </main>
    </div>
  );
}
