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
  CheckCircle2, XCircle, BarChart3, Calendar, ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen,
  ClipboardList, Zap, TrendingDown, Activity,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "wouter";
import type { Task, Machine } from "@shared/schema";

const zoneColors = [
  "bg-[#E84545]",
  "bg-[#c43535]",
  "bg-[#f07070]",
  "bg-[#1a0808]",
  "bg-[#6b6b6b]",
  "bg-[#3d3d3d]",
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
  dailySales: { date: string; amount: number }[];
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
  monthSpending: number;
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

interface SummaryProducts {
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  todaySalesUnits: number;
  weekSalesUnits: number;
  topProducts: { id: string; name: string; quantity: number; revenue: number }[];
  categories: Record<string, number>;
}

interface SummaryKpi {
  alertsThisWeek: number;
  alertsLastWeek: number;
  alertsDelta: number;
  tasksRateThisWeek: number;
  tasksRateLastWeek: number;
  tasksDelta: number;
}

interface SummaryMachines {
  totalMachines: number;
  statusCounts: { operando: number; necesita_servicio: number; mantenimiento: number; fuera_servicio: number };
  operativityRate: number;
  todaySalesUnits: number;
  todayRevenue: number;
  activeAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  zonesCount: number;
}

const TASK_PANEL_KEY = "dispensax-task-panel-open";

export function DashboardPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("today");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TASK_PANEL_KEY);
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem(TASK_PANEL_KEY, String(isTaskPanelOpen));
  }, [isTaskPanelOpen]);

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

  const { data: productsSummary } = useQuery<SummaryProducts>({
    queryKey: ["/api/summary/products"],
  });

  const { data: machinesSummary } = useQuery<SummaryMachines>({
    queryKey: ["/api/summary/machines"],
  });

  interface WOStats {
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    bySla: Record<string, number>;
    slaBreached: number;
    total: number;
  }

  const { data: woStats } = useQuery<WOStats>({
    queryKey: ["/api/work-orders/stats"],
  });

  const { data: kpiSummary } = useQuery<SummaryKpi>({
    queryKey: ["/api/summary/kpi"],
  });

  interface EstablishmentStats {
    total: number;
    activeWithContract: number;
    inPipeline: number;
    newThisWeek: number;
    byStage: Record<string, number>;
    byPriority: Record<string, number>;
  }

  const { data: establishmentStats } = useQuery<EstablishmentStats>({
    queryKey: ["/api/establishments/stats"],
  });

  const formatRelativeTime = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '';
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 60) return `hace ${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays}d`;
  };

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
      zones[zone].alertCount += (machine.alertCount || 0);
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

  const machineStatusData = useMemo(() => {
    if (!machinesSummary) return [];
    return [
      { name: 'Operando', value: machinesSummary.statusCounts?.operando || 0, color: 'hsl(var(--primary))' },
      { name: 'Servicio', value: machinesSummary.statusCounts?.necesita_servicio || 0, color: 'hsl(var(--muted-foreground))' },
      { name: 'Mant.', value: machinesSummary.statusCounts?.mantenimiento || 0, color: '#6b7280' },
      { name: 'Fuera', value: machinesSummary.statusCounts?.fuera_servicio || 0, color: 'hsl(var(--destructive))' },
    ].filter(d => d.value > 0);
  }, [machinesSummary]);

  const dailyAvgSales = (accountingSummary?.salesWeek || 0) / 7;
  const salesTodayDelta = dailyAvgSales > 0
    ? Math.round(((accountingSummary?.salesToday || 0) / dailyAvgSales - 1) * 100)
    : 0;
  const machinesDelta = (machinesSummary?.operativityRate ?? 100) - 100;

  const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return DAY_NAMES[d.getDay()];
  };

  const highlightInfo = useMemo(() => {
    if (woStats && woStats.slaBreached > 0) {
      return {
        type: 'urgent' as const,
        title: `${woStats.slaBreached} orden${woStats.slaBreached !== 1 ? 'es' : ''} con SLA vencido`,
        subtitle: 'Requieren atención inmediata',
        href: '/ordenes-trabajo',
        cta: 'Ir a Órdenes de Trabajo',
      };
    }
    const unresolvedAlerts = alerts.filter((a: any) => !a.isResolved);
    if (unresolvedAlerts.length >= 3) {
      return {
        type: 'warning' as const,
        title: `${unresolvedAlerts.length} alertas activas en máquinas`,
        subtitle: 'Revisar máquinas para continuar operaciones',
        href: '/maquinas',
        cta: 'Revisar Máquinas',
      };
    }
    return {
      type: 'positive' as const,
      title: `${machinesSummary?.operativityRate || 0}% de operatividad`,
      subtitle: `${machinesSummary?.statusCounts?.operando || 0} máquinas operando hoy`,
      href: '/maquinas',
      cta: 'Ver Máquinas',
    };
  }, [woStats, alerts, machinesSummary]);

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

        {/* Encabezado del Dashboard */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bienvenido, {user?.username || "usuario"} — {currentTime.toLocaleDateString("es-DO", { timeZone: "America/Santo_Domingo", weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono font-semibold tabular-nums">
              {currentTime.toLocaleTimeString("es-DO", { timeZone: "America/Santo_Domingo", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground">GMT-4 · Santo Domingo</p>
          </div>
        </div>

        {/* Fila superior: Highlight Card (izquierda) + 4 KPIs 2×2 (derecha) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

          {/* Highlight Card — lado izquierdo, altura total del bloque */}
          <Link href={highlightInfo.href} className="flex">
            <Card
              className={`w-full cursor-pointer hover-elevate ${
                highlightInfo.type === 'urgent'
                  ? 'bg-destructive text-destructive-foreground border-destructive'
                  : 'bg-primary text-primary-foreground border-primary'
              }`}
              data-testid="card-highlight"
            >
              <CardContent className="p-6 flex flex-col justify-between h-full gap-6 min-h-[180px]">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    {highlightInfo.type === 'urgent' ? (
                      <Zap className="h-6 w-6" />
                    ) : highlightInfo.type === 'warning' ? (
                      <AlertTriangle className="h-6 w-6" />
                    ) : (
                      <Activity className="h-6 w-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Estado operativo</p>
                    <p className="text-xl font-bold leading-snug">{highlightInfo.title}</p>
                    <p className="text-sm opacity-80 mt-1">{highlightInfo.subtitle}</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start bg-white/20 text-inherit border-white/30"
                  data-testid="button-highlight-cta"
                >
                  {highlightInfo.cta}
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Panel derecho: 4 KPIs en cuadrícula 2×2 (apilado en móvil) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* KPI: Máquinas Activas */}
            <Card>
              <CardContent className="p-4 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Máquinas Activas</p>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Box className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold mt-2" data-testid="stat-active-machines">
                    {machinesSummary?.statusCounts?.operando ?? machines.filter((m: any) => m.status === "operando").length}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {machinesDelta >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                    )}
                    <p className={`text-xs ${machinesDelta >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {machinesDelta >= 0 ? '100% operatividad' : `${Math.abs(machinesDelta)}% fuera de serv.`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI: Ventas Hoy */}
            <Card>
              <CardContent className="p-4 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Ventas Hoy</p>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold mt-2" data-testid="stat-sales-today">
                    {formatCurrency(accountingSummary?.salesToday || 0)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {salesTodayDelta >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                    )}
                    <p className={`text-xs ${salesTodayDelta >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {Math.abs(salesTodayDelta)}% vs prom. sem.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI: Alertas Activas */}
            <Card>
              <CardContent className="p-4 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Alertas Activas</p>
                  <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold mt-2" data-testid="stat-active-alerts">{activeAlerts}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {(kpiSummary?.alertsDelta ?? 0) <= 0 ? (
                      <ArrowDownRight className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3 text-destructive" />
                    )}
                    <p className={`text-xs ${(kpiSummary?.alertsDelta ?? 0) <= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {Math.abs(kpiSummary?.alertsDelta ?? 0)}% vs sem. ant.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI: Tareas Hoy */}
            <Card>
              <CardContent className="p-4 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Tareas Hoy</p>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold mt-2" data-testid="stat-today-tasks">{todayTasks.length}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {(kpiSummary?.tasksDelta ?? 0) >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                    )}
                    <p className={`text-xs ${(kpiSummary?.tasksDelta ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {kpiSummary?.tasksDelta !== undefined
                        ? `${kpiSummary.tasksDelta >= 0 ? '+' : ''}${kpiSummary.tasksDelta}pp vs sem. ant.`
                        : `${completedCount}/${todayTasks.length} completadas`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
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
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Box className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Máquinas</h3>
                      <p className="text-xs text-muted-foreground">{machinesSummary?.totalMachines || machines.length} total</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Operando</span>
                      <span className="font-medium text-primary">{machinesSummary?.statusCounts?.operando || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Con alertas</span>
                      <span className="font-medium text-muted-foreground">{machinesSummary?.activeAlerts || activeAlerts}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Operatividad</span>
                      <span className="font-medium">{machinesSummary?.operativityRate || 0}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/productos">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-products">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Productos</h3>
                      <p className="text-xs text-muted-foreground">{productsSummary?.totalProducts || 0} productos</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Activos</span>
                      <span className="font-medium text-primary">{productsSummary?.activeProducts || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stock bajo</span>
                      <span className="font-medium text-destructive">{productsSummary?.lowStockCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ventas sem.</span>
                      <span className="font-medium">{productsSummary?.weekSalesUnits || 0} uds</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/rutas">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-routes">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Route className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Rutas</h3>
                      <p className="text-xs text-muted-foreground">{routesSummary?.totalRoutes || 0} rutas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Activas hoy</span>
                      <span className="font-medium text-primary">{routesSummary?.activeRoutes || 0}</span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progreso paradas</span>
                        <span className="font-medium">{routesSummary?.completedStops || 0}/{routesSummary?.todayStops || 0}</span>
                      </div>
                      <Progress value={routesSummary?.todayStops ? ((routesSummary.completedStops || 0) / routesSummary.todayStops) * 100 : 0} className="h-1.5" />
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
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Warehouse className="h-5 w-5 text-primary" />
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
                      <span className="font-medium text-destructive">{warehouseSummary?.lowStockCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Movimientos sem.</span>
                      <span className="font-medium">{warehouseSummary?.weekMovements || 0}</span>
                    </div>
                    {warehouseSummary?.lowStockProducts && warehouseSummary.lowStockProducts.length > 0 && (
                      <div className="pt-1.5 border-t space-y-1">
                        {warehouseSummary.lowStockProducts.slice(0, 3).map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate max-w-[110px]">{p.name}</span>
                            <Badge variant="destructive" className="text-[9px] px-1">{p.currentStock}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/compras">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-purchases">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Compras</h3>
                      <p className="text-xs text-muted-foreground">{purchasesSummary?.totalOrders || 0} órdenes</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Abiertas</span>
                      <span className="font-medium">{purchasesSummary?.openOrders || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Por recibir</span>
                      <span className="font-medium text-muted-foreground">{purchasesSummary?.pendingReceptions || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gasto mes</span>
                      <span className="font-medium">{formatCurrency(purchasesSummary?.monthSpending || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/establecimientos">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-establishments">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Establecimientos</h3>
                      <p className="text-xs text-muted-foreground">{establishmentStats?.total ?? 0} total</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Activos (contrato)</span>
                      <span className="font-medium text-primary">{establishmentStats?.activeWithContract ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">En pipeline</span>
                      <span className="font-medium">{establishmentStats?.inPipeline ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Nuevos sem.</span>
                      <span className={`font-medium ${(establishmentStats?.newThisWeek ?? 0) > 0 ? 'text-primary' : ''}`}>
                        {establishmentStats?.newThisWeek ?? 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Sección Análisis */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Análisis</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Ventas — Últimos 7 días
                </CardTitle>
                <p className="text-xs text-muted-foreground">Ingreso diario acumulado (RD$)</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={accountingSummary?.dailySales || []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatDayLabel} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Ventas']}
                      labelFormatter={(label: string) => {
                        const d = new Date(label + 'T12:00:00');
                        return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'short' });
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  Estado Flota
                </CardTitle>
                <p className="text-xs text-muted-foreground">{machinesSummary?.totalMachines || 0} máquinas</p>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2">
                {machineStatusData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={machineStatusData} cx="50%" cy="50%" innerRadius={36} outerRadius={54} dataKey="value" strokeWidth={0}>
                          {machineStatusData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [v, 'Máquinas']} contentStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 w-full">
                      {machineStatusData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-muted-foreground">{item.name}</span>
                          </div>
                          <span className="font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground py-10 text-center">Sin datos de flota</p>
                )}
              </CardContent>
            </Card>
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
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CircleDollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Contabilidad</h3>
                      <p className="text-xs text-muted-foreground">Resumen de ventas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ventas semana</span>
                      <span className="font-medium text-primary">{formatCurrency(accountingSummary?.salesWeek || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ventas mes</span>
                      <span className="font-medium">{formatCurrency(accountingSummary?.salesMonth || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Flujo neto</span>
                      <span className={`font-medium ${(accountingSummary?.netCashFlow || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
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
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Caja Chica</h3>
                      <p className="text-xs text-muted-foreground">Fondo disponible</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Balance</span>
                      <span className="font-medium text-primary">{formatCurrency(parseFloat(pettyCashSummary?.currentBalance || "0"))}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gastos sem.</span>
                      <span className="font-medium text-destructive">{formatCurrency(pettyCashSummary?.weekExpenses || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pendientes</span>
                      <span className="font-medium text-muted-foreground">{pettyCashSummary?.pendingCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/combustible">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-fuel">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Fuel className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Combustible</h3>
                      <p className="text-xs text-muted-foreground">{fuelSummary?.activeVehicles || 0} vehículos activos</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Costo mes</span>
                      <span className="font-medium text-destructive">{formatCurrency(fuelSummary?.monthCost || 0)}</span>
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
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-primary" />
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
                      <span className="font-medium text-destructive">{reconciliationSummary?.weekShrinkage || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Recolecciones</span>
                      <span className="font-medium text-primary">{formatCurrency(reconciliationSummary?.weekCollections || 0)}</span>
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
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
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
                      <span className="font-medium text-primary">{hrSummary?.weekTasksCompleted || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Técnicos</span>
                      <span className="font-medium">{hrSummary?.byRole?.technicians || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {woStats && (
              <Link href="/ordenes-trabajo">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="widget-work-orders">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ClipboardList className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Órdenes de Trabajo</h3>
                        <p className="text-xs text-muted-foreground">{woStats.total} en total</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pendientes</span>
                        <span className="font-medium">
                          {(woStats.byStatus?.pendiente || 0) + (woStats.byStatus?.asignada || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">En proceso</span>
                        <span className="font-medium">
                          {(woStats.byStatus?.en_proceso || 0) + (woStats.byStatus?.en_ruta || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">SLA vencidas</span>
                        {woStats.slaBreached > 0 ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5">
                            {woStats.slaBreached} vencida{woStats.slaBreached !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <span className="font-medium text-primary">0</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            <Card className="h-full" data-testid="widget-reports">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Reportes</h3>
                    <p className="text-xs text-muted-foreground">Accesos rápidos</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Link href="/ordenes-trabajo">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm h-8" data-testid="link-quick-work-order">
                      <ClipboardList className="h-4 w-4 mr-2 text-primary" />
                      Nueva Orden de Trabajo
                    </Button>
                  </Link>
                  <Link href="/tareas">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm h-8" data-testid="link-quick-task">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                      Nueva Tarea
                    </Button>
                  </Link>
                  <Link href="/maquinas">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm h-8" data-testid="link-quick-alerts">
                      <AlertTriangle className="h-4 w-4 mr-2 text-muted-foreground" />
                      Ver Alertas de Máquinas
                    </Button>
                  </Link>
                  <Link href="/contabilidad">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm h-8" data-testid="link-quick-sales">
                      <TrendingUp className="h-4 w-4 mr-2 text-muted-foreground" />
                      Ventas por período
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
                            <span className={`w-1.5 h-1.5 rounded-full ${day.isToday ? "bg-white" : "bg-primary"}`} />
                          )}
                          {day.eventCount > 0 && (
                            <span className={`w-1.5 h-1.5 rounded-full ${day.isToday ? "bg-white" : "bg-primary/60"}`} />
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
                          <span className="w-2 h-2 rounded-full bg-primary" />
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
                          <span className="w-2 h-2 rounded-full bg-primary/60" />
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

        {/* Feed de Alertas Activas */}
        {alerts.filter((a: any) => !a.isResolved).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h2 className="text-xl font-bold">Alertas Activas</h2>
              <Link href="/maquinas">
                <Button variant="ghost" size="sm" data-testid="button-view-all-alerts">
                  Ver todas
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {alerts.filter((a: any) => !a.isResolved).slice(0, 6).map((alert: any) => (
                <Card key={alert.id} data-testid={`card-alert-${alert.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      alert.priority === 'critica' ? 'bg-destructive/10' : 'bg-muted'
                    }`}>
                      <AlertTriangle className={`h-4 w-4 ${alert.priority === 'critica' ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{alert.machineName || 'Máquina desconocida'}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(alert.createdAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{alert.message || alert.type}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={alert.priority === 'critica' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5">
                          {alert.priority || 'media'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{alert.type}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

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
              <Link key={zone.id} href={`/maquinas?zone=${encodeURIComponent(zone.name)}`}>
                <Card
                  className={`${zone.colorClass} text-white border-0 overflow-hidden hover-elevate cursor-pointer h-full`}
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
                        onClick={(e) => e.stopPropagation()}
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
              </Link>
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

      <div 
        className={`border-l bg-background overflow-hidden hidden lg:flex flex-col transition-all duration-300 ease-in-out ${
          isTaskPanelOpen ? "w-80" : "w-12"
        }`} 
        data-testid="panel-today-tasks"
      >
        <div className="flex items-center justify-center p-2 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsTaskPanelOpen(!isTaskPanelOpen)}
            className="h-8 w-8"
            data-testid="button-toggle-task-panel"
            aria-expanded={isTaskPanelOpen}
            aria-controls="task-panel-content"
            title={isTaskPanelOpen ? "Ocultar panel" : "Mostrar panel"}
          >
            {isTaskPanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <div 
          id="task-panel-content"
          className={`flex-1 overflow-auto transition-opacity duration-200 ${
            isTaskPanelOpen ? "opacity-100 p-4" : "opacity-0 p-0 pointer-events-none"
          }`}
        >
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
                          task.priority === "urgente" ? "bg-destructive/10 text-destructive" :
                          task.priority === "alta" ? "bg-muted text-muted-foreground" :
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
                        ? "bg-destructive/10 border-destructive/20"
                        : alert.priority === "alta"
                        ? "bg-muted border-muted-foreground/10"
                        : "bg-muted border-muted-foreground/10"
                    }`}
                  >
                    <p className={`text-sm font-medium ${
                      alert.priority === "critica" 
                        ? "text-destructive"
                        : alert.priority === "alta"
                        ? "text-muted-foreground"
                        : "text-muted-foreground"
                    }`}>
                      {alert.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge 
                        variant="secondary" 
                        className={`text-[10px] ${
                          alert.priority === "critica" 
                            ? "bg-destructive/20 text-destructive"
                            : alert.priority === "alta"
                            ? "bg-muted text-muted-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {alert.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(alert.createdAt)}</span>
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
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-4" />
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
    </div>
  );
}
