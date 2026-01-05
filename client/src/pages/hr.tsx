import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, Column } from "@/components/DataTable";
import { DataPagination } from "@/components/DataPagination";
import { StatsCard } from "@/components/StatsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import {
  Users,
  Clock,
  TrendingUp,
  UserPlus,
  Search,
  MoreHorizontal,
  Calendar,
  Pencil,
  X,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Employee {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
}

interface TimeRecord {
  id: string;
  employee: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  machine: string | null;
  machineId: string | null;
}

interface PerformanceRecord {
  id: string;
  employee: string;
  machinesDay: number;
  avgTime: number;
  efficiency: number;
  totalMachines: number;
  totalCollected: number;
  rating: number;
}

const employeeSchema = z.object({
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  role: z.string().min(1, "Selecciona un rol"),
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const editEmployeeSchema = z.object({
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  role: z.string().min(1, "Selecciona un rol"),
  isActive: z.boolean().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;
type EditEmployeeFormData = z.infer<typeof editEmployeeSchema>;

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  abastecedor: "Abastecedor",
  almacen: "Almacén",
  contabilidad: "Contabilidad",
  rh: "Recursos Humanos",
};

const ITEMS_PER_PAGE = 10;

export function HRPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeesPage, setEmployeesPage] = useState(1);
  const [timePage, setTimePage] = useState(1);
  const [performancePage, setPerformancePage] = useState(1);
  const { toast } = useToast();

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      role: "",
      username: "",
      password: "",
    },
  });

  const editForm = useForm<EditEmployeeFormData>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      role: "",
      isActive: true,
    },
  });

  const { data: employees, isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/hr/employees"],
  });

  const { data: timeRecords, isLoading: loadingTime } = useQuery<TimeRecord[]>({
    queryKey: ["/api/hr/time-tracking"],
  });

  const { data: performance, isLoading: loadingPerformance } = useQuery<PerformanceRecord[]>({
    queryKey: ["/api/hr/performance"],
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      return await apiRequest("POST", "/api/hr/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      toast({ title: "Empleado creado correctamente" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear empleado", description: error.message, variant: "destructive" });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditEmployeeFormData }) => {
      return await apiRequest("PATCH", `/api/hr/employees/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      toast({ title: "Empleado actualizado correctamente" });
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar empleado", description: error.message, variant: "destructive" });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/hr/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      toast({ title: "Empleado desactivado correctamente" });
      setDeletingEmployeeId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error al desactivar empleado", description: error.message, variant: "destructive" });
    },
  });

  const openEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    editForm.reset({
      fullName: employee.fullName || "",
      email: employee.email || "",
      phone: employee.phone || "",
      role: employee.role,
      isActive: employee.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const onEditSubmit = (data: EditEmployeeFormData) => {
    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data });
    }
  };

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter((emp) => {
      const matchesSearch = !searchQuery || 
        emp.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || emp.role === roleFilter;
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && emp.isActive) || 
        (statusFilter === "inactive" && !emp.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchQuery, roleFilter, statusFilter]);

  const paginatedEmployees = useMemo(() => {
    const start = (employeesPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEmployees, employeesPage]);

  const paginatedTime = useMemo(() => {
    const start = (timePage - 1) * ITEMS_PER_PAGE;
    return (timeRecords || []).slice(start, start + ITEMS_PER_PAGE);
  }, [timeRecords, timePage]);

  const paginatedPerformance = useMemo(() => {
    const start = (performancePage - 1) * ITEMS_PER_PAGE;
    return (performance || []).slice(start, start + ITEMS_PER_PAGE);
  }, [performance, performancePage]);

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setEmployeesPage(1);
  };

  const hasActiveFilters = searchQuery || roleFilter !== "all" || statusFilter !== "all";

  const activeEmployees = (employees || []).filter((e) => e.isActive).length;
  const avgHours = timeRecords?.length 
    ? (timeRecords.reduce((acc, r) => acc + r.hours, 0) / timeRecords.length).toFixed(1)
    : "0";
  const avgEfficiency = performance?.length
    ? (performance.reduce((acc, p) => acc + p.efficiency, 0) / performance.length).toFixed(0)
    : "0";

  const employeeColumns: Column<Employee>[] = [
    {
      key: "fullName",
      header: "Empleado",
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {(item.fullName || item.username)
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{item.fullName || item.username}</p>
            <p className="text-xs text-muted-foreground">{item.email || "-"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rol",
      render: (item) => <Badge variant="secondary">{roleLabels[item.role] || item.role}</Badge>,
    },
    {
      key: "isActive",
      header: "Estado",
      render: (item) => (
        <Badge
          variant="secondary"
          className={
            item.isActive
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-muted text-muted-foreground"
          }
        >
          {item.isActive ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      render: (item) => item.phone || "-",
    },
    {
      key: "id",
      header: "",
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => openEditEmployee(item)}
            data-testid={`button-edit-${item.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {item.isActive && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setDeletingEmployeeId(item.id)}
              className="text-destructive hover:text-destructive"
              data-testid={`button-delete-${item.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const timeColumns: Column<TimeRecord>[] = [
    { key: "date", header: "Fecha" },
    { key: "employee", header: "Empleado" },
    { key: "checkIn", header: "Entrada" },
    { key: "checkOut", header: "Salida" },
    {
      key: "hours",
      header: "Horas",
      render: (item) => `${item.hours}h`,
    },
    { 
      key: "machine", 
      header: "Máquina",
      render: (item) => item.machine || "-",
    },
  ];

  const performanceColumns: Column<PerformanceRecord>[] = [
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
    {
      key: "totalCollected",
      header: "Total Recolectado",
      render: (item) => formatCurrency(item.totalCollected),
    },
  ];

  const onSubmit = (data: EmployeeFormData) => {
    createEmployeeMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Recursos Humanos</h1>
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
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Juan Pérez" {...field} data-testid="input-fullname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <FormControl>
                        <Input placeholder="jperez" {...field} data-testid="input-username" />
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
                        <Input placeholder="juan@dispensax.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="555-1234" {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••" {...field} data-testid="input-password" />
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
                          <SelectTrigger data-testid="select-role">
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
                  <Button type="submit" disabled={createEmployeeMutation.isPending} data-testid="button-submit">
                    {createEmployeeMutation.isPending ? "Agregando..." : "Agregar Empleado"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loadingEmployees ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </>
        ) : (
          <>
            <StatsCard
              title="Total Empleados"
              value={employees?.length || 0}
              subtitle={`${activeEmployees} activos`}
              icon={Users}
              iconColor="primary"
            />
            <StatsCard
              title="Horas Promedio"
              value={`${avgHours}h`}
              subtitle="Esta semana"
              icon={Clock}
              iconColor="purple"
            />
            <StatsCard
              title="Eficiencia Promedio"
              value={`${avgEfficiency}%`}
              subtitle="Abastecedores"
              icon={TrendingUp}
              iconColor="success"
            />
            <StatsCard
              title="Roles"
              value={Object.keys(roleLabels).length}
              subtitle="Tipos definidos"
              icon={UserPlus}
              iconColor="warning"
            />
          </>
        )}
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal" data-testid="tab-personal">Personal</TabsTrigger>
          <TabsTrigger value="tiempos" data-testid="tab-tiempos">Control de Tiempos</TabsTrigger>
          <TabsTrigger value="rendimiento" data-testid="tab-rendimiento">Rendimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empleados..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-employees"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-role-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                    <X className="h-4 w-4 mr-1" />
                    Limpiar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingEmployees ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <DataTable
                    data={paginatedEmployees}
                    columns={employeeColumns}
                    searchPlaceholder="Buscar..."
                    searchKeys={["fullName", "email", "username"]}
                  />
                  <DataPagination
                    currentPage={employeesPage}
                    totalItems={filteredEmployees.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setEmployeesPage}
                    className="mt-4"
                  />
                </>
              )}
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
                  Últimos 7 días
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTime ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <DataTable
                    data={paginatedTime}
                    columns={timeColumns}
                    searchPlaceholder="Buscar..."
                    searchKeys={["employee"]}
                  />
                  <DataPagination
                    currentPage={timePage}
                    totalItems={(timeRecords || []).length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setTimePage}
                    className="mt-4"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rendimiento" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Abastecedor</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPerformance ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <DataTable
                    data={paginatedPerformance}
                    columns={performanceColumns}
                    searchPlaceholder="Buscar..."
                    searchKeys={["employee"]}
                  />
                  <DataPagination
                    currentPage={performancePage}
                    totalItems={(performance || []).length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setPerformancePage}
                    className="mt-4"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empleado</DialogTitle>
            <DialogDescription>Modifica los datos del empleado</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Juan Pérez" {...field} data-testid="input-edit-fullname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="juan@dispensax.com" {...field} data-testid="input-edit-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="555-1234" {...field} data-testid="input-edit-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-role">
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
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "true")} 
                      value={field.value ? "true" : "false"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Activo</SelectItem>
                        <SelectItem value="false">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateEmployeeMutation.isPending} data-testid="button-save-edit">
                  {updateEmployeeMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingEmployeeId} onOpenChange={(open) => { if (!open) setDeletingEmployeeId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desactivará al empleado. Podrás reactivarlo más tarde desde la edición.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEmployeeId && deleteEmployeeMutation.mutate(deletingEmployeeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
