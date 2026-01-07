import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, Column } from "@/components/DataTable";
import { StatsCard } from "@/components/StatsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Calendar,
  Download,
  Filter,
  FileCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#2F6FED", "#8E59FF", "#4ECB71", "#FF6B3D", "#6B7280"];

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();
  let startDate: Date;

  switch (period) {
    case "week":
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case "month":
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case "quarter":
      startDate = new Date(now.setMonth(now.getMonth() - 3));
      break;
    case "year":
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    default:
      startDate = new Date(now.setMonth(now.getMonth() - 1));
  }

  return { startDate: startDate.toISOString(), endDate };
}

interface MachineSale {
  id: string;
  machine: string;
  code: string;
  location: string;
  today: number;
  week: number;
  month: number;
  total: number;
  status: "up" | "down";
  transacciones: number;
}

interface ExpenseItem {
  id: string;
  fuente: string;
  concepto: string;
  category: string;
  amount: number;
  date: string;
  status: string;
}

interface AccountingOverview {
  totalIngresos: number;
  totalGastos: number;
  utilidadNeta: number;
  margen: number;
  transacciones: number;
  promedioTicket: number;
  tendenciaIngresos: number;
  tendenciaGastos: number;
  monthlyData: { month: string; ventas: number; gastos: number }[];
  categoryData: { name: string; value: number }[];
}

interface CashCutReport {
  totalRecolectado: number;
  totalEsperado: number;
  diferencia: number;
  detallePorMaquina: { machineId: string; machine: string; recolectado: number; esperado: number; diferencia: number }[];
  detallePorAbastecedor: { userId: string; abastecedor: string; recolectado: number; esperado: number; diferencia: number; maquinas: number }[];
}

export function AccountingPage() {
  const [period, setPeriod] = useState("month");
  const [selectedUser, setSelectedUser] = useState("all");
  const dateRange = useMemo(() => getDateRange(period), [period]);
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, canApprove, canExport } = usePermissions();

  const buildUrl = (base: string, params: Record<string, string | undefined>) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    const queryString = searchParams.toString();
    return queryString ? `${base}?${queryString}` : base;
  };

  const exportToCSV = useCallback((data: any[], filename: string, columns: { key: string; header: string }[]) => {
    if (!data || data.length === 0) {
      toast({ title: "Sin datos para exportar", variant: "destructive" });
      return;
    }
    const headers = columns.map(c => c.header).join(",");
    const rows = data.map(item => 
      columns.map(c => {
        const val = item[c.key];
        const strVal = val === null || val === undefined ? "" : String(val);
        return strVal.includes(",") ? `"${strVal}"` : strVal;
      }).join(",")
    ).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportación completada" });
  }, [toast]);

  const overviewUrl = buildUrl("/api/accounting/overview", {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { data: overview, isLoading: loadingOverview, isError: errorOverview } = useQuery<AccountingOverview>({
    queryKey: ["/api/accounting/overview", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(overviewUrl);
      if (!res.ok) throw new Error("Error al cargar resumen contable");
      return res.json();
    },
  });

  const salesUrl = buildUrl("/api/accounting/machine-sales", {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { data: machineSales, isLoading: loadingSales, isError: errorSales } = useQuery<MachineSale[]>({
    queryKey: ["/api/accounting/machine-sales", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(salesUrl);
      if (!res.ok) throw new Error("Error al cargar ventas por máquina");
      return res.json();
    },
  });

  const expensesUrl = buildUrl("/api/accounting/expenses", {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { data: expenses, isLoading: loadingExpenses, isError: errorExpenses } = useQuery<ExpenseItem[]>({
    queryKey: ["/api/accounting/expenses", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const res = await fetch(expensesUrl);
      if (!res.ok) throw new Error("Error al cargar gastos");
      return res.json();
    },
  });

  const cashCutUrl = buildUrl("/api/accounting/cash-cut", {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    userId: selectedUser !== "all" ? selectedUser : undefined,
  });

  const { data: cashCut, isLoading: loadingCashCut, isError: errorCashCut } = useQuery<CashCutReport>({
    queryKey: ["/api/accounting/cash-cut", dateRange.startDate, dateRange.endDate, selectedUser],
    queryFn: async () => {
      const res = await fetch(cashCutUrl);
      if (!res.ok) throw new Error("Error al cargar corte de caja");
      return res.json();
    },
  });

  const { data: employees } = useQuery<any[]>({
    queryKey: ["/api/hr/employees"],
    select: (data) => data?.filter(e => e.role === "abastecedor" || e.role === "supervisor") || [],
  });

  const handleExportSales = useCallback(() => {
    if (machineSales) {
      exportToCSV(machineSales, "ventas_por_maquina", [
        { key: "machine", header: "Máquina" },
        { key: "code", header: "Código" },
        { key: "location", header: "Ubicación" },
        { key: "today", header: "Hoy" },
        { key: "week", header: "Semana" },
        { key: "month", header: "Mes" },
        { key: "transacciones", header: "Transacciones" },
      ]);
    }
  }, [machineSales, exportToCSV]);

  const handleExportExpenses = useCallback(() => {
    if (expenses) {
      exportToCSV(expenses, "gastos", [
        { key: "date", header: "Fecha" },
        { key: "concepto", header: "Concepto" },
        { key: "category", header: "Categoría" },
        { key: "amount", header: "Monto" },
        { key: "status", header: "Estado" },
      ]);
    }
  }, [expenses, exportToCSV]);

  const handleExportCashCut = useCallback(() => {
    if (cashCut?.detallePorAbastecedor) {
      exportToCSV(cashCut.detallePorAbastecedor, "corte_caja", [
        { key: "abastecedor", header: "Abastecedor" },
        { key: "esperado", header: "Esperado" },
        { key: "recolectado", header: "Recolectado" },
        { key: "diferencia", header: "Diferencia" },
        { key: "maquinas", header: "Máquinas" },
      ]);
    }
  }, [cashCut, exportToCSV]);

  const handleGenerarCorte = useCallback(() => {
    if (!cashCut) {
      toast({ title: "No hay datos para generar corte", variant: "destructive" });
      return;
    }
    handleExportCashCut();
    toast({ 
      title: "Corte de caja generado", 
      description: `Período: ${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}` 
    });
  }, [cashCut, handleExportCashCut, toast, dateRange]);

  const salesColumns: Column<MachineSale>[] = [
    { 
      key: "machine", 
      header: "Máquina",
      render: (item) => (
        <div>
          <p className="font-medium">{item.machine || item.code}</p>
          <p className="text-xs text-muted-foreground">{item.location}</p>
        </div>
      ),
    },
    {
      key: "today",
      header: "Hoy",
      render: (item) => formatCurrency(item.today || 0),
    },
    {
      key: "week",
      header: "Semana",
      render: (item) => formatCurrency(item.week || 0),
    },
    {
      key: "month",
      header: "Mes",
      render: (item) => formatCurrency(item.month || 0),
    },
    {
      key: "transacciones",
      header: "Transacciones",
      render: (item) => (item.transacciones || 0).toLocaleString(),
    },
    {
      key: "status",
      header: "Tendencia",
      render: (item) =>
        item.status === "up" ? (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
            <TrendingUp className="h-3 w-3 mr-1" />
            Arriba
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-destructive/10 text-destructive">
            <TrendingDown className="h-3 w-3 mr-1" />
            Abajo
          </Badge>
        ),
    },
  ];

  const expenseColumns: Column<ExpenseItem>[] = [
    { key: "date", header: "Fecha" },
    { key: "concepto", header: "Concepto" },
    {
      key: "category",
      header: "Categoría",
      render: (item) => <Badge variant="secondary">{item.category}</Badge>,
    },
    {
      key: "amount",
      header: "Monto",
      render: (item) => (
        <span className="text-destructive font-medium">
          -{formatCurrency(item.amount || 0)}
        </span>
      ),
    },
  ];

  const chartData = overview?.monthlyData || [];
  const categoryData = overview?.categoryData || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Contabilidad</h1>
          <p className="text-muted-foreground">
            Control de ventas, ingresos y egresos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]" data-testid="select-period">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mes</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Este Año</SelectItem>
            </SelectContent>
          </Select>
          {canExport("accounting") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-export">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportSales} data-testid="export-ventas">
                  Ventas por Máquina
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExpenses} data-testid="export-gastos">
                  Gastos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCashCut} data-testid="export-corte">
                  Corte de Caja
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingOverview ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </>
        ) : (
          <>
            <StatsCard
              title="Ingresos del Período"
              value={formatCurrency(overview?.totalIngresos || 0)}
              subtitle={`Tendencia: ${overview?.tendenciaIngresos?.toFixed(1) || 0}%`}
              trend={{ value: overview?.tendenciaIngresos || 0, isPositive: (overview?.tendenciaIngresos || 0) >= 0 }}
              icon={DollarSign}
              iconColor="success"
            />
            <StatsCard
              title="Gastos del Período"
              value={formatCurrency(overview?.totalGastos || 0)}
              subtitle={`Tendencia: ${overview?.tendenciaGastos?.toFixed(1) || 0}%`}
              trend={{ value: Math.abs(overview?.tendenciaGastos || 0), isPositive: (overview?.tendenciaGastos || 0) <= 0 }}
              icon={TrendingDown}
              iconColor="destructive"
            />
            <StatsCard
              title="Utilidad Neta"
              value={formatCurrency(overview?.utilidadNeta || 0)}
              subtitle={`Margen: ${overview?.margen?.toFixed(1) || 0}%`}
              trend={{ value: overview?.margen || 0, isPositive: (overview?.margen || 0) > 0 }}
              icon={TrendingUp}
              iconColor="primary"
            />
            <StatsCard
              title="Transacciones"
              value={(overview?.transacciones || 0).toLocaleString()}
              subtitle={`Promedio: ${formatCurrency(overview?.promedioTicket || 0)}`}
              icon={Receipt}
              iconColor="purple"
            />
          </>
        )}
      </div>

      <Tabs defaultValue="ventas">
        <TabsList>
          <TabsTrigger value="ventas" data-testid="tab-ventas">Ventas por Máquina</TabsTrigger>
          <TabsTrigger value="ingresos" data-testid="tab-ingresos">Ingresos y Egresos</TabsTrigger>
          <TabsTrigger value="corte" data-testid="tab-corte">Corte de Caja</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ventas Mensuales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loadingOverview ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [formatCurrency(value), ""]}
                        />
                        <Area
                          type="monotone"
                          dataKey="ventas"
                          stroke="#2F6FED"
                          fill="#2F6FED"
                          fillOpacity={0.2}
                          name="Ventas"
                        />
                        <Area
                          type="monotone"
                          dataKey="gastos"
                          stroke="#FF6B3D"
                          fill="#FF6B3D"
                          fillOpacity={0.2}
                          name="Gastos"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ventas por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loadingOverview ? (
                    <Skeleton className="h-full w-full" />
                  ) : categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${value}%`, ""]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No hay datos de categorías
                    </div>
                  )}
                </div>
                {categoryData.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {categoryData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ventas por Máquina</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSales ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <DataTable
                  data={machineSales || []}
                  columns={salesColumns}
                  searchPlaceholder="Buscar máquina..."
                  searchKeys={["machine", "code", "location"]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingresos" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-emerald-500">Ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-emerald-500 mb-4" data-testid="text-total-ingresos">
                  {formatCurrency(overview?.totalIngresos || 0)}
                </div>
                <div className="h-[200px]">
                  {loadingOverview ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="ventas" fill="#4ECB71" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Egresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-destructive mb-4" data-testid="text-total-gastos">
                  {formatCurrency(expenses?.reduce((acc, e) => acc + (e.amount || 0), 0) || 0)}
                </div>
                {loadingExpenses ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <DataTable
                    data={expenses || []}
                    columns={expenseColumns}
                    pageSize={5}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="corte" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Corte de Caja</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-[180px]" data-testid="select-user">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Abastecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.fullName || emp.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canApprove("cash_collections") && (
                  <Button onClick={handleGenerarCorte} data-testid="button-generar-corte">
                    <FileCheck className="h-4 w-4 mr-2" />
                    Generar Corte
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingCashCut ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Efectivo Esperado</p>
                        <p className="text-2xl font-bold" data-testid="text-efectivo-esperado">
                          {formatCurrency(cashCut?.totalEsperado || 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Efectivo Real</p>
                        <p className="text-2xl font-bold" data-testid="text-efectivo-real">
                          {formatCurrency(cashCut?.totalRecolectado || 0)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Diferencia</p>
                        <p className={`text-2xl font-bold ${(cashCut?.diferencia || 0) < 0 ? "text-destructive" : "text-emerald-500"}`} data-testid="text-diferencia">
                          {(cashCut?.diferencia || 0) < 0 ? "-" : "+"}{formatCurrency(Math.abs(cashCut?.diferencia || 0))}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  {cashCut?.detallePorAbastecedor && cashCut.detallePorAbastecedor.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="font-medium mb-2">Desglose por Abastecedor</h4>
                      {cashCut.detallePorAbastecedor.map((user) => (
                        <div key={user.userId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <span>{user.abastecedor || user.userId}</span>
                          <div className="flex gap-4 text-sm">
                            <span>Esperado: {formatCurrency(user.esperado || 0)}</span>
                            <span>Real: {formatCurrency(user.recolectado || 0)}</span>
                            <span className={(user.diferencia || 0) < 0 ? "text-destructive" : "text-emerald-500"}>
                              Dif: {formatCurrency(user.diferencia || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay datos de recolección para el período seleccionado
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
