import { useState, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { 
  CheckSquare,
  Clock,
  AlertCircle,
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
  ListTodo,
  Filter,
  Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

const priorityConfig = {
  urgente: { label: "Urgente", color: "bg-destructive text-destructive-foreground", textColor: "text-destructive" },
  alta: { label: "Alta", color: "bg-muted text-muted-foreground", textColor: "text-muted-foreground" },
  media: { label: "Media", color: "bg-muted text-muted-foreground", textColor: "text-muted-foreground" },
  baja: { label: "Baja", color: "bg-primary text-primary-foreground", textColor: "text-primary" },
};

const statusConfig = {
  pendiente: { label: "Pendiente", color: "bg-muted text-muted-foreground", icon: Circle },
  en_progreso: { label: "En Progreso", color: "bg-primary text-primary-foreground", icon: PlayCircle },
  completada: { label: "Completada", color: "bg-primary text-primary-foreground", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-destructive text-destructive-foreground", icon: XCircle },
};

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  abastecimiento: { label: "Abastecimiento", icon: Package, color: "bg-primary/10 text-primary" },
  mantenimiento: { label: "Mantenimiento", icon: Wrench, color: "bg-muted text-muted-foreground" },
  recoleccion: { label: "Recolección", icon: Truck, color: "bg-primary/10 text-primary" },
  revision: { label: "Revisión", icon: ClipboardList, color: "bg-muted text-muted-foreground" },
  limpieza: { label: "Limpieza", icon: Sparkles, color: "bg-muted text-muted-foreground" },
  reparacion: { label: "Reparación", icon: Wrench, color: "bg-destructive/10 text-destructive" },
  reunion: { label: "Reunión", icon: Users, color: "bg-muted text-muted-foreground" },
  administrativo: { label: "Administrativo", icon: ClipboardList, color: "bg-muted text-muted-foreground" },
  capacitacion: { label: "Capacitación", icon: Users, color: "bg-muted text-muted-foreground" },
  otro: { label: "Otro", icon: Coffee, color: "bg-muted text-muted-foreground" },
};

interface TaskItemProps {
  task: any;
  onStartTask: (id: string) => void;
  onCompleteTask: (id: string) => void;
  onCancelTask: (id: string) => void;
}

const TaskItem = memo(function TaskItem({ task, onStartTask, onCompleteTask, onCancelTask }: TaskItemProps) {
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.media;
  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pendiente;
  const type = typeConfig[task.type as keyof typeof typeConfig] || typeConfig.otro;
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;

  return (
    <Card 
      className="hover-elevate transition-all"
      data-testid={`card-my-task-${task.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {(task.priority === "urgente" || task.priority === "alta") && (
            <div className={`w-1 self-stretch rounded-full ${
              task.priority === "urgente" ? "bg-destructive" : "bg-muted"
            }`} />
          )}
          <button
            onClick={() => {
              if (task.status === "pendiente") {
                onStartTask(task.id);
              } else if (task.status === "en_progreso") {
                onCompleteTask(task.id);
              }
            }}
            disabled={task.status === "completada" || task.status === "cancelada"}
            className={`mt-1 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              task.status === "completada" 
                ? "bg-primary border-primary text-primary-foreground" 
                : task.status === "en_progreso"
                ? "bg-primary border-primary text-primary-foreground"
                : task.status === "cancelada"
                ? "bg-destructive border-destructive text-destructive-foreground"
                : "border-muted-foreground/30 hover:border-primary"
            }`}
            data-testid={`button-toggle-mytask-${task.id}`}
          >
            {task.status === "completada" && <CheckCircle2 className="h-4 w-4" />}
            {task.status === "en_progreso" && <PlayCircle className="h-4 w-4" />}
            {task.status === "cancelada" && <XCircle className="h-4 w-4" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className={`font-semibold ${
                  task.status === "completada" || task.status === "cancelada" ? "line-through text-muted-foreground" : ""
                }`} data-testid={`text-mytask-title-${task.id}`}>
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {task.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={type.color} variant="secondary">
                  <TypeIcon className="h-3 w-3 mr-1" />
                  {type.label}
                </Badge>
                <Badge className={status.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3">
              {task.dueDate && (
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatDate(new Date(task.dueDate))}</span>
                </div>
              )}
              {task.startTime && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span>{task.startTime}</span>
                  {task.endTime && <span>- {task.endTime}</span>}
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

          {(task.status === "pendiente" || task.status === "en_progreso") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-mytask-menu-${task.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {task.status === "pendiente" && (
                  <DropdownMenuItem 
                    onClick={() => onStartTask(task.id)}
                    data-testid={`menu-item-start-${task.id}`}
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Iniciar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => onCompleteTask(task.id)}
                  data-testid={`menu-item-complete-${task.id}`}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onCancelTask(task.id)}
                  data-testid={`menu-item-cancel-${task.id}`}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export function MyTasksPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: tasks, isLoading } = useQuery<any[]>({
    queryKey: [`/api/tasks?assignedUserId=${user?.id}`],
    enabled: !!user?.id,
  });

  const invalidateTaskQueries = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/tasks");
      }
    });
  };

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

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Estado actualizado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    },
  });

  const handleStartTask = (id: string) => {
    changeStatusMutation.mutate({ id, status: "en_progreso" });
  };

  const handleCompleteTask = (id: string) => {
    completeTaskMutation.mutate(id);
  };

  const handleCancelTask = (id: string) => {
    changeStatusMutation.mutate({ id, status: "cancelada" });
  };

  const filteredTasks = tasks?.filter(task => {
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesSearch = !searchTerm || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  }) || [];

  const pendingCount = tasks?.filter(t => t.status === "pendiente").length || 0;
  const inProgressCount = tasks?.filter(t => t.status === "en_progreso").length || 0;
  const completedCount = tasks?.filter(t => t.status === "completada").length || 0;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <ListTodo className="h-8 w-8 text-primary" />
              Mis Tareas
            </h1>
            <p className="text-muted-foreground mt-1">
              Historial completo de tus tareas asignadas
            </p>
          </div>
          <Link href="/tareas">
            <Button variant="outline" data-testid="link-today-tasks">
              Ver Tareas de Hoy
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Circle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-pending-count">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <PlayCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-inprogress-count">{inProgressCount}</p>
                  <p className="text-sm text-muted-foreground">En Progreso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-completed-count">{completedCount}</p>
                  <p className="text-sm text-muted-foreground">Completadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tareas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-tasks"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="en_progreso">En Progreso</SelectItem>
                  <SelectItem value="completada">Completadas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckSquare className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No hay tareas</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "No se encontraron tareas con los filtros aplicados"
                  : "No tienes tareas asignadas todavía"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onStartTask={handleStartTask}
                onCompleteTask={handleCompleteTask}
                onCancelTask={handleCancelTask}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
