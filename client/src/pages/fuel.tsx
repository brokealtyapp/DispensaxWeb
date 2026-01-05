import { useState } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatsCard } from "@/components/StatsCard";
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
  Receipt,
  User,
  Route
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
});

const fuelRecordFormSchema = insertFuelRecordSchema.extend({
  vehicleId: z.string().min(1, "Selecciona un vehículo"),
  userId: z.string().min(1, "El usuario es requerido"),
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

export function FuelPage() {
  const [activeTab, setActiveTab] = useState("vehicles");
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [fuelDialogOpen, setFuelDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
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
    },
  });

  const fuelForm = useForm<FuelRecordFormData>({
    resolver: zodResolver(fuelRecordFormSchema),
    defaultValues: {
      vehicleId: "",
      userId: "",
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

  const onSubmitVehicle = (data: VehicleFormData) => {
    createVehicleMutation.mutate(data);
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

  const performanceData = fuelRecords
    .filter((r: any) => r.calculatedMileage)
    .slice(0, 10)
    .reverse()
    .map((r: any, idx: number) => ({
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

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Combustible</h1>
            <p className="text-muted-foreground">Gestión de vehículos y control de combustible</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-vehicle">
                  <Car className="mr-2 h-4 w-4" />
                  Agregar Vehículo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nuevo Vehículo</DialogTitle>
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
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setVehicleDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createVehicleMutation.isPending} data-testid="button-submit-vehicle">
                        {createVehicleMutation.isPending ? "Guardando..." : "Guardar Vehículo"}
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
              <DialogContent className="max-w-2xl">
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
                              <Input placeholder="Pemex Norte" {...field} value={field.value || ""} data-testid="input-fuel-station" />
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
                                placeholder="23.50"
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
                                placeholder="1069.25"
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
                      <Button type="button" variant="outline" onClick={() => setFuelDialogOpen(false)}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicles.map((vehicle: any) => (
                  <Card key={vehicle.id} className="hover-elevate" data-testid={`card-vehicle-${vehicle.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg" data-testid={`text-vehicle-plate-${vehicle.id}`}>{vehicle.plate}</CardTitle>
                        {getStatusBadge(vehicle.status)}
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
                      <div className="pt-2 border-t">
                        <Badge variant="outline" className="text-xs" data-testid={`badge-vehicle-type-${vehicle.id}`}>
                          {vehicleTypes.find((t) => t.value === vehicle.type)?.label || vehicle.type}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="records" className="space-y-4">
            {loadingRecords ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : fuelRecords.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Fuel className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No hay cargas registradas</p>
                  <p className="text-muted-foreground mb-4">Registra la primera carga de combustible</p>
                  <Button onClick={() => setFuelDialogOpen(true)} data-testid="button-add-first-fuel">
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar Carga
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {fuelRecords.map((record: any) => (
                  <Card key={record.id} className="hover-elevate" data-testid={`card-fuel-record-${record.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Fuel className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-record-liters-${record.id}`}>
                              {record.vehicle?.plate || "Vehículo"} - {parseFloat(record.liters).toFixed(2)} L
                            </p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span data-testid={`text-record-date-${record.id}`}>{formatDateShort(new Date(record.recordDate))}</span>
                              {record.gasStation && (
                                <>
                                  <span>•</span>
                                  <span data-testid={`text-record-station-${record.id}`}>{record.gasStation}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg" data-testid={`text-record-amount-${record.id}`}>
                            ${parseFloat(record.totalAmount).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center gap-2 text-sm">
                            {record.calculatedMileage && (
                              <Badge variant="outline" className="text-xs" data-testid={`badge-record-mileage-${record.id}`}>
                                {parseFloat(record.calculatedMileage).toFixed(1)} km/L
                              </Badge>
                            )}
                            {record.distanceTraveled && (
                              <span className="text-muted-foreground" data-testid={`text-record-distance-${record.id}`}>
                                {parseFloat(record.distanceTraveled).toLocaleString()} km
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
                      <p className="text-2xl font-bold">{fuelStats?.recordCount || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Promedio por Carga</p>
                      <p className="text-2xl font-bold">
                        ${(fuelStats?.recordCount ? (fuelStats?.totalAmount || 0) / fuelStats.recordCount : 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Litros Promedio</p>
                      <p className="text-2xl font-bold">
                        {(fuelStats?.recordCount ? (fuelStats?.totalLiters || 0) / fuelStats.recordCount : 0).toFixed(1)} L
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Vehículos Activos</p>
                      <p className="text-2xl font-bold">{vehicles.filter((v: any) => v.status === "activo").length}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Top Vehículos por Gasto</h4>
                    <div className="space-y-2">
                      {vehiclePerformanceData
                        .sort((a: any, b: any) => b.gasto - a.gasto)
                        .slice(0, 5)
                        .map((v: any, idx: number) => (
                          <div key={v.name} className="flex items-center justify-between">
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
