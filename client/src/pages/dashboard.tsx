import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { addDays } from "date-fns";
import { formatTime, TIMEZONE, LOCALE, isSameDayInTimezone, isTodayInTimezone, getStartOfWeekInTimezone, formatCurrency } from "@/lib/utils";
import { 
  Plus, MoreHorizontal, Check, Box, AlertTriangle, TrendingUp, Users, Loader2,
  Route, Warehouse, DollarSign, Wallet, ShoppingCart, Fuel, UserCheck, FileText,
  Package, Clock, ArrowUpRight, ArrowDownRight, Truck, CircleDollarSign, MapPin,
  CheckCircle2, XCircle, BarChart3, Calendar
} from "lucide-react";
import { Link } from "wouter";
import type { Task, Machine } from "@shared/schema";

const zoneColors = [
  "bg-[#2F6FED]",
  "bg-[#1D1D1D]",
  "bg-[#FF6B3D]",
  "bg-[#8E59FF]",
  "bg-[#4ECB71]",
  "bg-[#E84545]",
];

interface SummaryRoutes {
  activeRoutes: number;
  totalRoutes: number;
  todayStops: number;
  completedStops: number;
  pendingStops: number;
  avgServiceTimeMinutes: number;
  recentRoutes: { id: string; name: string; date: string; status: string; stopsCount: number }[];
}

interface SummaryWarehouse {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  lowStockProducts: { id: string; name: string; code: string; currentStock: number; category: string }[];
  weekMovements: number;
  entriesThisWeek: number;
  exitsThisWeek: number;
}

interface SummaryAccounting {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  weekDeposits: number;
  pendingDeposits: number;
}

interface SummaryPettyCash {
  currentBalance: string;
  initialAmount: string;
  weekExpenses: number;
  pendingCount: number;
  approvedCount: number;
  recentExpenses: { id: string; description: string; amount: string; category: string; status: string }[];
}

interface SummaryPurchases {
  openOrders: number;
  totalOrders: number;
  weekSpending: number;
  pendingReceptions: number;
  recentOrders: { id: string; orderNumber: string; total: string; status: string }[];
}

interface SummaryFuel {
  totalVehicles: number;
  activeVehicles: number;
  monthCost: number;
  monthLiters: number;
  avgEfficiency: string;
  lowEfficiencyAlerts: number;
}

interface SummaryHR {
  totalEmployees: number;
  activeEmployees: number;
  weekVisits: number;
  weekTasksCompleted: number;
  topPerformers: { id: string; name: string; role: string; visitsThisWeek: number; tasksCompleted: number }[];
  byRole: { technicians: number; admins: number; supervisors: number };
}

interface SummaryReconciliation {
  weekTransfers: number;
  pendingTransfers: number;
  weekShrinkage: number;
  shrinkageRecords: number;
  weekCollections: number;
  collectionsCount: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("today");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: todayTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks/today"],
  });

  const { data: machines = [], isLoading: machinesLoading } = useQuery<any[]>({
    queryKey: ["/api/machines"],
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: calendarEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/calendar/events"],
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: routesSummary } = useQuery<SummaryRoutes>({
    queryKey: ["/api/summary/routes"],
  });

  const { data: warehouseSummary } = useQuery<SummaryWarehouse>({
    queryKey: ["/api/summary/warehouse"],
  });

  const { data: accountingSummary } = useQuery<SummaryAccounting>({
    queryKey: ["/api/summary/accounting"],
  });

  const { data: pettyCashSummary } = useQuery<SummaryPettyCash>({
    queryKey: ["/api/summary/petty-cash"],
  });

  const { data: purchasesSummary } = useQuery<SummaryPurchases>({
    queryKey: ["/api/summary/purchases"],
  });

  const { data: fuelSummary } = useQuery<SummaryFuel>({
    queryKey: ["/api/summary/fuel"],
  });

  const { data: hrSummary } = useQuery<SummaryHR>({
    queryKey: ["/api/summary/hr"],
  });

  const { data: reconciliationSummary } = useQuery<SummaryReconciliation>({
    queryKey: ["/api/summary/reconciliation"],
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const newStatus = status === "completada" ? "pendiente" : "completada";
      return apiRequest("PATCH", `/api/tasks/${taskId}`, { 
        status: newStatus,
        completedAt: newStatus === "completada" ? new Date().toISOString() : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const zoneStats = useMemo(() => {
    const zones: Record<string, { machines: any[], activeCount: number, alertCount: number }> = {};
    machines.forEach((machine: any) => {
      const zone = machine.zone || "Sin zona";
      if (!zones[zone]) {
        zones[zone] = { machines: [], activeCount: 0, alertCount: 0 };
      }
      zones[zone].machines.push(machine);
      if (machine.status === "operando") {
        zones[zone].activeCount++;
      }
      if (machine.alerts && machine.alerts.length > 0) {
        zones[zone].alertCount += machine.alerts.filter((a: any) => !a.isResolved).length;
      }
    });
    return Object.entries(zones).map(([name, data], index) => ({
      id: name,
      name,
      subtitle: `${data.machines.length} máquinas`,
      progress: data.machines.length > 0 
        ? Math.round((data.activeCount / data.machines.length) * 100) 
        : 0,
      alertCount: data.alertCount,
      colorClass: zoneColors[index % zoneColors.length],
    }));
  }, [machines]);

  const weekDays = useMemo(() => {
    const start = getStartOfWeekInTimezone(); // Lunes en GMT-4
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const dayTasks = allTasks.filter((task) => {
        if (!task.dueDate) return false;
        return isSameDayInTimezone(task.dueDate, date);
      });
      const dayEvents = calendarEvents.filter((event: any) => {
        if (!event.startDate) return false;
        return isSameDayInTimezone(event.startDate, date);
      });
      return {
        day: date.toLocaleDateString(LOCALE, { timeZone: TIMEZONE, day: 'numeric' }),
        label: date.toLocaleDateString(LOCALE, { timeZone: TIMEZONE, weekday: 'short' }),
        isToday: isTodayInTimezone(date),
        date,
        taskCount: dayTasks.length,
        eventCount: dayEvents.length,
        totalCount: dayTasks.length + dayEvents.length,
        tasks: dayTasks,
        events: dayEvents,
      };
    });
  }, [allTasks, calendarEvents]);

  const selectedDayData = useMemo(() => {
    if (!selectedDay) return null;
    return weekDays.find(d => isSameDayInTimezone(d.date, selectedDay)) || null;
  }, [selectedDay, weekDays]);

  const completedCount = todayTasks.filter((t) => t.status === "completada").length;
  const openCount = todayTasks.filter((t) => t.status !== "completada" && t.status !== "cancelada").length;
  const activeAlerts = alerts.filter((a: any) => !a.isResolved).length;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatTaskTime = (task: Task) => {
    if (task.startTime && task.endTime) {
      return `${task.startTime} - ${task.endTime}`;
    }
    if (task.dueDate) {
      return formatTime(task.dueDate);
    }
    return "Sin hora";
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Máquinas Activas</p>
                  <p className="text-2xl font-bold" data-testid="stat-active-machines">
                    {machines.filter((m: any) => m.status === "operando").length}
                  </p>
                </div>
                <Box className="h-8 w-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Alertas Activas</p>
                  <p className="text-2xl font-bold" data-testid="stat-active-alerts">{activeAlerts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Ventas Hoy</p>
                  <p className="text-2xl font-bold" data-testid="stat-sales-today">
                    {formatCurrency(accountingSummary?.salesToday || 0)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Tareas Hoy</p>
                  <p className="text-2xl font-bold" data-testid="stat-today-tasks">{todayTasks.length}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Operaciones</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/maquinas">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-machines">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Box className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Máquinas</h3>
                      <p className="text-xs text-muted-foreground">{machines.length} total</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Operando</span>
                      <span className="font-medium text-green-600">{machines.filter((m: any) => m.status === "operando").length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Con alertas</span>
                      <span className="font-medium text-orange-600">{activeAlerts}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Zonas</span>
                      <span className="font-medium">{zoneStats.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/abastecedor">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-routes">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Route className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Rutas</h3>
                      <p className="text-xs text-muted-foreground">{routesSummary?.totalRoutes || 0} rutas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Activas</span>
                      <span className="font-medium text-green-600">{routesSummary?.activeRoutes || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Paradas hoy</span>
                      <span className="font-medium">{routesSummary?.todayStops || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tiempo prom.</span>
                      <span className="font-medium">{routesSummary?.avgServiceTimeMinutes || 0} min</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/almacen">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-warehouse">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Warehouse className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Almacén</h3>
                      <p className="text-xs text-muted-foreground">{warehouseSummary?.totalProducts || 0} productos</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stock total</span>
                      <span className="font-medium">{warehouseSummary?.totalStock || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stock bajo</span>
                      <span className="font-medium text-red-600">{warehouseSummary?.lowStockCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Movimientos sem.</span>
                      <span className="font-medium">{warehouseSummary?.weekMovements || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/compras">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-purchases">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Compras</h3>
                      <p className="text-xs text-muted-foreground">{purchasesSummary?.totalOrders || 0} órdenes</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Abiertas</span>
                      <span className="font-medium text-blue-600">{purchasesSummary?.openOrders || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Por recibir</span>
                      <span className="font-medium text-orange-600">{purchasesSummary?.pendingReceptions || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gasto sem.</span>
                      <span className="font-medium">{formatCurrency(purchasesSummary?.weekSpending || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Finanzas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/contabilidad">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-accounting">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CircleDollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Contabilidad</h3>
                      <p className="text-xs text-muted-foreground">Resumen de ventas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ventas semana</span>
                      <span className="font-medium text-green-600">{formatCurrency(accountingSummary?.salesWeek || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ventas mes</span>
                      <span className="font-medium">{formatCurrency(accountingSummary?.salesMonth || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Flujo neto</span>
                      <span className={`font-medium ${(accountingSummary?.netCashFlow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(accountingSummary?.netCashFlow || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/caja-chica">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-petty-cash">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Caja Chica</h3>
                      <p className="text-xs text-muted-foreground">Fondo disponible</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Balance</span>
                      <span className="font-medium text-green-600">{formatCurrency(pettyCashSummary?.currentBalance || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gastos sem.</span>
                      <span className="font-medium text-red-600">{formatCurrency(pettyCashSummary?.weekExpenses || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pendientes</span>
                      <span className="font-medium text-orange-600">{pettyCashSummary?.pendingCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/combustible">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-fuel">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                      <Fuel className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Combustible</h3>
                      <p className="text-xs text-muted-foreground">{fuelSummary?.activeVehicles || 0} vehículos activos</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Costo mes</span>
                      <span className="font-medium text-red-600">{formatCurrency(fuelSummary?.monthCost || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Litros mes</span>
                      <span className="font-medium">{fuelSummary?.monthLiters?.toFixed(1) || 0} L</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rend. prom.</span>
                      <span className="font-medium">{fuelSummary?.avgEfficiency || 0} km/L</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dinero-productos">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-reconciliation">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Conciliación</h3>
                      <p className="text-xs text-muted-foreground">Dinero y productos</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Transferencias</span>
                      <span className="font-medium">{reconciliationSummary?.weekTransfers || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Mermas sem.</span>
                      <span className="font-medium text-red-600">{reconciliationSummary?.weekShrinkage || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Recolecciones</span>
                      <span className="font-medium text-green-600">{formatCurrency(reconciliationSummary?.weekCollections || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Administración</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/rh">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-hr">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                      <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Recursos Humanos</h3>
                      <p className="text-xs text-muted-foreground">{hrSummary?.activeEmployees || 0} empleados activos</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Visitas sem.</span>
                      <span className="font-medium">{hrSummary?.weekVisits || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tareas comp.</span>
                      <span className="font-medium text-green-600">{hrSummary?.weekTasksCompleted || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Técnicos</span>
                      <span className="font-medium">{hrSummary?.byRole?.technicians || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="h-full" data-testid="widget-reports">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-900/30 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Reportes</h3>
                    <p className="text-xs text-muted-foreground">Accesos rápidos</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Link href="/contabilidad">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm h-8" data-testid="link-report-sales">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Ventas por período
                    </Button>
                  </Link>
                  <Link href="/almacen">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm h-8" data-testid="link-report-inventory">
                      <Package className="h-4 w-4 mr-2" />
                      Rotación de inventario
                    </Button>
                  </Link>
                  <Link href="/combustible">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm h-8" data-testid="link-report-fuel">
                      <Fuel className="h-4 w-4 mr-2" />
                      Eficiencia combustible
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Calendario Semanal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(selectedDay && isSameDayInTimezone(selectedDay, day.date) ? null : day.date)}
                      className={`text-center p-2 rounded-lg transition-all relative ${
                        day.isToday
                          ? "bg-primary text-primary-foreground"
                          : selectedDay && isSameDayInTimezone(selectedDay, day.date)
                          ? "bg-primary/20 ring-2 ring-primary"
                          : "hover:bg-muted"
                      }`}
                      data-testid={`calendar-day-${idx}`}
                    >
                      <p className="text-lg font-bold">{day.day}</p>
                      <p className="text-[10px] capitalize">{day.label}</p>
                      {day.totalCount > 0 && (
                        <div className="flex justify-center gap-0.5 mt-1">
                          {day.taskCount > 0 && (
                            <span className={`w-1.5 h-1.5 rounded-full ${day.isToday ? "bg-white" : "bg-blue-500"}`} />
                          )}
                          {day.eventCount > 0 && (
                            <span className={`w-1.5 h-1.5 rounded-full ${day.isToday ? "bg-white" : "bg-green-500"}`} />
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {selectedDayData && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">
                        {selectedDayData.date.toLocaleDateString(LOCALE, { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })}
                      </h4>
                      <Badge variant="secondary" className="text-[10px]">
                        {selectedDayData.totalCount} actividades
                      </Badge>
                    </div>
                    
                    {selectedDayData.tasks.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Tareas ({selectedDayData.taskCount})
                        </p>
                        {selectedDayData.tasks.slice(0, 3).map((task: Task) => (
                          <div key={task.id} className="text-xs p-2 rounded bg-muted/50 flex items-center justify-between">
                            <span className="truncate">{task.title}</span>
                            <Badge variant={task.status === "completada" ? "default" : "secondary"} className="text-[9px] ml-2">
                              {task.status}
                            </Badge>
                          </div>
                        ))}
                        {selectedDayData.tasks.length > 3 && (
                          <Link href="/tareas">
                            <p className="text-xs text-primary hover:underline cursor-pointer">
                              +{selectedDayData.tasks.length - 3} más...
                            </p>
                          </Link>
                        )}
                      </div>
                    )}
                    
                    {selectedDayData.events.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Eventos ({selectedDayData.eventCount})
                        </p>
                        {selectedDayData.events.slice(0, 3).map((event: any) => (
                          <div key={event.id} className="text-xs p-2 rounded bg-muted/50">
                            <span className="truncate">{event.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedDayData.totalCount === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No hay actividades programadas
                      </p>
                    )}
                  </div>
                )}
                
                {!selectedDay && (
                  <p className="text-xs text-muted-foreground text-center">
                    Haz clic en un día para ver las actividades
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Zonas</h2>
            <p className="text-sm text-muted-foreground">
              {zoneStats.length} zonas activas
            </p>
          </div>
          <Link href="/maquinas">
            <Button className="gap-2" data-testid="button-view-machines">
              <MapPin className="h-4 w-4" />
              Ver Máquinas
            </Button>
          </Link>
        </div>

        {machinesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 overflow-hidden">
                <CardContent className="p-5">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-4" />
                  <Skeleton className="h-2 w-full mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : zoneStats.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zoneStats.map((zone) => (
              <Card
                key={zone.id}
                className={`${zone.colorClass} text-white border-0 overflow-hidden hover-elevate cursor-pointer`}
                data-testid={`card-zone-${zone.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{zone.name}</h3>
                      <p className="text-sm text-white/70">{zone.subtitle}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                      data-testid={`button-zone-menu-${zone.id}`}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/70">Operativas</span>
                      <span className="text-sm font-medium">{zone.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${zone.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {zone.alertCount > 0 && (
                      <Badge variant="secondary" className="bg-white/20 text-white border-0">
                        {zone.alertCount} alertas
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Box className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No hay máquinas registradas</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Agrega tu primera máquina para comenzar a gestionar tu inventario
              </p>
              <Link href="/maquinas">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Máquina
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="w-80 border-l bg-background p-4 overflow-auto hidden lg:block" data-testid="panel-today-tasks">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="messages" className="flex-1 text-xs">
              Mensajes
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-1 text-xs">
              Tareas
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 text-xs">
              Alertas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-4">
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay mensajes nuevos
            </p>
          </TabsContent>

          <TabsContent value="today" className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Tareas de Hoy</h2>
                <p className="text-xs text-muted-foreground">
                  {new Date().toLocaleDateString(LOCALE, { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <Link href="/tareas">
                <Button size="sm" className="h-8 gap-1 text-xs" data-testid="button-new-task">
                  <Plus className="h-3 w-3" />
                  Nueva
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="text-xs">
                Todas {todayTasks.length.toString().padStart(2, "0")}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Abiertas {openCount.toString().padStart(2, "0")}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Cerradas {completedCount.toString().padStart(2, "0")}
              </Badge>
            </div>

            {tasksLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : todayTasks.length > 0 ? (
              <div className="space-y-3">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    data-testid={`task-item-${task.id}`}
                  >
                    <div
                      className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                        task.status === "completada"
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30 hover:border-primary"
                      }`}
                      onClick={() => toggleTaskMutation.mutate({ taskId: task.id, status: task.status || "pendiente" })}
                      data-testid={`checkbox-task-${task.id}`}
                    >
                      {task.status === "completada" && <Check className="h-3 w-3 text-white" />}
                      {toggleTaskMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium text-sm ${
                          task.status === "completada" ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {task.description || task.type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTaskTime(task)}
                      </p>
                    </div>
                    {task.priority && (
                      <Badge 
                        variant="secondary" 
                        className={`text-[10px] ${
                          task.priority === "urgente" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          task.priority === "alta" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                          ""
                        }`}
                      >
                        {task.priority}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  No hay tareas para hoy
                </p>
                <Link href="/tareas">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Tarea
                  </Button>
                </Link>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            {activeAlerts > 0 ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Alertas Activas ({activeAlerts})</h3>
                {alerts.filter((a: any) => !a.isResolved).slice(0, 5).map((alert: any) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-xl border ${
                      alert.priority === "critica" 
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        : alert.priority === "alta"
                        ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
                        : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                    }`}
                  >
                    <p className={`text-sm font-medium ${
                      alert.priority === "critica" 
                        ? "text-red-800 dark:text-red-300"
                        : alert.priority === "alta"
                        ? "text-orange-800 dark:text-orange-300"
                        : "text-yellow-800 dark:text-yellow-300"
                    }`}>
                      {alert.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge 
                        variant="secondary" 
                        className={`text-[10px] ${
                          alert.priority === "critica" 
                            ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200"
                            : alert.priority === "alta"
                            ? "bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200"
                            : "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200"
                        }`}
                      >
                        {alert.priority}
                      </Badge>
                      <span className={`text-xs ${
                        alert.priority === "critica" 
                          ? "text-red-600 dark:text-red-400"
                          : alert.priority === "alta"
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}>
                        {alert.type}
                      </span>
                    </div>
                  </div>
                ))}
                <Link href="/maquinas">
                  <Button variant="outline" size="sm" className="w-full mt-2" data-testid="button-view-all-alerts">
                    Ver todas las alertas
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-sm text-muted-foreground">
                  No hay alertas activas
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todas las máquinas operan con normalidad
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
