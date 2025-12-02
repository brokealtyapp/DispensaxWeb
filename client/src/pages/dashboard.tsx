import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, startOfWeek, addDays, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, MoreHorizontal, Check, Box, AlertTriangle, TrendingUp, Users, Loader2 } from "lucide-react";
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

export function DashboardPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("today");

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

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: calendarEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/calendar/events"],
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
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        day: format(date, "d"),
        label: format(date, "EEE", { locale: es }),
        isToday: isToday(date),
        date,
      };
    });
  }, []);

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
      return format(new Date(task.dueDate), "HH:mm");
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
                  <p className="text-2xl font-bold">{machines.filter((m: any) => m.status === "operando").length}</p>
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
                  <p className="text-2xl font-bold">{activeAlerts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Tareas Hoy</p>
                  <p className="text-2xl font-bold">{todayTasks.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/70">Zonas</p>
                  <p className="text-2xl font-bold">{zoneStats.length}</p>
                </div>
                <Users className="h-8 w-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Zonas</h1>
            <p className="text-sm text-muted-foreground">
              Tienes {zoneStats.length} zonas activas
            </p>
          </div>
          <Link href="/maquinas">
            <Button className="gap-2" data-testid="button-add-project">
              <Plus className="h-4 w-4" />
              Ver Máquinas
            </Button>
          </Link>
        </div>

        {machinesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
          <Card className="mb-8">
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

        <Card>
          <CardHeader className="pb-4">
            <Tabs defaultValue="calendar" className="w-full">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="calendar">Calendario</TabsTrigger>
                <TabsTrigger value="teams">Equipos</TabsTrigger>
                <TabsTrigger value="favorite">Favoritos</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 mb-4">
              {weekDays.map((day, idx) => (
                <div
                  key={idx}
                  className={`text-center p-2 rounded-xl ${
                    day.isToday
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <p className="text-2xl font-bold">{day.day}</p>
                  <p className="text-xs capitalize">{day.label}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-6">
              {calendarEvents.length > 0 ? (
                <div className="space-y-2">
                  {calendarEvents.slice(0, 5).map((event: any) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
                    >
                      <div 
                        className="w-2 h-10 rounded-full"
                        style={{ backgroundColor: event.color || "#2F6FED" }}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.startDate && format(new Date(event.startDate), "d MMM, HH:mm", { locale: es })}
                        </p>
                      </div>
                      {event.user && (
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(event.user.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No hay eventos próximos</p>
                  <Link href="/calendario">
                    <Button variant="ghost" className="mt-2 text-primary">
                      Ver calendario completo
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-80 border-l bg-background p-4 overflow-auto hidden md:block" data-testid="panel-today-tasks">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="messages" className="flex-1 text-xs">
              Mensajes
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-1 text-xs">
              Tareas Hoy
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 text-xs">
              Actividad
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
                  {format(new Date(), "EEEE, d MMMM", { locale: es })}
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
                <h3 className="font-semibold text-sm">Alertas Recientes</h3>
                {alerts.filter((a: any) => !a.isResolved).slice(0, 5).map((alert: any) => (
                  <div key={alert.id} className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                      {alert.message}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      {alert.type} - {alert.priority}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay actividad reciente
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
