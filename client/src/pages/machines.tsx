import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  MapPin,
  Filter,
  AlertTriangle,
  Clock,
  Eye,
  Wrench,
  Settings2,
  Edit,
  Trash2,
} from "lucide-react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Machine, Location } from "@shared/schema";
import { formatDate as formatDateUtil } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const statusLabels: Record<string, string> = {
  operando: "Operando",
  necesita_servicio: "Necesita Servicio",
  vacia: "Vacía",
  fuera_de_linea: "Fuera de Línea",
  mantenimiento: "Mantenimiento",
};

const statusColors: Record<string, string> = {
  operando: "bg-emerald-500 text-white",
  necesita_servicio: "bg-amber-500 text-white",
  vacia: "bg-destructive text-destructive-foreground",
  fuera_de_linea: "bg-muted text-muted-foreground",
  mantenimiento: "bg-blue-500 text-white",
};

const colorVariants = [
  "bg-[#E84545]",
  "bg-[#1D1D1D]",
  "bg-[#8E59FF]",
  "bg-[#4ECB71]",
  "bg-[#FF6B3D]",
];

const machineSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  code: z.string().optional(),
  type: z.string().default("mixta"),
  zone: z.string().min(1, "Selecciona una zona"),
  locationId: z.string().optional(),
  notes: z.string().optional(),
});

type MachineFormData = z.infer<typeof machineSchema>;

const locationSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  address: z.string().optional(),
  zone: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface MachineWithDetails extends Machine {
  locationName?: string;
  inventoryPercentage?: number;
  alertCount?: number;
}

export function MachinesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: machines = [], isLoading } = useQuery<MachineWithDetails[]>({
    queryKey: ["/api/machines"],
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: zones = [] } = useQuery<string[]>({
    queryKey: ["/api/stats/zones"],
  });

  const createMachineMutation = useMutation({
    mutationFn: async (data: MachineFormData) => {
      const cleanData = {
        ...data,
        code: data.code || undefined,
        locationId: data.locationId || undefined,
        notes: data.notes || undefined,
      };
      const response = await apiRequest("POST", "/api/machines", cleanData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({ title: "Máquina creada", description: "La máquina se ha registrado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la máquina", variant: "destructive" });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: LocationFormData) => {
      const cleanData = {
        name: data.name,
        address: data.address || undefined,
        zone: data.zone || undefined,
        contactName: data.contactName || undefined,
        contactPhone: data.contactPhone || undefined,
        notes: data.notes || undefined,
      };
      const response = await apiRequest("POST", "/api/locations", cleanData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setIsLocationDialogOpen(false);
      locationForm.reset();
      toast({ title: "Ubicación creada", description: "La ubicación se ha registrado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la ubicación", variant: "destructive" });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LocationFormData }) => {
      const cleanData = {
        name: data.name,
        address: data.address || undefined,
        zone: data.zone || undefined,
        contactName: data.contactName || undefined,
        contactPhone: data.contactPhone || undefined,
        notes: data.notes || undefined,
      };
      const response = await apiRequest("PATCH", `/api/locations/${id}`, cleanData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setIsLocationDialogOpen(false);
      setEditingLocation(null);
      locationForm.reset();
      toast({ title: "Ubicación actualizada", description: "Los cambios se han guardado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la ubicación", variant: "destructive" });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setDeletingLocationId(null);
      toast({ title: "Ubicación eliminada", description: "La ubicación se ha eliminado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la ubicación", variant: "destructive" });
    },
  });

  const form = useForm<MachineFormData>({
    resolver: zodResolver(machineSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "mixta",
      zone: "",
      notes: "",
    },
  });

  const locationForm = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      address: "",
      zone: "",
      contactName: "",
      contactPhone: "",
      notes: "",
    },
  });

  const handleOpenLocationDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location);
      locationForm.reset({
        name: location.name || "",
        address: location.address || "",
        zone: location.zone || "",
        contactName: location.contactName || "",
        contactPhone: location.contactPhone || "",
        notes: location.notes || "",
      });
    } else {
      setEditingLocation(null);
      locationForm.reset({
        name: "",
        address: "",
        zone: "",
        contactName: "",
        contactPhone: "",
        notes: "",
      });
    }
    setIsLocationDialogOpen(true);
  };

  const handleSaveLocation = (data: LocationFormData) => {
    if (editingLocation) {
      updateLocationMutation.mutate({ id: editingLocation.id, data });
    } else {
      createLocationMutation.mutate(data);
    }
  };

  const filteredMachines = machines.filter((machine) => {
    const matchesSearch =
      machine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (machine.locationName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (machine.zone || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || machine.status === statusFilter;
    const matchesZone = zoneFilter === "all" || machine.zone === zoneFilter;
    return matchesSearch && matchesStatus && matchesZone;
  });

  const allZones = Array.from(new Set([...zones, ...machines.map(m => m.zone).filter(Boolean)]));

  const onSubmit = (data: MachineFormData) => {
    createMachineMutation.mutate(data);
  };

  const formatMachineDate = (date: string | Date | null | undefined) => {
    if (!date) return "Sin visitas";
    try {
      return formatDateUtil(date);
    } catch {
      return "Sin visitas";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Máquinas</h1>
          <p className="text-muted-foreground">
            {machines.length} máquinas registradas • {locations.length} ubicaciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleOpenLocationDialog()} data-testid="button-manage-locations">
            <Settings2 className="h-4 w-4 mr-2" />
            Ubicaciones
          </Button>
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
                        <Input placeholder="Ej: Plaza Central" {...field} data-testid="input-machine-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: MAQ-001" {...field} data-testid="input-machine-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-machine-type">
                            <SelectValue placeholder="Selecciona un tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bebidas_frias">Bebidas Frías</SelectItem>
                          <SelectItem value="bebidas_calientes">Bebidas Calientes</SelectItem>
                          <SelectItem value="snacks">Snacks</SelectItem>
                          <SelectItem value="mixta">Mixta</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <FormControl>
                        <Input placeholder="Ej: Zona Norte" {...field} data-testid="input-machine-zone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ubicación</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-machine-location">
                            <SelectValue placeholder="Selecciona una ubicación" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Notas adicionales..." {...field} data-testid="input-machine-notes" />
                      </FormControl>
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
                  <Button type="submit" disabled={createMachineMutation.isPending} data-testid="button-submit-machine">
                    {createMachineMutation.isPending ? "Guardando..." : "Agregar Máquina"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Location Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={(open) => {
        setIsLocationDialogOpen(open);
        if (!open) {
          setEditingLocation(null);
          locationForm.reset();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Editar Ubicación" : "Nueva Ubicación"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation 
                ? "Modifica la información de la ubicación"
                : "Completa la información para registrar una nueva ubicación"}
            </DialogDescription>
          </DialogHeader>
          <Form {...locationForm}>
            <form onSubmit={locationForm.handleSubmit(handleSaveLocation)} className="space-y-4">
              <FormField
                control={locationForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Plaza Central" {...field} data-testid="input-location-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={locationForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Av. 27 de Febrero #123" {...field} data-testid="input-location-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={locationForm.control}
                name="zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Zona Norte" {...field} data-testid="input-location-zone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={locationForm.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de Contacto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Juan Pérez" {...field} data-testid="input-location-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={locationForm.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono de Contacto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 809-555-1234" {...field} data-testid="input-location-contact-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={locationForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Input placeholder="Notas adicionales..." {...field} data-testid="input-location-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsLocationDialogOpen(false);
                    setEditingLocation(null);
                    locationForm.reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
                  data-testid="button-submit-location"
                >
                  {(createLocationMutation.isPending || updateLocationMutation.isPending) 
                    ? "Guardando..." 
                    : editingLocation ? "Guardar Cambios" : "Crear Ubicación"}
                </Button>
              </div>
            </form>
          </Form>

          {/* Existing Locations List */}
          {!editingLocation && locations.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Ubicaciones Existentes ({locations.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {locations.map((loc) => (
                  <div 
                    key={loc.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-2"
                    data-testid={`location-item-${loc.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{loc.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {loc.address || loc.zone || "Sin dirección"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenLocationDialog(loc)}
                        data-testid={`button-edit-location-${loc.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingLocationId(loc.id)}
                        data-testid={`button-delete-location-${loc.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Location Confirmation */}
      <AlertDialog open={!!deletingLocationId} onOpenChange={(open) => !open && setDeletingLocationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Ubicación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar esta ubicación? Las máquinas asociadas perderán esta referencia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLocationId && deleteLocationMutation.mutate(deletingLocationId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-location"
            >
              {deleteLocationMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="operando">Operando</SelectItem>
              <SelectItem value="necesita_servicio">Necesita Servicio</SelectItem>
              <SelectItem value="vacia">Vacía</SelectItem>
              <SelectItem value="fuera_de_linea">Fuera de Línea</SelectItem>
              <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
            </SelectContent>
          </Select>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-zone-filter">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Zona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {allZones.map((zone) => (
                <SelectItem key={zone} value={zone as string}>
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

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMachines.map((machine, index) => (
            <Card
              key={machine.id}
              className={`${colorVariants[index % colorVariants.length]} text-white border-0 overflow-hidden`}
              data-testid={`card-machine-${machine.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4 gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold truncate">{machine.name}</h3>
                    <p className="text-sm text-white/70 truncate">
                      {machine.locationName || machine.zone || "Sin ubicación"}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-white/20 text-white border-0 shrink-0"
                  >
                    {statusLabels[machine.status || "operando"]}
                  </Badge>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/70">Inventario</span>
                    <span className="text-sm font-medium">{machine.inventoryPercentage || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${machine.inventoryPercentage || 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-white/70">
                    <Clock className="h-4 w-4" />
                    <span>{formatMachineDate(machine.lastVisit)}</span>
                  </div>
                  {(machine.alertCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{machine.alertCount} alertas</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-white hover:bg-white/10"
                    onClick={() => navigate(`/maquinas/${machine.id}`)}
                    data-testid={`button-view-machine-${machine.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-white hover:bg-white/10"
                    onClick={() => navigate(`/maquinas/${machine.id}?tab=servicio`)}
                    data-testid={`button-service-machine-${machine.id}`}
                  >
                    <Wrench className="h-4 w-4 mr-1" />
                    Servicio
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">Nombre</th>
                    <th className="text-left p-4 font-medium">Ubicación</th>
                    <th className="text-left p-4 font-medium">Zona</th>
                    <th className="text-left p-4 font-medium">Estado</th>
                    <th className="text-left p-4 font-medium">Inventario</th>
                    <th className="text-left p-4 font-medium">Última Visita</th>
                    <th className="text-left p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMachines.map((machine) => (
                    <tr key={machine.id} className="border-b hover:bg-muted/50" data-testid={`row-machine-${machine.id}`}>
                      <td className="p-4 font-medium">{machine.name}</td>
                      <td className="p-4 text-muted-foreground">{machine.locationName || "-"}</td>
                      <td className="p-4">{machine.zone || "-"}</td>
                      <td className="p-4">
                        <Badge className={statusColors[machine.status || "operando"]} variant="secondary">
                          {statusLabels[machine.status || "operando"]}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={machine.inventoryPercentage || 0} className="h-2 flex-1" />
                          <span className="text-sm tabular-nums w-10 text-right">{machine.inventoryPercentage || 0}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{formatMachineDate(machine.lastVisit)}</td>
                      <td className="p-4">
                        <Link href={`/maquinas/${machine.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-details-${machine.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredMachines.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {machines.length === 0
                ? "No hay máquinas registradas"
                : "No se encontraron máquinas con los filtros seleccionados"}
            </p>
            {machines.length === 0 && (
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-machine">
                <Plus className="h-4 w-4 mr-2" />
                Agregar primera máquina
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
