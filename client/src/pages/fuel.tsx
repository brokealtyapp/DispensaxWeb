import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertVehicleSchema, insertFuelRecordSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatsCard } from "@/components/StatsCard";
import { DataPagination } from "@/components/DataPagination";
import { formatDateShort } from "@/lib/utils";
import {
  Car,
  Fuel,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Gauge,
  Droplets,
  MapPin,
  Calendar,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Receipt,
  User,
  Route,
  Pencil,
  Trash2,
  Filter,
  X
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

const vehicleFormSchema = insertVehicleSchema.extend({
  plate: z.string().min(1, "La placa es requerida"),
  brand: z.string().min(1, "La marca es requerida"),
  model: z.string().min(1, "El modelo es requerido"),
  year: z.preprocess((val) => val ? parseInt(val as string) : undefined, z.number().optional()),
  tankCapacity: z.preprocess((val) => val ? parseFloat(val as string) : undefined, z.number().optional()),
  expectedMileage: z.preprocess((val) => val ? parseFloat(val as string) : undefined, z.number().optional()),
  currentOdometer: z.preprocess((val) => val ? parseInt(val as string) : 0, z.number().default(0)),
  nextServiceOdometer: z.preprocess((val) => val ? parseInt(val as string) : undefined, z.number().optional()),
  assignedUserId: z.string().optional().nullable(),
});

const fuelRecordFormSchema = insertFuelRecordSchema.extend({
  vehicleId: z.string().min(1, "Selecciona un vehículo"),
  userId: z.string().min(1, "El usuario es requerido"),
  routeId: z.string().optional().nullable(),
  liters: z.preprocess((val) => parseFloat(val as string), z.number().positive("Los litros deben ser positivos")),
  pricePerLiter: z.preprocess((val) => parseFloat(val as string), z.number().positive("El precio debe ser positivo")),
  totalAmount: z.preprocess((val) => parseFloat(val as string), z.number().positive("El total debe ser positivo")),
  odometerReading: z.preprocess((val) => parseInt(val as string), z.number().positive("El odómetro debe ser positivo")),
  isFull: z.boolean().default(true),
});

type VehicleFormData = z.infer<typeof vehicleFormSchema>;
type FuelRecordFormData = z.infer<typeof fuelRecordFormSchema>;

const COLORS = ['#E84545', '#2F6FED', '#4ECB71', '#8E59FF', '#FF6B3D'];

const vehicleTypes = [
  { value: "camioneta", label: "Camioneta" },
  { value: "van", label: "Van" },
  { value: "camion", label: "Camión" },
  { value: "motocicleta", label: "Motocicleta" },
  { value: "auto", label: "Auto" },
];

const fuelTypes = [
  { value: "gasolina_regular", label: "Gasolina Regular" },
  { value: "gasolina_premium", label: "Gasolina Premium" },
  { value: "diesel", label: "Diesel" },
];

const vehicleStatuses = [
  { value: "activo", label: "Activo", color: "bg-green-500" },
  { value: "mantenimiento", label: "En Mantenimiento", color: "bg-yellow-500" },
  { value: "inactivo", label: "Inactivo", color: "bg-gray-500" },
];

type SortField = "recordDate" | "liters" | "totalAmount" | "odometerReading" | "calculatedMileage";
type SortDirection = "asc" | "desc";

export function FuelPage() {
  const [activeTab, setActiveTab] = useState("vehicles");
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [fuelDialogOpen, setFuelDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [fuelRecordToDelete, setFuelRecordToDelete] = useState<string | null>(null);
  
  const [vehiclePage, setVehiclePage] = useState(1);
  const [recordsPage, setRecordsPage] = useState(1);
  const itemsPerPage = 9;
  const recordsPerPage = 10;
  
  const [filterVehicleId, setFilterVehicleId] = useState<string>("");
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  
  const [sortField, setSortField] = useState<SortField>("recordDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  const { toast } = useToast();

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery<any[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: fuelRecords = [], isLoading: loadingRecords } = useQuery<any[]>({
    queryKey: ["/api/fuel-records"],
  });

  const { data: fuelStats, isLoading: loadingStats } = useQuery<any>({
    queryKey: ["/api/fuel-stats"],
  });

  const { data: routes = [] } = useQuery<any[]>({
    queryKey: ["/api/routes"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const vehicleForm = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plate: "",
      brand: "",
      model: "",
      type: "camioneta",
      status: "activo",
      fuelType: "gasolina_regular",
      color: "",
      notes: "",
      currentOdometer: 0,
      assignedUserId: null,
    },
  });

  const fuelForm = useForm<FuelRecordFormData>({
    resolver: zodResolver(fuelRecordFormSchema),
    defaultValues: {
      vehicleId: "",
      userId: "",
      routeId: null,
      fuelType: "gasolina_regular",
      liters: 0,
      pricePerLiter: 0,
      totalAmount: 0,
      odometerReading: 0,
      ticketNumber: "",
      gasStation: "",
      isFull: true,
      notes: "",
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: (data: VehicleFormData) => apiRequest("POST", "/api/vehicles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setVehicleDialogOpen(false);
      vehicleForm.reset();
      toast({ title: "Vehículo registrado", description: "El vehículo se ha agregado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar el vehículo", variant: "destructive" });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VehicleFormData> }) =>
      apiRequest("PATCH", `/api/vehicles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setVehicleDialogOpen(false);
      setEditingVehicle(null);
      vehicleForm.reset();
      toast({ title: "Vehículo actualizado", description: "Los cambios se han guardado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el vehículo", variant: "destructive" });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setVehicleToDelete(null);
      toast({ title: "Vehículo eliminado", description: "El vehículo se ha eliminado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el vehículo", variant: "destructive" });
    },
  });

  const createFuelRecordMutation = useMutation({
    mutationFn: (data: FuelRecordFormData) => apiRequest("POST", "/api/fuel-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fuel-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fuel-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setFuelDialogOpen(false);
      fuelForm.reset();
      toast({ title: "Carga registrada", description: "La carga de combustible se ha registrado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar la carga", variant: "destructive" });
    },
  });

  const deleteFuelRecordMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/fuel-records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fuel-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fuel-stats"] });
      setFuelRecordToDelete(null);
      toast({ title: "Registro eliminado", description: "El registro de combustible se ha eliminado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el registro", variant: "destructive" });
    },
  });

  const openEditVehicle = (vehicle: any) => {
    setEditingVehicle(vehicle);
    vehicleForm.reset({
      plate: vehicle.plate || "",
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      type: vehicle.type || "camioneta",
      status: vehicle.status || "activo",
      fuelType: vehicle.fuelType || "gasolina_regular",
      color: vehicle.color || "",
      notes: vehicle.notes || "",
      year: vehicle.year,
      tankCapacity: vehicle.tankCapacity,
      expectedMileage: vehicle.expectedMileage,
      currentOdometer: vehicle.currentOdometer || 0,
      nextServiceOdometer: vehicle.nextServiceOdometer,
      assignedUserId: vehicle.assignedUserId || null,
    });
    setVehicleDialogOpen(true);
  };

  const closeVehicleDialog = () => {
    setVehicleDialogOpen(false);
    setEditingVehicle(null);
    vehicleForm.reset();
  };

  const onSubmitVehicle = (data: VehicleFormData) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createVehicleMutation.mutate(data);
    }
  };

  const onSubmitFuelRecord = (data: FuelRecordFormData) => {
    createFuelRecordMutation.mutate(data);
  };

  const watchLiters = fuelForm.watch("liters");
  const watchPricePerLiter = fuelForm.watch("pricePerLiter");

  const calculateTotal = () => {
    const liters = parseFloat(watchLiters?.toString() || "0");
    const price = parseFloat(watchPricePerLiter?.toString() || "0");
    const total = liters * price;
    if (!isNaN(total) && total > 0) {
      fuelForm.setValue("totalAmount", total);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = vehicleStatuses.find((s) => s.value === status);
    return (
      <Badge variant="outline" className={`${statusConfig?.color || "bg-gray-500"} text-white border-0`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const filteredRecords = useMemo(() => {
    let records = [...fuelRecords];
    
    if (filterVehicleId) {
      records = records.filter((r: any) => r.vehicleId === filterVehicleId);
    }
    if (filterUserId) {
      records = records.filter((r: any) => r.userId === filterUserId);
    }
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      records = records.filter((r: any) => new Date(r.recordDate) >= start);
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      records = records.filter((r: any) => new Date(r.recordDate) <= end);
    }
    
    records.sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case "recordDate":
          aVal = new Date(a.recordDate).getTime();
          bVal = new Date(b.recordDate).getTime();
          break;
        case "liters":
          aVal = parseFloat(a.liters) || 0;
          bVal = parseFloat(b.liters) || 0;
          break;
        case "totalAmount":
          aVal = parseFloat(a.totalAmount) || 0;
          bVal = parseFloat(b.totalAmount) || 0;
          break;
        case "odometerReading":
          aVal = parseInt(a.odometerReading) || 0;
          bVal = parseInt(b.odometerReading) || 0;
          break;
        case "calculatedMileage":
          aVal = parseFloat(a.calculatedMileage) || 0;
          bVal = parseFloat(b.calculatedMileage) || 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
    
    return records;
  }, [fuelRecords, filterVehicleId, filterUserId, filterStartDate, filterEndDate, sortField, sortDirection]);

  const clearFilters = () => {
    setFilterVehicleId("");
    setFilterUserId("");
    setFilterStartDate("");
    setFilterEndDate("");
    setRecordsPage(1);
  };

  const hasActiveFilters = filterVehicleId || filterUserId || filterStartDate || filterEndDate;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "asc" ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const paginatedVehicles = vehicles.slice(
    (vehiclePage - 1) * itemsPerPage,
    vehiclePage * itemsPerPage
  );

  const paginatedRecords = filteredRecords.slice(
    (recordsPage - 1) * recordsPerPage,
    recordsPage * recordsPerPage
  );

  const totalVehiclePages = Math.ceil(vehicles.length / itemsPerPage);
  const totalRecordPages = Math.ceil(filteredRecords.length / recordsPerPage);

  const performanceData = fuelRecords
    .filter((r: any) => r.calculatedMileage)
    .slice(0, 10)
    .reverse()
    .map((r: any) => ({
      name: formatDateShort(r.recordDate).split('/').slice(0, 2).join('/'),
      rendimiento: parseFloat(r.calculatedMileage || 0),
      vehiculo: r.vehicle?.plate || "",
    }));

  const vehiclePerformanceData = vehicles.map((v: any) => {
    const vehicleRecords = fuelRecords.filter((r: any) => r.vehicleId === v.id);
    const totalLiters = vehicleRecords.reduce((sum: number, r: any) => sum + parseFloat(r.liters || 0), 0);
    const totalAmount = vehicleRecords.reduce((sum: number, r: any) => sum + parseFloat(r.totalAmount || 0), 0);
    return {
      name: v.plate,
      litros: totalLiters,
      gasto: totalAmount,
    };
  }).filter((v: any) => v.litros > 0);

  const costByFuelType = fuelRecords.reduce((acc: any[], r: any) => {
    const existing = acc.find((a) => a.name === r.fuelType);
    if (existing) {
      existing.value += parseFloat(r.totalAmount || 0);
    } else {
      acc.push({
        name: fuelTypes.find((f) => f.value === r.fuelType)?.label || r.fuelType,
        value: parseFloat(r.totalAmount || 0),
      });
    }
    return acc;
  }, []);

  const activeRoutes = routes.filter((r: any) => r.status === "active" || r.status === "in_progress");

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Combustible</h1>
            <p className="text-muted-foreground">Gestión de vehículos y control de combustible</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={vehicleDialogOpen} onOpenChange={(open) => {
              if (!open) closeVehicleDialog();
              else setVehicleDialogOpen(true);
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-vehicle">
                  <Car className="mr-2 h-4 w-4" />
                  Agregar Vehículo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingVehicle ? "Editar Vehículo" : "Nuevo Vehículo"}</DialogTitle>
                </DialogHeader>
                <Form {...vehicleForm}>
                  <form onSubmit={vehicleForm.handleSubmit(onSubmitVehicle)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={vehicleForm.control}
                        name="plate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Placa *</FormLabel>
                            <FormControl>
                              <Input placeholder="ABC-123" {...field} data-testid="input-vehicle-plate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="brand"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Marca *</FormLabel>
                            <FormControl>
                              <Input placeholder="Toyota" {...field} data-testid="input-vehicle-brand" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="model"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Modelo *</FormLabel>
                            <FormControl>
                              <Input placeholder="Hilux" {...field} data-testid="input-vehicle-model" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Año</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="2024" {...field} data-testid="input-vehicle-year" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "camioneta"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-vehicle-type">
                                  <SelectValue placeholder="Seleccionar tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vehicleTypes.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "activo"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-vehicle-status">
                                  <SelectValue placeholder="Seleccionar estado" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vehicleStatuses.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color</FormLabel>
                            <FormControl>
                              <Input placeholder="Blanco" {...field} value={field.value || ""} data-testid="input-vehicle-color" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="fuelType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Combustible</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "gasolina_regular"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-vehicle-fuel-type">
                                  <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {fuelTypes.map((f) => (
                                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="tankCapacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacidad Tanque (L)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="50" {...field} data-testid="input-vehicle-tank" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="expectedMileage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rendimiento Esperado (km/L)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="12" {...field} data-testid="input-vehicle-mileage" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="currentOdometer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Odómetro Actual (km)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="50000" {...field} data-testid="input-vehicle-odometer" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="nextServiceOdometer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Próximo Servicio (km)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="55000" {...field} data-testid="input-vehicle-next-service" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="assignedUserId"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Usuario Asignado</FormLabel>
                            <Select 
                              onValueChange={(val) => field.onChange(val === "none" ? null : val)} 
                              value={field.value || "none"}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-vehicle-assigned-user">
                                  <SelectValue placeholder="Seleccionar usuario (opcional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Sin asignar</SelectItem>
                                {users.map((u: any) => (
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
                    </div>
                    <FormField
                      control={vehicleForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notas</FormLabel>
                          <FormControl>
                            <Input placeholder="Observaciones..." {...field} value={field.value || ""} data-testid="input-vehicle-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={closeVehicleDialog} data-testid="button-cancel-vehicle">
                        Cancelar
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending} 
                        data-testid="button-submit-vehicle"
                      >
                        {(createVehicleMutation.isPending || updateVehicleMutation.isPending) 
                          ? "Guardando..." 
                          : editingVehicle ? "Actualizar" : "Guardar Vehículo"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={fuelDialogOpen} onOpenChange={setFuelDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-fuel-record">
                  <Fuel className="mr-2 h-4 w-4" />
                  Registrar Carga
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nueva Carga de Combustible</DialogTitle>
                </DialogHeader>
                <Form {...fuelForm}>
                  <form onSubmit={fuelForm.handleSubmit(onSubmitFuelRecord)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={fuelForm.control}
                        name="vehicleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehículo *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-fuel-vehicle">
                                  <SelectValue placeholder="Seleccionar vehículo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vehicles.map((v: any) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.plate} - {v.brand} {v.model}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conductor *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-fuel-user">
                                  <SelectValue placeholder="Seleccionar conductor" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users.map((u: any) => (
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
                        control={fuelForm.control}
                        name="routeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ruta (opcional)</FormLabel>
                            <Select 
                              onValueChange={(val) => field.onChange(val === "none" ? null : val)} 
                              value={field.value || "none"}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-fuel-route">
                                  <SelectValue placeholder="Seleccionar ruta" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Sin ruta asociada</SelectItem>
                                {activeRoutes.map((r: any) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="fuelType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Combustible</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "gasolina_regular"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-fuel-type">
                                  <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {fuelTypes.map((f) => (
                                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="gasStation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gasolinera</FormLabel>
                            <FormControl>
                              <Input placeholder="Shell Norte" {...field} value={field.value || ""} data-testid="input-fuel-station" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="liters"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Litros *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.001"
                                placeholder="45.5"
                                {...field}
                                onBlur={calculateTotal}
                                data-testid="input-fuel-liters"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="pricePerLiter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Precio por Litro *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="290.50"
                                {...field}
                                onBlur={calculateTotal}
                                data-testid="input-fuel-price"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="totalAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="13222.75"
                                {...field}
                                data-testid="input-fuel-total"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="odometerReading"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lectura Odómetro (km) *</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="50500" {...field} data-testid="input-fuel-odometer" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="ticketNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>No. de Ticket</FormLabel>
                            <FormControl>
                              <Input placeholder="12345" {...field} value={field.value || ""} data-testid="input-fuel-ticket" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={fuelForm.control}
                        name="isFull"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0 pt-6">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-fuel-full"
                              />
                            </FormControl>
                            <FormLabel className="font-normal">Tanque lleno</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={fuelForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notas</FormLabel>
                          <FormControl>
                            <Input placeholder="Observaciones..." {...field} value={field.value || ""} data-testid="input-fuel-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setFuelDialogOpen(false)} data-testid="button-cancel-fuel">
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createFuelRecordMutation.isPending} data-testid="button-submit-fuel">
                        {createFuelRecordMutation.isPending ? "Guardando..." : "Registrar Carga"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingStats ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <StatsCard
                title="Total Litros"
                value={`${(fuelStats?.totalLiters || 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })} L`}
                icon={Droplets}
                iconColor="primary"
                subtitle="Combustible consumido"
              />
              <StatsCard
                title="Gasto Total"
                value={`$${(fuelStats?.totalAmount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                iconColor="success"
                subtitle="En combustible"
              />
              <StatsCard
                title="Rendimiento Promedio"
                value={`${(fuelStats?.averageMileage || 0).toFixed(1)} km/L`}
                icon={Gauge}
                iconColor="purple"
                subtitle="Eficiencia de flota"
              />
              <StatsCard
                title="Costo por Km"
                value={`$${(fuelStats?.costPerKm || 0).toFixed(2)}`}
                icon={TrendingUp}
                iconColor="warning"
                subtitle="Costo operativo"
              />
            </>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="vehicles" className="gap-2" data-testid="tab-vehicles">
              <Car className="h-4 w-4" />
              <span className="hidden sm:inline">Vehículos</span>
            </TabsTrigger>
            <TabsTrigger value="records" className="gap-2" data-testid="tab-records">
              <Fuel className="h-4 w-4" />
              <span className="hidden sm:inline">Cargas</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2" data-testid="tab-performance">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Rendimiento</span>
            </TabsTrigger>
            <TabsTrigger value="costs" className="gap-2" data-testid="tab-costs">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Costos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="space-y-4">
            {loadingVehicles ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : vehicles.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Car className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No hay vehículos registrados</p>
                  <p className="text-muted-foreground mb-4">Agrega el primer vehículo de tu flota</p>
                  <Button onClick={() => setVehicleDialogOpen(true)} data-testid="button-add-first-vehicle">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Vehículo
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedVehicles.map((vehicle: any) => (
                    <Card key={vehicle.id} className="hover-elevate" data-testid={`card-vehicle-${vehicle.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-lg" data-testid={`text-vehicle-plate-${vehicle.id}`}>{vehicle.plate}</CardTitle>
                          <div className="flex items-center gap-1">
                            {getStatusBadge(vehicle.status)}
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => openEditVehicle(vehicle)}
                              data-testid={`button-edit-vehicle-${vehicle.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog open={vehicleToDelete === vehicle.id} onOpenChange={(open) => !open && setVehicleToDelete(null)}>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setVehicleToDelete(vehicle.id)}
                                  data-testid={`button-delete-vehicle-${vehicle.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se eliminará el vehículo {vehicle.plate} permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel data-testid="button-cancel-delete-vehicle">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteVehicleMutation.mutate(vehicle.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid="button-confirm-delete-vehicle"
                                  >
                                    {deleteVehicleMutation.isPending ? "Eliminando..." : "Eliminar"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <CardDescription data-testid={`text-vehicle-model-${vehicle.id}`}>
                          {vehicle.brand} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Fuel className="h-4 w-4 text-muted-foreground" />
                            <span data-testid={`text-vehicle-fuel-type-${vehicle.id}`}>{fuelTypes.find((f) => f.value === vehicle.fuelType)?.label || vehicle.fuelType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-muted-foreground" />
                            <span data-testid={`text-vehicle-odometer-${vehicle.id}`}>{vehicle.currentOdometer?.toLocaleString() || 0} km</span>
                          </div>
                        </div>
                        {vehicle.expectedMileage && (
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span data-testid={`text-vehicle-expected-mileage-${vehicle.id}`}>Rendimiento esperado: {vehicle.expectedMileage} km/L</span>
                          </div>
                        )}
                        {vehicle.assignedUser && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span data-testid={`text-vehicle-user-${vehicle.id}`}>{vehicle.assignedUser.fullName || vehicle.assignedUser.username}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t flex items-center justify-between">
                          <Badge variant="outline" className="text-xs" data-testid={`badge-vehicle-type-${vehicle.id}`}>
                            {vehicleTypes.find((t) => t.value === vehicle.type)?.label || vehicle.type}
                          </Badge>
                          {vehicle.color && (
                            <span className="text-xs text-muted-foreground">{vehicle.color}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {totalVehiclePages > 1 && (
                  <DataPagination
                    currentPage={vehiclePage}
                    onPageChange={setVehiclePage}
                    totalItems={vehicles.length}
                    itemsPerPage={itemsPerPage}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="records" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg">Registros de Cargas</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    data-testid="button-toggle-filters"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2">{
                        [filterVehicleId, filterUserId, filterStartDate, filterEndDate].filter(Boolean).length
                      }</Badge>
                    )}
                  </Button>
                </div>
                
                {showFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t mt-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Vehículo</label>
                      <Select 
                        value={filterVehicleId || "all"} 
                        onValueChange={(val) => {
                          setFilterVehicleId(val === "all" ? "" : val);
                          setRecordsPage(1);
                        }}
                      >
                        <SelectTrigger data-testid="filter-vehicle">
                          <SelectValue placeholder="Todos los vehículos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los vehículos</SelectItem>
                          {vehicles.map((v: any) => (
                            <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Conductor</label>
                      <Select 
                        value={filterUserId || "all"} 
                        onValueChange={(val) => {
                          setFilterUserId(val === "all" ? "" : val);
                          setRecordsPage(1);
                        }}
                      >
                        <SelectTrigger data-testid="filter-user">
                          <SelectValue placeholder="Todos los conductores" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los conductores</SelectItem>
                          {users.map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>{u.fullName || u.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Fecha Desde</label>
                      <Input
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => {
                          setFilterStartDate(e.target.value);
                          setRecordsPage(1);
                        }}
                        data-testid="filter-start-date"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Fecha Hasta</label>
                      <Input
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => {
                          setFilterEndDate(e.target.value);
                          setRecordsPage(1);
                        }}
                        data-testid="filter-end-date"
                      />
                    </div>
                    {hasActiveFilters && (
                      <div className="col-span-full">
                        <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                          <X className="h-4 w-4 mr-2" />
                          Limpiar filtros
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {loadingRecords ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Fuel className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No hay cargas registradas</p>
                    <p className="text-muted-foreground mb-4">
                      {hasActiveFilters ? "No se encontraron registros con los filtros aplicados" : "Registra la primera carga de combustible"}
                    </p>
                    {!hasActiveFilters && (
                      <Button onClick={() => setFuelDialogOpen(true)} data-testid="button-add-first-fuel">
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar Carga
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleSort("recordDate")}
                              data-testid="sort-date"
                            >
                              <div className="flex items-center">
                                Fecha {getSortIcon("recordDate")}
                              </div>
                            </TableHead>
                            <TableHead>Vehículo</TableHead>
                            <TableHead>Conductor</TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 text-right"
                              onClick={() => toggleSort("liters")}
                              data-testid="sort-liters"
                            >
                              <div className="flex items-center justify-end">
                                Litros {getSortIcon("liters")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 text-right"
                              onClick={() => toggleSort("totalAmount")}
                              data-testid="sort-total"
                            >
                              <div className="flex items-center justify-end">
                                Total {getSortIcon("totalAmount")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 text-right"
                              onClick={() => toggleSort("odometerReading")}
                              data-testid="sort-odometer"
                            >
                              <div className="flex items-center justify-end">
                                Odómetro {getSortIcon("odometerReading")}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 text-right"
                              onClick={() => toggleSort("calculatedMileage")}
                              data-testid="sort-mileage"
                            >
                              <div className="flex items-center justify-end">
                                Rendimiento {getSortIcon("calculatedMileage")}
                              </div>
                            </TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRecords.map((record: any) => (
                            <TableRow key={record.id} data-testid={`row-fuel-record-${record.id}`}>
                              <TableCell data-testid={`text-record-date-${record.id}`}>
                                {formatDateShort(new Date(record.recordDate))}
                              </TableCell>
                              <TableCell data-testid={`text-record-vehicle-${record.id}`}>
                                {record.vehicle?.plate || "—"}
                              </TableCell>
                              <TableCell data-testid={`text-record-user-${record.id}`}>
                                {record.user?.fullName || record.user?.username || "—"}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-record-liters-${record.id}`}>
                                {parseFloat(record.liters).toFixed(2)} L
                              </TableCell>
                              <TableCell className="text-right font-medium" data-testid={`text-record-amount-${record.id}`}>
                                ${parseFloat(record.totalAmount).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-record-odometer-${record.id}`}>
                                {parseInt(record.odometerReading).toLocaleString()} km
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-record-mileage-${record.id}`}>
                                {record.calculatedMileage ? (
                                  <Badge variant="outline" className="text-xs">
                                    {parseFloat(record.calculatedMileage).toFixed(1)} km/L
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <AlertDialog 
                                  open={fuelRecordToDelete === record.id} 
                                  onOpenChange={(open) => !open && setFuelRecordToDelete(null)}
                                >
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setFuelRecordToDelete(record.id)}
                                      data-testid={`button-delete-fuel-${record.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará el registro de carga permanentemente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel data-testid="button-cancel-delete-fuel">Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteFuelRecordMutation.mutate(record.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        data-testid="button-confirm-delete-fuel"
                                      >
                                        {deleteFuelRecordMutation.isPending ? "Eliminando..." : "Eliminar"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {totalRecordPages > 1 && (
                      <div className="mt-4">
                        <DataPagination
                          currentPage={recordsPage}
                          onPageChange={setRecordsPage}
                          totalItems={filteredRecords.length}
                          itemsPerPage={recordsPerPage}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tendencia de Rendimiento</CardTitle>
                  <CardDescription>Km/L en las últimas cargas</CardDescription>
                </CardHeader>
                <CardContent>
                  {performanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, "auto"]} />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(2)} km/L`, "Rendimiento"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="rendimiento"
                          stroke="#E84545"
                          strokeWidth={2}
                          dot={{ fill: "#E84545" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No hay datos de rendimiento
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Consumo por Vehículo</CardTitle>
                  <CardDescription>Litros y gasto total</CardDescription>
                </CardHeader>
                <CardContent>
                  {vehiclePerformanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={vehiclePerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="litros" fill="#2F6FED" name="Litros" />
                        <Bar yAxisId="right" dataKey="gasto" fill="#4ECB71" name="Gasto ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No hay datos de consumo
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Alertas de Rendimiento</CardTitle>
                <CardDescription>Vehículos con rendimiento por debajo del esperado</CardDescription>
              </CardHeader>
              <CardContent>
                {vehicles.filter((v: any) => v.expectedMileage).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                    <p>No hay vehículos con rendimiento esperado configurado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vehicles
                      .filter((v: any) => v.expectedMileage)
                      .map((v: any) => {
                        const vehicleRecords = fuelRecords.filter((r: any) => r.vehicleId === v.id && r.calculatedMileage);
                        const avgMileage = vehicleRecords.length > 0
                          ? vehicleRecords.reduce((sum: number, r: any) => sum + parseFloat(r.calculatedMileage || 0), 0) / vehicleRecords.length
                          : 0;
                        const expected = parseFloat(v.expectedMileage || 0);
                        const percentage = expected > 0 ? (avgMileage / expected * 100) : 100;
                        const isLow = percentage < 85;

                        return (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${isLow ? "bg-red-50 dark:bg-red-950" : "bg-muted/50"}`}
                            data-testid={`alert-vehicle-${v.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Car className={`h-5 w-5 ${isLow ? "text-red-500" : "text-muted-foreground"}`} />
                              <div>
                                <p className="font-medium">{v.plate}</p>
                                <p className="text-sm text-muted-foreground">{v.brand} {v.model}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                {isLow ? (
                                  <ArrowDown className="h-4 w-4 text-red-500" />
                                ) : (
                                  <ArrowUp className="h-4 w-4 text-green-500" />
                                )}
                                <span className={`font-bold ${isLow ? "text-red-500" : "text-green-500"}`}>
                                  {avgMileage.toFixed(1)} km/L
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Esperado: {expected} km/L ({percentage.toFixed(0)}%)
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Distribución por Tipo de Combustible</CardTitle>
                </CardHeader>
                <CardContent>
                  {costByFuelType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={costByFuelType}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {costByFuelType.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No hay datos de costos
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumen de Costos</CardTitle>
                  <CardDescription>Estadísticas generales</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Total Registros</p>
                      <p className="text-2xl font-bold" data-testid="text-total-records">{fuelStats?.recordCount || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Promedio por Carga</p>
                      <p className="text-2xl font-bold" data-testid="text-avg-per-charge">
                        ${(fuelStats?.recordCount ? (fuelStats?.totalAmount || 0) / fuelStats.recordCount : 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Litros Promedio</p>
                      <p className="text-2xl font-bold" data-testid="text-avg-liters">
                        {(fuelStats?.recordCount ? (fuelStats?.totalLiters || 0) / fuelStats.recordCount : 0).toFixed(1)} L
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Vehículos Activos</p>
                      <p className="text-2xl font-bold" data-testid="text-active-vehicles">{vehicles.filter((v: any) => v.status === "activo").length}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Top Vehículos por Gasto</h4>
                    <div className="space-y-2">
                      {vehiclePerformanceData
                        .sort((a: any, b: any) => b.gasto - a.gasto)
                        .slice(0, 5)
                        .map((v: any, idx: number) => (
                          <div key={v.name} className="flex items-center justify-between" data-testid={`top-vehicle-${idx}`}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                                {idx + 1}
                              </Badge>
                              <span>{v.name}</span>
                            </div>
                            <span className="font-medium">
                              ${v.gasto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

export default FuelPage;
