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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Edit, Trash2, Search, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  users?: string;
  machines?: string;
  planName?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: string;
  isActive: boolean;
}

export function SuperAdminTenantsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTenant, setSearchTenant] = useState("");
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/super-admin/tenants"],
  });

  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/super-admin/plans"],
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; planId: string; phone?: string; address?: string }) => {
      return apiRequest("POST", "/api/super-admin/tenants", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/metrics"] });
      setDialogOpen(false);
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
      setDialogOpen(false);
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

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTenant.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTenant.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

  return (
    <div className="p-6 space-y-6" data-testid="super-admin-tenants-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Building2 className="h-8 w-8 text-primary" />
            Gestión de Empresas
          </h1>
          <p className="text-muted-foreground">Administra las empresas registradas en la plataforma</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Empresas Registradas</CardTitle>
              <CardDescription>{tenants.length} empresas en total</CardDescription>
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
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
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
                  <form onSubmit={handleSubmit}>
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
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Usuarios</TableHead>
                  <TableHead>Máquinas</TableHead>
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
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No se encontraron empresas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>{tenant.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tenant.planName || "Sin plan"}</Badge>
                      </TableCell>
                      <TableCell>{tenant.users || 0}</TableCell>
                      <TableCell>{tenant.machines || 0}</TableCell>
                      <TableCell>
                        <Badge variant={tenant.isActive ? "default" : "secondary"}>
                          {tenant.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(tenant.createdAt), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingTenant(tenant);
                              setDialogOpen(true);
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
    </div>
  );
}
