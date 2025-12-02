import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceTimer } from "@/components/ServiceTimer";
import { ProductCard } from "@/components/ProductCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MapPin,
  Navigation,
  Clock,
  Package,
  DollarSign,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Play,
  Square,
  Loader2,
  ChevronRight,
} from "lucide-react";

const DEMO_USER_ID = "abastecedor1";

interface RouteStop {
  id: string;
  order: number;
  status: string;
  estimatedArrival: string;
  actualArrival?: string;
  actualDeparture?: string;
  notes?: string;
  machine: {
    id: string;
    name: string;
    code: string;
    location?: {
      name: string;
      address: string;
    };
  };
}

interface Route {
  id: string;
  date: string;
  status: string;
  totalStops: number;
  completedStops: number;
  estimatedDuration: number;
  actualDuration?: number;
  startTime?: string;
  endTime?: string;
  stops: RouteStop[];
}

export function SupplierPage() {
  const [activeTab, setActiveTab] = useState("ruta");
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [currentStop, setCurrentStop] = useState<RouteStop | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [issueType, setIssueType] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [issuePriority, setIssuePriority] = useState("media");
  const { toast } = useToast();

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const supplierId = users?.find((u: any) => u.username === DEMO_USER_ID)?.id;

  const { data: todayRoute, isLoading: isLoadingRoute, refetch: refetchRoute } = useQuery<Route>({
    queryKey: ["/api/supplier/today-route", supplierId],
    enabled: !!supplierId,
  });

  const { data: supplierStats } = useQuery({
    queryKey: ["/api/supplier/stats", supplierId],
    enabled: !!supplierId,
  });

  const { data: machineInventory } = useQuery({
    queryKey: ["/api/machines", currentStop?.machine?.id, "inventory"],
    enabled: !!currentStop?.machine?.id && isServiceActive,
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const startRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      return apiRequest("POST", `/api/supplier/routes/${routeId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/today-route"] });
      toast({ title: "Ruta iniciada", description: "Tu ruta del día ha comenzado" });
    },
  });

  const startStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      return apiRequest("POST", `/api/supplier/stops/${stopId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/today-route"] });
    },
  });

  const completeStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      return apiRequest("POST", `/api/supplier/stops/${stopId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/today-route"] });
    },
  });

  const startServiceMutation = useMutation({
    mutationFn: async (data: { userId: string; machineId: string; routeStopId?: string }) => {
      return apiRequest("POST", "/api/supplier/services", data);
    },
    onSuccess: (data: any) => {
      setActiveServiceId(data.id);
      toast({ title: "Servicio iniciado" });
    },
  });

  const endServiceMutation = useMutation({
    mutationFn: async ({ serviceId, notes }: { serviceId: string; notes?: string }) => {
      return apiRequest("POST", `/api/supplier/services/${serviceId}/end`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/services"] });
      toast({ title: "Servicio finalizado" });
    },
  });

  const createCashCollectionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/supplier/cash", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/cash"] });
      toast({ title: "Efectivo registrado", description: `$${cashAmount} MXN registrados` });
      setCashAmount("");
      setExpectedAmount("");
      setIsCashDialogOpen(false);
    },
  });

  const createIssueReportMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/supplier/issues", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/issues"] });
      toast({ title: "Reporte enviado", description: "El supervisor ha sido notificado" });
      setIssueType("");
      setIssueDescription("");
      setIssuePriority("media");
      setIsReportDialogOpen(false);
    },
  });

  const handleStartRoute = () => {
    if (todayRoute?.id) {
      startRouteMutation.mutate(todayRoute.id);
    }
  };

  const handleStartService = async (stop: RouteStop) => {
    if (!supplierId) return;
    
    setCurrentStop(stop);
    setIsServiceActive(true);
    setActiveTab("servicio");
    
    await startStopMutation.mutateAsync(stop.id);
    const service = await startServiceMutation.mutateAsync({
      userId: supplierId,
      machineId: stop.machine.id,
      routeStopId: stop.id,
    });
  };

  const handleStopService = async (duration: number) => {
    if (!activeServiceId || !currentStop) return;
    
    const minutes = Math.floor(duration / 60);
    await endServiceMutation.mutateAsync({ serviceId: activeServiceId });
    await completeStopMutation.mutateAsync(currentStop.id);
    
    toast({
      title: "Servicio finalizado",
      description: `Tiempo total: ${minutes} minutos`,
    });
    
    setIsServiceActive(false);
    setCurrentStop(null);
    setActiveServiceId(null);
    setActiveTab("ruta");
    refetchRoute();
  };

  const handleReportIssue = () => {
    if (!supplierId || !currentStop) return;
    
    createIssueReportMutation.mutate({
      machineId: currentStop.machine.id,
      userId: supplierId,
      serviceRecordId: activeServiceId,
      issueType: issueType || "otro",
      description: issueDescription,
      priority: issuePriority,
    });
  };

  const handleCashCollection = () => {
    if (!supplierId || !currentStop) return;
    
    createCashCollectionMutation.mutate({
      machineId: currentStop.machine.id,
      userId: supplierId,
      serviceRecordId: activeServiceId,
      actualAmount: cashAmount,
      expectedAmount: expectedAmount || undefined,
    });
  };

  const completedStops = todayRoute?.completedStops || 0;
  const totalStops = todayRoute?.totalStops || 0;
  const estimatedDuration = todayRoute?.estimatedDuration || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completada":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Completada</Badge>;
      case "en_progreso":
        return <Badge className="bg-blue-500 hover:bg-blue-600">En progreso</Badge>;
      default:
        return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  if (isLoadingRoute) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Panel de Abastecedor</h1>
          <p className="text-muted-foreground">
            {todayRoute ? format(new Date(todayRoute.date), "EEEE d 'de' MMMM, yyyy", { locale: es }) : "Sin ruta asignada"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {todayRoute && todayRoute.status === "pendiente" && (
            <Button onClick={handleStartRoute} disabled={startRouteMutation.isPending} data-testid="button-start-route">
              {startRouteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Iniciar Ruta
            </Button>
          )}
          <Badge variant="outline" className="gap-1" data-testid="badge-progress">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {completedStops}/{totalStops} completadas
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-stops">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalStops}</p>
              <p className="text-sm text-muted-foreground">Paradas hoy</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-time">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{Math.round(estimatedDuration / 60)}h</p>
              <p className="text-sm text-muted-foreground">Tiempo estimado</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-products">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{(supplierStats as any)?.productsLoaded || 0}</p>
              <p className="text-sm text-muted-foreground">Productos cargados</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-cash">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">${((supplierStats as any)?.cashCollected || 0).toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Efectivo recolectado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="ruta" data-testid="tab-route">Mi Ruta</TabsTrigger>
          <TabsTrigger value="servicio" disabled={!isServiceActive} data-testid="tab-service">
            Servicio Activo
          </TabsTrigger>
          <TabsTrigger value="inventario" data-testid="tab-inventory">Inventario</TabsTrigger>
        </TabsList>

        <TabsContent value="ruta" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="h-5 w-5" />
                    Ruta del Día
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!todayRoute ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No tienes una ruta asignada para hoy</p>
                    </div>
                  ) : (
                    todayRoute.stops?.map((stop, index) => (
                      <div 
                        key={stop.id} 
                        className={`p-4 rounded-lg border transition-colors ${
                          stop.status === "en_progreso" ? "border-primary bg-primary/5" : 
                          stop.status === "completada" ? "bg-muted/50" : ""
                        }`}
                        data-testid={`card-stop-${stop.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              stop.status === "completada" ? "bg-emerald-500 text-white" :
                              stop.status === "en_progreso" ? "bg-primary text-white" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {stop.status === "completada" ? <CheckCircle2 className="h-4 w-4" /> : stop.order}
                            </div>
                            <div>
                              <h4 className="font-medium">{stop.machine?.name || "Máquina"}</h4>
                              <p className="text-sm text-muted-foreground">
                                {stop.machine?.location?.name || stop.machine?.code || ""}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {stop.estimatedArrival ? format(new Date(stop.estimatedArrival), "HH:mm") : "--:--"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(stop.status)}
                            {stop.status === "pendiente" && todayRoute.status === "en_progreso" && (
                              <Button 
                                size="sm" 
                                onClick={() => handleStartService(stop)}
                                disabled={startServiceMutation.isPending}
                                data-testid={`button-start-service-${stop.id}`}
                              >
                                {startServiceMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Play className="h-4 w-4 mr-1" />
                                    Iniciar
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-base">Estado de la Ruta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span className="font-medium">{Math.round((completedStops / totalStops) * 100) || 0}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all" 
                        style={{ width: `${(completedStops / totalStops) * 100 || 0}%` }}
                      />
                    </div>
                  </div>
                  {todayRoute && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estado:</span>
                        <span>{getStatusBadge(todayRoute.status)}</span>
                      </div>
                      {todayRoute.startTime && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Inicio:</span>
                          <span>{format(new Date(todayRoute.startTime), "HH:mm")}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="servicio" className="mt-6">
          {isServiceActive && currentStop && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ServiceTimer
                  machineName={currentStop.machine?.name || "Máquina"}
                  onStart={() => {}}
                  onPause={() => {}}
                  onStop={handleStopService}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Productos en Máquina</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {machineInventory && Array.isArray(machineInventory) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(machineInventory as any[]).map((item: any) => (
                          <ProductCard
                            key={item.id}
                            id={item.productId}
                            name={item.product?.name || "Producto"}
                            quantity={item.currentQuantity || 0}
                            maxQuantity={item.maxCapacity || 20}
                            price={parseFloat(item.product?.salePrice || "0")}
                            isLowStock={(item.currentQuantity || 0) <= (item.minLevel || 5)}
                            onClick={() => {}}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Sin inventario registrado</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Acciones de Servicio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      className="w-full justify-start gap-2" 
                      variant="outline"
                      onClick={() => setIsLoadDialogOpen(true)}
                      data-testid="button-load-products"
                    >
                      <Package className="h-4 w-4" />
                      Cargar Productos
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => setIsCashDialogOpen(true)}
                      data-testid="button-collect-cash"
                    >
                      <DollarSign className="h-4 w-4" />
                      Recolectar Efectivo
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => setIsReportDialogOpen(true)}
                      data-testid="button-report-issue"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Reportar Problema
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventario" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventario del Vehículo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Funcionalidad de inventario del vehículo disponible próximamente
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar Problema</DialogTitle>
            <DialogDescription>
              Describe el problema encontrado en la máquina
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de problema</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger data-testid="select-issue-type">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mecanico">Problema mecánico</SelectItem>
                  <SelectItem value="electrico">Problema eléctrico</SelectItem>
                  <SelectItem value="refrigeracion">Falla refrigeración</SelectItem>
                  <SelectItem value="vandalismo">Vandalismo</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={issuePriority} onValueChange={setIssuePriority}>
                <SelectTrigger data-testid="select-issue-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Describe el problema con detalle..."
                className="min-h-[100px]"
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                data-testid="input-issue-description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsReportDialogOpen(false)} data-testid="button-cancel-issue">
                Cancelar
              </Button>
              <Button 
                onClick={handleReportIssue} 
                disabled={!issueDescription || createIssueReportMutation.isPending}
                data-testid="button-submit-issue"
              >
                {createIssueReportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enviar Reporte
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCashDialogOpen} onOpenChange={setIsCashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recolección de Efectivo</DialogTitle>
            <DialogDescription>
              Registra el monto recolectado de la máquina
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monto esperado (MXN) - opcional</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                data-testid="input-expected-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Monto recolectado (MXN)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                data-testid="input-actual-amount"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCashDialogOpen(false)} data-testid="button-cancel-cash">
                Cancelar
              </Button>
              <Button 
                onClick={handleCashCollection} 
                disabled={!cashAmount || createCashCollectionMutation.isPending}
                data-testid="button-submit-cash"
              >
                {createCashCollectionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
