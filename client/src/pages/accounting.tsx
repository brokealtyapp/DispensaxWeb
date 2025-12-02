import { useState } from "react";
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
import { DataTable, Column } from "@/components/DataTable";
import { StatsCard } from "@/components/StatsCard";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Calendar,
  Download,
  Filter,
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

// todo: remove mock functionality - replace with actual API data
const mockSalesData = [
  { month: "Ene", ventas: 85000, gastos: 45000 },
  { month: "Feb", ventas: 92000, gastos: 48000 },
  { month: "Mar", ventas: 78000, gastos: 42000 },
  { month: "Abr", ventas: 105000, gastos: 52000 },
  { month: "May", ventas: 115000, gastos: 55000 },
  { month: "Jun", ventas: 125430, gastos: 58000 },
];

const mockMachineSales = [
  { id: "1", machine: "Plaza Central", today: 2340, week: 14520, month: 58200, status: "up" },
  { id: "2", machine: "Edificio Corporativo", today: 1890, week: 11230, month: 45800, status: "up" },
  { id: "3", machine: "Universidad Tech", today: 3210, week: 19450, month: 78900, status: "up" },
  { id: "4", machine: "Hospital Central", today: 980, week: 6540, month: 26100, status: "down" },
  { id: "5", machine: "Aeropuerto Terminal A", today: 4520, week: 28900, month: 115600, status: "up" },
];

const mockExpenses = [
  { id: "1", concept: "Compra de productos", category: "Inventario", amount: 35000, date: "2024-12-25" },
  { id: "2", concept: "Combustible rutas", category: "Operaciones", amount: 8500, date: "2024-12-25" },
  { id: "3", concept: "Nómina semanal", category: "Personal", amount: 45000, date: "2024-12-24" },
  { id: "4", concept: "Mantenimiento máquinas", category: "Mantenimiento", amount: 12000, date: "2024-12-23" },
  { id: "5", concept: "Servicios oficina", category: "Operaciones", amount: 5500, date: "2024-12-22" },
];

const mockCategoryData = [
  { name: "Bebidas carbonatadas", value: 45 },
  { name: "Agua", value: 25 },
  { name: "Jugos", value: 15 },
  { name: "Energéticas", value: 10 },
  { name: "Otros", value: 5 },
];

const COLORS = ["#2F6FED", "#8E59FF", "#4ECB71", "#FF6B3D", "#6B7280"];

export function AccountingPage() {
  const [period, setPeriod] = useState("month");

  const salesColumns: Column<(typeof mockMachineSales)[0]>[] = [
    { key: "machine", header: "Máquina" },
    {
      key: "today",
      header: "Hoy",
      render: (item) => `$${item.today.toLocaleString()}`,
    },
    {
      key: "week",
      header: "Semana",
      render: (item) => `$${item.week.toLocaleString()}`,
    },
    {
      key: "month",
      header: "Mes",
      render: (item) => `$${item.month.toLocaleString()}`,
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

  const expenseColumns: Column<(typeof mockExpenses)[0]>[] = [
    { key: "date", header: "Fecha" },
    { key: "concept", header: "Concepto" },
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
          -${item.amount.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Contabilidad</h1>
          <p className="text-muted-foreground">
            Control de ventas, ingresos y egresos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
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
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Ingresos del Mes"
          value="$125,430"
          subtitle="Meta: $150,000"
          trend={{ value: 8.5, isPositive: true }}
          icon={DollarSign}
          iconColor="success"
        />
        <StatsCard
          title="Gastos del Mes"
          value="$58,000"
          subtitle="Presupuesto: $65,000"
          trend={{ value: 5.2, isPositive: false }}
          icon={TrendingDown}
          iconColor="destructive"
        />
        <StatsCard
          title="Utilidad Neta"
          value="$67,430"
          subtitle="Margen: 53.8%"
          trend={{ value: 12.3, isPositive: true }}
          icon={TrendingUp}
          iconColor="primary"
        />
        <StatsCard
          title="Transacciones"
          value="4,892"
          subtitle="Promedio: $25.65"
          icon={Receipt}
          iconColor="purple"
        />
      </div>

      <Tabs defaultValue="ventas">
        <TabsList>
          <TabsTrigger value="ventas">Ventas por Máquina</TabsTrigger>
          <TabsTrigger value="ingresos">Ingresos y Egresos</TabsTrigger>
          <TabsTrigger value="corte">Corte de Caja</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ventas Mensuales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockSalesData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ventas por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mockCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {mockCategoryData.map((entry, index) => (
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
                </div>
                <div className="space-y-2 mt-4">
                  {mockCategoryData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ventas por Máquina</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={mockMachineSales}
                columns={salesColumns}
                searchPlaceholder="Buscar máquina..."
                searchKeys={["machine"]}
              />
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
                <div className="text-4xl font-bold text-emerald-500 mb-4">
                  $125,430
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mockSalesData}>
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Egresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-destructive mb-4">
                  $58,000
                </div>
                <DataTable
                  data={mockExpenses}
                  columns={expenseColumns}
                  pageSize={5}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="corte" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Corte de Caja</CardTitle>
              <div className="flex items-center gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Abastecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="carlos">Carlos R.</SelectItem>
                    <SelectItem value="maria">María G.</SelectItem>
                    <SelectItem value="juan">Juan P.</SelectItem>
                  </SelectContent>
                </Select>
                <Button>Generar Corte</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Efectivo Esperado</p>
                    <p className="text-2xl font-bold">$15,240</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Efectivo Real</p>
                    <p className="text-2xl font-bold">$15,180</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Diferencia</p>
                    <p className="text-2xl font-bold text-destructive">-$60</p>
                  </CardContent>
                </Card>
              </div>
              <p className="text-sm text-muted-foreground text-center py-8">
                Selecciona un período y abastecedor para generar el corte de caja
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
