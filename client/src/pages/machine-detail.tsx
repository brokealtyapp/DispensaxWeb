import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useSearch, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  MapPin,
  Clock,
  AlertTriangle,
  Package,
  DollarSign,
  Wrench,
  Calendar,
  CheckCircle,
  XCircle,
  Plus,
  TrendingUp,
  User,
  Edit,
  Trash2,
  Power,
  Save,
  Play,
  StopCircle,
  Banknote,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateTime, formatTimeWithSeconds, formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import type { Machine, Location, MachineInventory, MachineAlert, MachineVisit, Product } from "@shared/schema";

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

const alertTypeLabels: Record<string, string> = {
  producto_agotado: "Producto Agotado",
  inventario_bajo: "Inventario Bajo",
  falla_tecnica: "Falla Técnica",
  coin_box_llena: "Coin Box Llena",
  poco_cambio: "Poco Cambio",
  mantenimiento_requerido: "Mantenimiento Requerido",
};

const alertPriorityColors: Record<string, string> = {
  baja: "bg-blue-500",
  media: "bg-amber-500",
  alta: "bg-orange-500",
  critica: "bg-destructive",
};

const alertSchema = z.object({
  type: z.string().min(1, "Selecciona un tipo"),
  priority: z.string().default("media"),
  message: z.string().min(5, "El mensaje debe tener al menos 5 caracteres"),
});

type AlertFormData = z.infer<typeof alertSchema>;

const machineEditSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  code: z.string().optional(),
  type: z.string().default("mixta"),
  zone: z.string().optional(),
  locationId: z.string().optional(),
  notes: z.string().optional(),
});

type MachineEditFormData = z.infer<typeof machineEditSchema>;

const inventorySchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  maxCapacity: z.number().min(1, "La capacidad debe ser mayor a 0"),
  currentQuantity: z.number().min(0, "La cantidad no puede ser negativa"),
  minLevel: z.number().min(0, "El nivel mínimo no puede ser negativo"),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

const serviceSchema = z.object({
  visitType: z.string().default("abastecimiento"),
  notes: z.string().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

const cashCollectionSchema = z.object({
  amount: z.number().min(0, "El monto no puede ser negativo"),
  notes: z.string().optional(),
});

type CashCollectionFormData = z.infer<typeof cashCollectionSchema>;

const productLoadSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  quantity: z.number().min(1, "La cantidad debe ser mayor a 0"),
});

type ProductLoadFormData = z.infer<typeof productLoadSchema>;

interface MachineWithDetails extends Machine {
  location?: Location;
  inventory?: (MachineInventory & { product: Product })[];
  alerts?: MachineAlert[];
  recentVisits?: MachineVisit[];
  salesSummary?: { today: number; week: number; month: number };
  inventoryPercentage?: number;
}

export function MachineDetailPage() {
  const [, params] = useRoute("/maquinas/:id");
  const machineId = params?.id;
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInventoryDialogOpen, setIsInventoryDialogOpen] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<number>(0);
  
  const searchParams = new URLSearchParams(searchString);
  const tabFromUrl = searchParams.get("tab");
  const validTabs = ["servicio", "inventario", "alertas", "visitas", "ventas"];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "servicio";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [serviceStartTime, setServiceStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loadedProducts, setLoadedProducts] = useState<{ productId: string; productName: string; quantity: number }[]>([]);
  const [collectedCash, setCollectedCash] = useState<number | null>(null);
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/maquinas/${machineId}?tab=${tab}`, { replace: true });
  };
  
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isServiceActive && serviceStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - serviceStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isServiceActive, serviceStartTime]);

  const { data: machine, isLoading } = useQuery<MachineWithDetails>({
    queryKey: ["/api/machines", machineId],
    queryFn: async () => {
      const response = await fetch(`/api/machines/${machineId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Error loading machine");
      return response.json();
    },
    enabled: !!machineId,
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: zones = [] } = useQuery<string[]>({
    queryKey: ["/api/stats/zones"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: AlertFormData) => {
      const response = await apiRequest("POST", `/api/machines/${machineId}/alerts`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
      setIsAlertDialogOpen(false);
      alertForm.reset();
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("PATCH", `/api/alerts/${alertId}/resolve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
    },
  });

  const updateMachineMutation = useMutation({
    mutationFn: async (data: MachineEditFormData) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      setIsEditDialogOpen(false);
    },
  });

  const deactivateMachineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}`, { isActive: false, status: "fuera_de_linea" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    },
  });

  const addInventoryMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      const response = await apiRequest("POST", `/api/machines/${machineId}/inventory`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
      setIsInventoryDialogOpen(false);
      inventoryForm.reset();
    },
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async ({ productId, currentQuantity }: { productId: string; currentQuantity: number }) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}/inventory/${productId}`, { currentQuantity });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
      setEditingInventoryId(null);
    },
  });

  const alertForm = useForm<AlertFormData>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      type: "",
      priority: "media",
      message: "",
    },
  });

  const editForm = useForm<MachineEditFormData>({
    resolver: zodResolver(machineEditSchema),
    defaultValues: {
      name: machine?.name || "",
      code: machine?.code || "",
      type: machine?.type || "mixta",
      zone: machine?.zone || "",
      locationId: machine?.locationId || "",
      notes: machine?.notes || "",
    },
  });

  const inventoryForm = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      productId: "",
      maxCapacity: 20,
      currentQuantity: 0,
      minLevel: 5,
    },
  });

  const productLoadForm = useForm<ProductLoadFormData>({
    resolver: zodResolver(productLoadSchema),
    defaultValues: {
      productId: "",
      quantity: 1,
    },
  });

  const allZones = Array.from(new Set([...zones, ...locations.map(l => l.zone).filter(Boolean)]));

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartService = () => {
    setIsServiceActive(true);
    setServiceStartTime(new Date());
    setElapsedTime(0);
    setLoadedProducts([]);
    setCollectedCash(null);
    toast({ title: "Servicio iniciado", description: "El temporizador ha comenzado" });
  };

  const handleAddProduct = (data: ProductLoadFormData) => {
    const product = products.find(p => p.id === data.productId);
    if (product) {
      setLoadedProducts(prev => [...prev, { 
        productId: data.productId, 
        productName: product.name, 
        quantity: data.quantity 
      }]);
      productLoadForm.reset({ productId: "", quantity: 1 });
      toast({ title: "Producto agregado", description: `${data.quantity}x ${product.name}` });
    }
  };

  const handleCollectCash = (amount: number) => {
    setCollectedCash(amount);
    toast({ title: "Efectivo registrado", description: `${formatCurrency(amount)} recolectado` });
  };

  const createVisitMutation = useMutation({
    mutationFn: async (data: { userId: string; visitType: string; startTime: string; durationMinutes: number; notes?: string; cashCollected?: string }) => {
      const response = await apiRequest("POST", `/api/machines/${machineId}/visits`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", machineId] });
      toast({ title: "Servicio registrado", description: "La visita se ha guardado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar la visita", variant: "destructive" });
    },
  });

  const handleFinishService = async (notes?: string) => {
    if (!serviceStartTime) return;
    if (!user?.id) {
      toast({ title: "Error", description: "Debe iniciar sesión para registrar servicios", variant: "destructive" });
      return;
    }
    
    const durationMinutes = Math.ceil((Date.now() - serviceStartTime.getTime()) / 60000);
    
    for (const item of loadedProducts) {
      const inventoryItem = machine?.inventory?.find(inv => inv.productId === item.productId);
      if (inventoryItem) {
        const newQuantity = (inventoryItem.currentQuantity || 0) + item.quantity;
        await updateInventoryMutation.mutateAsync({ 
          productId: item.productId, 
          currentQuantity: Math.min(newQuantity, inventoryItem.maxCapacity || 999)
        });
      }
    }
    
    createVisitMutation.mutate({
      userId: user.id,
      visitType: "abastecimiento",
      startTime: serviceStartTime.toISOString(),
      durationMinutes,
      notes,
      cashCollected: collectedCash ? collectedCash.toString() : undefined,
    });
    
    setIsServiceActive(false);
    setServiceStartTime(null);
    setElapsedTime(0);
    setLoadedProducts([]);
    setCollectedCash(null);
  };

  const handleOpenEditDialog = () => {
    editForm.reset({
      name: machine?.name || "",
      code: machine?.code || "",
      type: machine?.type || "mixta",
      zone: machine?.zone || "",
      locationId: machine?.locationId || "",
      notes: machine?.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveInventoryQuantity = (productId: string) => {
    updateInventoryMutation.mutate({ productId, currentQuantity: editingQuantity });
  };

  const formatMachineDate = (date: string | Date | null | undefined) => {
    if (!date) return "N/A";
    try {
      return formatDateTime(date);
    } catch {
      return "N/A";
    }
  };

  const getTimeAgo = (date: string | Date | null | undefined) => {
    if (!date) return "Nunca";
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
    } catch {
      return "Nunca";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Máquina no encontrada</p>
            <Link href="/maquinas">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al listado
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unresolvedAlerts = machine.alerts?.filter(a => !a.isResolved) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/maquinas">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{machine.name}</h1>
              <Badge className={statusColors[machine.status || "operando"]}>
                {statusLabels[machine.status || "operando"]}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <MapPin className="h-4 w-4" />
              <span>{machine.location?.name || machine.zone || "Sin ubicación"}</span>
              {machine.code && (
                <>
                  <span>•</span>
                  <span>Código: {machine.code}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select 
            value={machine.status || "operando"} 
            onValueChange={(status) => updateStatusMutation.mutate(status)}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-status">
              <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operando">Operando</SelectItem>
              <SelectItem value="necesita_servicio">Necesita Servicio</SelectItem>
              <SelectItem value="vacia">Vacía</SelectItem>
              <SelectItem value="fuera_de_linea">Fuera de Línea</SelectItem>
              <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleOpenEditDialog} data-testid="button-edit-machine">
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive" data-testid="button-deactivate-machine">
                <Power className="h-4 w-4 mr-2" />
                Desactivar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Desactivar esta máquina?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción marcará la máquina como fuera de línea y no aparecerá en las rutas activas. 
                  Puedes reactivarla cambiando su estado posteriormente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => deactivateMachineMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Desactivar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-alert">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Reportar Problema
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reportar Problema</DialogTitle>
                <DialogDescription>
                  Registra una alerta o problema con esta máquina
                </DialogDescription>
              </DialogHeader>
              <Form {...alertForm}>
                <form onSubmit={alertForm.handleSubmit((data) => createAlertMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={alertForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Problema</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-alert-type">
                              <SelectValue placeholder="Selecciona el tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="producto_agotado">Producto Agotado</SelectItem>
                            <SelectItem value="inventario_bajo">Inventario Bajo</SelectItem>
                            <SelectItem value="falla_tecnica">Falla Técnica</SelectItem>
                            <SelectItem value="coin_box_llena">Coin Box Llena</SelectItem>
                            <SelectItem value="poco_cambio">Poco Cambio</SelectItem>
                            <SelectItem value="mantenimiento_requerido">Mantenimiento Requerido</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={alertForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridad</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-alert-priority">
                              <SelectValue placeholder="Selecciona la prioridad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="baja">Baja</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="critica">Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={alertForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe el problema..." 
                            {...field} 
                            data-testid="textarea-alert-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAlertDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createAlertMutation.isPending} data-testid="button-submit-alert">
                      {createAlertMutation.isPending ? "Guardando..." : "Reportar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Diálogo de Editar Máquina */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Máquina</DialogTitle>
            <DialogDescription>
              Modifica la información de la máquina
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateMachineMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Plaza Central" {...field} data-testid="input-edit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: MAQ-001" {...field} data-testid="input-edit-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-type">
                          <SelectValue placeholder="Selecciona el tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mixta">Mixta</SelectItem>
                        <SelectItem value="bebidas">Bebidas</SelectItem>
                        <SelectItem value="snacks">Snacks</SelectItem>
                        <SelectItem value="cafe">Café</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-zone">
                          <SelectValue placeholder="Selecciona una zona" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allZones.map((zone) => (
                          <SelectItem key={zone} value={zone as string}>
                            {zone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-location">
                          <SelectValue placeholder="Selecciona una ubicación" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notas adicionales..." {...field} data-testid="textarea-edit-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMachineMutation.isPending} data-testid="button-save-edit">
                  {updateMachineMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Agregar Producto al Inventario */}
      <Dialog open={isInventoryDialogOpen} onOpenChange={setIsInventoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Producto al Inventario</DialogTitle>
            <DialogDescription>
              Configura un producto para esta máquina
            </DialogDescription>
          </DialogHeader>
          <Form {...inventoryForm}>
            <form onSubmit={inventoryForm.handleSubmit((data) => addInventoryMutation.mutate(data))} className="space-y-4">
              <FormField
                control={inventoryForm.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-inventory-product">
                          <SelectValue placeholder="Selecciona un producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={inventoryForm.control}
                  name="maxCapacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidad Máxima</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-inventory-capacity" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={inventoryForm.control}
                  name="currentQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad Actual</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-inventory-quantity" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={inventoryForm.control}
                name="minLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nivel Mínimo (para alerta)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-inventory-min" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsInventoryDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addInventoryMutation.isPending} data-testid="button-save-inventory">
                  {addInventoryMutation.isPending ? "Guardando..." : "Agregar Producto"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inventario</p>
                <p className="text-2xl font-bold">{machine.inventoryPercentage || 0}%</p>
              </div>
            </div>
            <Progress value={machine.inventoryPercentage || 0} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ventas Hoy</p>
                <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.today || 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Semana: {formatCurrency(machine.salesSummary?.week || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alertas Activas</p>
                <p className="text-2xl font-bold">{unresolvedAlerts.length}</p>
              </div>
            </div>
            {unresolvedAlerts.length > 0 && (
              <p className="text-sm text-amber-600 mt-2">Requiere atención</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Visita</p>
                <p className="text-lg font-bold">{getTimeAgo(machine.lastVisit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="servicio" data-testid="tab-service">
            <Wrench className="h-4 w-4 mr-2" />
            Servicio
          </TabsTrigger>
          <TabsTrigger value="inventario" data-testid="tab-inventory">
            <Package className="h-4 w-4 mr-2" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="alertas" data-testid="tab-alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alertas ({unresolvedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="visitas" data-testid="tab-visits">
            <Calendar className="h-4 w-4 mr-2" />
            Visitas
          </TabsTrigger>
          <TabsTrigger value="ventas" data-testid="tab-sales">
            <DollarSign className="h-4 w-4 mr-2" />
            Ventas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servicio" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Temporizador de Servicio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isServiceActive ? (
                  <div className="text-center py-8">
                    <div className="text-6xl font-mono font-bold text-muted-foreground mb-6">00:00:00</div>
                    <Button size="lg" onClick={handleStartService} data-testid="button-start-service">
                      <Play className="h-5 w-5 mr-2" />
                      Iniciar Servicio
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-6xl font-mono font-bold text-primary mb-2">{formatElapsedTime(elapsedTime)}</div>
                    <p className="text-sm text-muted-foreground mb-6">
                      Inicio: {serviceStartTime ? formatTimeWithSeconds(serviceStartTime) : "-"}
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="lg" variant="destructive" data-testid="button-finish-service">
                          <StopCircle className="h-5 w-5 mr-2" />
                          Finalizar Servicio
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Finalizar servicio?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se registrará la visita con una duración de {formatElapsedTime(elapsedTime)}.
                            {loadedProducts.length > 0 && ` Se actualizará el inventario con ${loadedProducts.length} producto(s).`}
                            {collectedCash !== null && ` Efectivo recolectado: ${formatCurrency(collectedCash)}.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleFinishService()} data-testid="button-confirm-finish">
                            Finalizar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Recolección de Efectivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {collectedCash !== null ? (
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-emerald-500 mb-2">{formatCurrency(collectedCash)}</div>
                    <p className="text-sm text-muted-foreground mb-4">Efectivo registrado</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCollectedCash(null)}
                      data-testid="button-edit-cash"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Modificar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium">RD$</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        id="cash-amount"
                        data-testid="input-cash-amount"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                            if (value > 0) handleCollectCash(value);
                          }
                        }}
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => {
                        const input = document.getElementById("cash-amount") as HTMLInputElement;
                        const value = parseFloat(input?.value) || 0;
                        if (value > 0) handleCollectCash(value);
                      }}
                      data-testid="button-register-cash"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Registrar Efectivo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Cargar Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...productLoadForm}>
                  <form onSubmit={productLoadForm.handleSubmit(handleAddProduct)} className="flex flex-wrap items-end gap-3 mb-4">
                    <FormField
                      control={productLoadForm.control}
                      name="productId"
                      render={({ field }) => (
                        <FormItem className="flex-1 min-w-[200px]">
                          <FormLabel>Producto</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-load-product">
                                <SelectValue placeholder="Selecciona un producto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {machine?.inventory?.map((inv) => (
                                <SelectItem key={inv.productId} value={inv.productId}>
                                  {inv.product?.name || "Producto"} ({inv.currentQuantity}/{inv.maxCapacity})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={productLoadForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormLabel>Cantidad</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                              data-testid="input-load-quantity"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" data-testid="button-add-product">
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </form>
                </Form>

                {loadedProducts.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Productos a cargar:</p>
                    {loadedProducts.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        data-testid={`loaded-product-${index}`}
                      >
                        <span className="font-medium">{item.productName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">+{item.quantity}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setLoadedProducts(prev => prev.filter((_, i) => i !== index))}
                            data-testid={`button-remove-product-${index}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay productos para cargar</p>
                    <p className="text-xs">Selecciona productos del inventario para agregarlos</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Reportar Problema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...alertForm}>
                  <form onSubmit={alertForm.handleSubmit((data) => createAlertMutation.mutate(data))} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={alertForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Problema</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-service-alert-type">
                                  <SelectValue placeholder="Selecciona el tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="producto_agotado">Producto Agotado</SelectItem>
                                <SelectItem value="inventario_bajo">Inventario Bajo</SelectItem>
                                <SelectItem value="falla_tecnica">Falla Técnica</SelectItem>
                                <SelectItem value="coin_box_llena">Coin Box Llena</SelectItem>
                                <SelectItem value="poco_cambio">Poco Cambio</SelectItem>
                                <SelectItem value="mantenimiento_requerido">Mantenimiento Requerido</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={alertForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prioridad</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-service-alert-priority">
                                  <SelectValue placeholder="Selecciona la prioridad" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="baja">Baja</SelectItem>
                                <SelectItem value="media">Media</SelectItem>
                                <SelectItem value="alta">Alta</SelectItem>
                                <SelectItem value="critica">Crítica</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={alertForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción del Problema</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe el problema encontrado..." 
                              {...field} 
                              data-testid="textarea-service-alert-message"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={createAlertMutation.isPending} data-testid="button-submit-service-alert">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        {createAlertMutation.isPending ? "Reportando..." : "Reportar Problema"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventario" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Inventario Actual</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsInventoryDialogOpen(true)}
                data-testid="button-edit-inventory"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            </CardHeader>
            <CardContent>
              {machine.inventory && machine.inventory.length > 0 ? (
                <div className="space-y-4">
                  {machine.inventory.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg" data-testid={`inventory-item-${item.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product?.name || "Producto"}</p>
                        <p className="text-sm text-muted-foreground">
                          Capacidad: {item.maxCapacity} unidades • Mínimo: {item.minLevel}
                        </p>
                      </div>
                      {editingInventoryId === item.productId ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editingQuantity}
                            onChange={(e) => setEditingQuantity(parseInt(e.target.value) || 0)}
                            className="w-20 h-8"
                            data-testid={`input-quantity-${item.id}`}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={() => handleSaveInventoryQuantity(item.productId)}
                            disabled={updateInventoryMutation.isPending}
                            data-testid={`button-save-quantity-${item.id}`}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={() => setEditingInventoryId(null)}
                            data-testid={`button-cancel-quantity-${item.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-24 text-right">
                            <span className="font-medium">{item.currentQuantity}</span>
                            <span className="text-muted-foreground">/{item.maxCapacity}</span>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingInventoryId(item.productId);
                              setEditingQuantity(item.currentQuantity || 0);
                            }}
                            data-testid={`button-edit-quantity-${item.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div className="w-24">
                        <Progress 
                          value={((item.currentQuantity || 0) / (item.maxCapacity || 1)) * 100} 
                          className="h-2" 
                        />
                      </div>
                      {(item.currentQuantity || 0) <= (item.minLevel || 5) && (
                        <Badge variant="destructive" className="shrink-0">
                          Bajo
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay productos en inventario</p>
                  <Button 
                    className="mt-4" 
                    variant="outline" 
                    onClick={() => setIsInventoryDialogOpen(true)}
                    data-testid="button-add-first-product"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar productos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas y Problemas</CardTitle>
            </CardHeader>
            <CardContent>
              {machine.alerts && machine.alerts.length > 0 ? (
                <div className="space-y-3">
                  {machine.alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`flex items-start gap-4 p-4 rounded-lg border ${alert.isResolved ? 'bg-muted/30 opacity-60' : 'bg-background'}`}
                      data-testid={`alert-item-${alert.id}`}
                    >
                      <div className={`p-2 rounded-full ${alertPriorityColors[alert.priority || "media"]}`}>
                        <AlertTriangle className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{alertTypeLabels[alert.type] || alert.type}</p>
                          <Badge variant="outline" className="text-xs">
                            {alert.priority}
                          </Badge>
                          {alert.isResolved && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resuelta
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatMachineDate(alert.createdAt)}
                        </p>
                      </div>
                      {!alert.isResolved && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => resolveAlertMutation.mutate(alert.id)}
                          disabled={resolveAlertMutation.isPending}
                          data-testid={`button-resolve-alert-${alert.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolver
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                  <p className="text-muted-foreground">No hay alertas activas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visitas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Visitas</CardTitle>
            </CardHeader>
            <CardContent>
              {machine.recentVisits && machine.recentVisits.length > 0 ? (
                <div className="space-y-3">
                  {machine.recentVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg" data-testid={`visit-item-${visit.id}`}>
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <User className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium capitalize">{visit.visitType?.replace("_", " ") || "Visita"}</p>
                          {visit.durationMinutes && (
                            <Badge variant="outline" className="text-xs">
                              {visit.durationMinutes} min
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatMachineDate(visit.startTime)}
                        </p>
                        {visit.notes && (
                          <p className="text-sm mt-1">{visit.notes}</p>
                        )}
                      </div>
                      {visit.cashCollected && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Efectivo</p>
                          <p className="font-medium">{formatCurrency(parseFloat(visit.cashCollected))}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay visitas registradas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ventas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Hoy</p>
                  <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.today || 0)}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Últimos 7 días</p>
                  <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.week || 0)}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Últimos 30 días</p>
                  <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.month || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
