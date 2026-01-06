import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatTime,
  formatCurrency,
  isTodayInTimezone,
  getDateKeyInTimezone,
  getTodayInTimezone,
} from "@/lib/utils";
import {
  Truck,
  MapPin,
  Clock,
  Package,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  Users,
  Navigation,
  Activity,
  Timer,
  Target,
  Award,
  Search,
  Filter,
  Eye,
  ChevronRight,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import { Link } from "wouter";

interface Supplier {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
}

interface Route {
  id: string;
  date: string;
  status: string;
  supplierId: string;
  totalStops: number;
  completedStops: number;
  estimatedDurationMinutes?: number;
  actualDurationMinutes?: number;
  notes?: string;
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
}

interface SupplierWithRoute extends Supplier {
  todayRoute?: Route;
  todayStops?: RouteStop[];
  stats?: {
    machinesAttended: number;
    totalMachines: number;
    cashCollected: number;
    productsLoaded: number;
    avgServiceTime: number;
  };
}

export function SuppliersManagementPage() {
  const [activeTab, setActiveTab] = useState("activos");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodFilter, setPeriodFilter] = useState("hoy");

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/users", "abastecedor"],
    queryFn: async () => {
      const res = await fetch("/api/users?role=abastecedor");
      if (!res.ok) throw new Error("Error fetching suppliers");
      return res.json();
    },
  });

  const { data: routes = [], isLoading: loadingRoutes } = useQuery<Route[]>({
    queryKey: ["/api/supplier/routes"],
  });

  const { data: routeStopsMap = {}, isLoading: loadingStops } = useQuery<Record<string, RouteStop[]>>({
    queryKey: ["/api/supplier/route-stops-map", routes.map(r => r.id).join(",")],
    queryFn: async () => {
      const map: Record<string, RouteStop[]> = {};
      const results = await Promise.allSettled(
        routes.map(async (route) => {
          const res = await fetch(`/api/supplier/routes/${route.id}/stops`);
          if (res.ok) {
            const stops = await res.json();
            return { routeId: route.id, stops };
          }
          return { routeId: route.id, stops: [] };
        })
      );
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          map[result.value.routeId] = result.value.stops;
        }
      });
      return map;
    },
    enabled: routes.length > 0,
  });

  const { data: cashCollections = [], isLoading: loadingCash } = useQuery<any[]>({
    queryKey: ["/api/supplier/cash"],
  });

  const { data: productLoads = [], isLoading: loadingLoads } = useQuery<any[]>({
    queryKey: ["/api/supplier/loads"],
  });

  const suppliersWithRoutes = useMemo((): SupplierWithRoute[] => {
    const todayKey = getDateKeyInTimezone(new Date());
    
    return suppliers
      .filter(s => s.role === "abastecedor")
      .map(supplier => {
        const todayRoute = routes.find(r => {
          const routeKey = getDateKeyInTimezone(new Date(r.date));
          return r.supplierId === supplier.id && routeKey === todayKey;
        });

        const todayStops: RouteStop[] = todayRoute
          ? (routeStopsMap[todayRoute.id] || [])
          : [];

        const completedStops = todayStops.filter((s: RouteStop) => s.status === "completada");

        const supplierCash = cashCollections.filter(c => {
          const collectionDate = new Date(c.collectedAt || c.createdAt);
          return c.userId === supplier.id && isTodayInTimezone(collectionDate);
        });

        const supplierLoads = productLoads.filter(p => {
          const loadDate = new Date(p.loadedAt || p.createdAt);
          return p.userId === supplier.id && isTodayInTimezone(loadDate);
        });

        const avgTime = completedStops.length > 0
          ? completedStops.reduce((acc: number, stop: RouteStop) => {
              if (stop.actualArrival && stop.actualDeparture) {
                const arrival = new Date(stop.actualArrival);
                const departure = new Date(stop.actualDeparture);
                return acc + (departure.getTime() - arrival.getTime()) / 60000;
              }
              return acc;
            }, 0) / completedStops.length
          : 0;

        return {
          ...supplier,
          todayRoute,
          todayStops,
          stats: {
            machinesAttended: completedStops.length,
            totalMachines: todayStops.length,
            cashCollected: supplierCash.reduce((acc, c) => acc + (c.amount || 0), 0),
            productsLoaded: supplierLoads.reduce((acc, l) => acc + (l.quantity || 0), 0),
            avgServiceTime: Math.round(avgTime),
          },
        };
      });
  }, [suppliers, routes, routeStopsMap, cashCollections, productLoads]);

  const activeSuppliers = suppliersWithRoutes.filter(s => 
    s.todayRoute?.status === "en_progreso"
  );

  const pendingSuppliers = suppliersWithRoutes.filter(s => 
    s.todayRoute?.status === "pendiente"
  );

  const completedSuppliers = suppliersWithRoutes.filter(s => 
    s.todayRoute?.status === "completada"
  );

  const noRouteSuppliers = suppliersWithRoutes.filter(s => !s.todayRoute);

  const filteredSuppliers = useMemo(() => {
    let filtered = suppliersWithRoutes;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.fullName.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "todos") {
      filtered = filtered.filter(s => {
        if (statusFilter === "en_progreso") return s.todayRoute?.status === "en_progreso";
        if (statusFilter === "pendiente") return s.todayRoute?.status === "pendiente";
        if (statusFilter === "completada") return s.todayRoute?.status === "completada";
        if (statusFilter === "sin_ruta") return !s.todayRoute;
        return true;
      });
    }

    return filtered;
  }, [suppliersWithRoutes, searchQuery, statusFilter]);

  const totalStats = useMemo(() => {
    return {
      totalSuppliers: suppliersWithRoutes.length,
      activeNow: activeSuppliers.length,
      completedToday: completedSuppliers.length,
      pendingToday: pendingSuppliers.length,
      totalCashCollected: suppliersWithRoutes.reduce((acc, s) => acc + (s.stats?.cashCollected || 0), 0),
      totalMachinesAttended: suppliersWithRoutes.reduce((acc, s) => acc + (s.stats?.machinesAttended || 0), 0),
      totalMachinesPlanned: suppliersWithRoutes.reduce((acc, s) => acc + (s.stats?.totalMachines || 0), 0),
    };
  }, [suppliersWithRoutes, activeSuppliers, completedSuppliers, pendingSuppliers]);

  const isLoading = loadingSuppliers || loadingRoutes;
  const isLoadingDetails = loadingStops || loadingCash || loadingLoads;

  const getDateRangeForPeriod = (period: string): { start: Date; end: Date } => {
    const now = new Date();
    const today = getTodayInTimezone();
    
    if (period === "semana") {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start, end: now };
    }
    if (period === "mes") {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { start, end: now };
    }
    return { start: today, end: now };
  };

  const filteredRoutesByPeriod = useMemo(() => {
    const { start, end } = getDateRangeForPeriod(periodFilter);
    return routes.filter(r => {
      const routeDate = new Date(r.date);
      return routeDate >= start && routeDate <= end;
    });
  }, [routes, periodFilter]);

  const getStatusBadge = (supplier: SupplierWithRoute) => {
    if (!supplier.todayRoute) {
      return <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800">Sin ruta</Badge>;
    }
    const status = supplier.todayRoute.status;
    if (status === "en_progreso") {
      return <Badge className="bg-green-500 hover:bg-green-600">En ruta</Badge>;
    }
    if (status === "pendiente") {
      return <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pendiente</Badge>;
    }
    if (status === "completada") {
      return <Badge className="bg-blue-500 hover:bg-blue-600">Completada</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Gestión de Abastecedores
          </h1>
          <p className="text-muted-foreground">
            Monitorea y administra a todos los abastecedores en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Activity className="w-3 h-3 mr-1" />
            {activeSuppliers.length} activos ahora
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Abastecedores</p>
                <p className="text-2xl font-bold" data-testid="text-total-suppliers">
                  {totalStats.totalSuppliers}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Ruta Ahora</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-active-now">
                  {totalStats.activeNow}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Navigation className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Máquinas Atendidas</p>
                <p className="text-2xl font-bold" data-testid="text-machines-attended">
                  {totalStats.totalMachinesAttended}/{totalStats.totalMachinesPlanned}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <Progress 
              value={totalStats.totalMachinesPlanned > 0 
                ? (totalStats.totalMachinesAttended / totalStats.totalMachinesPlanned) * 100 
                : 0
              } 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Efectivo Recolectado</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-cash-collected">
                  {formatCurrency(totalStats.totalCashCollected)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="activos" data-testid="tab-activos">
              <Activity className="w-4 h-4 mr-2" />
              En Tiempo Real
            </TabsTrigger>
            <TabsTrigger value="lista" data-testid="tab-lista">
              <Users className="w-4 h-4 mr-2" />
              Lista Completa
            </TabsTrigger>
            <TabsTrigger value="rendimiento" data-testid="tab-rendimiento">
              <BarChart3 className="w-4 h-4 mr-2" />
              Rendimiento
            </TabsTrigger>
            <TabsTrigger value="historial" data-testid="tab-historial">
              <CalendarDays className="w-4 h-4 mr-2" />
              Historial
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar abastecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="en_progreso">En ruta</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="completada">Completados</SelectItem>
                <SelectItem value="sin_ruta">Sin ruta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="activos" className="space-y-4">
          {activeSuppliers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Navigation className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hay abastecedores en ruta</h3>
                <p className="text-muted-foreground">
                  Ningún abastecedor ha iniciado su ruta del día
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSuppliers.map((supplier) => {
                const progress = supplier.stats?.totalMachines 
                  ? (supplier.stats.machinesAttended / supplier.stats.totalMachines) * 100 
                  : 0;
                
                return (
                  <Card key={supplier.id} className="hover-elevate">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-green-500 text-white">
                              {supplier.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">{supplier.fullName}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {supplier.todayRoute?.notes || "Ruta del día"}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(supplier)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progreso</span>
                          <span className="font-medium">
                            {supplier.stats?.machinesAttended}/{supplier.stats?.totalMachines} máquinas
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{supplier.stats?.avgServiceTime || 0} min/máq</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span>{formatCurrency(supplier.stats?.cashCollected || 0)}</span>
                        </div>
                      </div>

                      <Link href={`/abastecedor?id=${supplier.id}`}>
                        <Button variant="outline" className="w-full" data-testid={`button-view-${supplier.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalles
                          <ChevronRight className="w-4 h-4 ml-auto" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {pendingSuppliers.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Pendientes de iniciar ({pendingSuppliers.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {pendingSuppliers.map((supplier) => (
                  <Card key={supplier.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-amber-500 text-white text-xs">
                            {supplier.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{supplier.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {supplier.stats?.totalMachines} paradas
                          </p>
                        </div>
                        {getStatusBadge(supplier)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lista" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Abastecedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Progreso Hoy</TableHead>
                    <TableHead>Tiempo Prom.</TableHead>
                    <TableHead>Efectivo</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => {
                    const progress = supplier.stats?.totalMachines 
                      ? (supplier.stats.machinesAttended / supplier.stats.totalMachines) * 100 
                      : 0;
                    
                    return (
                      <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                {supplier.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{supplier.fullName}</p>
                              <p className="text-sm text-muted-foreground">{supplier.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(supplier)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className="h-2 w-20" />
                              <span className="text-sm">
                                {supplier.stats?.machinesAttended}/{supplier.stats?.totalMachines}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Timer className="w-4 h-4 text-muted-foreground" />
                            {supplier.stats?.avgServiceTime || 0} min
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">
                            {formatCurrency(supplier.stats?.cashCollected || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {supplier.stats?.productsLoaded || 0} uds
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/abastecedor?id=${supplier.id}`}>
                            <Button size="sm" variant="ghost" data-testid={`button-details-${supplier.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rendimiento" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Mejores del Día
                </CardTitle>
                <CardDescription>Abastecedores con mejor rendimiento hoy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {suppliersWithRoutes
                    .filter(s => s.stats && s.stats.machinesAttended > 0)
                    .sort((a, b) => (b.stats?.machinesAttended || 0) - (a.stats?.machinesAttended || 0))
                    .slice(0, 5)
                    .map((supplier, index) => (
                      <div key={supplier.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? "bg-amber-500 text-white" :
                            index === 1 ? "bg-gray-400 text-white" :
                            index === 2 ? "bg-amber-700 text-white" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {index + 1}
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {supplier.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{supplier.fullName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {supplier.stats?.machinesAttended} máquinas
                          </span>
                          <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30">
                            {formatCurrency(supplier.stats?.cashCollected || 0)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Eficiencia de Tiempo
                </CardTitle>
                <CardDescription>Tiempo promedio por máquina atendida</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {suppliersWithRoutes
                    .filter(s => s.stats && s.stats.avgServiceTime > 0)
                    .sort((a, b) => (a.stats?.avgServiceTime || 999) - (b.stats?.avgServiceTime || 999))
                    .slice(0, 5)
                    .map((supplier, index) => (
                      <div key={supplier.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? "bg-green-500 text-white" :
                            index === 1 ? "bg-green-400 text-white" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {index + 1}
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {supplier.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{supplier.fullName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{supplier.stats?.avgServiceTime} min/máq</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumen de Rendimiento del Equipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{totalStats.totalMachinesAttended}</p>
                  <p className="text-sm text-muted-foreground">Máquinas Atendidas</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(totalStats.totalCashCollected)}</p>
                  <p className="text-sm text-muted-foreground">Efectivo Total</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">
                    {totalStats.totalMachinesPlanned > 0 
                      ? Math.round((totalStats.totalMachinesAttended / totalStats.totalMachinesPlanned) * 100) 
                      : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Progreso General</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-600">{totalStats.completedToday}</p>
                  <p className="text-sm text-muted-foreground">Rutas Completadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Historial de Rutas</CardTitle>
                  <CardDescription>Registro de rutas completadas por abastecedor</CardDescription>
                </div>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoy">Hoy</SelectItem>
                    <SelectItem value="semana">Esta semana</SelectItem>
                    <SelectItem value="mes">Este mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Abastecedor</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Paradas</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes
                    .filter(r => r.status === "completada" || r.status === "en_progreso")
                    .slice(0, 20)
                    .map((route) => {
                      const supplier = suppliers.find(s => s.id === route.supplierId);
                      return (
                        <TableRow key={route.id}>
                          <TableCell>{formatDate(new Date(route.date))}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {supplier?.fullName?.split(" ").map(n => n[0]).join("").toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              {supplier?.fullName || "Desconocido"}
                            </div>
                          </TableCell>
                          <TableCell>{route.notes || `Ruta ${route.id}`}</TableCell>
                          <TableCell>
                            {route.completedStops}/{route.totalStops}
                          </TableCell>
                          <TableCell>
                            {route.actualDurationMinutes 
                              ? `${Math.floor(route.actualDurationMinutes / 60)}h ${route.actualDurationMinutes % 60}m`
                              : route.estimatedDurationMinutes
                                ? `~${Math.floor(route.estimatedDurationMinutes / 60)}h`
                                : "-"
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={route.status === "completada" ? "default" : "outline"}>
                              {route.status === "completada" ? "Completada" : "En progreso"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SuppliersManagementPage;
