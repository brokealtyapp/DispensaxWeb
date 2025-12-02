import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, Column } from "@/components/DataTable";
import { StatsCard } from "@/components/StatsCard";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  Clock,
  TrendingUp,
  UserPlus,
  Plus,
  Search,
  MoreHorizontal,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// todo: remove mock functionality - replace with actual API data
const mockEmployees = [
  {
    id: "1",
    name: "Carlos Rodríguez",
    email: "carlos@dispensax.com",
    role: "Abastecedor",
    status: "activo",
    machines: 12,
    hoursWeek: 45,
    efficiency: 92,
  },
  {
    id: "2",
    name: "María García",
    email: "maria@dispensax.com",
    role: "Supervisor",
    status: "activo",
    machines: 0,
    hoursWeek: 42,
    efficiency: 0,
  },
  {
    id: "3",
    name: "Juan Pérez",
    email: "juan@dispensax.com",
    role: "Abastecedor",
    status: "inactivo",
    machines: 0,
    hoursWeek: 0,
    efficiency: 0,
  },
  {
    id: "4",
    name: "Ana López",
    email: "ana@dispensax.com",
    role: "Almacén",
    status: "activo",
    machines: 0,
    hoursWeek: 40,
    efficiency: 0,
  },
  {
    id: "5",
    name: "Pedro Sánchez",
    email: "pedro@dispensax.com",
    role: "Abastecedor",
    status: "activo",
    machines: 15,
    hoursWeek: 48,
    efficiency: 88,
  },
];

const mockTimeRecords = [
  { id: "1", employee: "Carlos Rodríguez", date: "2024-12-25", checkIn: "08:00", checkOut: "17:30", hours: 9.5, machines: 8 },
  { id: "2", employee: "Pedro Sánchez", date: "2024-12-25", checkIn: "07:30", checkOut: "18:00", hours: 10.5, machines: 10 },
  { id: "3", employee: "Carlos Rodríguez", date: "2024-12-24", checkIn: "08:15", checkOut: "17:00", hours: 8.75, machines: 7 },
  { id: "4", employee: "María García", date: "2024-12-24", checkIn: "09:00", checkOut: "18:00", hours: 9, machines: 0 },
  { id: "5", employee: "Ana López", date: "2024-12-24", checkIn: "08:00", checkOut: "16:00", hours: 8, machines: 0 },
];

const mockPerformance = [
  { id: "1", employee: "Carlos Rodríguez", machinesDay: 8.2, avgTime: 35, efficiency: 92, rating: 4.8 },
  { id: "2", employee: "Pedro Sánchez", machinesDay: 9.5, avgTime: 28, efficiency: 88, rating: 4.5 },
  { id: "3", employee: "Juan Martínez", machinesDay: 6.8, avgTime: 42, efficiency: 75, rating: 3.9 },
];

const employeeSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  role: z.string().min(1, "Selecciona un rol"),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  abastecedor: "Abastecedor",
  almacen: "Almacén",
  contabilidad: "Contabilidad",
  rh: "Recursos Humanos",
};

export function HRPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "",
    },
  });

  const filteredEmployees = mockEmployees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeEmployees = mockEmployees.filter((e) => e.status === "activo").length;

  const employeeColumns: Column<(typeof mockEmployees)[0]>[] = [
    {
      key: "name",
      header: "Empleado",
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {item.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rol",
      render: (item) => <Badge variant="secondary">{item.role}</Badge>,
    },
    {
      key: "status",
      header: "Estado",
      render: (item) => (
        <Badge
          variant="secondary"
          className={
            item.status === "activo"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-muted text-muted-foreground"
          }
        >
          {item.status === "activo" ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    { key: "machines", header: "Máquinas Asignadas" },
    {
      key: "hoursWeek",
      header: "Horas/Semana",
      render: (item) => `${item.hoursWeek}h`,
    },
    {
      key: "actions",
      header: "",
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
            <DropdownMenuItem>Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Desactivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const timeColumns: Column<(typeof mockTimeRecords)[0]>[] = [
    { key: "date", header: "Fecha" },
    { key: "employee", header: "Empleado" },
    { key: "checkIn", header: "Entrada" },
    { key: "checkOut", header: "Salida" },
    {
      key: "hours",
      header: "Horas",
      render: (item) => `${item.hours}h`,
    },
    { key: "machines", header: "Máquinas" },
  ];

  const performanceColumns: Column<(typeof mockPerformance)[0]>[] = [
    { key: "employee", header: "Empleado" },
    {
      key: "machinesDay",
      header: "Máq/Día",
      render: (item) => item.machinesDay.toFixed(1),
    },
    {
      key: "avgTime",
      header: "Tiempo Prom.",
      render: (item) => `${item.avgTime} min`,
    },
    {
      key: "efficiency",
      header: "Eficiencia",
      render: (item) => (
        <Badge
          variant="secondary"
          className={
            item.efficiency >= 90
              ? "bg-emerald-500/10 text-emerald-500"
              : item.efficiency >= 75
              ? "bg-amber-500/10 text-amber-500"
              : "bg-destructive/10 text-destructive"
          }
        >
          {item.efficiency}%
        </Badge>
      ),
    },
    {
      key: "rating",
      header: "Calificación",
      render: (item) => `${item.rating}/5`,
    },
  ];

  const onSubmit = (data: EmployeeFormData) => {
    console.log("New employee:", data);
    setIsAddDialogOpen(false);
    form.reset();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Recursos Humanos</h1>
          <p className="text-muted-foreground">Gestión de personal y control de tiempos</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-employee">
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Empleado
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Empleado</DialogTitle>
              <DialogDescription>Ingresa los datos del nuevo empleado</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Juan Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="juan@dispensax.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Agregar Empleado</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Empleados"
          value={mockEmployees.length}
          subtitle={`${activeEmployees} activos`}
          icon={Users}
          iconColor="primary"
        />
        <StatsCard
          title="Horas Promedio"
          value="42.5h"
          subtitle="Esta semana"
          trend={{ value: 5.2, isPositive: true }}
          icon={Clock}
          iconColor="purple"
        />
        <StatsCard
          title="Eficiencia Promedio"
          value="87%"
          subtitle="Abastecedores"
          trend={{ value: 3.1, isPositive: true }}
          icon={TrendingUp}
          iconColor="success"
        />
        <StatsCard
          title="Nuevos este Mes"
          value={1}
          subtitle="2 en proceso"
          icon={UserPlus}
          iconColor="warning"
        />
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="tiempos">Control de Tiempos</TabsTrigger>
          <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empleados..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-employees"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={filteredEmployees}
                columns={employeeColumns}
                searchPlaceholder="Buscar..."
                searchKeys={["name", "email"]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiempos" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Registro de Tiempos</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Dic 2024
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={mockTimeRecords}
                columns={timeColumns}
                searchPlaceholder="Buscar..."
                searchKeys={["employee"]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rendimiento" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Abastecedor</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={mockPerformance}
                columns={performanceColumns}
                searchPlaceholder="Buscar..."
                searchKeys={["employee"]}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
