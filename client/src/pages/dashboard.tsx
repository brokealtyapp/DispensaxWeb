import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, MoreHorizontal, Check } from "lucide-react";

// todo: remove mock functionality - replace with actual API data
const mockProjects = [
  {
    id: "1",
    name: "Zona Norte",
    subtitle: "Team",
    progress: 55,
    members: ["CR", "MG", "JP", "AL"],
    date: "Dic 25",
    colorClass: "bg-[#2F6FED]",
  },
  {
    id: "2",
    name: "Mantenimiento",
    subtitle: "Preventivo",
    progress: 55,
    members: ["PS", "LH"],
    date: "Dic 26",
    colorClass: "bg-[#1D1D1D]",
  },
  {
    id: "3",
    name: "Rutas",
    subtitle: "Optimización",
    progress: 45,
    members: ["RG", "AL", "MG"],
    date: "Dic 27",
    colorClass: "bg-[#FF6B3D]",
  },
];

const mockTasks = [
  {
    id: "1",
    title: "Revisión de Inventario",
    subtitle: "Zona Norte - Máquinas",
    time: "10:00 AM - 11:45 AM",
    assignees: ["CR", "MG"],
    completed: true,
  },
  {
    id: "2",
    title: "Revisión de Inventario",
    subtitle: "Zona Sur - Máquinas",
    time: "10:00 AM - 11:45 AM",
    assignees: ["JP"],
    completed: true,
  },
  {
    id: "3",
    title: "Reunión con Cliente",
    subtitle: "Contrato nuevo",
    time: "01:00 PM - 03:00 PM",
    assignees: ["AL", "PS"],
    completed: false,
  },
  {
    id: "4",
    title: "Planeación",
    subtitle: "Rutas semanales",
    time: "06:00 PM - 07:30 PM",
    assignees: ["MG", "LH"],
    completed: false,
  },
  {
    id: "5",
    title: "Crear Wireframe",
    subtitle: "Dashboard rediseño",
    time: "09:15 PM - 10:00 PM",
    assignees: ["CR"],
    completed: false,
  },
];

const mockCalendarEvents = [
  {
    id: "1",
    title: "Revisión de Inventario",
    members: ["CR", "+4"],
    color: "bg-[#4ECB71]",
    startCol: 3,
    endCol: 5,
    row: 1,
  },
  {
    id: "2",
    title: "Sesión de Planeación",
    members: ["MG", "+3"],
    color: "bg-[#8E59FF]",
    startCol: 1,
    endCol: 3,
    row: 2,
  },
  {
    id: "3",
    title: "Sesión de Planeación",
    members: ["JP", "+2"],
    color: "bg-[#FF6B3D]",
    startCol: 4,
    endCol: 6,
    row: 2,
  },
  {
    id: "4",
    title: "Rediseño de Rutas",
    members: ["AL", "+4"],
    color: "bg-[#2F6FED]",
    startCol: 2,
    endCol: 5,
    row: 3,
  },
];

const weekDays = [
  { day: 13, label: "Vie" },
  { day: 13, label: "Vie" },
  { day: 14, label: "Sáb" },
  { day: 15, label: "Dom", isToday: true },
  { day: 16, label: "Lun" },
  { day: 17, label: "Mar" },
  { day: 17, label: "Mar" },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("today");
  const [tasks, setTasks] = useState(mockTasks);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const openCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Máquinas</h1>
            <p className="text-sm text-muted-foreground">
              Tienes {mockProjects.length} zonas activas
            </p>
          </div>
          <Button className="gap-2" data-testid="button-add-project">
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {mockProjects.map((project) => (
            <Card
              key={project.id}
              className={`${project.colorClass} text-white border-0 overflow-hidden`}
              data-testid={`card-project-${project.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{project.name}</h3>
                    <p className="text-sm text-white/70">{project.subtitle}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/70">Progreso</span>
                    <span className="text-sm font-medium">{project.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {project.members.slice(0, 4).map((member, idx) => (
                      <Avatar
                        key={idx}
                        className="h-8 w-8 border-2 border-current"
                        style={{ borderColor: "inherit" }}
                      >
                        <AvatarFallback className="bg-white/20 text-white text-xs">
                          {member}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {project.members.length > 4 && (
                      <Avatar className="h-8 w-8 border-2 border-current">
                        <AvatarFallback className="bg-white/20 text-white text-xs">
                          +{project.members.length - 4}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-white/20 text-white border-0 hover:bg-white/30"
                  >
                    {project.date}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
                  <p className="text-xs">{day.label}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-6">
              <div className="absolute left-0 top-0 w-16">
                <Badge className="bg-[#4ECB71] text-white border-0">12:30</Badge>
              </div>

              <div className="ml-20 space-y-3">
                <div className="grid grid-cols-6 gap-2 relative h-12">
                  <div className="col-start-3 col-span-2 bg-[#4ECB71] rounded-xl flex items-center gap-2 px-3 text-white">
                    <div className="flex -space-x-1">
                      <Avatar className="h-6 w-6 border border-white/30">
                        <AvatarFallback className="bg-white/20 text-white text-[10px]">
                          CR
                        </AvatarFallback>
                      </Avatar>
                      <Avatar className="h-6 w-6 border border-white/30">
                        <AvatarFallback className="bg-white/20 text-white text-[10px]">
                          +4
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-sm font-medium truncate">
                      Revisión de Inventario
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-2 relative h-12">
                  <div className="col-start-1 col-span-2 bg-[#8E59FF] rounded-xl flex items-center gap-2 px-3 text-white">
                    <div className="flex -space-x-1">
                      <Avatar className="h-6 w-6 border border-white/30">
                        <AvatarFallback className="bg-white/20 text-white text-[10px]">
                          MG
                        </AvatarFallback>
                      </Avatar>
                      <Avatar className="h-6 w-6 border border-white/30">
                        <AvatarFallback className="bg-white/20 text-white text-[10px]">
                          +3
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-sm font-medium truncate">
                      Sesión de Planeación
                    </span>
                  </div>
                  <div className="col-start-4 col-span-2 bg-[#FF6B3D] rounded-xl flex items-center gap-2 px-3 text-white">
                    <div className="flex -space-x-1">
                      <Avatar className="h-6 w-6 border border-white/30">
                        <AvatarFallback className="bg-white/20 text-white text-[10px]">
                          JP
                        </AvatarFallback>
                      </Avatar>
                      <Avatar className="h-6 w-6 border border-white/30">
                        <AvatarFallback className="bg-white/20 text-white text-[10px]">
                          +2
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-sm font-medium truncate">
                      Sesión de Planeación
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-2 relative h-12">
                  <div className="col-start-2 col-span-3 bg-[#2F6FED] rounded-xl flex items-center gap-2 px-3 text-white">
                    <div className="flex -space-x-1">
                      <Avatar className="h-6 w-6 border border-white/30">
                        <AvatarFallback className="bg-white/20 text-white text-[10px]">
                          AL
                        </AvatarFallback>
                      </Avatar>
                      <Avatar className="h-6 w-6 border border-white/30">
                        <AvatarFallback className="bg-white/20 text-white text-[10px]">
                          +4
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-sm font-medium truncate">
                      Rediseño de Rutas
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-80 border-l bg-background p-4 overflow-auto hidden lg:block">
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
        </Tabs>

        <TabsContent value="messages" className="mt-4">
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay mensajes nuevos
          </p>
        </TabsContent>

        <TabsContent value="today" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Tareas de Hoy</h2>
              <p className="text-xs text-muted-foreground">
                {format(new Date(), "EEEE, d MMMM", { locale: es })}
              </p>
            </div>
            <Button size="sm" className="h-8 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Nueva
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="text-xs">
              Todas {tasks.length.toString().padStart(2, "0")}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Abiertas {openCount.toString().padStart(2, "0")}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Cerradas {completedCount.toString().padStart(2, "0")}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Archivadas
            </Badge>
          </div>

          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                data-testid={`task-item-${task.id}`}
              >
                <div
                  className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                    task.completed
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30 hover:border-primary"
                  }`}
                  onClick={() => toggleTask(task.id)}
                >
                  {task.completed && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium text-sm ${
                      task.completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hoy {task.time}
                  </p>
                </div>
                <div className="flex -space-x-1">
                  {task.assignees.slice(0, 2).map((assignee, idx) => (
                    <Avatar key={idx} className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="text-[10px] bg-muted">
                        {assignee}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay actividad reciente
          </p>
        </TabsContent>
      </div>
    </div>
  );
}
