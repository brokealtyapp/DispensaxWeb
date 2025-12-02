import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCard } from "@/components/StatsCard";
import { MachineCard } from "@/components/MachineCard";
import { AlertCard } from "@/components/AlertCard";
import { TaskCard } from "@/components/TaskCard";
import { CalendarStrip } from "@/components/CalendarStrip";
import { QuickActionCard } from "@/components/QuickActionCard";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Box,
  DollarSign,
  Users,
  AlertTriangle,
  Plus,
  Truck,
  FileText,
  Clock,
} from "lucide-react";

// todo: remove mock functionality - replace with actual API data
const mockMachines = [
  {
    id: "1",
    name: "Plaza Central",
    location: "Centro Comercial Norte",
    status: "operando" as const,
    inventoryLevel: 75,
    lastVisit: "Dic 25",
    assignedTeam: [
      { name: "Carlos R", initials: "CR" },
      { name: "María G", initials: "MG" },
    ],
    colorVariant: "blue" as const,
  },
  {
    id: "2",
    name: "Edificio Corporativo",
    location: "Zona Industrial",
    status: "servicio" as const,
    inventoryLevel: 35,
    lastVisit: "Dic 24",
    assignedTeam: [{ name: "Juan P", initials: "JP" }],
    colorVariant: "dark" as const,
  },
  {
    id: "3",
    name: "Universidad Tech",
    location: "Campus Sur",
    status: "vacia" as const,
    inventoryLevel: 8,
    lastVisit: "Dic 23",
    assignedTeam: [
      { name: "Ana L", initials: "AL" },
      { name: "Pedro S", initials: "PS" },
    ],
    colorVariant: "purple" as const,
  },
];

const mockAlerts = [
  {
    id: "1",
    type: "producto" as const,
    title: "Producto Agotado",
    description: "Coca-Cola 600ml se ha agotado",
    machineName: "Plaza Central",
    priority: "alta" as const,
    timestamp: "Hace 2h",
  },
  {
    id: "2",
    type: "falla" as const,
    title: "Falla en Dispensador",
    description: "El dispensador de la fila 3 no responde",
    machineName: "Edificio Corp",
    priority: "alta" as const,
    timestamp: "Hace 4h",
  },
  {
    id: "3",
    type: "dinero" as const,
    title: "Coin Box Llena",
    description: "El contenedor de monedas está al 95%",
    machineName: "Universidad Tech",
    priority: "media" as const,
    timestamp: "Hace 6h",
  },
];

const mockTasks = [
  {
    id: "1",
    title: "Revisar máquina Plaza Central",
    subtitle: "Reabastecimiento urgente",
    time: "10:00 AM - 11:45 AM",
    assignees: [{ name: "Carlos R", initials: "CR" }],
    completed: true,
  },
  {
    id: "2",
    title: "Mantenimiento Edificio Corp",
    subtitle: "Limpieza programada",
    time: "01:00 PM - 03:00 PM",
    assignees: [{ name: "Juan P", initials: "JP" }],
    completed: false,
  },
  {
    id: "3",
    title: "Recolección de efectivo",
    subtitle: "Zona Norte - 5 máquinas",
    time: "06:00 PM - 07:30 PM",
    assignees: [
      { name: "María G", initials: "MG" },
      { name: "Pedro S", initials: "PS" },
    ],
    completed: false,
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState("today");

  const currentTime = format(new Date(), "HH:mm:ss");
  const currentDate = format(new Date(), "EEEE, d MMMM", { locale: es });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            Buenos días, {user?.fullName?.split(" ")[0] || "Usuario"}
          </h1>
          <p className="text-muted-foreground capitalize">{currentDate}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums" data-testid="text-current-time">
            {currentTime}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Máquinas"
          value={48}
          subtitle="12 activas hoy"
          trend={{ value: 12, isPositive: true }}
          icon={Box}
          iconColor="primary"
        />
        <StatsCard
          title="Ingresos del Mes"
          value="$125,430"
          subtitle="Meta: $150,000"
          trend={{ value: 8.5, isPositive: true }}
          icon={DollarSign}
          iconColor="success"
        />
        <StatsCard
          title="Abastecedores"
          value={8}
          subtitle="5 en ruta"
          icon={Users}
          iconColor="purple"
        />
        <StatsCard
          title="Alertas Activas"
          value={5}
          subtitle="2 críticas"
          trend={{ value: 15, isPositive: false }}
          icon={AlertTriangle}
          iconColor="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle>Máquinas</CardTitle>
              <Button size="sm" data-testid="button-add-machine">
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Tienes {mockMachines.length} máquinas registradas
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {mockMachines.map((machine) => (
                  <MachineCard
                    key={machine.id}
                    {...machine}
                    onViewDetails={() => console.log("View details:", machine.id)}
                    onStartService={() => console.log("Start service:", machine.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calendario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 border-b pb-4">
                <Tabs value="calendar" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 max-w-xs">
                    <TabsTrigger value="calendar">Calendario</TabsTrigger>
                    <TabsTrigger value="teams">Equipos</TabsTrigger>
                    <TabsTrigger value="favorites">Favoritos</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <CalendarStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} />
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500 text-white">12:30</Badge>
                </div>
                <div className="relative pl-4 space-y-2">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />
                  <Card className="bg-[#4ECB71] text-white border-0">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                          CR
                        </div>
                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                          +4
                        </div>
                      </div>
                      <span className="font-medium">Revisión de inventario</span>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#8E59FF] text-white border-0">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                          MG
                        </div>
                      </div>
                      <span className="font-medium">Sesión de planeación</span>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary text-primary-foreground border-0">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                          JP
                        </div>
                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                          +4
                        </div>
                      </div>
                      <span className="font-medium">Rediseño de rutas</span>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="messages" className="flex-1">Mensajes</TabsTrigger>
                    <TabsTrigger value="today" className="flex-1">Hoy</TabsTrigger>
                    <TabsTrigger value="activity" className="flex-1">Actividad</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <TabsContent value="messages" className="m-0">
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay mensajes nuevos
                </p>
              </TabsContent>
              <TabsContent value="today" className="m-0 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Tareas de Hoy</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(), "EEEE, d MMMM", { locale: es })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" data-testid="button-new-task">
                    <Plus className="h-4 w-4 mr-1" />
                    Nueva
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="default">Todas 03</Badge>
                  <Badge variant="secondary">Abiertas</Badge>
                  <Badge variant="secondary">Cerradas</Badge>
                  <Badge variant="secondary">Archivadas</Badge>
                </div>
                <div className="space-y-3">
                  {mockTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      {...task}
                      onToggle={(completed) =>
                        console.log("Task toggled:", task.id, completed)
                      }
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="activity" className="m-0">
                <div className="space-y-3">
                  {mockAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      {...alert}
                      onClick={() => console.log("Alert clicked:", alert.id)}
                    />
                  ))}
                </div>
              </TabsContent>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickActionCard
                title="Nueva Máquina"
                description="Agregar una nueva máquina"
                icon={Plus}
                color="primary"
                onClick={() => console.log("New machine")}
              />
              <QuickActionCard
                title="Crear Ruta"
                description="Planificar ruta de abastecimiento"
                icon={Truck}
                color="success"
                onClick={() => console.log("New route")}
              />
              <QuickActionCard
                title="Generar Reporte"
                description="Crear reporte de ventas"
                icon={FileText}
                color="purple"
                onClick={() => console.log("Generate report")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
