import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDateShort, formatDate, formatTime, getDateKeyInTimezone, getTodayInTimezone } from "@/lib/utils";
import { 
  Route, MapPin, Plus, Search, Filter, Edit2, Trash2, Eye, 
  Calendar, Clock, CheckCircle2, XCircle, Play, Square, Truck,
  Users, ChevronRight, AlertTriangle, Navigation
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DataPagination } from "@/components/DataPagination";

interface RouteData {
  id: string;
  date: string;
  supplierId: string;
  supervisorId?: string;
  status: string;
  totalStops: number;
  completedStops: number;
  estimatedDuration?: number;
  actualDuration?: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
  supplierName?: string;
  supervisorName?: string;
  stops?: RouteStop[];
}

interface RouteStop {
  id: string;
  routeId: string;
  machineId: string;
  order: number;
  status: string;
  estimatedArrival?: string;
  actualArrival?: string;
  actualDeparture?: string;
  durationMinutes?: number;
  notes?: string;
  machineName?: string;
  machineCode?: string;
  machineLocation?: string;
}

interface Machine {
  id: string;
  name: string;
  code?: string;
  status: string;
  locationId?: string;
  locationName?: string;
}

interface User {
  id: string;
  username: string;
  fullName?: string;
  role: string;
  isActive: boolean;
}

const routeFormSchema = z.object({
  date: z.string().min(1, "La fecha es requerida"),
  supplierId: z.string().min(1, "Seleccione un abastecedor"),
  supervisorId: z.string().optional(),
  estimatedDuration: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type RouteFormData = z.infer<typeof routeFormSchema>;

const stopFormSchema = z.object({
  machineId: z.string().min(1, "Seleccione una máquina"),
  estimatedArrival: z.string().optional(),
  notes: z.string().optional(),
});

type StopFormData = z.infer<typeof stopFormSchema>;

const ITEMS_PER_PAGE = 20;

export default function RoutesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  
  const [isNewRouteOpen, setIsNewRouteOpen] = useState(false);
  const [isEditRouteOpen, setIsEditRouteOpen] = useState(false);
  const [isRouteDetailOpen, setIsRouteDetailOpen] = useState(false);
  const [isAddStopOpen, setIsAddStopOpen] = useState(false);
  const [isDeleteRouteOpen, setIsDeleteRouteOpen] = useState(false);
  const [isDeleteStopOpen, setIsDeleteStopOpen] = useState(false);
  const [isCancelRouteOpen, setIsCancelRouteOpen] = useState(false);
  const [isCompleteRouteOpen, setIsCompleteRouteOpen] = useState(false);
  
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<RouteData | null>(null);
  const [stopToDelete, setStopToDelete] = useState<RouteStop | null>(null);
  const [pendingStops, setPendingStops] = useState<{machineId: string, order: number, notes?: string}[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);

  const routeForm = useForm<RouteFormData>({
    resolver: zodResolver(routeFormSchema),
    defaultValues: {
      date: getDateKeyInTimezone(getTodayInTimezone()),
      supplierId: "",
      supervisorId: "",
      estimatedDuration: 480,
      notes: "",
    },
  });

  const stopForm = useForm<StopFormData>({
    resolver: zodResolver(stopFormSchema),
    defaultValues: {
      machineId: "",
      estimatedArrival: "",
      notes: "",
    },
  });

  const { data: routes = [], isLoading: routesLoading } = useQuery<RouteData[]>({
    queryKey: ["/api/supplier/routes"],
  });

  const { data: routeStops = [], isLoading: stopsLoading } = useQuery<RouteStop[]>({
    queryKey: ["/api/supplier/routes", selectedRoute?.id, "stops"],
    enabled: !!selectedRoute?.id && isRouteDetailOpen,
  });

  const { data: abastecedores = [] } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "abastecedor" }],
  });

  const { data: supervisores = [] } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "supervisor" }],
  });

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });

  const filteredRoutes = useMemo(() => {
    let filtered = routes;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.supplierName?.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term)
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    if (dateFilter) {
      filtered = filtered.filter(r => {
        const routeDate = getDateKeyInTimezone(r.date);
        return routeDate === dateFilter;
      });
    }
    
    if (supplierFilter !== "all") {
      filtered = filtered.filter(r => r.supplierId === supplierFilter);
    }
    
    if (activeTab === "today") {
      const today = getDateKeyInTimezone(getTodayInTimezone());
      filtered = filtered.filter(r => {
        const routeDate = getDateKeyInTimezone(r.date);
        return routeDate === today;
      });
    } else if (activeTab === "pending") {
      filtered = filtered.filter(r => r.status === "pendiente");
    } else if (activeTab === "active") {
      filtered = filtered.filter(r => r.status === "en_progreso");
    } else if (activeTab === "completed") {
      filtered = filtered.filter(r => r.status === "completada");
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [routes, searchTerm, statusFilter, dateFilter, supplierFilter, activeTab]);

  const paginatedRoutes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRoutes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRoutes, currentPage]);

  const totalPages = Math.ceil(filteredRoutes.length / ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    const today = getDateKeyInTimezone(getTodayInTimezone());
    const todayRoutes = routes.filter(r => {
      const routeDate = getDateKeyInTimezone(r.date);
      return routeDate === today;
    });
    
    return {
      total: routes.length,
      today: todayRoutes.length,
      pending: routes.filter(r => r.status === "pendiente").length,
      active: routes.filter(r => r.status === "en_progreso").length,
      completed: routes.filter(r => r.status === "completada").length,
      todayProgress: todayRoutes.length > 0 
        ? Math.round((todayRoutes.filter(r => r.status === "completada").length / todayRoutes.length) * 100)
        : 0,
    };
  }, [routes]);

  const createRouteMutation = useMutation({
    mutationFn: async (data: RouteFormData & { stops: typeof pendingStops }) => {
      const routeData = {
        date: new Date(data.date).toISOString(),
        supplierId: data.supplierId,
        supervisorId: data.supervisorId === "none" ? undefined : data.supervisorId || undefined,
        estimatedDuration: data.estimatedDuration,
        notes: data.notes,
        totalStops: data.stops.length,
        status: "pendiente",
      };
      
      const response = await apiRequest("POST", "/api/supplier/routes", routeData);
      const newRoute = await response.json();
      
      for (const stop of data.stops) {
        await apiRequest("POST", `/api/supplier/routes/${newRoute.id}/stops`, {
          machineId: stop.machineId,
          order: stop.order,
          notes: stop.notes,
          status: "pendiente",
        });
      }
      
      return newRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Ruta creada", description: "La ruta se ha creado correctamente" });
      setIsNewRouteOpen(false);
      routeForm.reset();
      setPendingStops([]);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la ruta", variant: "destructive" });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RouteFormData> }) => {
      return apiRequest("PATCH", `/api/supplier/routes/${id}`, {
        ...data,
        date: data.date ? new Date(data.date).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Ruta actualizada", description: "La ruta se ha actualizado correctamente" });
      setIsEditRouteOpen(false);
      setSelectedRoute(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la ruta", variant: "destructive" });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/supplier/routes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Ruta eliminada", description: "La ruta se ha eliminado correctamente" });
      setIsDeleteRouteOpen(false);
      setRouteToDelete(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la ruta", variant: "destructive" });
    },
  });

  const addStopMutation = useMutation({
    mutationFn: async ({ routeId, data }: { routeId: string; data: StopFormData & { order: number } }) => {
      return apiRequest("POST", `/api/supplier/routes/${routeId}/stops`, {
        ...data,
        status: "pendiente",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes", selectedRoute?.id, "stops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Parada agregada", description: "La parada se ha agregado a la ruta" });
      setIsAddStopOpen(false);
      stopForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo agregar la parada", variant: "destructive" });
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      return apiRequest("DELETE", `/api/supplier/stops/${stopId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes", selectedRoute?.id, "stops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Parada eliminada", description: "La parada se ha eliminado de la ruta" });
      setIsDeleteStopOpen(false);
      setStopToDelete(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la parada", variant: "destructive" });
    },
  });

  const cancelRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/supplier/routes/${id}`, { status: "cancelada" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Ruta cancelada", description: "La ruta ha sido cancelada" });
      setIsCancelRouteOpen(false);
      setSelectedRoute(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo cancelar la ruta", variant: "destructive" });
    },
  });

  const completeRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/supplier/routes/${id}`, { 
        status: "completada",
        endTime: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Ruta completada", description: "La ruta ha sido marcada como completada" });
      setIsCompleteRouteOpen(false);
      setSelectedRoute(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo completar la ruta", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completada":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Completada</Badge>;
      case "en_progreso":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">En Progreso</Badge>;
      case "pendiente":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pendiente</Badge>;
      case "cancelada":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCreateRoute = (data: RouteFormData) => {
    if (pendingStops.length === 0) {
      toast({ 
        title: "Sin paradas", 
        description: "Agregue al menos una parada a la ruta", 
        variant: "destructive" 
      });
      return;
    }
    createRouteMutation.mutate({ ...data, stops: pendingStops });
  };

  const handleEditRoute = (route: RouteData) => {
    setSelectedRoute(route);
    routeForm.reset({
      date: getDateKeyInTimezone(route.date),
      supplierId: route.supplierId,
      supervisorId: route.supervisorId || "",
      estimatedDuration: route.estimatedDuration || 480,
      notes: route.notes || "",
    });
    setIsEditRouteOpen(true);
  };

  const handleAddPendingStop = (machineId: string, notes?: string) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;
    
    const alreadyAdded = pendingStops.some(s => s.machineId === machineId);
    if (alreadyAdded) {
      toast({ title: "Ya agregada", description: "Esta máquina ya está en la ruta", variant: "destructive" });
      return;
    }
    
    setPendingStops(prev => [
      ...prev,
      { machineId, order: prev.length + 1, notes }
    ]);
    stopForm.reset();
  };

  const handleRemovePendingStop = (machineId: string) => {
    setPendingStops(prev => {
      const filtered = prev.filter(s => s.machineId !== machineId);
      return filtered.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const handleViewDetail = (route: RouteData) => {
    setSelectedRoute(route);
    setIsRouteDetailOpen(true);
  };

  const handleAddStop = (data: StopFormData) => {
    if (!selectedRoute) return;
    const order = (routeStops?.length || 0) + 1;
    addStopMutation.mutate({ routeId: selectedRoute.id, data: { ...data, order } });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-4" data-testid="routes-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Gestión de Rutas</h1>
          <p className="text-muted-foreground">Planifica y administra las rutas de abastecimiento</p>
        </div>
        <Button onClick={() => setIsNewRouteOpen(true)} className="gap-2" data-testid="button-new-route">
          <Plus className="h-4 w-4" />
          Nueva Ruta
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card data-testid="stat-total-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rutas</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-today-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rutas Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <Progress value={stats.todayProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card data-testid="stat-pending-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-completed-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar rutas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-routes"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-40"
            data-testid="input-filter-date"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="en_progreso">En Progreso</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-supplier">
              <SelectValue placeholder="Abastecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {abastecedores.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName || user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">Todas</TabsTrigger>
          <TabsTrigger value="today" data-testid="tab-today">Hoy</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">Pendientes</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">Activas</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completadas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Rutas ({filteredRoutes.length})</CardTitle>
              <CardDescription>
                {activeTab === "today" && "Rutas programadas para hoy"}
                {activeTab === "pending" && "Rutas pendientes de iniciar"}
                {activeTab === "active" && "Rutas actualmente en progreso"}
                {activeTab === "completed" && "Rutas completadas"}
                {activeTab === "all" && "Todas las rutas del sistema"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {routesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : paginatedRoutes.length === 0 ? (
                <div className="text-center py-12">
                  <Route className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Sin rutas</h3>
                  <p className="text-muted-foreground mb-4">
                    {activeTab === "today" 
                      ? "No hay rutas programadas para hoy" 
                      : "No se encontraron rutas con los filtros seleccionados"}
                  </p>
                  <Button onClick={() => setIsNewRouteOpen(true)} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Crear Primera Ruta
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Abastecedor</TableHead>
                        <TableHead>Paradas</TableHead>
                        <TableHead>Progreso</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRoutes.map((route) => {
                        const supplier = abastecedores.find(u => u.id === route.supplierId);
                        const progress = route.totalStops > 0 
                          ? Math.round((route.completedStops / route.totalStops) * 100)
                          : 0;
                        
                        return (
                          <TableRow key={route.id} data-testid={`row-route-${route.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{formatDateShort(new Date(route.date))}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span>{supplier?.fullName || route.supplierName || route.supplierId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>{route.completedStops}/{route.totalStops}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <Progress value={progress} className="h-2 flex-1" />
                                <span className="text-sm text-muted-foreground w-10">{progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(route.status)}</TableCell>
                            <TableCell>
                              {route.actualDuration ? (
                                <span>{route.actualDuration} min</span>
                              ) : route.estimatedDuration ? (
                                <span className="text-muted-foreground">~{route.estimatedDuration} min</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDetail(route)}
                                  data-testid={`button-view-route-${route.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {route.status === "pendiente" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditRoute(route)}
                                      data-testid={`button-edit-route-${route.id}`}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedRoute(route);
                                        setIsCancelRouteOpen(true);
                                      }}
                                      data-testid={`button-cancel-route-${route.id}`}
                                      title="Cancelar ruta"
                                    >
                                      <XCircle className="h-4 w-4 text-orange-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setRouteToDelete(route);
                                        setIsDeleteRouteOpen(true);
                                      }}
                                      data-testid={`button-delete-route-${route.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                                {route.status === "en_progreso" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedRoute(route);
                                        setIsCompleteRouteOpen(true);
                                      }}
                                      data-testid={`button-complete-route-${route.id}`}
                                      title="Completar ruta"
                                    >
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedRoute(route);
                                        setIsCancelRouteOpen(true);
                                      }}
                                      data-testid={`button-cancel-active-route-${route.id}`}
                                      title="Cancelar ruta"
                                    >
                                      <XCircle className="h-4 w-4 text-orange-500" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  {filteredRoutes.length > ITEMS_PER_PAGE && (
                    <div className="mt-4">
                      <DataPagination
                        currentPage={currentPage}
                        totalItems={filteredRoutes.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isNewRouteOpen} onOpenChange={setIsNewRouteOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Ruta</DialogTitle>
            <DialogDescription>
              Crea una nueva ruta de abastecimiento asignando fecha, abastecedor y paradas
            </DialogDescription>
          </DialogHeader>
          
          <Form {...routeForm}>
            <form onSubmit={routeForm.handleSubmit(handleCreateRoute)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={routeForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-route-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={routeForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abastecedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-route-supplier">
                            <SelectValue placeholder="Seleccionar abastecedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {abastecedores.filter(u => u.isActive).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={routeForm.control}
                  name="supervisorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supervisor (opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-route-supervisor">
                            <SelectValue placeholder="Seleccionar supervisor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {supervisores.filter(u => u.isActive).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={routeForm.control}
                  name="estimatedDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duración estimada (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-route-duration" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={routeForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Instrucciones especiales..." data-testid="input-route-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-4">Paradas de la Ruta ({pendingStops.length})</h4>
                
                <div className="flex gap-2 mb-4">
                  <Select onValueChange={(v) => handleAddPendingStop(v)}>
                    <SelectTrigger className="flex-1" data-testid="select-add-stop">
                      <SelectValue placeholder="Agregar máquina a la ruta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {machines
                        .filter(m => m.status !== "fuera_servicio")
                        .filter(m => !pendingStops.some(s => s.machineId === m.id))
                        .map((machine) => (
                          <SelectItem key={machine.id} value={machine.id}>
                            {machine.code || machine.id} - {machine.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {pendingStops.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {pendingStops.map((stop, index) => {
                      const machine = machines.find(m => m.id === stop.machineId);
                      return (
                        <div key={stop.machineId} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium">{machine?.name || stop.machineId}</p>
                              <p className="text-sm text-muted-foreground">{machine?.code}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePendingStop(stop.machineId)}
                            data-testid={`button-remove-stop-${stop.machineId}`}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-lg border-dashed">
                    <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Agrega máquinas para crear las paradas de la ruta</p>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsNewRouteOpen(false);
                  setPendingStops([]);
                  routeForm.reset();
                }}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createRouteMutation.isPending || pendingStops.length === 0}
                  data-testid="button-save-route"
                >
                  {createRouteMutation.isPending ? "Guardando..." : "Crear Ruta"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditRouteOpen} onOpenChange={setIsEditRouteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ruta</DialogTitle>
            <DialogDescription>
              Modifica los datos de la ruta
            </DialogDescription>
          </DialogHeader>
          
          <Form {...routeForm}>
            <form onSubmit={routeForm.handleSubmit((data) => {
              if (selectedRoute) {
                updateRouteMutation.mutate({ id: selectedRoute.id, data });
              }
            })} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={routeForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={routeForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abastecedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {abastecedores.filter(u => u.isActive).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={routeForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditRouteOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateRouteMutation.isPending}>
                  {updateRouteMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isRouteDetailOpen} onOpenChange={setIsRouteDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Detalle de Ruta
            </DialogTitle>
            <DialogDescription>
              {selectedRoute && formatDate(new Date(selectedRoute.date))}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRoute && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Abastecedor</p>
                  <p className="font-medium">
                    {abastecedores.find(u => u.id === selectedRoute.supplierId)?.fullName || selectedRoute.supplierId}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Estado</p>
                  {getStatusBadge(selectedRoute.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Progreso</p>
                  <p className="font-medium">{selectedRoute.completedStops}/{selectedRoute.totalStops} paradas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Duración</p>
                  <p className="font-medium">
                    {selectedRoute.actualDuration 
                      ? `${selectedRoute.actualDuration} min`
                      : `~${selectedRoute.estimatedDuration || 0} min (estimado)`}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Paradas ({routeStops.length})</h4>
                  {selectedRoute.status === "pendiente" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1"
                      onClick={() => setIsAddStopOpen(true)}
                      data-testid="button-add-stop"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                  )}
                </div>
                
                {stopsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : routeStops.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Sin paradas registradas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routeStops.sort((a, b) => a.order - b.order).map((stop) => {
                      const machine = machines.find(m => m.id === stop.machineId);
                      return (
                        <div 
                          key={stop.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            stop.status === "completada" ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" :
                            stop.status === "en_progreso" ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" :
                            "bg-muted/50"
                          }`}
                          data-testid={`stop-${stop.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
                              stop.status === "completada" ? "bg-green-500 text-white" :
                              stop.status === "en_progreso" ? "bg-blue-500 text-white" :
                              "bg-muted-foreground/20 text-muted-foreground"
                            }`}>
                              {stop.order}
                            </span>
                            <div>
                              <p className="font-medium">{machine?.name || stop.machineId}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{machine?.code}</span>
                                {stop.actualArrival && (
                                  <span>• Llegada: {formatTime(new Date(stop.actualArrival))}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(stop.status)}
                            {selectedRoute.status === "pendiente" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setStopToDelete(stop);
                                  setIsDeleteStopOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStopOpen} onOpenChange={setIsAddStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Parada</DialogTitle>
            <DialogDescription>
              Selecciona una máquina para agregar a la ruta
            </DialogDescription>
          </DialogHeader>
          
          <Form {...stopForm}>
            <form onSubmit={stopForm.handleSubmit(handleAddStop)} className="space-y-4">
              <FormField
                control={stopForm.control}
                name="machineId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máquina</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar máquina" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {machines
                          .filter(m => m.status !== "fuera_servicio")
                          .filter(m => !routeStops.some(s => s.machineId === m.id))
                          .map((machine) => (
                            <SelectItem key={machine.id} value={machine.id}>
                              {machine.code || machine.id} - {machine.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={stopForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Instrucciones especiales..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddStopOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addStopMutation.isPending}>
                  {addStopMutation.isPending ? "Agregando..." : "Agregar Parada"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteRouteOpen} onOpenChange={setIsDeleteRouteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la ruta y todas sus paradas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => routeToDelete && deleteRouteMutation.mutate(routeToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRouteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteStopOpen} onOpenChange={setIsDeleteStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar parada?</AlertDialogTitle>
            <AlertDialogDescription>
              La parada será eliminada de la ruta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => stopToDelete && deleteStopMutation.mutate(stopToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStopMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCancelRouteOpen} onOpenChange={setIsCancelRouteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              La ruta será marcada como cancelada y no podrá ser ejecutada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRoute && cancelRouteMutation.mutate(selectedRoute.id)}
              className="bg-orange-500 text-white hover:bg-orange-600"
              data-testid="button-confirm-cancel-route"
            >
              {cancelRouteMutation.isPending ? "Cancelando..." : "Cancelar Ruta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCompleteRouteOpen} onOpenChange={setIsCompleteRouteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Completar ruta manualmente?</AlertDialogTitle>
            <AlertDialogDescription>
              La ruta será marcada como completada. Use esta opción solo si la ruta fue ejecutada pero no se registró correctamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRoute && completeRouteMutation.mutate(selectedRoute.id)}
              className="bg-green-500 text-white hover:bg-green-600"
              data-testid="button-confirm-complete-route"
            >
              {completeRouteMutation.isPending ? "Completando..." : "Completar Ruta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
