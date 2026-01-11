import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Plus, Edit, Package, Users, MapPin, Check } from "lucide-react";

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
  features: any;
  isActive: boolean;
  createdAt: string;
}

export function SuperAdminPlansPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/super-admin/plans"],
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: Partial<SubscriptionPlan>) => {
      return apiRequest("POST", "/api/super-admin/plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/plans"] });
      setDialogOpen(false);
      toast({ title: "Plan creado correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error al crear plan", description: error.message, variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SubscriptionPlan> }) => {
      return apiRequest("PATCH", `/api/super-admin/plans/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/plans"] });
      setDialogOpen(false);
      setEditingPlan(null);
      toast({ title: "Plan actualizado correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error al actualizar plan", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      description: formData.get("description") as string || undefined,
      monthlyPrice: formData.get("monthlyPrice") as string,
      yearlyPrice: formData.get("yearlyPrice") as string || undefined,
      maxMachines: parseInt(formData.get("maxMachines") as string) || undefined,
      maxUsers: parseInt(formData.get("maxUsers") as string) || undefined,
      maxProducts: parseInt(formData.get("maxProducts") as string) || undefined,
      maxLocations: parseInt(formData.get("maxLocations") as string) || undefined,
    };

    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="super-admin-plans-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <CreditCard className="h-8 w-8 text-primary" />
            Planes de Suscripción
          </h1>
          <p className="text-muted-foreground">Configura los planes disponibles para las empresas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPlan(null);
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-plan">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPlan ? "Editar Plan" : "Nuevo Plan"}</DialogTitle>
              <DialogDescription>
                {editingPlan ? "Modifica los detalles del plan" : "Crea un nuevo plan de suscripción"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="planName">Nombre del Plan</Label>
                    <Input
                      id="planName"
                      name="name"
                      defaultValue={editingPlan?.name || ""}
                      required
                      data-testid="input-plan-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="planCode">Código</Label>
                    <Input
                      id="planCode"
                      name="code"
                      defaultValue={editingPlan?.code || ""}
                      required
                      disabled={!!editingPlan}
                      data-testid="input-plan-code"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    name="description"
                    defaultValue={editingPlan?.description || ""}
                    data-testid="input-plan-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="monthlyPrice">Precio Mensual (RD$)</Label>
                    <Input
                      id="monthlyPrice"
                      name="monthlyPrice"
                      type="number"
                      step="0.01"
                      defaultValue={editingPlan?.monthlyPrice || ""}
                      required
                      data-testid="input-plan-monthly-price"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="yearlyPrice">Precio Anual (RD$)</Label>
                    <Input
                      id="yearlyPrice"
                      name="yearlyPrice"
                      type="number"
                      step="0.01"
                      defaultValue={editingPlan?.yearlyPrice || ""}
                      data-testid="input-plan-yearly-price"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="maxMachines">Máx. Máquinas</Label>
                    <Input
                      id="maxMachines"
                      name="maxMachines"
                      type="number"
                      defaultValue={editingPlan?.maxMachines || ""}
                      data-testid="input-plan-max-machines"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxUsers">Máx. Usuarios</Label>
                    <Input
                      id="maxUsers"
                      name="maxUsers"
                      type="number"
                      defaultValue={editingPlan?.maxUsers || ""}
                      data-testid="input-plan-max-users"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="maxProducts">Máx. Productos</Label>
                    <Input
                      id="maxProducts"
                      name="maxProducts"
                      type="number"
                      defaultValue={editingPlan?.maxProducts || ""}
                      data-testid="input-plan-max-products"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxLocations">Máx. Ubicaciones</Label>
                    <Input
                      id="maxLocations"
                      name="maxLocations"
                      type="number"
                      defaultValue={editingPlan?.maxLocations || ""}
                      data-testid="input-plan-max-locations"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                  data-testid="button-submit-plan"
                >
                  {(createPlanMutation.isPending || updatePlanMutation.isPending) ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plansLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : plans.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay planes configurados</p>
            <p className="text-sm">Crea tu primer plan de suscripción</p>
          </div>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""} data-testid={`card-plan-${plan.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <Badge variant={plan.isActive ? "default" : "secondary"}>
                    {plan.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <CardDescription>{plan.description || "Sin descripción"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">
                    RD$ {parseFloat(plan.monthlyPrice).toLocaleString("es-DO")}
                    <span className="text-sm font-normal text-muted-foreground">/mes</span>
                  </div>
                  {plan.yearlyPrice && (
                    <p className="text-sm text-muted-foreground">
                      RD$ {parseFloat(plan.yearlyPrice).toLocaleString("es-DO")}/año
                    </p>
                  )}
                </div>
                
                <div className="space-y-2 text-sm border-t pt-4">
                  {plan.maxMachines && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>Hasta {plan.maxMachines} máquinas</span>
                    </div>
                  )}
                  {plan.maxUsers && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Hasta {plan.maxUsers} usuarios</span>
                    </div>
                  )}
                  {plan.maxProducts && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>Hasta {plan.maxProducts} productos</span>
                    </div>
                  )}
                  {plan.maxLocations && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>Hasta {plan.maxLocations} ubicaciones</span>
                    </div>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditingPlan(plan);
                    setDialogOpen(true);
                  }}
                  data-testid={`button-edit-plan-${plan.id}`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Plan
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
