import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  CheckSquare,
  Clock,
  AlertCircle,
  User,
  MapPin,
  CheckCircle2,
  Circle,
  PlayCircle,
  XCircle,
  MoreHorizontal,
  Flag,
  Wrench,
  Package,
  Truck,
  ClipboardList,
  Sparkles,
  Coffee,
  Users,
  CalendarDays,
  ChevronRight,
  Plus,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

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
  urgente: { label: "Urgente", color: "bg-red-500 text-white", textColor: "text-red-500" },
  alta: { label: "Alta", color: "bg-orange-500 text-white", textColor: "text-orange-500" },
  media: { label: "Media", color: "bg-yellow-500 text-white", textColor: "text-yellow-500" },
  baja: { label: "Baja", color: "bg-green-500 text-white", textColor: "text-green-500" },
};

const statusConfig = {
  pendiente: { label: "Pendiente", color: "bg-slate-500 text-white", icon: Circle },
  en_progreso: { label: "En Progreso", color: "bg-blue-500 text-white", icon: PlayCircle },
  completada: { label: "Completada", color: "bg-green-500 text-white", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-red-500 text-white", icon: XCircle },
};

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  abastecimiento: { label: "Abastecimiento", icon: Package, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  mantenimiento: { label: "Mantenimiento", icon: Wrench, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  recoleccion: { label: "Recolección", icon: Truck, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  revision: { label: "Revisión", icon: ClipboardList, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  limpieza: { label: "Limpieza", icon: Sparkles, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  reparacion: { label: "Reparación", icon: Wrench, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  reunion: { label: "Reunión", icon: Users, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  otro: { label: "Otro", icon: Coffee, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export function TasksTodayPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canCreate } = usePermissions();
  const today = new Date();
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

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

  const { data: tasks, isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks/today"],
  });

  const { data: historyTasks, isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks/my-history"],
    enabled: user?.role === "abastecedor",
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: isNewTaskOpen,
  });

  const { data: machines } = useQuery<any[]>({
    queryKey: ["/api/machines"],
    enabled: isNewTaskOpen,
  });

  const { data: routes } = useQuery<any[]>({
    queryKey: ["/api/routes"],
    enabled: isNewTaskOpen,
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
      // Para rol RH, auto-asignar la tarea al usuario actual
      const effectiveAssignedUserId = user?.role === "rh" 
        ? user.id 
        : (data.assignedUserId && data.assignedUserId !== "" ? data.assignedUserId : undefined);
      
      return apiRequest("POST", "/api/tasks", {
        ...data,
        dueDate: data.dueDate?.toISOString(),
        assignedUserId: effectiveAssignedUserId,
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

  const onTaskSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const completeTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/tasks/${id}/complete`, { completedBy: user?.id || "system" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-history"] });
      toast({ title: "Tarea completada", description: "La tarea ha sido marcada como completada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo completar la tarea", variant: "destructive" });
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-history"] });
      toast({ title: "Estado actualizado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    },
  });

  const urgentTasks = tasks?.filter(t => t.priority === "urgente") || [];
  const highTasks = tasks?.filter(t => t.priority === "alta") || [];
  const normalTasks = tasks?.filter(t => t.priority === "media" || t.priority === "baja") || [];

  const completedToday = tasks?.filter(t => t.status === "completada").length || 0;
  const totalToday = tasks?.length || 0;
  const progress = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

  const TaskItem = ({ task }: { task: any }) => {
    const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.media;
    const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pendiente;
    const type = typeConfig[task.type as keyof typeof typeConfig] || typeConfig.otro;
    const TypeIcon = type.icon;
    const StatusIcon = status.icon;

    return (
      <Card 
        className={`hover-elevate transition-all ${
          task.priority === "urgente" ? "border-l-4 border-l-red-500" : 
          task.priority === "alta" ? "border-l-4 border-l-orange-500" : ""
        }`}
        data-testid={`card-today-task-${task.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => {
                if (task.status === "pendiente") {
                  changeStatusMutation.mutate({ id: task.id, status: "en_progreso" });
                } else if (task.status === "en_progreso") {
                  completeTaskMutation.mutate(task.id);
                }
              }}
              className={`mt-1 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                task.status === "completada" 
                  ? "bg-green-500 border-green-500 text-white" 
                  : task.status === "en_progreso"
                  ? "bg-blue-500 border-blue-500 text-white"
                  : "border-muted-foreground/30 hover:border-primary"
              }`}
              data-testid={`button-toggle-task-${task.id}`}
            >
              {task.status === "completada" && <CheckCircle2 className="h-4 w-4" />}
              {task.status === "en_progreso" && <PlayCircle className="h-4 w-4" />}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className={`font-semibold ${
                    task.status === "completada" ? "line-through text-muted-foreground" : ""
                  }`} data-testid={`text-today-task-title-${task.id}`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {task.description}
                    </p>
                  )}
                </div>
                <Badge className={type.color} variant="secondary">
                  <TypeIcon className="h-3 w-3 mr-1" />
                  {type.label}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-3">
                {task.startTime && (
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{task.startTime}</span>
                    {task.endTime && <span className="text-muted-foreground">- {task.endTime}</span>}
                  </div>
                )}
                {task.assignedUser && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {task.assignedUser.initials || task.assignedUser.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{task.assignedUser.name}</span>
                  </div>
                )}
                {task.machine && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{task.machine.name}</span>
                  </div>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-today-task-menu-${task.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {task.status !== "completada" && (
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
                <DropdownMenuItem onClick={() => changeStatusMutation.mutate({ id: task.id, status: "cancelada" })}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <CalendarDays className="h-8 w-8 text-primary" />
              Tareas de Hoy
            </h1>
            <p className="text-muted-foreground mt-1">
              {formatDate(today)}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            {user?.role !== "abastecedor" && (
              <Link href={user?.role === "rh" ? "/mis-tareas" : "/todas-tareas"}>
                <Button variant="outline" className="gap-2" data-testid="link-all-tasks">
                  {user?.role === "rh" ? "Ver Mis Tareas" : "Ver Todas las Tareas"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Progreso del día</p>
                <p className="text-2xl font-bold" data-testid="text-progress-count">
                  {completedToday} de {totalToday} tareas
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary" data-testid="text-progress-percent">
                  {Math.round(progress)}%
                </p>
              </div>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        {tasksLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : tasks?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckSquare className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No hay tareas para hoy</h3>
              <p className="text-muted-foreground mb-4">
                {user?.role === "abastecedor" 
                  ? "No tienes tareas asignadas para hoy. Las tareas serán asignadas por tu supervisor."
                  : "¡Excelente! No tienes tareas programadas para hoy."}
              </p>
              {canCreate("tasks") && (
                <Button 
                  onClick={() => {
                    taskForm.reset();
                    setIsNewTaskOpen(true);
                  }}
                  data-testid="button-create-task"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Nueva Tarea
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {urgentTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-red-500">Urgente ({urgentTasks.length})</h2>
                </div>
                <div className="space-y-2">
                  {urgentTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {highTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-orange-500" />
                  <h2 className="text-lg font-semibold text-orange-500">Prioridad Alta ({highTasks.length})</h2>
                </div>
                <div className="space-y-2">
                  {highTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {normalTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Otras Tareas ({normalTasks.length})</h2>
                </div>
                <div className="space-y-2">
                  {normalTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {user?.role === "abastecedor" && (
          <div className="mt-8 space-y-4">
            <Separator />
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Mi Historial de Tareas</h2>
            </div>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : historyTasks && historyTasks.length > 0 ? (
              <div className="space-y-2">
                {historyTasks.map((task) => {
                  const type = typeConfig[task.type as keyof typeof typeConfig] || typeConfig.otro;
                  const TypeIcon = type.icon;
                  const isCompleted = task.status === "completada";
                  return (
                    <Card key={task.id} className="opacity-75" data-testid={`card-history-task-${task.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                            isCompleted ? "bg-green-500 text-white" : "bg-red-500 text-white"
                          }`}>
                            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium line-through text-muted-foreground">
                                {task.title}
                              </h3>
                              <Badge className={type.color} variant="secondary">
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {type.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {task.dueDate ? formatDate(new Date(task.dueDate)) : "Sin fecha"}
                            </p>
                          </div>
                          <Badge variant={isCompleted ? "default" : "destructive"}>
                            {isCompleted ? "Completada" : "Cancelada"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No tienes tareas en tu historial todavía</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

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

              {/* RH solo puede asignarse tareas a sí mismo, se oculta el selector */}
              {user?.role !== "rh" && (
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
              )}

              <div className="grid grid-cols-2 gap-4">
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

                <FormField
                  control={taskForm.control}
                  name="routeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ruta (opcional)</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "none" ? "" : val)} 
                        defaultValue={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-task-route">
                            <SelectValue placeholder="Seleccionar ruta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Ninguna</SelectItem>
                          {routes?.map((route) => (
                            <SelectItem key={route.id} value={route.id}>
                              {route.name}
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
    </ScrollArea>
  );
}

export default TasksTodayPage;
