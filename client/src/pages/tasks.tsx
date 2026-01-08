import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { formatDate } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { 
  CheckSquare,
  Plus,
  Clock,
  AlertCircle,
  User,
  MapPin,
  Calendar,
  Filter,
  CheckCircle2,
  Circle,
  PlayCircle,
  XCircle,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Edit,
  Flag,
  Wrench,
  Package,
  Truck,
  ClipboardList,
  Sparkles,
  Coffee,
  Users,
  ListTodo
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";

const taskFormSchema = z.object({
  title: z.string().min(1, "Título requerido"),
  description: z.string().optional(),
  type: z.string().min(1, "Tipo requerido"),
  priority: z.string().min(1, "Prioridad requerida"),
  dueDate: z.date().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  assignedUserId: z.string().optional(),
  machineId: z.string().optional(),
  routeId: z.string().optional(),
  notes: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const priorityConfig = {
  urgente: { label: "Urgente", color: "bg-red-500 text-white", icon: AlertCircle },
  alta: { label: "Alta", color: "bg-orange-500 text-white", icon: Flag },
  media: { label: "Media", color: "bg-yellow-500 text-white", icon: Flag },
  baja: { label: "Baja", color: "bg-green-500 text-white", icon: Flag },
};

const statusConfig = {
  pendiente: { label: "Pendiente", color: "bg-slate-500 text-white", icon: Circle },
  en_progreso: { label: "En Progreso", color: "bg-blue-500 text-white", icon: PlayCircle },
  completada: { label: "Completada", color: "bg-green-500 text-white", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-red-500 text-white", icon: XCircle },
};

const typeConfig: Record<string, { label: string; icon: any }> = {
  abastecimiento: { label: "Abastecimiento", icon: Package },
  mantenimiento: { label: "Mantenimiento", icon: Wrench },
  recoleccion: { label: "Recolección", icon: Truck },
  revision: { label: "Revisión", icon: ClipboardList },
  limpieza: { label: "Limpieza", icon: Sparkles },
  reparacion: { label: "Reparación", icon: Wrench },
  reunion: { label: "Reunión", icon: Users },
  otro: { label: "Otro", icon: Coffee },
};

export function TasksPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [activeTab, setActiveTab] = useState("all");
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "otro",
      priority: "media",
      startTime: "",
      endTime: "",
      assignedUserId: "",
      machineId: "",
      routeId: "",
      notes: "",
    },
  });

  const buildTasksQueryKey = () => {
    const params = new URLSearchParams();
    if (filterPriority && filterPriority !== "all") params.append("priority", filterPriority);
    if (filterStatus && filterStatus !== "all") params.append("status", filterStatus);
    if (filterType && filterType !== "all") params.append("type", filterType);
    const queryString = params.toString();
    return queryString ? `/api/tasks?${queryString}` : "/api/tasks";
  };

  const { data: tasks, isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: [buildTasksQueryKey()],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/tasks/stats"],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: machines } = useQuery<any[]>({
    queryKey: ["/api/machines"],
  });

  const { data: routes } = useQuery<any[]>({
    queryKey: ["/api/routes"],
  });

  const invalidateTaskQueries = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/tasks");
      }
    });
  };

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      return apiRequest("POST", "/api/tasks", {
        ...data,
        dueDate: data.dueDate?.toISOString(),
        assignedUserId: data.assignedUserId && data.assignedUserId !== "" ? data.assignedUserId : undefined,
        machineId: data.machineId && data.machineId !== "" ? data.machineId : undefined,
        routeId: data.routeId && data.routeId !== "" ? data.routeId : undefined,
      });
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Tarea creada", description: "La tarea se ha creado correctamente" });
      setIsNewTaskOpen(false);
      taskForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la tarea", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormData> }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, {
        ...data,
        dueDate: data.dueDate?.toISOString(),
        assignedUserId: data.assignedUserId && data.assignedUserId !== "" ? data.assignedUserId : undefined,
        machineId: data.machineId && data.machineId !== "" ? data.machineId : undefined,
        routeId: data.routeId && data.routeId !== "" ? data.routeId : undefined,
      });
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Tarea actualizada", description: "La tarea se ha actualizado correctamente" });
      setIsEditTaskOpen(false);
      setSelectedTask(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la tarea", variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/tasks/${id}/complete`, { completedBy: user?.id || "system" });
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Tarea completada", description: "La tarea ha sido marcada como completada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo completar la tarea", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tasks/${id}`, {});
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Tarea eliminada", description: "La tarea ha sido eliminada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la tarea", variant: "destructive" });
    },
  });

  const cancelTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/tasks/${id}/cancel`, { cancelledBy: user?.id || "system" });
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Tarea cancelada", description: "La tarea ha sido cancelada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo cancelar la tarea", variant: "destructive" });
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Estado actualizado", description: "El estado de la tarea ha sido actualizado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    },
  });

  const onTaskSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const handleEditTask = (task: any) => {
    setSelectedTask(task);
    taskForm.reset({
      title: task.title,
      description: task.description || "",
      type: task.type || "otro",
      priority: task.priority || "media",
      dueDate: task.dueDate ? parseISO(task.dueDate) : undefined,
      startTime: task.startTime || "",
      endTime: task.endTime || "",
      assignedUserId: task.assignedUserId || "",
      machineId: task.machineId || "",
      routeId: task.routeId || "",
      notes: task.notes || "",
    });
    setIsEditTaskOpen(true);
  };

  const onEditSubmit = (data: TaskFormData) => {
    if (selectedTask) {
      updateTaskMutation.mutate({ id: selectedTask.id, data });
    }
  };

  const getDateLabel = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return "Hoy";
    if (isTomorrow(d)) return "Mañana";
    if (isPast(d)) return "Vencida";
    return formatDate(d);
  };

  const filteredTasks = tasks?.filter(task => {
    if (activeTab === "pending") return task.status === "pendiente";
    if (activeTab === "in_progress") return task.status === "en_progreso";
    if (activeTab === "completed") return task.status === "completada";
    if (activeTab === "cancelled") return task.status === "cancelada";
    if (activeTab === "overdue") return task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== "completada" && task.status !== "cancelada";
    return true;
  }) || [];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">
              Gestión de Tareas
            </h1>
            <p className="text-muted-foreground">
              Administra y organiza todas las tareas del equipo
            </p>
          </div>
          {canCreate("tasks") && (
            <Button
              onClick={() => {
                taskForm.reset();
                setIsNewTaskOpen(true);
              }}
              className="gap-2"
              data-testid="button-new-task"
            >
              <Plus className="h-4 w-4" />
              Nueva Tarea
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <ListTodo className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-stat-total">{stats?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Circle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-stat-pending">{stats?.pending || 0}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <PlayCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-stat-in-progress">{stats?.inProgress || 0}</p>
                  <p className="text-xs text-muted-foreground">En Progreso</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-stat-completed">{stats?.completed || 0}</p>
                  <p className="text-xs text-muted-foreground">Completadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-stat-overdue">{stats?.overdue || 0}</p>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-stat-cancelled">{stats?.cancelled || 0}</p>
                  <p className="text-xs text-muted-foreground">Canceladas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Lista de Tareas
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[130px]" data-testid="select-filter-priority">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]" data-testid="select-filter-type">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(typeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all" data-testid="tab-all">Todas</TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-pending">Pendientes</TabsTrigger>
                <TabsTrigger value="in_progress" data-testid="tab-in-progress">En Progreso</TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-completed">Completadas</TabsTrigger>
                <TabsTrigger value="cancelled" data-testid="tab-cancelled">Canceladas</TabsTrigger>
                <TabsTrigger value="overdue" data-testid="tab-overdue">Vencidas</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-2">
                {tasksLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No hay tareas en esta categoría</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTasks.map((task) => {
                      const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.media;
                      const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pendiente;
                      const type = typeConfig[task.type as keyof typeof typeConfig] || typeConfig.otro;
                      const TypeIcon = type.icon;
                      const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== "completada";

                      return (
                        <Card 
                          key={task.id} 
                          className={`hover-elevate transition-all ${isOverdue ? "border-red-500/50" : ""}`}
                          data-testid={`card-task-${task.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className={`p-2 rounded-lg ${
                                task.status === "completada" 
                                  ? "bg-green-100 dark:bg-green-900/30" 
                                  : "bg-muted"
                              }`}>
                                <TypeIcon className={`h-5 w-5 ${
                                  task.status === "completada" 
                                    ? "text-green-600 dark:text-green-400" 
                                    : "text-muted-foreground"
                                }`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <h3 className={`font-semibold ${
                                      task.status === "completada" ? "line-through text-muted-foreground" : ""
                                    }`} data-testid={`text-task-title-${task.id}`}>
                                      {task.title}
                                    </h3>
                                    {task.description && (
                                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={priority.color} variant="secondary">
                                      {priority.label}
                                    </Badge>
                                    <Badge className={status.color} variant="secondary">
                                      {status.label}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                                  {task.dueDate && (
                                    <div className={`flex items-center gap-1 ${isOverdue ? "text-red-500" : ""}`}>
                                      <Calendar className="h-4 w-4" />
                                      <span>{getDateLabel(task.dueDate)}</span>
                                      {task.startTime && <span>- {task.startTime}</span>}
                                    </div>
                                  )}
                                  {task.assignedUser && (
                                    <div className="flex items-center gap-1">
                                      <User className="h-4 w-4" />
                                      <span>{task.assignedUser.name}</span>
                                    </div>
                                  )}
                                  {task.machine && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-4 w-4" />
                                      <span>{task.machine.name}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-task-menu-${task.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canEdit("tasks") && task.status !== "completada" && (
                                    <>
                                      {task.status === "pendiente" && (
                                        <DropdownMenuItem onClick={() => changeStatusMutation.mutate({ id: task.id, status: "en_progreso" })}>
                                          <PlayCircle className="h-4 w-4 mr-2" />
                                          Iniciar
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => completeTaskMutation.mutate(task.id)}>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Completar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {canEdit("tasks") && (
                                    <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                  )}
                                  {canEdit("tasks") && task.status !== "completada" && task.status !== "cancelada" && (
                                    <DropdownMenuItem 
                                      onClick={() => cancelTaskMutation.mutate(task.id)}
                                      className="text-orange-600"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancelar
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete("tasks") && (
                                    <DropdownMenuItem 
                                      onClick={() => deleteTaskMutation.mutate(task.id)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Nueva Tarea</DialogTitle>
              <DialogDescription>
                Crea una nueva tarea para el equipo
              </DialogDescription>
            </DialogHeader>
            <Form {...taskForm}>
              <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                <FormField
                  control={taskForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Título de la tarea" {...field} data-testid="input-task-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción detallada..." {...field} data-testid="input-task-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={taskForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-task-type">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(typeConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridad</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-task-priority">
                              <SelectValue placeholder="Seleccionar prioridad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="baja">Baja</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={taskForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="justify-start text-left font-normal"
                                data-testid="button-task-date"
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {field.value ? formatDate(field.value) : "Seleccionar"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Inicio</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-task-start-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Fin</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-task-end-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={taskForm.control}
                    name="assignedUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asignar a</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "unassigned" ? "" : val)} 
                          defaultValue={field.value || "unassigned"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-task-assigned">
                              <SelectValue placeholder="Seleccionar usuario" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                            {users?.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.fullName || u.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="machineId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Máquina (opcional)</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "none" ? "" : val)} 
                          defaultValue={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-task-machine">
                              <SelectValue placeholder="Seleccionar máquina" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Ninguna</SelectItem>
                            {machines?.map((machine) => (
                              <SelectItem key={machine.id} value={machine.id}>
                                {machine.name}
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
                  control={taskForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas adicionales</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notas adicionales..." {...field} data-testid="input-task-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewTaskOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-submit-task">
                    {createTaskMutation.isPending ? "Creando..." : "Crear Tarea"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditTaskOpen} onOpenChange={setIsEditTaskOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Tarea</DialogTitle>
              <DialogDescription>
                Modifica los detalles de la tarea
              </DialogDescription>
            </DialogHeader>
            <Form {...taskForm}>
              <form onSubmit={taskForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={taskForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Título de la tarea" {...field} data-testid="input-edit-task-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción detallada..." {...field} data-testid="input-edit-task-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={taskForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(typeConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridad</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar prioridad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="baja">Baja</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={taskForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="justify-start text-left font-normal"
                                data-testid="button-edit-task-date"
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {field.value ? formatDate(field.value) : "Seleccionar"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Inicio</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-edit-task-start-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora Fin</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-edit-task-end-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={taskForm.control}
                    name="assignedUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asignar a</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "unassigned" ? "" : val)} 
                          value={field.value || "unassigned"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-task-assigned">
                              <SelectValue placeholder="Seleccionar usuario" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                            {users?.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.fullName || u.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="machineId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Máquina (opcional)</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "none" ? "" : val)} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-task-machine">
                              <SelectValue placeholder="Seleccionar máquina" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Ninguna</SelectItem>
                            {machines?.map((machine) => (
                              <SelectItem key={machine.id} value={machine.id}>
                                {machine.name}
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
                  control={taskForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas adicionales</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notas adicionales..." {...field} data-testid="input-edit-task-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditTaskOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateTaskMutation.isPending} data-testid="button-update-task">
                    {updateTaskMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}

export default TasksPage;
