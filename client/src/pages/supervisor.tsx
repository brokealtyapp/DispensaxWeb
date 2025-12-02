import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";
import {
  Route, Box, AlertTriangle, Users, CheckCircle2, Clock, 
  MapPin, TrendingUp, Truck, ArrowRight, XCircle, Activity
} from "lucide-react";

interface RouteSummary {
  activeRoutes: number;
  totalRoutes: number;
  todayStops: number;
  completedStops: number;
  pendingStops: number;
  avgServiceTimeMinutes: number;
  recentRoutes: { id: string; name: string; date: string; status: string; stopsCount: number }[];
}

interface HRSummary {
  totalEmployees: number;
  activeEmployees: number;
  weekVisits: number;
  weekTasksCompleted: number;
  topPerformers: { id: string; name: string; role: string; visitsThisWeek: number; tasksCompleted: number }[];
  byRole: { technicians: number; admins: number; supervisors: number };
}

interface MachineSummary {
  total: number;
  active: number;
  needsService: number;
  offline: number;
  lowStock: number;
}

export function SupervisorPage() {
  const { data: routesSummary, isLoading: routesLoading } = useQuery<RouteSummary>({
    queryKey: ["/api/summary/routes"],
  });

  const { data: hrSummary, isLoading: hrLoading } = useQuery<HRSummary>({
    queryKey: ["/api/summary/hr"],
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery<any[]>({
    queryKey: ["/api/machines"],
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: todayTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks/today"],
  });

  const activeAlerts = alerts.filter((a: any) => !a.isResolved);
  const criticalAlerts = activeAlerts.filter((a: any) => a.priority === "critica");

  const machineSummary: MachineSummary = {
    total: machines.length,
    active: machines.filter((m: any) => m.status === "operando").length,
    needsService: machines.filter((m: any) => m.status === "necesita_servicio").length,
    offline: machines.filter((m: any) => m.status === "fuera_de_linea").length,
    lowStock: machines.filter((m: any) => m.status === "vacia").length,
  };

  const completionRate = routesSummary?.todayStops 
    ? Math.round((routesSummary.completedStops / routesSummary.todayStops) * 100)
    : 0;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de Supervisor</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/maquinas">
            <Button variant="outline" className="gap-2" data-testid="button-view-machines">
              <Box className="h-4 w-4" />
              Máquinas
            </Button>
          </Link>
          <Link href="/abastecedor">
            <Button className="gap-2" data-testid="button-view-routes">
              <Route className="h-4 w-4" />
              Ver Rutas
            </Button>
          </Link>
        </div>
      </div>

      {criticalAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  {criticalAlerts.length} Alerta{criticalAlerts.length > 1 ? "s" : ""} Crítica{criticalAlerts.length > 1 ? "s" : ""}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {criticalAlerts[0]?.message}
                  {criticalAlerts.length > 1 && ` y ${criticalAlerts.length - 1} más...`}
                </p>
              </div>
              <Link href="/maquinas">
                <Button size="sm" variant="destructive" data-testid="button-view-critical-alerts">
                  Ver todas
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-routes-progress">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Route className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {routesSummary?.activeRoutes || 0} activas
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{completionRate}%</span>
                <span className="text-sm text-muted-foreground">completado</span>
              </div>
              <Progress value={completionRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {routesSummary?.completedStops || 0} de {routesSummary?.todayStops || 0} paradas
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-machines-status">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Box className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {Math.round((machineSummary.active / Math.max(machineSummary.total, 1)) * 100)}% operativas
              </Badge>
            </div>
            <div className="space-y-2">
              <span className="text-2xl font-bold">{machineSummary.active}/{machineSummary.total}</span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <p className="font-medium text-orange-600">{machineSummary.needsService}</p>
                  <p className="text-muted-foreground">Servicio</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-red-600">{machineSummary.offline}</p>
                  <p className="text-muted-foreground">Offline</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-yellow-600">{machineSummary.lowStock}</p>
                  <p className="text-muted-foreground">Vacías</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-alerts">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              {criticalAlerts.length > 0 && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  {criticalAlerts.length} críticas
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <span className="text-2xl font-bold">{activeAlerts.length}</span>
              <p className="text-sm text-muted-foreground">alertas activas</p>
              <div className="flex gap-1">
                {activeAlerts.slice(0, 3).map((alert: any, idx: number) => (
                  <div 
                    key={idx}
                    className={`h-2 flex-1 rounded-full ${
                      alert.priority === "critica" ? "bg-red-500" :
                      alert.priority === "alta" ? "bg-orange-500" : "bg-yellow-500"
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-technicians">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {hrSummary?.weekVisits || 0} visitas
              </Badge>
            </div>
            <div className="space-y-2">
              <span className="text-2xl font-bold">{hrSummary?.byRole?.technicians || 0}</span>
              <p className="text-sm text-muted-foreground">técnicos activos</p>
              <p className="text-xs text-muted-foreground">
                {hrSummary?.weekTasksCompleted || 0} tareas completadas esta semana
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Rutas del Día</CardTitle>
              <CardDescription>Estado de las rutas activas</CardDescription>
            </div>
            <Link href="/abastecedor">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="link-all-routes">
                Ver todas <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {routesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : routesSummary?.recentRoutes && routesSummary.recentRoutes.length > 0 ? (
              <div className="space-y-3">
                {routesSummary.recentRoutes.map((route) => (
                  <div 
                    key={route.id} 
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      route.status === "completada" ? "bg-green-100 dark:bg-green-900/30" :
                      route.status === "en_progreso" ? "bg-blue-100 dark:bg-blue-900/30" :
                      "bg-gray-100 dark:bg-gray-800"
                    }`}>
                      {route.status === "completada" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : route.status === "en_progreso" ? (
                        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{route.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {route.stopsCount} paradas
                      </p>
                    </div>
                    <Badge variant={
                      route.status === "completada" ? "default" :
                      route.status === "en_progreso" ? "secondary" : "outline"
                    }>
                      {route.status === "completada" ? "Completada" :
                       route.status === "en_progreso" ? "En progreso" : "Pendiente"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Route className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay rutas programadas para hoy</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Técnicos
            </CardTitle>
            <CardDescription>Rendimiento esta semana</CardDescription>
          </CardHeader>
          <CardContent>
            {hrLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : hrSummary?.topPerformers && hrSummary.topPerformers.length > 0 ? (
              <div className="space-y-3">
                {hrSummary.topPerformers.slice(0, 5).map((tech, idx) => (
                  <div key={tech.id} className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={`${
                          idx === 0 ? "bg-yellow-100 text-yellow-700" :
                          idx === 1 ? "bg-gray-100 text-gray-700" :
                          idx === 2 ? "bg-amber-100 text-amber-700" :
                          "bg-muted"
                        }`}>
                          {getInitials(tech.name)}
                        </AvatarFallback>
                      </Avatar>
                      {idx < 3 && (
                        <div className={`absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx === 0 ? "bg-yellow-400 text-yellow-900" :
                          idx === 1 ? "bg-gray-300 text-gray-700" :
                          "bg-amber-400 text-amber-900"
                        }`}>
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">{tech.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{tech.visitsThisWeek}</p>
                      <p className="text-xs text-muted-foreground">visitas</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay datos de rendimiento</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlerts.length > 0 ? (
              <div className="space-y-3">
                {activeAlerts.slice(0, 5).map((alert: any) => (
                  <div 
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.priority === "critica" 
                        ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                        : alert.priority === "alta"
                        ? "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800"
                        : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                        alert.priority === "critica" ? "text-red-600 dark:text-red-400" :
                        alert.priority === "alta" ? "text-orange-600 dark:text-orange-400" :
                        "text-yellow-600 dark:text-yellow-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          alert.priority === "critica" ? "text-red-800 dark:text-red-200" :
                          alert.priority === "alta" ? "text-orange-800 dark:text-orange-200" :
                          "text-yellow-800 dark:text-yellow-200"
                        }`}>
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.type} - {format(new Date(alert.createdAt), "HH:mm")}
                        </p>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] ${
                        alert.priority === "critica" 
                          ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200"
                          : alert.priority === "alta"
                          ? "bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200"
                          : "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200"
                      }`}>
                        {alert.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
                {activeAlerts.length > 5 && (
                  <Link href="/maquinas">
                    <Button variant="outline" size="sm" className="w-full" data-testid="link-more-alerts">
                      Ver {activeAlerts.length - 5} alertas más
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-muted-foreground">No hay alertas activas</p>
                <p className="text-xs text-muted-foreground mt-1">Todas las máquinas operan con normalidad</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Tareas del Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayTasks.length > 0 ? (
              <div className="space-y-3">
                {todayTasks.slice(0, 5).map((task: any) => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      task.status === "completada" 
                        ? "bg-green-100 dark:bg-green-900/30"
                        : task.status === "en_progreso"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-gray-100 dark:bg-gray-800"
                    }`}>
                      {task.status === "completada" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : task.status === "en_progreso" ? (
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        task.status === "completada" ? "line-through text-muted-foreground" : ""
                      }`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{task.type}</p>
                    </div>
                    {task.priority && (
                      <Badge variant="secondary" className={`text-[10px] ${
                        task.priority === "urgente" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        task.priority === "alta" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                        ""
                      }`}>
                        {task.priority}
                      </Badge>
                    )}
                  </div>
                ))}
                {todayTasks.length > 5 && (
                  <Link href="/tareas">
                    <Button variant="outline" size="sm" className="w-full" data-testid="link-more-tasks">
                      Ver {todayTasks.length - 5} tareas más
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-muted-foreground">No hay tareas pendientes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
