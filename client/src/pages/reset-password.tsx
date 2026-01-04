import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocation } from "wouter";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setTokenError("No se proporcionó un token válido");
        setIsVerifying(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-reset-token/${token}`);
        const data = await response.json();
        
        if (data.valid) {
          setIsValidToken(true);
        } else {
          setTokenError(data.error || "Token inválido o expirado");
        }
      } catch (error) {
        setTokenError("Error al verificar el token");
      } finally {
        setIsVerifying(false);
      }
    }

    verifyToken();
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
      });
      setIsSuccess(true);
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido restablecida correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo restablecer la contraseña",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
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
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Verificando enlace...</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (tokenError) {
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
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl">Enlace Inválido</CardTitle>
              <CardDescription className="text-base">
                {tokenError}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => setLocation("/auth")}
                data-testid="button-back-to-login"
              >
                Volver al inicio de sesión
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isSuccess) {
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
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">¡Contraseña Actualizada!</CardTitle>
              <CardDescription className="text-base">
                Tu contraseña ha sido restablecida correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => setLocation("/auth")}
                data-testid="button-go-to-login"
              >
                Iniciar Sesión
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Nueva Contraseña</CardTitle>
            <CardDescription>
              Ingresa tu nueva contraseña para restablecer el acceso a tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Ingresa tu nueva contraseña"
                            className="pr-10"
                            data-testid="input-new-password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Contraseña</FormLabel>
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirma tu nueva contraseña"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-reset-password"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    "Restablecer Contraseña"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
