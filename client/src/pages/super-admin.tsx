import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2, CreditCard, Users, Package, TrendingUp, Plus, Edit, Trash2, Shield, Activity, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const tenantFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  address: z.string().optional(),
  planId: z.string().min(1, "El plan es requerido"),
});

const planFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  code: z.string().min(1, "El código es requerido"),
  description: z.string().optional(),
  monthlyPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Precio inválido"),
  yearlyPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Precio inválido").optional().or(z.literal("")),
  maxMachines: z.coerce.number().int().positive().optional().or(z.literal("")),
  maxUsers: z.coerce.number().int().positive().optional().or(z.literal("")),
  maxProducts: z.coerce.number().int().positive().optional().or(z.literal("")),
  maxLocations: z.coerce.number().int().positive().optional().or(z.literal("")),
});

type TenantFormValues = z.infer<typeof tenantFormSchema>;
type PlanFormValues = z.infer<typeof planFormSchema>;

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

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
  createdAt: string;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalMachines: number;
  totalUsers: number;
  totalProducts: number;
  totalRevenue: string;
}

export function SuperAdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [searchTenant, setSearchTenant] = useState("");
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const { data: metrics, isLoading: metricsLoading } = useQuery<PlatformMetrics>({
    queryKey: ["/api/super-admin/metrics"],
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/super-admin/tenants"],
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/super-admin/plans"],
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/super-admin/audit-logs"],
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; planId: string; phone?: string; address?: string }) => {
      return apiRequest("POST", "/api/super-admin/tenants", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/metrics"] });
      setTenantDialogOpen(false);
      toast({ title: "Empresa creada correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error al crear empresa", description: error.message, variant: "destructive" });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Tenant> }) => {
      return apiRequest("PATCH", `/api/super-admin/tenants/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      setTenantDialogOpen(false);
      setEditingTenant(null);
      toast({ title: "Empresa actualizada correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error al actualizar empresa", description: error.message, variant: "destructive" });
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/super-admin/tenants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/metrics"] });
      toast({ title: "Empresa desactivada correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error al desactivar empresa", description: error.message, variant: "destructive" });
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: Partial<SubscriptionPlan>) => {
      return apiRequest("POST", "/api/super-admin/plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/plans"] });
      setPlanDialogOpen(false);
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
      setPlanDialogOpen(false);
      setEditingPlan(null);
      toast({ title: "Plan actualizado correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error al actualizar plan", description: error.message, variant: "destructive" });
    },
  });

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTenant.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTenant.toLowerCase())
  );

  const handleTenantSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string || undefined,
      address: formData.get("address") as string || undefined,
      planId: formData.get("planId") as string,
    };

    if (editingTenant) {
      const { planId, ...updateData } = data;
      updateTenantMutation.mutate({ id: editingTenant.id, data: updateData });
    } else {
      createTenantMutation.mutate(data);
    }
  };

  const handlePlanSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
    <div className="p-6 space-y-6" data-testid="super-admin-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-8 w-8 text-primary" />
            Panel Super Administrador
          </h1>
          <p className="text-muted-foreground">Gestión de la plataforma SaaS Dispensax</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <TrendingUp className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="tenants" data-testid="tab-tenants">
            <Building2 className="h-4 w-4 mr-2" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">
            <CreditCard className="h-4 w-4 mr-2" />
            Planes
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <Activity className="h-4 w-4 mr-2" />
            Auditoría
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Empresas</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-total-tenants">{metrics?.totalTenants || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {metrics?.activeTenants || 0} activas
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Máquinas</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="text-total-machines">{metrics?.totalMachines || 0}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="text-total-users">{metrics?.totalUsers || 0}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold" data-testid="text-total-revenue">
                    RD$ {parseFloat(metrics?.totalRevenue || "0").toLocaleString("es-DO")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Empresas Recientes</CardTitle>
                <CardDescription>Últimas empresas registradas en la plataforma</CardDescription>
              </CardHeader>
              <CardContent>
                {tenantsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tenants.slice(0, 5).map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-sm text-muted-foreground">{tenant.email}</p>
                          </div>
                        </div>
                        <Badge variant={tenant.isActive ? "default" : "secondary"}>
                          {tenant.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                    ))}
                    {tenants.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No hay empresas registradas</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
                <CardDescription>Últimas acciones en la plataforma</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{log.action.replace(/_/g, " ")}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.resourceType} - {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No hay actividad reciente</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Gestión de Empresas</CardTitle>
                  <CardDescription>Administra las empresas registradas en la plataforma</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresa..."
                      value={searchTenant}
                      onChange={(e) => setSearchTenant(e.target.value)}
                      className="pl-8 w-64"
                      data-testid="input-search-tenant"
                    />
                  </div>
                  <Dialog open={tenantDialogOpen} onOpenChange={(open) => {
                    setTenantDialogOpen(open);
                    if (!open) setEditingTenant(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-tenant">
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Empresa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingTenant ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
                        <DialogDescription>
                          {editingTenant ? "Modifica los datos de la empresa" : "Registra una nueva empresa en la plataforma"}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleTenantSubmit}>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="name">Nombre de la Empresa</Label>
                            <Input
                              id="name"
                              name="name"
                              defaultValue={editingTenant?.name || ""}
                              required
                              data-testid="input-tenant-name"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              defaultValue={editingTenant?.email || ""}
                              required
                              data-testid="input-tenant-email"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input
                              id="phone"
                              name="phone"
                              defaultValue={editingTenant?.phone || ""}
                              data-testid="input-tenant-phone"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="address">Dirección</Label>
                            <Input
                              id="address"
                              name="address"
                              defaultValue={editingTenant?.address || ""}
                              data-testid="input-tenant-address"
                            />
                          </div>
                          {!editingTenant && (
                            <div className="grid gap-2">
                              <Label htmlFor="planId">Plan de Suscripción</Label>
                              <select
                                id="planId"
                                name="planId"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                required
                                data-testid="select-tenant-plan"
                              >
                                {plans.filter(p => p.isActive).map((plan) => (
                                  <option key={plan.id} value={plan.id}>
                                    {plan.name} - RD$ {parseFloat(plan.monthlyPrice).toLocaleString("es-DO")}/mes
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={createTenantMutation.isPending || updateTenantMutation.isPending}
                            data-testid="button-submit-tenant"
                          >
                            {(createTenantMutation.isPending || updateTenantMutation.isPending) ? "Guardando..." : "Guardar"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredTenants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No se encontraron empresas
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTenants.map((tenant) => (
                        <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                          <TableCell className="font-medium">{tenant.name}</TableCell>
                          <TableCell>{tenant.email}</TableCell>
                          <TableCell>{tenant.phone || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={tenant.isActive ? "default" : "secondary"}>
                              {tenant.isActive ? "Activa" : "Inactiva"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(tenant.createdAt), "dd/MM/yyyy", { locale: es })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingTenant(tenant);
                                  setTenantDialogOpen(true);
                                }}
                                data-testid={`button-edit-tenant-${tenant.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("¿Estás seguro de desactivar esta empresa?")) {
                                    deleteTenantMutation.mutate(tenant.id);
                                  }
                                }}
                                data-testid={`button-delete-tenant-${tenant.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Planes de Suscripción</CardTitle>
                  <CardDescription>Configura los planes disponibles para las empresas</CardDescription>
                </div>
                <Dialog open={planDialogOpen} onOpenChange={(open) => {
                  setPlanDialogOpen(open);
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
                    <form onSubmit={handlePlanSubmit}>
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
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No hay planes configurados
                  </div>
                ) : (
                  plans.map((plan) => (
                    <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""} data-testid={`card-plan-${plan.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <Badge variant={plan.isActive ? "default" : "secondary"}>
                            {plan.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        <CardDescription>{plan.description || "Sin descripción"}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-4">
                          RD$ {parseFloat(plan.monthlyPrice).toLocaleString("es-DO")}
                          <span className="text-sm font-normal text-muted-foreground">/mes</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          {plan.maxMachines && (
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span>Hasta {plan.maxMachines} máquinas</span>
                            </div>
                          )}
                          {plan.maxUsers && (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>Hasta {plan.maxUsers} usuarios</span>
                            </div>
                          )}
                          {plan.maxProducts && (
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span>Hasta {plan.maxProducts} productos</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPlan(plan);
                              setPlanDialogOpen(true);
                            }}
                            data-testid={`button-edit-plan-${plan.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Log de Auditoría</CardTitle>
              <CardDescription>Historial de acciones realizadas en la plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>ID Recurso</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        </TableRow>
                      ))
                    ) : auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay registros de auditoría
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log) => (
                        <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                          <TableCell>
                            {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action.replace(/_/g, " ")}</Badge>
                          </TableCell>
                          <TableCell>{log.resourceType}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.resourceId ? log.resourceId.slice(0, 8) + "..." : "-"}
                          </TableCell>
                          <TableCell>{log.ipAddress || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
