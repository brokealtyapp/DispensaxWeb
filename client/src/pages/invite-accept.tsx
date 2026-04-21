import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Building2, Mail } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

type PreviewStatus = "valid" | "expired" | "accepted" | "not_found" | "error";

interface PreviewData {
  status: PreviewStatus;
  email: string;
  establishmentName: string;
  expiresAt: string | null;
}

const acceptSchema = z.object({
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  fullName: z.string().optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type AcceptFormData = z.infer<typeof acceptSchema>;

export function InviteAcceptPage() {
  const [, params] = useRoute<{ token: string }>("/invite/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const token = params?.token || "";

  const form = useForm<AcceptFormData>({
    resolver: zodResolver(acceptSchema),
    defaultValues: { username: "", fullName: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setPreview({ status: "not_found", email: "", establishmentName: "", expiresAt: null });
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/viewer-invites/${token}/preview`);
        const data = await res.json();
        if (cancelled) return;
        setPreview({
          status: (data.status as PreviewStatus) || "error",
          email: data.email || "",
          establishmentName: data.establishmentName || "",
          expiresAt: data.expiresAt || null,
        });
      } catch {
        if (!cancelled) setPreview({ status: "error", email: "", establishmentName: "", expiresAt: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  const onSubmit = async (values: AcceptFormData) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/viewer-invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
          fullName: values.fullName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "No se pudo crear la cuenta", description: data.error || "Intenta nuevamente", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      toast({ title: "Cuenta creada", description: "Ya puedes iniciar sesión con tus credenciales." });
      setLocation("/auth");
    } catch (e: any) {
      toast({ title: "Error de conexión", description: e?.message || "Intenta nuevamente", variant: "destructive" });
      setSubmitting(false);
    }
  };

  const renderShell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center"><Logo /></div>
          <CardTitle>Activar acceso al panel</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return renderShell(
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preview || preview.status !== "valid") {
    const messages: Record<PreviewStatus, { title: string; desc: string }> = {
      valid: { title: "", desc: "" },
      expired: { title: "Invitación expirada", desc: "Solicita al administrador una nueva invitación." },
      accepted: { title: "Invitación ya utilizada", desc: "Esta cuenta ya fue creada. Inicia sesión con tus credenciales." },
      not_found: { title: "Invitación no encontrada", desc: "El enlace no es válido o fue revocado." },
      error: { title: "Error al cargar", desc: "No se pudo verificar la invitación. Intenta más tarde." },
    };
    const msg = messages[preview?.status || "error"];
    return renderShell(
      <div className="space-y-4 text-center" data-testid="section-invite-error">
        <XCircle className="h-12 w-12 mx-auto text-destructive" />
        <div>
          <p className="font-medium">{msg.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{msg.desc}</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/auth")} data-testid="button-go-login">
          Ir a iniciar sesión
        </Button>
      </div>
    );
  }

  return renderShell(
    <div className="space-y-4" data-testid="section-invite-form">
      <div className="space-y-2 text-sm border rounded-md p-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium" data-testid="text-invite-establishment">{preview.establishmentName}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span data-testid="text-invite-email">{preview.email}</span>
        </div>
      </div>
      <CardDescription>
        Crea tu usuario y contraseña para acceder al panel del establecimiento.
      </CardDescription>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" data-testid="form-accept-invite">
          <FormField control={form.control} name="username" render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de usuario</FormLabel>
              <FormControl><Input {...field} autoComplete="username" data-testid="input-username" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="fullName" render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre completo (opcional)</FormLabel>
              <FormControl><Input {...field} data-testid="input-full-name" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} {...field} autoComplete="new-password" data-testid="input-password" />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="button-toggle-password">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="confirmPassword" render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar contraseña</FormLabel>
              <FormControl><Input type={showPassword ? "text" : "password"} {...field} autoComplete="new-password" data-testid="input-confirm-password" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" className="w-full" disabled={submitting} data-testid="button-submit-accept">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Crear cuenta y activar
          </Button>
        </form>
      </Form>
    </div>
  );
}
