import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MachineCard, MachineStatus } from "@/components/MachineCard";
import { DataTable, Column } from "@/components/DataTable";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  MapPin,
  Filter,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// todo: remove mock functionality - replace with actual API data
const mockMachines = [
  {
    id: "1",
    name: "Plaza Central",
    location: "Centro Comercial Norte",
    zone: "Norte",
    status: "operando" as const,
    inventoryLevel: 75,
    lastVisit: "2024-12-25",
    assignedTeam: [
      { name: "Carlos R", initials: "CR" },
      { name: "María G", initials: "MG" },
    ],
  },
  {
    id: "2",
    name: "Edificio Corporativo",
    location: "Zona Industrial",
    zone: "Sur",
    status: "servicio" as const,
    inventoryLevel: 35,
    lastVisit: "2024-12-24",
    assignedTeam: [{ name: "Juan P", initials: "JP" }],
  },
  {
    id: "3",
    name: "Universidad Tech",
    location: "Campus Sur",
    zone: "Sur",
    status: "vacia" as const,
    inventoryLevel: 8,
    lastVisit: "2024-12-23",
    assignedTeam: [
      { name: "Ana L", initials: "AL" },
      { name: "Pedro S", initials: "PS" },
    ],
  },
  {
    id: "4",
    name: "Hospital Central",
    location: "Zona Médica",
    zone: "Centro",
    status: "offline" as const,
    inventoryLevel: 0,
    lastVisit: "2024-12-20",
    assignedTeam: [],
  },
  {
    id: "5",
    name: "Aeropuerto Terminal A",
    location: "Terminal Principal",
    zone: "Este",
    status: "operando" as const,
    inventoryLevel: 92,
    lastVisit: "2024-12-25",
    assignedTeam: [{ name: "María G", initials: "MG" }],
  },
  {
    id: "6",
    name: "Centro Deportivo",
    location: "Parque Olímpico",
    zone: "Oeste",
    status: "operando" as const,
    inventoryLevel: 65,
    lastVisit: "2024-12-24",
    assignedTeam: [{ name: "Carlos R", initials: "CR" }],
  },
];

const statusLabels: Record<MachineStatus, string> = {
  operando: "Operando",
  servicio: "Necesita Servicio",
  vacia: "Vacía",
  offline: "Fuera de Línea",
};

const statusColors: Record<MachineStatus, string> = {
  operando: "bg-emerald-500 text-white",
  servicio: "bg-amber-500 text-white",
  vacia: "bg-destructive text-destructive-foreground",
  offline: "bg-muted text-muted-foreground",
};

const colorVariants: ("blue" | "dark" | "purple" | "green")[] = ["blue", "dark", "purple", "green"];

const machineSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  location: z.string().min(3, "La ubicación es requerida"),
  zone: z.string().min(1, "Selecciona una zona"),
});

type MachineFormData = z.infer<typeof machineSchema>;

export function MachinesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const form = useForm<MachineFormData>({
    resolver: zodResolver(machineSchema),
    defaultValues: {
      name: "",
      location: "",
      zone: "",
    },
  });

  const filteredMachines = mockMachines.filter((machine) => {
    const matchesSearch =
      machine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      machine.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || machine.status === statusFilter;
    const matchesZone = zoneFilter === "all" || machine.zone === zoneFilter;
    return matchesSearch && matchesStatus && matchesZone;
  });

  const zones = Array.from(new Set(mockMachines.map((m) => m.zone)));

  const columns: Column<(typeof mockMachines)[0]>[] = [
    { key: "name", header: "Nombre" },
    { key: "location", header: "Ubicación" },
    { key: "zone", header: "Zona" },
    {
      key: "status",
      header: "Estado",
      render: (item) => (
        <Badge className={statusColors[item.status]} variant="secondary">
          {statusLabels[item.status]}
        </Badge>
      ),
    },
    {
      key: "inventoryLevel",
      header: "Inventario",
      render: (item) => (
        <div className="flex items-center gap-2 min-w-[100px]">
          <Progress value={item.inventoryLevel} className="h-2 flex-1" />
          <span className="text-sm tabular-nums w-10 text-right">{item.inventoryLevel}%</span>
        </div>
      ),
    },
    { key: "lastVisit", header: "Última Visita" },
  ];

  const onSubmit = (data: MachineFormData) => {
    console.log("New machine:", data);
    setIsAddDialogOpen(false);
    form.reset();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Máquinas</h1>
          <p className="text-muted-foreground">
            Gestiona todas las máquinas expendedoras
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-machine">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Máquina
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nueva Máquina</DialogTitle>
              <DialogDescription>
                Completa la información para registrar una nueva máquina
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Plaza Central" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ubicación</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Centro Comercial Norte" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zona</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una zona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {zones.map((zone) => (
                            <SelectItem key={zone} value={zone}>
                              {zone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Agregar Máquina</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar máquinas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-machines"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="operando">Operando</SelectItem>
              <SelectItem value="servicio">Necesita Servicio</SelectItem>
              <SelectItem value="vacia">Vacía</SelectItem>
              <SelectItem value="offline">Fuera de Línea</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-zone-filter">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Zona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-lg">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              data-testid="button-grid-view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              data-testid="button-list-view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMachines.map((machine, index) => (
                <MachineCard
                  key={machine.id}
                  id={machine.id}
                  name={machine.name}
                  location={machine.location}
                  status={machine.status}
                  inventoryLevel={machine.inventoryLevel}
                  lastVisit={machine.lastVisit}
                  assignedTeam={machine.assignedTeam}
                  colorVariant={colorVariants[index % colorVariants.length]}
                  onViewDetails={() => console.log("View details:", machine.id)}
                  onStartService={() => console.log("Start service:", machine.id)}
                />
              ))}
            </div>
          ) : (
            <DataTable
              data={filteredMachines}
              columns={columns}
              searchPlaceholder="Buscar..."
              searchKeys={["name", "location"]}
              onRowClick={(item) => console.log("Row clicked:", item)}
            />
          )}
          {filteredMachines.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No se encontraron máquinas con los filtros seleccionados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
