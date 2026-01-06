import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatsCard } from "@/components/StatsCard";
import { subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { formatDateShort, getTodayInTimezone, getDateKeyInTimezone, formatCurrency } from "@/lib/utils";
import type { Machine } from "@shared/schema";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Fuel,
  ShoppingCart,
  Wallet,
  AlertTriangle,
  FileText,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Building,
  Users,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Percent,
  Clock,
  CheckCircle,
  XCircle,
  Warehouse,
  MapPin,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

const COLORS = ['#E84545', '#2F6FED', '#4ECB71', '#8E59FF', '#FF6B3D', '#00C49F', '#FFBB28'];

const dateRanges = [
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes pasado" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "year", label: "Este año" },
];

const categoryLabels: Record<string, string> = {
  compra_rapida: "Compra Rápida",
  herramientas: "Herramientas",
  reparaciones: "Reparaciones",
  viaticos: "Viáticos",
  otros: "Otros",
};

const shrinkageTypeLabels: Record<string, string> = {
  caducidad: "Caducidad",
  danio: "Daño",
  robo: "Robo",
  otros: "Otros",
};

const movementTypeLabels: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  merma: "Merma",
};

function getDateRange(rangeValue: string): { startDate: Date; endDate: Date } {
  const today = getTodayInTimezone();
  let startDate: Date;
  let endDate = today;

  switch (rangeValue) {
    case "7d":
      startDate = subDays(today, 7);
      break;
    case "30d":
      startDate = subDays(today, 30);
      break;
    case "this_month":
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
      break;
    case "last_month":
      const lastMonth = subMonths(today, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      break;
    case "90d":
      startDate = subDays(today, 90);
      break;
    case "year":
      startDate = new Date(today.getFullYear(), 0, 1);
      break;
    default:
      startDate = subDays(today, 30);
  }

  return { startDate, endDate };
}

function calculateTrend(current: number, previous: number): { change: number; direction: 'up' | 'down' | 'neutral' } {
  if (previous === 0) return { change: 0, direction: 'neutral' };
  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  return { change: Math.abs(change), direction };
}

function TrendIndicator({ current, previous, inverted = false }: { current: number; previous: number; inverted?: boolean }) {
  if (previous === undefined || previous === null) return null;
  
  const { change, direction } = calculateTrend(current, previous);
  const isPositive = inverted ? direction === 'down' : direction === 'up';
  const color = direction === 'neutral' ? 'text-muted-foreground' : isPositive ? 'text-green-600' : 'text-red-600';
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  
  return (
    <div className="flex flex-col">
      <span className={`flex items-center gap-1 text-sm ${color}`} data-testid="trend-indicator">
        <Icon className="h-3 w-3" />
        <span>{change.toFixed(1)}%</span>
      </span>
      <span className="text-xs text-muted-foreground">vs período anterior</span>
    </div>
  );
}


export function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30d");
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedMachineId, setSelectedMachineId] = useState("all");
  const [salesGroupBy, setSalesGroupBy] = useState<string>("machine");
  const [purchasesGroupBy, setPurchasesGroupBy] = useState<string>("supplier");
  const [fuelGroupBy, setFuelGroupBy] = useState<string>("vehicle");
  const [pettyCashGroupBy, setPettyCashGroupBy] = useState<string>("category");
  const [movementType, setMovementType] = useState("all");
  const [productsLimit, setProductsLimit] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: allMachines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
    staleTime: 10 * 60 * 1000,
  });

  const filteredMachines = useMemo(() => {
    if (selectedZone === "all") return allMachines;
    return allMachines.filter((m) => m.zone === selectedZone);
  }, [allMachines, selectedZone]);

  const { startDateStr, endDateStr } = useMemo(() => {
    const { startDate, endDate } = getDateRange(dateRange);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return {
      startDateStr: start.toISOString(),
      endDateStr: end.toISOString(),
    };
  }, [dateRange]);

  const { previousStartDateStr, previousEndDateStr } = useMemo(() => {
    const { startDate, endDate } = getDateRange(dateRange);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousEnd.setHours(23, 59, 59, 999);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - periodDays + 1);
    previousStart.setHours(0, 0, 0, 0);
    
    return {
      previousStartDateStr: previousStart.toISOString(),
      previousEndDateStr: previousEnd.toISOString(),
    };
  }, [dateRange]);

  const { data: overview, isLoading: loadingOverview } = useQuery<any>({
    queryKey: ["/api/reports/overview", { startDate: startDateStr, endDate: endDateStr }],
    staleTime: 5 * 60 * 1000,
  });

  const { data: previousOverview } = useQuery<any>({
    queryKey: ["/api/reports/overview", { startDate: previousStartDateStr, endDate: previousEndDateStr }],
    enabled: activeTab === "overview" && !!previousStartDateStr && !!previousEndDateStr,
    staleTime: 5 * 60 * 1000,
  });

  const { data: salesBreakdown = [], isLoading: loadingSales } = useQuery<any[]>({
    queryKey: ["/api/reports/sales", { 
      startDate: startDateStr, 
      endDate: endDateStr, 
      groupBy: salesGroupBy,
      ...(selectedZone !== "all" && { zone: selectedZone }),
      ...(selectedMachineId !== "all" && { machineId: selectedMachineId }),
    }],
    enabled: activeTab === "sales" || activeTab === "overview",
    staleTime: 5 * 60 * 1000,
  });

  const { data: purchasesBreakdown = [], isLoading: loadingPurchases } = useQuery<any[]>({
    queryKey: ["/api/reports/purchases", { startDate: startDateStr, endDate: endDateStr, groupBy: purchasesGroupBy }],
    enabled: activeTab === "purchases" || activeTab === "overview",
    staleTime: 5 * 60 * 1000,
  });

  const { data: fuelBreakdown = [], isLoading: loadingFuel } = useQuery<any[]>({
    queryKey: ["/api/reports/fuel", { startDate: startDateStr, endDate: endDateStr, groupBy: fuelGroupBy }],
    enabled: activeTab === "fuel" || activeTab === "overview",
    staleTime: 5 * 60 * 1000,
  });

  const { data: pettyCashBreakdown = [], isLoading: loadingPettyCash } = useQuery<any[]>({
    queryKey: ["/api/reports/petty-cash", { startDate: startDateStr, endDate: endDateStr, groupBy: pettyCashGroupBy }],
    enabled: activeTab === "petty-cash" || activeTab === "overview",
    staleTime: 5 * 60 * 1000,
  });

  const { data: machinePerformance = [], isLoading: loadingMachines } = useQuery<any[]>({
    queryKey: ["/api/reports/machine-performance", { 
      startDate: startDateStr, 
      endDate: endDateStr,
      ...(selectedZone !== "all" && { zone: selectedZone }),
      ...(selectedMachineId !== "all" && { machineId: selectedMachineId }),
    }],
    enabled: activeTab === "machines",
    staleTime: 5 * 60 * 1000,
  });

  const { data: topProducts = [], isLoading: loadingProducts } = useQuery<any[]>({
    queryKey: ["/api/reports/top-products", { 
      startDate: startDateStr, 
      endDate: endDateStr, 
      limit: productsLimit.toString(),
      ...(selectedZone !== "all" && { zone: selectedZone }),
      ...(selectedMachineId !== "all" && { machineId: selectedMachineId }),
    }],
    enabled: activeTab === "products" || activeTab === "overview",
    staleTime: 5 * 60 * 1000,
  });

  const { data: supplierRanking = [], isLoading: loadingSuppliers } = useQuery<any[]>({
    queryKey: ["/api/reports/supplier-ranking", { startDate: startDateStr, endDate: endDateStr }],
    enabled: activeTab === "suppliers",
    staleTime: 5 * 60 * 1000,
  });

  const { data: warehouseMovements = [], isLoading: loadingWarehouse } = useQuery<any[]>({
    queryKey: ["/api/warehouse/movements", { startDate: startDateStr, endDate: endDateStr }],
    enabled: activeTab === "warehouse",
    staleTime: 5 * 60 * 1000,
  });

  const { data: shrinkageRecords = [], isLoading: loadingShrinkage } = useQuery<any[]>({
    queryKey: ["/api/shrinkage", { startDate: startDateStr, endDate: endDateStr }],
    enabled: activeTab === "shrinkage",
    staleTime: 5 * 60 * 1000,
  });

  const { data: shrinkageSummary } = useQuery<any>({
    queryKey: ["/api/shrinkage/summary", { startDate: startDateStr, endDate: endDateStr }],
    enabled: activeTab === "shrinkage",
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/reports');
        }
      });
      toast({
        title: "Datos actualizados",
        description: "Los reportes se han actualizado correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron actualizar los datos",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = async (type: 'sales' | 'purchases' | 'fuel' | 'pettycash' | 'inventory') => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/reports/export?type=${type}&startDate=${startDateStr}&endDate=${endDateStr}`
      );
      
      if (!response.ok) {
        throw new Error("Error al obtener datos");
      }
      
      const data = await response.json();
      
      if (data.length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay datos para exportar en el período seleccionado",
          variant: "destructive",
        });
        return;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(","),
        ...data.map((row: any) => headers.map(h => `"${row[h] || ''}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte_${type}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Exportación completada",
        description: `Se exportaron ${data.length} registros`,
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Error de exportación",
        description: "No se pudo exportar el archivo. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredSalesBreakdown = useMemo(() => {
    if (selectedZone === "all" && selectedMachineId === "all") return salesBreakdown;
    
    const machineIdsInZone = selectedZone !== "all" 
      ? new Set(allMachines.filter(m => m.zone === selectedZone).map(m => m.id))
      : null;
    
    return salesBreakdown.filter(item => {
      if (selectedMachineId !== "all") {
        return item.machineId === selectedMachineId || item.machine?.id === selectedMachineId;
      }
      if (machineIdsInZone) {
        return machineIdsInZone.has(item.machineId) || machineIdsInZone.has(item.machine?.id);
      }
      return true;
    });
  }, [salesBreakdown, selectedZone, selectedMachineId, allMachines]);

  const filteredMachinePerformance = useMemo(() => {
    if (selectedZone === "all" && selectedMachineId === "all") return machinePerformance;
    
    return machinePerformance.filter(item => {
      if (selectedMachineId !== "all") {
        return item.machine?.id === selectedMachineId;
      }
      if (selectedZone !== "all") {
        return item.machine?.zone === selectedZone;
      }
      return true;
    });
  }, [machinePerformance, selectedZone, selectedMachineId]);

  const filteredTopProducts = useMemo(() => {
    if (selectedZone === "all" && selectedMachineId === "all") return topProducts;
    return topProducts;
  }, [topProducts, selectedZone, selectedMachineId]);

  const displayedTopProducts = useMemo(() => {
    return filteredTopProducts.slice(0, productsLimit);
  }, [filteredTopProducts, productsLimit]);

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingOverview ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <Card className="hover-elevate" data-testid="card-total-sales">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Ventas Totales</p>
                    <p className="text-2xl font-bold">{formatCurrency(overview?.totalSales || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{`${Math.abs(overview?.profitMargin || 0).toFixed(1)}% margen`}</p>
                    {previousOverview && (
                      <div className="mt-2">
                        <TrendIndicator 
                          current={overview?.totalSales || 0} 
                          previous={previousOverview?.totalSales || 0} 
                          inverted={false}
                        />
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg p-2 bg-green-500/10">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate" data-testid="card-total-purchases">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Compras</p>
                    <p className="text-2xl font-bold">{formatCurrency(overview?.totalPurchases || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{`${overview?.pendingOrders || 0} pendientes`}</p>
                    {previousOverview && (
                      <div className="mt-2">
                        <TrendIndicator 
                          current={overview?.totalPurchases || 0} 
                          previous={previousOverview?.totalPurchases || 0} 
                          inverted={true}
                        />
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg p-2 bg-primary/10">
                    <ShoppingCart className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate" data-testid="card-total-fuel">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Combustible</p>
                    <p className="text-2xl font-bold">{formatCurrency(overview?.totalFuelCost || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Gasto operativo</p>
                    {previousOverview && (
                      <div className="mt-2">
                        <TrendIndicator 
                          current={overview?.totalFuelCost || 0} 
                          previous={previousOverview?.totalFuelCost || 0} 
                          inverted={true}
                        />
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg p-2 bg-yellow-500/10">
                    <Fuel className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate" data-testid="card-total-pettycash">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Caja Chica</p>
                    <p className="text-2xl font-bold">{formatCurrency(overview?.totalPettyCash || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{`${overview?.pendingExpenses || 0} pendientes`}</p>
                    {previousOverview && (
                      <div className="mt-2">
                        <TrendIndicator 
                          current={overview?.totalPettyCash || 0} 
                          previous={previousOverview?.totalPettyCash || 0} 
                          inverted={true}
                        />
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg p-2 bg-purple-500/10">
                    <Wallet className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingOverview ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Card className="hover-elevate" data-testid="card-machines-count">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Máquinas</p>
                    <p className="text-2xl font-bold">{overview?.machineCount || 0}</p>
                  </div>
                  <Building className="h-8 w-8 text-primary opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate" data-testid="card-routes-count">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Rutas Activas</p>
                    <p className="text-2xl font-bold">{overview?.activeRoutes || 0}</p>
                  </div>
                  <Truck className="h-8 w-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate" data-testid="card-products-count">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Productos</p>
                    <p className="text-2xl font-bold">{overview?.productCount || 0}</p>
                  </div>
                  <Package className="h-8 w-8 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate" data-testid="card-alerts-count">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Alertas Stock</p>
                    <p className="text-2xl font-bold">{overview?.lowStockAlerts || 0}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-sales-trend">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tendencia de Ventas
            </CardTitle>
            <CardDescription>Ventas por período</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSales ? (
              <Skeleton className="h-64" />
            ) : filteredSalesBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={filteredSalesBreakdown.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey={salesGroupBy === 'day' ? 'date' : 'machine.code'} 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => label}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalAmount" 
                    stroke="#E84545" 
                    fill="#E84545" 
                    fillOpacity={0.3}
                    name="Ventas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No hay datos de ventas en este período
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-top-products">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-500" />
              Productos Más Vendidos
            </CardTitle>
            <CardDescription>Top 5 por monto</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <Skeleton className="h-64" />
            ) : filteredTopProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={filteredTopProducts.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis 
                    type="category" 
                    dataKey="product.name" 
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="totalAmount" fill="#4ECB71" name="Ventas" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No hay datos de productos vendidos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-purchases-breakdown">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-500" />
              Compras por Proveedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPurchases ? (
              <Skeleton className="h-64" />
            ) : purchasesBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={purchasesBreakdown}
                    dataKey="totalAmount"
                    nameKey="supplier.name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ supplier, percent }) => 
                      `${supplier?.name?.slice(0, 10) || ''}... ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {purchasesBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No hay datos de compras
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-petty-cash-breakdown">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-500" />
              Caja Chica por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPettyCash ? (
              <Skeleton className="h-64" />
            ) : pettyCashBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pettyCashBreakdown}
                    dataKey="totalAmount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, percent }) => 
                      `${categoryLabels[category] || category} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pettyCashBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => categoryLabels[label] || label}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No hay gastos de caja chica
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderSalesTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={salesGroupBy} onValueChange={setSalesGroupBy}>
          <SelectTrigger className="w-48" data-testid="select-sales-group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="machine" data-testid="option-sales-machine">Por Máquina</SelectItem>
            <SelectItem value="product" data-testid="option-sales-product">Por Producto</SelectItem>
            <SelectItem value="day" data-testid="option-sales-day">Por Día</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => handleExport("sales")}
          disabled={isExporting}
          data-testid="button-export-sales"
        >
          <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </div>

      <Card data-testid="card-sales-chart">
        <CardHeader>
          <CardTitle>Desglose de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSales ? (
            <Skeleton className="h-80" />
          ) : salesBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={salesBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={
                    salesGroupBy === 'day' ? 'date' : 
                    salesGroupBy === 'machine' ? 'machine.code' : 
                    'product.name'
                  } 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="totalAmount" fill="#E84545" name="Monto" radius={[4, 4, 0, 0]} />
                <Bar dataKey="quantity" fill="#2F6FED" name="Cantidad" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay ventas en este período
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-sales-table">
        <CardHeader>
          <CardTitle>Detalle de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">
                    {salesGroupBy === 'machine' ? 'Máquina' : salesGroupBy === 'product' ? 'Producto' : 'Fecha'}
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Cantidad</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {loadingSales ? (
                  <tr><td colSpan={3}>{renderLoadingSkeleton()}</td></tr>
                ) : filteredSalesBreakdown.length > 0 ? (
                  filteredSalesBreakdown.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-sales-${index}`}>
                      <td className="py-3 px-2">
                        {salesGroupBy === 'machine' ? (
                          <div>
                            <p className="font-medium">{item.machine?.code || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{item.machine?.name}</p>
                          </div>
                        ) : salesGroupBy === 'product' ? (
                          <div>
                            <p className="font-medium">{item.product?.name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{item.product?.code}</p>
                          </div>
                        ) : (
                          <p className="font-medium">{formatDateShort(item.date)}</p>
                        )}
                      </td>
                      <td className="text-right py-3 px-2">{item.quantity}</td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-muted-foreground">
                      No hay ventas en este período
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredSalesBreakdown.length > 0 && !loadingSales && (
                <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm font-semibold">
                  <tr className="border-t-2">
                    <td className="py-3 px-2">TOTAL</td>
                    <td className="text-right py-3 px-2">
                      {filteredSalesBreakdown.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {formatCurrency(filteredSalesBreakdown.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderPurchasesTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={purchasesGroupBy} onValueChange={setPurchasesGroupBy}>
          <SelectTrigger className="w-48" data-testid="select-purchases-group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="supplier" data-testid="option-purchases-supplier">Por Proveedor</SelectItem>
            <SelectItem value="day" data-testid="option-purchases-day">Por Día</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => handleExport("purchases")}
          disabled={isExporting}
          data-testid="button-export-purchases"
        >
          <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </div>

      <Card data-testid="card-purchases-chart">
        <CardHeader>
          <CardTitle>Desglose de Compras</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPurchases ? (
            <Skeleton className="h-80" />
          ) : purchasesBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={purchasesBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={purchasesGroupBy === 'day' ? 'date' : 'supplier.name'} 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="totalAmount" fill="#2F6FED" name="Monto" radius={[4, 4, 0, 0]} />
                <Bar dataKey="orderCount" fill="#8E59FF" name="Órdenes" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay compras en este período
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-purchases-table">
        <CardHeader>
          <CardTitle>Detalle de Compras</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">
                    {purchasesGroupBy === 'supplier' ? 'Proveedor' : 'Fecha'}
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Órdenes</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {loadingPurchases ? (
                  <tr><td colSpan={3}>{renderLoadingSkeleton()}</td></tr>
                ) : purchasesBreakdown.length > 0 ? (
                  purchasesBreakdown.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-purchases-${index}`}>
                      <td className="py-3 px-2">
                        {purchasesGroupBy === 'supplier' ? (
                          <div>
                            <p className="font-medium">{item.supplier?.name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{item.supplier?.code}</p>
                          </div>
                        ) : (
                          <p className="font-medium">{formatDateShort(item.date)}</p>
                        )}
                      </td>
                      <td className="text-right py-3 px-2">{item.orderCount}</td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-muted-foreground">
                      No hay compras en este período
                    </td>
                  </tr>
                )}
              </tbody>
              {purchasesBreakdown.length > 0 && !loadingPurchases && (
                <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm font-semibold">
                  <tr className="border-t-2">
                    <td className="py-3 px-2">TOTAL</td>
                    <td className="text-right py-3 px-2">
                      {purchasesBreakdown.reduce((sum, item) => sum + (item.orderCount || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {formatCurrency(purchasesBreakdown.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderFuelTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={fuelGroupBy} onValueChange={setFuelGroupBy}>
          <SelectTrigger className="w-48" data-testid="select-fuel-group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vehicle" data-testid="option-fuel-vehicle">Por Vehículo</SelectItem>
            <SelectItem value="user" data-testid="option-fuel-user">Por Usuario</SelectItem>
            <SelectItem value="day" data-testid="option-fuel-day">Por Día</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => handleExport("fuel")}
          disabled={isExporting}
          data-testid="button-export-fuel"
        >
          <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </div>

      <Card data-testid="card-fuel-chart">
        <CardHeader>
          <CardTitle>Consumo de Combustible</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFuel ? (
            <Skeleton className="h-80" />
          ) : fuelBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={fuelBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={
                    fuelGroupBy === 'day' ? 'date' : 
                    fuelGroupBy === 'vehicle' ? 'vehicle.plate' : 
                    'user.fullName'
                  } 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number, name: string) => 
                  name === 'Monto' ? formatCurrency(value) : `${value.toFixed(1)} L`
                } />
                <Legend />
                <Bar yAxisId="left" dataKey="totalAmount" fill="#FF6B3D" name="Monto" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="totalLiters" fill="#4ECB71" name="Litros" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay registros de combustible en este período
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-fuel-table">
        <CardHeader>
          <CardTitle>Detalle de Combustible</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">
                    {fuelGroupBy === 'vehicle' ? 'Vehículo' : fuelGroupBy === 'user' ? 'Usuario' : 'Fecha'}
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Cargas</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Litros</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {loadingFuel ? (
                  <tr><td colSpan={4}>{renderLoadingSkeleton()}</td></tr>
                ) : fuelBreakdown.length > 0 ? (
                  fuelBreakdown.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-fuel-${index}`}>
                      <td className="py-3 px-2">
                        {fuelGroupBy === 'vehicle' ? (
                          <div>
                            <p className="font-medium">{item.vehicle?.plate || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{item.vehicle?.brand} {item.vehicle?.model}</p>
                          </div>
                        ) : fuelGroupBy === 'user' ? (
                          <p className="font-medium">{item.user?.fullName || item.user?.username || 'N/A'}</p>
                        ) : (
                          <p className="font-medium">{formatDateShort(item.date)}</p>
                        )}
                      </td>
                      <td className="text-right py-3 px-2">{item.recordCount}</td>
                      <td className="text-right py-3 px-2">{item.totalLiters?.toFixed(1)} L</td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No hay registros de combustible en este período
                    </td>
                  </tr>
                )}
              </tbody>
              {fuelBreakdown.length > 0 && !loadingFuel && (
                <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm font-semibold">
                  <tr className="border-t-2">
                    <td className="py-3 px-2">TOTAL</td>
                    <td className="text-right py-3 px-2">
                      {fuelBreakdown.reduce((sum, item) => sum + (item.recordCount || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {fuelBreakdown.reduce((sum, item) => sum + (item.totalLiters || 0), 0).toFixed(1)} L
                    </td>
                    <td className="text-right py-3 px-2">
                      {formatCurrency(fuelBreakdown.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderPettyCashTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={pettyCashGroupBy} onValueChange={setPettyCashGroupBy}>
          <SelectTrigger className="w-48" data-testid="select-pettycash-group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category" data-testid="option-pettycash-category">Por Categoría</SelectItem>
            <SelectItem value="user" data-testid="option-pettycash-user">Por Usuario</SelectItem>
            <SelectItem value="day" data-testid="option-pettycash-day">Por Día</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => handleExport("pettycash")}
          disabled={isExporting}
          data-testid="button-export-pettycash"
        >
          <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </div>

      <Card data-testid="card-pettycash-chart">
        <CardHeader>
          <CardTitle>Gastos de Caja Chica</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPettyCash ? (
            <Skeleton className="h-80" />
          ) : pettyCashBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={pettyCashBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={
                    pettyCashGroupBy === 'day' ? 'date' : 
                    pettyCashGroupBy === 'category' ? 'category' : 
                    'user.fullName'
                  } 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => categoryLabels[value] || value}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => categoryLabels[label] || label}
                />
                <Legend />
                <Bar dataKey="totalAmount" fill="#8E59FF" name="Monto" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenseCount" fill="#00C49F" name="Gastos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay gastos de caja chica en este período
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-pettycash-table">
        <CardHeader>
          <CardTitle>Detalle de Caja Chica</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">
                    {pettyCashGroupBy === 'category' ? 'Categoría' : pettyCashGroupBy === 'user' ? 'Usuario' : 'Fecha'}
                  </th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Gastos</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {loadingPettyCash ? (
                  <tr><td colSpan={3}>{renderLoadingSkeleton()}</td></tr>
                ) : pettyCashBreakdown.length > 0 ? (
                  pettyCashBreakdown.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-pettycash-${index}`}>
                      <td className="py-3 px-2">
                        {pettyCashGroupBy === 'category' ? (
                          <Badge variant="outline">{categoryLabels[item.category] || item.category}</Badge>
                        ) : pettyCashGroupBy === 'user' ? (
                          <p className="font-medium">{item.user?.fullName || item.user?.username || 'N/A'}</p>
                        ) : (
                          <p className="font-medium">{formatDateShort(item.date)}</p>
                        )}
                      </td>
                      <td className="text-right py-3 px-2">{item.expenseCount}</td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-muted-foreground">
                      No hay gastos de caja chica en este período
                    </td>
                  </tr>
                )}
              </tbody>
              {pettyCashBreakdown.length > 0 && !loadingPettyCash && (
                <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm font-semibold">
                  <tr className="border-t-2">
                    <td className="py-3 px-2">TOTAL</td>
                    <td className="text-right py-3 px-2">
                      {pettyCashBreakdown.reduce((sum, item) => sum + (item.expenseCount || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {formatCurrency(pettyCashBreakdown.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderProductsTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="outline"
          onClick={() => handleExport("inventory")}
          disabled={isExporting}
          data-testid="button-export-inventory"
        >
          <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? "Exportando..." : "Exportar Inventario CSV"}
        </Button>
      </div>

      <Card data-testid="card-top-products-chart">
        <CardHeader>
          <CardTitle>Top {productsLimit} Productos</CardTitle>
          <CardDescription>Por monto total de ventas</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingProducts ? (
            <Skeleton className="h-80" />
          ) : displayedTopProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={displayedTopProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis 
                  type="category" 
                  dataKey="product.name" 
                  width={150}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(value: number, name: string) => 
                  name === 'Ventas' ? formatCurrency(value) : value
                } />
                <Legend />
                <Bar dataKey="totalAmount" fill="#E84545" name="Ventas" radius={[0, 4, 4, 0]} />
                <Bar dataKey="quantity" fill="#4ECB71" name="Cantidad" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay datos de productos
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-products-table">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Detalle por Producto</CardTitle>
            <CardDescription>Mostrando {displayedTopProducts.length} productos</CardDescription>
          </div>
          <div className="flex gap-2">
            {productsLimit > 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductsLimit(10)}
                data-testid="button-products-show-less"
              >
                Ver menos
              </Button>
            )}
            {displayedTopProducts.length === productsLimit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductsLimit(prev => prev + 10)}
                data-testid="button-products-show-more"
              >
                Ver más
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Producto</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Cantidad Vendida</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Total Ventas</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Promedio/Unidad</th>
                </tr>
              </thead>
              <tbody>
                {loadingProducts ? (
                  <tr><td colSpan={4}>{renderLoadingSkeleton()}</td></tr>
                ) : displayedTopProducts.length > 0 ? (
                  displayedTopProducts.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-product-${index}`}>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{item.product?.name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{item.product?.code}</p>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2">{item.quantity}</td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(item.totalAmount)}</td>
                      <td className="text-right py-3 px-2">
                        {item.quantity > 0 ? formatCurrency(item.totalAmount / item.quantity) : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No hay datos de productos
                    </td>
                  </tr>
                )}
              </tbody>
              {displayedTopProducts.length > 0 && !loadingProducts && (
                <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm font-semibold">
                  <tr className="border-t-2">
                    <td className="py-3 px-2">TOTAL</td>
                    <td className="text-right py-3 px-2">
                      {displayedTopProducts.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {formatCurrency(displayedTopProducts.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}
                    </td>
                    <td className="text-right py-3 px-2">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderMachinesTab = () => (
    <div className="space-y-6">
      <Card data-testid="card-machine-performance">
        <CardHeader>
          <CardTitle>Rendimiento de Máquinas</CardTitle>
          <CardDescription>Ventas y alertas por máquina</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMachines ? (
            <Skeleton className="h-80" />
          ) : filteredMachinePerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={filteredMachinePerformance.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="machine.code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number, name: string) => 
                  name === 'Ventas' ? formatCurrency(value) : value
                } />
                <Legend />
                <Bar dataKey="totalSales" fill="#E84545" name="Ventas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="transactionCount" fill="#2F6FED" name="Transacciones" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay datos de máquinas
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-machines-table">
        <CardHeader>
          <CardTitle>Detalle por Máquina</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Máquina</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Transacciones</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Unidades</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Ventas</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Promedio</th>
                  <th className="text-center py-3 px-2 text-sm font-medium">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {loadingMachines ? (
                  <tr><td colSpan={6}>{renderLoadingSkeleton()}</td></tr>
                ) : filteredMachinePerformance.length > 0 ? (
                  filteredMachinePerformance.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-machine-${index}`}>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{item.machine?.code || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{item.machine?.name}</p>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2">{item.transactionCount}</td>
                      <td className="text-right py-3 px-2">{item.totalQuantity}</td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(item.totalSales)}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(item.avgTransactionValue)}</td>
                      <td className="text-center py-3 px-2">
                        {item.activeAlerts > 0 ? (
                          <Badge variant="destructive">{item.activeAlerts}</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700">0</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay datos de máquinas
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredMachinePerformance.length > 0 && !loadingMachines && (
                <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm font-semibold">
                  <tr className="border-t-2">
                    <td className="py-3 px-2">TOTAL</td>
                    <td className="text-right py-3 px-2">
                      {filteredMachinePerformance.reduce((sum, item) => sum + (item.transactionCount || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {filteredMachinePerformance.reduce((sum, item) => sum + (item.totalQuantity || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {formatCurrency(filteredMachinePerformance.reduce((sum, item) => sum + (item.totalSales || 0), 0))}
                    </td>
                    <td className="text-right py-3 px-2">-</td>
                    <td className="text-center py-3 px-2">
                      <Badge variant="outline">
                        {filteredMachinePerformance.reduce((sum, item) => sum + (item.activeAlerts || 0), 0)}
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderSuppliersTab = () => (
    <div className="space-y-6">
      <Card data-testid="card-supplier-ranking">
        <CardHeader>
          <CardTitle>Ranking de Proveedores</CardTitle>
          <CardDescription>Por monto total de compras</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSuppliers ? (
            <Skeleton className="h-80" />
          ) : supplierRanking.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={supplierRanking} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis 
                  type="category" 
                  dataKey="supplier.name" 
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(value: number, name: string) => 
                  name === 'Monto' ? formatCurrency(value) : `${value}%`
                } />
                <Legend />
                <Bar dataKey="totalAmount" fill="#2F6FED" name="Monto" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay datos de proveedores
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-suppliers-table">
        <CardHeader>
          <CardTitle>Detalle de Proveedores</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Proveedor</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Órdenes</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Recibidas</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Cumplimiento</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {loadingSuppliers ? (
                  <tr><td colSpan={5}>{renderLoadingSkeleton()}</td></tr>
                ) : supplierRanking.length > 0 ? (
                  supplierRanking.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-supplier-${index}`}>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{item.supplier?.name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{item.supplier?.code}</p>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2">{item.orderCount}</td>
                      <td className="text-right py-3 px-2">{item.receivedCount}</td>
                      <td className="text-right py-3 px-2">
                        <Badge 
                          variant={item.fulfillmentRate >= 90 ? "default" : item.fulfillmentRate >= 70 ? "secondary" : "destructive"}
                          className={item.fulfillmentRate >= 90 ? "bg-green-100 text-green-800" : ""}
                        >
                          {item.fulfillmentRate}%
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-2 font-medium">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay datos de proveedores
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const filteredWarehouseMovements = useMemo(() => {
    if (movementType === "all") return warehouseMovements;
    return warehouseMovements.filter((m: any) => m.movementType === movementType);
  }, [warehouseMovements, movementType]);

  const warehouseChartData = useMemo(() => {
    const grouped: Record<string, { type: string; count: number; totalCost: number }> = {};
    warehouseMovements.forEach((m: any) => {
      const type = m.movementType || 'otros';
      if (!grouped[type]) {
        grouped[type] = { type: movementTypeLabels[type] || type, count: 0, totalCost: 0 };
      }
      grouped[type].count += 1;
      grouped[type].totalCost += parseFloat(m.cost || 0);
    });
    return Object.values(grouped);
  }, [warehouseMovements]);

  const shrinkageChartData = useMemo(() => {
    // Usar datos del summary si están disponibles (pre-agrupados por el backend)
    if (shrinkageSummary?.byType && Object.keys(shrinkageSummary.byType).length > 0) {
      return Object.entries(shrinkageSummary.byType).map(([type, data]: [string, any]) => ({
        type: shrinkageTypeLabels[type] || type,
        count: data.count || 0,
        totalCost: data.cost || 0,
        quantity: data.quantity || 0,
      }));
    }
    // Fallback: agrupar desde los registros individuales
    const grouped: Record<string, { type: string; count: number; totalCost: number; quantity: number }> = {};
    shrinkageRecords.forEach((s: any) => {
      const type = s.shrinkageType || 'otros';
      if (!grouped[type]) {
        grouped[type] = { type: shrinkageTypeLabels[type] || type, count: 0, totalCost: 0, quantity: 0 };
      }
      grouped[type].count += 1;
      grouped[type].totalCost += parseFloat(s.totalLoss || 0);
      grouped[type].quantity += s.quantity || 0;
    });
    return Object.values(grouped);
  }, [shrinkageRecords, shrinkageSummary]);

  const renderWarehouseTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={movementType} onValueChange={setMovementType}>
          <SelectTrigger className="w-48" data-testid="select-movement-type">
            <SelectValue placeholder="Tipo de movimiento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-movement-all">Todos</SelectItem>
            <SelectItem value="entrada" data-testid="option-movement-entrada">Entrada</SelectItem>
            <SelectItem value="salida" data-testid="option-movement-salida">Salida</SelectItem>
            <SelectItem value="ajuste" data-testid="option-movement-ajuste">Ajuste</SelectItem>
            <SelectItem value="merma" data-testid="option-movement-merma">Merma</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => handleExport("inventory")}
          disabled={isExporting}
          data-testid="button-export-warehouse"
        >
          <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </div>

      <Card data-testid="card-warehouse-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" />
            Movimientos por Tipo
          </CardTitle>
          <CardDescription>Distribución de movimientos de inventario</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingWarehouse ? (
            <Skeleton className="h-80" />
          ) : warehouseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={warehouseChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number, name: string) => 
                  name === 'Costo' ? formatCurrency(value) : value
                } />
                <Legend />
                <Bar dataKey="count" fill="#2F6FED" name="Cantidad" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalCost" fill="#4ECB71" name="Costo" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay movimientos de almacén en este período
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-warehouse-table">
        <CardHeader>
          <CardTitle>Detalle de Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Fecha</th>
                  <th className="text-left py-3 px-2 text-sm font-medium">Producto</th>
                  <th className="text-left py-3 px-2 text-sm font-medium">Tipo</th>
                  <th className="text-left py-3 px-2 text-sm font-medium">Lote</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Cantidad</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Costo</th>
                  <th className="text-left py-3 px-2 text-sm font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {loadingWarehouse ? (
                  <tr><td colSpan={7}>{renderLoadingSkeleton()}</td></tr>
                ) : filteredWarehouseMovements.length > 0 ? (
                  filteredWarehouseMovements.map((item: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-warehouse-${index}`}>
                      <td className="py-3 px-2">{formatDateShort(item.date || item.createdAt)}</td>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{item.product?.name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{item.product?.code}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={
                          item.movementType === 'entrada' ? 'default' :
                          item.movementType === 'salida' ? 'secondary' :
                          item.movementType === 'merma' ? 'destructive' : 'outline'
                        }>
                          {movementTypeLabels[item.movementType] || item.movementType}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">{item.lotNumber || item.lot?.lotNumber || '-'}</td>
                      <td className="text-right py-3 px-2">{item.quantity}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(item.cost || 0)}</td>
                      <td className="py-3 px-2">{item.user?.fullName || item.user?.username || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay movimientos de almacén en este período
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredWarehouseMovements.length > 0 && !loadingWarehouse && (
                <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm font-semibold">
                  <tr className="border-t-2">
                    <td className="py-3 px-2" colSpan={4}>TOTAL</td>
                    <td className="text-right py-3 px-2">
                      {filteredWarehouseMovements.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {formatCurrency(filteredWarehouseMovements.reduce((sum: number, item: any) => sum + parseFloat(item.cost || 0), 0))}
                    </td>
                    <td className="py-3 px-2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderShrinkageTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Mermas"
          value={shrinkageSummary?.totalRecords || 0}
          icon={AlertTriangle}
          iconColor="warning"
          subtitle="Registros"
        />
        <StatsCard
          title="Costo Total"
          value={formatCurrency(shrinkageSummary?.totalCost || 0)}
          icon={DollarSign}
          iconColor="primary"
          subtitle="Pérdidas"
        />
        <StatsCard
          title="Unidades Perdidas"
          value={shrinkageSummary?.totalQuantity || 0}
          icon={Package}
          iconColor="purple"
          subtitle="Productos"
        />
        <StatsCard
          title="Pendientes"
          value={shrinkageSummary?.pendingCount || 0}
          icon={Clock}
          iconColor="warning"
          subtitle="Por aprobar"
        />
      </div>

      <Card data-testid="card-shrinkage-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Distribución por Tipo de Merma
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingShrinkage ? (
            <Skeleton className="h-80" />
          ) : shrinkageChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={shrinkageChartData}
                  dataKey="totalCost"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {shrinkageChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No hay registros de mermas en este período
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-shrinkage-table">
        <CardHeader>
          <CardTitle>Registros de Mermas</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <table className="w-full">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Fecha</th>
                  <th className="text-left py-3 px-2 text-sm font-medium">Producto</th>
                  <th className="text-left py-3 px-2 text-sm font-medium">Tipo</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Cantidad</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Costo</th>
                  <th className="text-center py-3 px-2 text-sm font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loadingShrinkage ? (
                  <tr><td colSpan={6}>{renderLoadingSkeleton()}</td></tr>
                ) : shrinkageRecords.length > 0 ? (
                  shrinkageRecords.map((item: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-muted/50" data-testid={`row-shrinkage-${index}`}>
                      <td className="py-3 px-2">{formatDateShort(item.date || item.createdAt)}</td>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{item.product?.name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{item.product?.code}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={
                          item.shrinkageType === 'caducidad' ? 'secondary' :
                          item.shrinkageType === 'robo' ? 'destructive' :
                          item.shrinkageType === 'danio' ? 'outline' : 'default'
                        }>
                          {shrinkageTypeLabels[item.shrinkageType] || item.shrinkageType}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-2">{item.quantity}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(item.totalLoss || 0)}</td>
                      <td className="text-center py-3 px-2">
                        <Badge variant={
                          item.status === 'aprobado' ? 'default' :
                          item.status === 'rechazado' ? 'destructive' : 'secondary'
                        } className={item.status === 'aprobado' ? 'bg-green-100 text-green-800' : ''}>
                          {item.status === 'aprobado' ? 'Aprobado' : 
                           item.status === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay registros de mermas en este período
                    </td>
                  </tr>
                )}
              </tbody>
              {shrinkageRecords.length > 0 && !loadingShrinkage && (
                <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur-sm font-semibold">
                  <tr className="border-t-2">
                    <td className="py-3 px-2" colSpan={3}>TOTAL</td>
                    <td className="text-right py-3 px-2">
                      {shrinkageRecords.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2">
                      {formatCurrency(shrinkageRecords.reduce((sum: number, item: any) => sum + parseFloat(item.totalLoss || 0), 0))}
                    </td>
                    <td className="py-3 px-2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <BarChart3 className="h-7 w-7 text-primary" />
              Reportes Generales
            </h1>
            <p className="text-muted-foreground">Análisis consolidado de operaciones</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48" data-testid="select-date-range">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRanges.map((range) => (
                  <SelectItem key={range.value} value={range.value} data-testid={`option-range-${range.value}`}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={selectedZone} 
              onValueChange={(val) => {
                setSelectedZone(val);
                setSelectedMachineId("all");
              }}
            >
              <SelectTrigger className="w-36" data-testid="select-zone">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-zone-all">Todas las zonas</SelectItem>
                <SelectItem value="Norte" data-testid="option-zone-norte">Norte</SelectItem>
                <SelectItem value="Sur" data-testid="option-zone-sur">Sur</SelectItem>
                <SelectItem value="Este" data-testid="option-zone-este">Este</SelectItem>
                <SelectItem value="Oeste" data-testid="option-zone-oeste">Oeste</SelectItem>
                <SelectItem value="Centro" data-testid="option-zone-centro">Centro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
              <SelectTrigger className="w-48" data-testid="select-machine">
                <Building className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Máquina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-machine-all">Todas las máquinas</SelectItem>
                {filteredMachines.map((machine) => (
                  <SelectItem 
                    key={machine.id} 
                    value={machine.id}
                    data-testid={`option-machine-${machine.id}`}
                  >
                    {machine.code} - {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="overview" data-testid="tab-overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="sales" data-testid="tab-sales" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Ventas</span>
            </TabsTrigger>
            <TabsTrigger value="purchases" data-testid="tab-purchases" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Compras</span>
            </TabsTrigger>
            <TabsTrigger value="fuel" data-testid="tab-fuel" className="flex items-center gap-2">
              <Fuel className="h-4 w-4" />
              <span className="hidden sm:inline">Combustible</span>
            </TabsTrigger>
            <TabsTrigger value="petty-cash" data-testid="tab-petty-cash" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Caja Chica</span>
            </TabsTrigger>
            <TabsTrigger value="machines" data-testid="tab-machines" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Máquinas</span>
            </TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Productos</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" data-testid="tab-suppliers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Proveedores</span>
            </TabsTrigger>
            <TabsTrigger value="warehouse" data-testid="tab-warehouse" className="flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              <span className="hidden sm:inline">Almacén/Kardex</span>
            </TabsTrigger>
            <TabsTrigger value="shrinkage" data-testid="tab-shrinkage" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Mermas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" data-testid="content-overview">
            {renderOverviewTab()}
          </TabsContent>
          <TabsContent value="sales" data-testid="content-sales">
            {renderSalesTab()}
          </TabsContent>
          <TabsContent value="purchases" data-testid="content-purchases">
            {renderPurchasesTab()}
          </TabsContent>
          <TabsContent value="fuel" data-testid="content-fuel">
            {renderFuelTab()}
          </TabsContent>
          <TabsContent value="petty-cash" data-testid="content-petty-cash">
            {renderPettyCashTab()}
          </TabsContent>
          <TabsContent value="machines" data-testid="content-machines">
            {renderMachinesTab()}
          </TabsContent>
          <TabsContent value="products" data-testid="content-products">
            {renderProductsTab()}
          </TabsContent>
          <TabsContent value="suppliers" data-testid="content-suppliers">
            {renderSuppliersTab()}
          </TabsContent>
          <TabsContent value="warehouse" data-testid="content-warehouse">
            {renderWarehouseTab()}
          </TabsContent>
          <TabsContent value="shrinkage" data-testid="content-shrinkage">
            {renderShrinkageTab()}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

export default ReportsPage;
