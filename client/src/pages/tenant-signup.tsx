import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, Package, Check, ArrowRight, ArrowLeft, Shield } from "lucide-react";
import dispensaxLogo from "@assets/LOGO-DISPENSAX_1764711476889.png";

interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string | null;
  maxMachines: number | null;
  maxUsers: number | null;
  maxProducts: number | null;
  maxLocations: number | null;
  features: string[] | null;
  isActive: boolean;
}

const signupSchema = z.object({
  companyName: z.string().min(2, "El nombre de la empresa debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  address: z.string().optional(),
  adminName: z.string().min(2, "El nombre es requerido"),
  adminEmail: z.string().email("Email del administrador inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function TenantSignupPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/public/plans"],
  });

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: "",
      email: "",
      phone: "",
      address: "",
      adminName: "",
      adminEmail: "",
      password: "",
      confirmPassword: "",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormValues & { planId: string }) => {
      return apiRequest("POST", "/api/public/tenant-signup", data);
    },
    onSuccess: () => {
      toast({ 
        title: "Registro exitoso", 
        description: "Tu empresa ha sido registrada. Revisa tu correo para activar tu cuenta." 
      });
      navigate("/auth");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error en el registro", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const activePlans = plans.filter(p => p.isActive);

  const handleSubmit = (values: SignupFormValues) => {
    if (!selectedPlanId) {
      toast({ title: "Selecciona un plan", variant: "destructive" });
      return;
    }
    signupMutation.mutate({ ...values, planId: selectedPlanId });
  };

  const nextStep = () => {
    if (step === 1 && !selectedPlanId) {
      toast({ title: "Por favor selecciona un plan", variant: "destructive" });
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <img 
            src={dispensaxLogo} 
            alt="Dispensax" 
            className="h-16 mx-auto mb-4"
            data-testid="img-logo"
          />
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Registra tu empresa
          </h1>
          <p className="text-muted-foreground mt-2">
            Comienza a gestionar tus máquinas expendedoras con Dispensax
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              1
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              2
            </div>
            <div className={`w-16 h-1 ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              3
            </div>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center">Selecciona tu plan</h2>
            
            {plansLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-24" />
                      <div className="h-4 bg-muted rounded w-full mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-8 bg-muted rounded w-32 mb-4" />
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-full" />
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : activePlans.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No hay planes disponibles en este momento.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {activePlans.map((plan) => (
                  <Card 
                    key={plan.id}
                    className={`cursor-pointer transition-all ${selectedPlanId === plan.id ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        {selectedPlanId === plan.id && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <CardDescription>{plan.description || "Plan de suscripción"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-4">
                        RD$ {parseFloat(plan.monthlyPrice).toLocaleString("es-DO")}
                        <span className="text-sm font-normal text-muted-foreground">/mes</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {plan.maxMachines && (
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            <span>Hasta {plan.maxMachines} máquinas</span>
                          </div>
                        )}
                        {plan.maxUsers && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span>Hasta {plan.maxUsers} usuarios</span>
                          </div>
                        )}
                        {plan.features && plan.features.length > 0 && (
                          <Separator className="my-2" />
                        )}
                        {plan.features?.map((feature, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-center">
              <Button 
                size="lg" 
                onClick={nextStep}
                disabled={!selectedPlanId}
                data-testid="button-next-step"
              >
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Datos de la empresa</CardTitle>
              <CardDescription>Ingresa la información de tu empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="space-y-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="Mi Empresa S.R.L." {...field} data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email de la empresa</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contacto@miempresa.com" {...field} data-testid="input-company-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono (opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="809-555-1234" {...field} data-testid="input-company-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dirección (opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Av. Principal #123" {...field} data-testid="input-company-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={prevStep} data-testid="button-prev-step">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                    </Button>
                    <Button type="button" onClick={nextStep} data-testid="button-next-step">
                      Continuar <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Crear tu cuenta de administrador</CardTitle>
              <CardDescription>Esta será tu cuenta principal para acceder al sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="adminName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan Pérez" {...field} data-testid="input-admin-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="adminEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email del administrador</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="admin@miempresa.com" {...field} data-testid="input-admin-email" />
                        </FormControl>
                        <FormDescription>Este será tu email para iniciar sesión</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="********" {...field} data-testid="input-password" />
                        </FormControl>
                        <FormDescription>Mínimo 8 caracteres</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar contraseña</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="********" {...field} data-testid="input-confirm-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={prevStep} data-testid="button-prev-step">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                    </Button>
                    <Button 
                      type="submit"
                      disabled={signupMutation.isPending}
                      data-testid="button-submit"
                    >
                      {signupMutation.isPending ? "Registrando..." : "Completar registro"}
                      <Shield className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Ya tienes una cuenta?{" "}
          <a href="/auth" className="text-primary hover:underline">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
