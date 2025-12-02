import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  ArrowLeft,
  MapPin,
  Clock,
  AlertTriangle,
  Package,
  DollarSign,
  Wrench,
  Calendar,
  CheckCircle,
  XCircle,
  Plus,
  TrendingUp,
  User,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Machine, Location, MachineInventory, MachineAlert, MachineVisit, Product } from "@shared/schema";

const statusLabels: Record<string, string> = {
  operando: "Operando",
  necesita_servicio: "Necesita Servicio",
  vacia: "Vacía",
  fuera_de_linea: "Fuera de Línea",
  mantenimiento: "Mantenimiento",
};

const statusColors: Record<string, string> = {
  operando: "bg-emerald-500 text-white",
  necesita_servicio: "bg-amber-500 text-white",
  vacia: "bg-destructive text-destructive-foreground",
  fuera_de_linea: "bg-muted text-muted-foreground",
  mantenimiento: "bg-blue-500 text-white",
};

const alertTypeLabels: Record<string, string> = {
  producto_agotado: "Producto Agotado",
  inventario_bajo: "Inventario Bajo",
  falla_tecnica: "Falla Técnica",
  coin_box_llena: "Coin Box Llena",
  poco_cambio: "Poco Cambio",
  mantenimiento_requerido: "Mantenimiento Requerido",
};

const alertPriorityColors: Record<string, string> = {
  baja: "bg-blue-500",
  media: "bg-amber-500",
  alta: "bg-orange-500",
  critica: "bg-destructive",
};

const alertSchema = z.object({
  type: z.string().min(1, "Selecciona un tipo"),
  priority: z.string().default("media"),
  message: z.string().min(5, "El mensaje debe tener al menos 5 caracteres"),
});

type AlertFormData = z.infer<typeof alertSchema>;

interface MachineWithDetails extends Machine {
  location?: Location;
  inventory?: (MachineInventory & { product: Product })[];
  alerts?: MachineAlert[];
  recentVisits?: MachineVisit[];
  salesSummary?: { today: number; week: number; month: number };
  inventoryPercentage?: number;
}

export function MachineDetailPage() {
  const [, params] = useRoute("/maquinas/:id");
  const machineId = params?.id;
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inventario");

  const { data: machine, isLoading } = useQuery<MachineWithDetails>({
    queryKey: ["/api/machines", machineId],
    queryFn: async () => {
      const response = await fetch(`/api/machines/${machineId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Error loading machine");
      return response.json();
    },
    enabled: !!machineId,
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: AlertFormData) => {
      const response = await apiRequest("POST", `/api/machines/${machineId}/alerts`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
      setIsAlertDialogOpen(false);
      alertForm.reset();
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("PATCH", `/api/alerts/${alertId}/resolve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
    },
  });

  const alertForm = useForm<AlertFormData>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      type: "",
      priority: "media",
      message: "",
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "N/A";
    try {
      return format(new Date(date), "d MMM yyyy, HH:mm", { locale: es });
    } catch {
      return "N/A";
    }
  };

  const getTimeAgo = (date: string | Date | null | undefined) => {
    if (!date) return "Nunca";
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
    } catch {
      return "Nunca";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Máquina no encontrada</p>
            <Link href="/maquinas">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al listado
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unresolvedAlerts = machine.alerts?.filter(a => !a.isResolved) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/maquinas">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{machine.name}</h1>
              <Badge className={statusColors[machine.status || "operando"]}>
                {statusLabels[machine.status || "operando"]}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <MapPin className="h-4 w-4" />
              <span>{machine.location?.name || machine.zone || "Sin ubicación"}</span>
              {machine.code && (
                <>
                  <span>•</span>
                  <span>Código: {machine.code}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={machine.status || "operando"} 
            onValueChange={(status) => updateStatusMutation.mutate(status)}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-status">
              <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operando">Operando</SelectItem>
              <SelectItem value="necesita_servicio">Necesita Servicio</SelectItem>
              <SelectItem value="vacia">Vacía</SelectItem>
              <SelectItem value="fuera_de_linea">Fuera de Línea</SelectItem>
              <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-alert">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Reportar Problema
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reportar Problema</DialogTitle>
                <DialogDescription>
                  Registra una alerta o problema con esta máquina
                </DialogDescription>
              </DialogHeader>
              <Form {...alertForm}>
                <form onSubmit={alertForm.handleSubmit((data) => createAlertMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={alertForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Problema</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-alert-type">
                              <SelectValue placeholder="Selecciona el tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="producto_agotado">Producto Agotado</SelectItem>
                            <SelectItem value="inventario_bajo">Inventario Bajo</SelectItem>
                            <SelectItem value="falla_tecnica">Falla Técnica</SelectItem>
                            <SelectItem value="coin_box_llena">Coin Box Llena</SelectItem>
                            <SelectItem value="poco_cambio">Poco Cambio</SelectItem>
                            <SelectItem value="mantenimiento_requerido">Mantenimiento Requerido</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={alertForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridad</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-alert-priority">
                              <SelectValue placeholder="Selecciona la prioridad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="baja">Baja</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="critica">Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={alertForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe el problema..." 
                            {...field} 
                            data-testid="textarea-alert-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAlertDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createAlertMutation.isPending} data-testid="button-submit-alert">
                      {createAlertMutation.isPending ? "Guardando..." : "Reportar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inventario</p>
                <p className="text-2xl font-bold">{machine.inventoryPercentage || 0}%</p>
              </div>
            </div>
            <Progress value={machine.inventoryPercentage || 0} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ventas Hoy</p>
                <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.today || 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Semana: {formatCurrency(machine.salesSummary?.week || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alertas Activas</p>
                <p className="text-2xl font-bold">{unresolvedAlerts.length}</p>
              </div>
            </div>
            {unresolvedAlerts.length > 0 && (
              <p className="text-sm text-amber-600 mt-2">Requiere atención</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Visita</p>
                <p className="text-lg font-bold">{getTimeAgo(machine.lastVisit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventario" data-testid="tab-inventory">
            <Package className="h-4 w-4 mr-2" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="alertas" data-testid="tab-alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alertas ({unresolvedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="visitas" data-testid="tab-visits">
            <Calendar className="h-4 w-4 mr-2" />
            Visitas
          </TabsTrigger>
          <TabsTrigger value="ventas" data-testid="tab-sales">
            <DollarSign className="h-4 w-4 mr-2" />
            Ventas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Inventario Actual</CardTitle>
              <Button variant="outline" size="sm" data-testid="button-edit-inventory">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            </CardHeader>
            <CardContent>
              {machine.inventory && machine.inventory.length > 0 ? (
                <div className="space-y-4">
                  {machine.inventory.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg" data-testid={`inventory-item-${item.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product?.name || "Producto"}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.currentQuantity} / {item.maxCapacity} unidades
                        </p>
                      </div>
                      <div className="w-32">
                        <Progress 
                          value={((item.currentQuantity || 0) / (item.maxCapacity || 1)) * 100} 
                          className="h-2" 
                        />
                      </div>
                      {(item.currentQuantity || 0) <= (item.minLevel || 5) && (
                        <Badge variant="destructive" className="shrink-0">
                          Bajo
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay productos en inventario</p>
                  <Button className="mt-4" variant="outline" data-testid="button-add-first-product">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar productos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas y Problemas</CardTitle>
            </CardHeader>
            <CardContent>
              {machine.alerts && machine.alerts.length > 0 ? (
                <div className="space-y-3">
                  {machine.alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`flex items-start gap-4 p-4 rounded-lg border ${alert.isResolved ? 'bg-muted/30 opacity-60' : 'bg-background'}`}
                      data-testid={`alert-item-${alert.id}`}
                    >
                      <div className={`p-2 rounded-full ${alertPriorityColors[alert.priority || "media"]}`}>
                        <AlertTriangle className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{alertTypeLabels[alert.type] || alert.type}</p>
                          <Badge variant="outline" className="text-xs">
                            {alert.priority}
                          </Badge>
                          {alert.isResolved && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resuelta
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(alert.createdAt)}
                        </p>
                      </div>
                      {!alert.isResolved && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => resolveAlertMutation.mutate(alert.id)}
                          disabled={resolveAlertMutation.isPending}
                          data-testid={`button-resolve-alert-${alert.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolver
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                  <p className="text-muted-foreground">No hay alertas activas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visitas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Visitas</CardTitle>
            </CardHeader>
            <CardContent>
              {machine.recentVisits && machine.recentVisits.length > 0 ? (
                <div className="space-y-3">
                  {machine.recentVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg" data-testid={`visit-item-${visit.id}`}>
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <User className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium capitalize">{visit.visitType?.replace("_", " ") || "Visita"}</p>
                          {visit.durationMinutes && (
                            <Badge variant="outline" className="text-xs">
                              {visit.durationMinutes} min
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(visit.startTime)}
                        </p>
                        {visit.notes && (
                          <p className="text-sm mt-1">{visit.notes}</p>
                        )}
                      </div>
                      {visit.cashCollected && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Efectivo</p>
                          <p className="font-medium">{formatCurrency(parseFloat(visit.cashCollected))}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay visitas registradas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ventas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Hoy</p>
                  <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.today || 0)}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Últimos 7 días</p>
                  <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.week || 0)}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Últimos 30 días</p>
                  <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.month || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
