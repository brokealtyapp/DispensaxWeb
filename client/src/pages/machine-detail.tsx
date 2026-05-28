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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Copy,
  Settings as SettingsIcon,
  Grid3x3,
  ClipboardList,
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
import { usePermissions } from "@/hooks/use-permissions";
import type { Machine, Location, MachineInventory, MachineAlert, MachineVisit, Product, MachineTypeOption } from "@shared/schema";

const statusLabels: Record<string, string> = {
  operando: "Operando",
  necesita_servicio: "Necesita Servicio",
  vacia: "Vacía",
  fuera_de_linea: "Fuera de Línea",
  mantenimiento: "Mantenimiento",
};

const statusColors: Record<string, string> = {
  operando: "bg-primary text-primary-foreground",
  necesita_servicio: "bg-secondary text-secondary-foreground",
  vacia: "bg-destructive text-destructive-foreground",
  fuera_de_linea: "bg-muted text-muted-foreground",
  mantenimiento: "bg-primary text-primary-foreground",
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
  baja: "bg-muted",
  media: "bg-primary/60",
  alta: "bg-primary",
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
  refillModeOverride: z.enum(["default", "standard", "manual"]).default("default"),
});

type MachineEditFormData = z.infer<typeof machineEditSchema>;

const inventorySchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  maxCapacity: z.number().min(1, "La capacidad debe ser mayor a 0"),
  currentQuantity: z.number().min(0, "La cantidad no puede ser negativa"),
  minLevel: z.number().min(0, "El nivel mínimo no puede ser negativo"),
  standardQuantity: z.number().min(0, "La cantidad estándar no puede ser negativa").optional(),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

const planogramSchema = z.object({
  maxCapacity: z.number().int().min(1, "La capacidad debe ser mayor a 0"),
  minLevel: z.number().int().min(0, "El nivel mínimo no puede ser negativo"),
  standardQuantity: z.number().int().min(0).nullable(),
}).refine(
  (data) => data.standardQuantity === null || data.standardQuantity <= data.maxCapacity,
  { message: "La carga estándar no puede ser mayor a la capacidad", path: ["standardQuantity"] }
);

type PlanogramFormData = z.infer<typeof planogramSchema>;

const layoutSchema = z.object({
  trayCount: z.number().int().min(1, "Debe haber al menos 1 bandeja").max(20, "Máximo 20 bandejas"),
  lanesPerTray: z.number().int().min(1, "Debe haber al menos 1 carril").max(20, "Máximo 20 carriles por bandeja"),
});

type LayoutFormData = z.infer<typeof layoutSchema>;

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
  const { canEdit } = usePermissions();
  const canEditLayout = canEdit("machines");
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInventoryDialogOpen, setIsInventoryDialogOpen] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<number>(0);
  const [planogramItem, setPlanogramItem] = useState<(MachineInventory & { product: Product }) | null>(null);
  const [isCopyPlanogramOpen, setIsCopyPlanogramOpen] = useState(false);
  const [copySourceMachineId, setCopySourceMachineId] = useState<string>("");
  const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [positionTray, setPositionTray] = useState<string>("");
  const [positionLane, setPositionLane] = useState<string>("");
  
  const searchParams = new URLSearchParams(searchString);
  const tabFromUrl = searchParams.get("tab");
  const validTabs = ["servicio", "inventario", "alertas", "visitas", "ventas", "ordenes"];
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

  type MachineWorkOrder = {
    id: string; orderNumber: string; type: string; priority: string;
    status: string; slaStatus: string | null; slaDeadline: string | null;
    assignedUserId: string | null; createdAt: string;
  };

  const { data: machineOrders = [] } = useQuery<MachineWorkOrder[]>({
    queryKey: ["/api/work-orders", { machineId: machineId }],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders?machineId=${machineId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar órdenes");
      return res.json();
    },
    enabled: !!machineId && activeTab === "ordenes",
  });
  
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
    queryKey: [`/api/machines/${machineId}`],
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

  const { data: machineTypes = [] } = useQuery<MachineTypeOption[]>({
    queryKey: ["/api/machine-types"],
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: AlertFormData) => {
      const response = await apiRequest("POST", `/api/machines/${machineId}/alerts`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/machines"] });
      setIsAlertDialogOpen(false);
      alertForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la alerta", variant: "destructive" });
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("PATCH", `/api/alerts/${alertId}/resolve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/machines"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo resolver la alerta", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/machines"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el estado de la máquina", variant: "destructive" });
    },
  });

  // REGLA: toda mutación que modifique `locationId` o `isActive` de una máquina debe
  // invalidar ["/api/establishments/active"] para mantener el machineCount sincronizado.
  const updateMachineMutation = useMutation({
    mutationFn: async (data: MachineEditFormData) => {
      // El servidor espera null cuando no hay override; el form usa "default" como sentinel
      const { refillModeOverride, ...rest } = data;
      const payload: Omit<MachineEditFormData, "refillModeOverride"> & {
        refillModeOverride: "standard" | "manual" | null;
      } = {
        ...rest,
        refillModeOverride: refillModeOverride === "default" ? null : refillModeOverride,
      };
      const response = await apiRequest("PATCH", `/api/machines/${machineId}`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/machines"] });
      // Puede modificar locationId → actualizar conteo de máquinas por establecimiento
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/active"] });
      setIsEditDialogOpen(false);
      toast({ title: "Máquina actualizada", description: "Los cambios se han guardado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la máquina", variant: "destructive" });
    },
  });

  const deactivateMachineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}`, { isActive: false, status: "fuera_de_linea" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/machines"] });
      // Modifica isActive → la máquina sale del conteo del establecimiento
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/active"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo desactivar la máquina", variant: "destructive" });
    },
  });

  const addInventoryMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      const response = await apiRequest("POST", `/api/machines/${machineId}/inventory`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      setIsInventoryDialogOpen(false);
      inventoryForm.reset();
      toast({ title: "Producto agregado", description: "El producto se agregó al inventario de la máquina" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo agregar el producto al inventario", variant: "destructive" });
    },
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async ({ productId, currentQuantity }: { productId: string; currentQuantity: number }) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}/inventory/${productId}`, { currentQuantity });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      setEditingInventoryId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el inventario", variant: "destructive" });
    },
  });

  const updatePlanogramMutation = useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: PlanogramFormData }) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}/inventory/${productId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      setPlanogramItem(null);
      toast({ title: "Planograma actualizado", description: "Los valores se guardaron correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el planograma", variant: "destructive" });
    },
  });

  const copyPlanogramMutation = useMutation({
    mutationFn: async (sourceMachineId: string) => {
      const response = await apiRequest("POST", `/api/machines/${machineId}/copy-planogram`, { sourceMachineId });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      setIsCopyPlanogramOpen(false);
      setCopySourceMachineId("");
      toast({ title: "Planograma copiado", description: data?.message || "Productos copiados correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "No se pudo copiar el planograma", variant: "destructive" });
    },
  });

  // Otras máquinas del tenant para copiar planograma
  const { data: otherMachines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
    enabled: isCopyPlanogramOpen,
  });

  // Mutación para actualizar el layout de bandejas/carriles
  const updateLayoutMutation = useMutation({
    mutationFn: async (data: LayoutFormData) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}/layout`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      setIsLayoutDialogOpen(false);
      toast({ title: "Layout actualizado", description: "Las bandejas y carriles se guardaron correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el layout", variant: "destructive" });
    },
  });

  // Mutación para asignar posición (bandeja/carril) a un producto
  const updatePositionMutation = useMutation({
    mutationFn: async ({ productId, trayNumber, laneNumber }: { productId: string; trayNumber: number | null; laneNumber: number | null }) => {
      const response = await apiRequest("PATCH", `/api/machines/${machineId}/inventory/${productId}/position`, { trayNumber, laneNumber });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      setEditingPositionId(null);
      setPositionTray("");
      setPositionLane("");
      toast({ title: "Posición actualizada", description: "El carril del producto se guardó correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "No se pudo asignar la posición", variant: "destructive" });
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
      refillModeOverride: (machine?.refillModeOverride === "standard" || machine?.refillModeOverride === "manual")
        ? machine.refillModeOverride
        : "default",
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

  const planogramForm = useForm<PlanogramFormData>({
    resolver: zodResolver(planogramSchema),
    defaultValues: {
      maxCapacity: 20,
      minLevel: 5,
      standardQuantity: null,
    },
  });

  useEffect(() => {
    if (planogramItem) {
      planogramForm.reset({
        maxCapacity: planogramItem.maxCapacity ?? 20,
        minLevel: planogramItem.minLevel ?? 5,
        standardQuantity: planogramItem.standardQuantity ?? null,
      });
    }
  }, [planogramItem]);

  const layoutForm = useForm<LayoutFormData>({
    resolver: zodResolver(layoutSchema),
    defaultValues: {
      trayCount: 6,
      lanesPerTray: 8,
    },
  });

  useEffect(() => {
    if (isLayoutDialogOpen && machine) {
      layoutForm.reset({
        trayCount: machine.trayCount ?? 6,
        lanesPerTray: machine.lanesPerTray ?? 8,
      });
    }
  }, [isLayoutDialogOpen, machine]);

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
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
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
      refillModeOverride: (machine?.refillModeOverride === "standard" || machine?.refillModeOverride === "manual")
        ? machine.refillModeOverride
        : "default",
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
            <div className="flex items-center gap-2 text-muted-foreground mt-1 flex-wrap">
              <MapPin className="h-4 w-4" />
              <span>{machine.location?.name || machine.zone || "Sin ubicación"}</span>
              {machine.code && (
                <>
                  <span>•</span>
                  <span className="font-mono">{machine.code}</span>
                </>
              )}
              {machine.type && (
                <>
                  <span>•</span>
                  <span>{machineTypes.find(mt => mt.value === machine.type)?.name ?? machine.type}</span>
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
              <FormField
                control={editForm.control}
                name="refillModeOverride"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modo de carga (override)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "default"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-refill-mode">
                          <SelectValue placeholder="Usar configuración global" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="default">Usar configuración global</SelectItem>
                        <SelectItem value="standard">Carga estándar (cantidad fija)</SelectItem>
                        <SelectItem value="manual">Manual (cantidad libre)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Sobrescribe el modo de carga por defecto solo para esta máquina.
                    </p>
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
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ventas Hoy</p>
                <p className="text-2xl font-bold">{formatCurrency(machine.salesSummary?.today || 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Semana: {formatCurrency(machine.salesSummary?.week || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alertas Activas</p>
                <p className="text-2xl font-bold">{unresolvedAlerts.length}</p>
              </div>
            </div>
            {unresolvedAlerts.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">Requiere atención</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
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
          <TabsTrigger value="ordenes" data-testid="tab-orders">
            <ClipboardList className="h-4 w-4 mr-2" />
            Órdenes {machineOrders.filter(o => !["cerrada","cancelada"].includes(o.status)).length > 0 && `(${machineOrders.filter(o => !["cerrada","cancelada"].includes(o.status)).length})`}
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
                    <div className="text-4xl font-bold text-primary mb-2">{formatCurrency(collectedCash)}</div>
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

        <TabsContent value="inventario" className="mt-4 space-y-4">
          {canEditLayout && machine?.inventory && (
            <Card data-testid="card-planogram-grid-editor">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid3x3 className="h-5 w-5" />
                  Editor de Planograma
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Click en una celda para asignar o cambiar el SKU de esa posición ({machine.trayCount ?? 6} bandejas × {machine.lanesPerTray ?? 8} carriles).
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const trayCount = machine.trayCount ?? 6;
                  const lanesPerTray = machine.lanesPerTray ?? 8;
                  type InventoryCell = { id: string; productId: string; trayNumber: number | null; laneNumber: number | null; product?: { name?: string } | null };
                  const inventoryItems: InventoryCell[] = (machine.inventory ?? []) as InventoryCell[];
                  const lookup = new Map<string, InventoryCell>();
                  inventoryItems.forEach((it) => {
                    if (it.trayNumber != null && it.laneNumber != null) {
                      lookup.set(`${it.trayNumber}-${it.laneNumber}`, it);
                    }
                  });
                  return Array.from({ length: trayCount }, (_, i) => i + 1).map((tray) => (
                    <div key={tray} className="space-y-1" data-testid={`grid-editor-tray-${tray}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Bandeja {tray}</Badge>
                        <span className="text-xs text-muted-foreground">{lanesPerTray} carriles</span>
                      </div>
                      <div
                        className="grid gap-1"
                        style={{ gridTemplateColumns: `repeat(${Math.min(lanesPerTray, 8)}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: lanesPerTray }, (_, j) => j + 1).map((lane) => {
                          const item = lookup.get(`${tray}-${lane}`);
                          return (
                            <Popover key={lane}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={`p-2 rounded-md border text-xs flex flex-col items-center justify-center min-h-14 text-center hover-elevate active-elevate-2 ${
                                    item ? "bg-card" : "bg-muted/40 border-dashed"
                                  }`}
                                  data-testid={`grid-cell-${tray}-${lane}`}
                                  title={item?.product?.name || "Vacío"}
                                >
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    B{tray}-C{lane}
                                  </span>
                                  <span className="truncate w-full">
                                    {item?.product?.name || (
                                      <span className="text-muted-foreground italic">Vacío</span>
                                    )}
                                  </span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2" data-testid={`popover-cell-${tray}-${lane}`}>
                                <p className="text-xs font-medium mb-2">
                                  Asignar SKU a B{tray}-C{lane}
                                </p>
                                <div className="space-y-1 max-h-64 overflow-y-auto">
                                  {item && (() => {
                                    const row = inventoryItems.find((x) => x.productId === item.productId) as
                                      | (InventoryCell & { maxCapacity?: number; minLevel?: number; standardQuantity?: number | null })
                                      | undefined;
                                    return (
                                      <>
                                        <PlanogramCellInlineEditor
                                          machineId={machineId!}
                                          productId={item.productId}
                                          currentMaxCapacity={row?.maxCapacity ?? 1}
                                          currentStandardQuantity={row?.standardQuantity ?? null}
                                          currentMinLevel={row?.minLevel ?? 0}
                                          cellKey={`${tray}-${lane}`}
                                        />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-xs"
                                        onClick={() => {
                                          updatePositionMutation.mutate({
                                            productId: item.productId,
                                            trayNumber: null,
                                            laneNumber: null,
                                          });
                                        }}
                                        data-testid={`button-clear-cell-${tray}-${lane}`}
                                      >
                                        <XCircle className="h-3 w-3 mr-2" />
                                        Vaciar posición
                                      </Button>
                                      </>
                                    );
                                  })()}
                                  {inventoryItems.map((inv) => {
                                    const isHere = inv.trayNumber === tray && inv.laneNumber === lane;
                                    return (
                                      <Button
                                        key={inv.id}
                                        variant={isHere ? "secondary" : "ghost"}
                                        size="sm"
                                        className="w-full justify-start text-xs"
                                        disabled={isHere || updatePositionMutation.isPending}
                                        onClick={() => {
                                          updatePositionMutation.mutate({
                                            productId: inv.productId,
                                            trayNumber: tray,
                                            laneNumber: lane,
                                          });
                                        }}
                                        data-testid={`button-assign-${inv.productId}-${tray}-${lane}`}
                                      >
                                        <span className="truncate">{inv.product?.name || "Producto"}</span>
                                        {inv.trayNumber && inv.laneNumber && !isHere && (
                                          <Badge variant="outline" className="ml-auto text-[10px]">
                                            B{inv.trayNumber}-C{inv.laneNumber}
                                          </Badge>
                                        )}
                                      </Button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <CardTitle>Inventario Actual</CardTitle>
                {(machine?.refillModeOverride === "standard" || machine?.refillModeOverride === "manual") && (
                  <p className="text-xs text-muted-foreground">
                    Modo de carga override: <span className="font-medium">{machine.refillModeOverride === "standard" ? "Carga estándar" : "Manual"}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" data-testid="badge-machine-layout">
                  Layout: {machine?.trayCount ?? 6} bandejas × {machine?.lanesPerTray ?? 8} carriles
                </Badge>
                {canEditLayout && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLayoutDialogOpen(true)}
                    data-testid="button-edit-layout"
                  >
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Configurar Layout
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCopyPlanogramOpen(true)}
                  data-testid="button-copy-planogram"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Planograma
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInventoryDialogOpen(true)}
                  data-testid="button-edit-inventory"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {machine.inventory && machine.inventory.length > 0 ? (
                <div className="space-y-4">
                  {machine.inventory.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg" data-testid={`inventory-item-${item.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product?.name || "Producto"}</p>
                        <p className="text-sm text-muted-foreground">
                          Capacidad: {item.maxCapacity} • Mínimo: {item.minLevel}
                          {typeof item.standardQuantity === "number" && (
                            <> • Estándar: <span className="font-medium">{item.standardQuantity}</span></>
                          )}
                        </p>
                        {editingPositionId === item.productId ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Select value={positionTray} onValueChange={setPositionTray}>
                              <SelectTrigger className="w-32 h-8" data-testid={`select-tray-${item.id}`}>
                                <SelectValue placeholder="Bandeja" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin asignar</SelectItem>
                                {Array.from({ length: machine?.trayCount ?? 6 }, (_, i) => i + 1).map(n => (
                                  <SelectItem key={n} value={String(n)}>Bandeja {n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={positionLane} onValueChange={setPositionLane} disabled={positionTray === "none" || !positionTray}>
                              <SelectTrigger className="w-28 h-8" data-testid={`select-lane-${item.id}`}>
                                <SelectValue placeholder="Carril" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {Array.from({ length: machine?.lanesPerTray ?? 8 }, (_, i) => i + 1).map(n => (
                                  <SelectItem key={n} value={String(n)}>Carril {n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                const tray = positionTray && positionTray !== "none" ? parseInt(positionTray) : null;
                                const lane = positionLane && positionLane !== "none" ? parseInt(positionLane) : null;
                                if ((tray && !lane) || (!tray && lane)) {
                                  toast({ title: "Posición incompleta", description: "Selecciona bandeja y carril, o ambos como 'Sin asignar'", variant: "destructive" });
                                  return;
                                }
                                updatePositionMutation.mutate({ productId: item.productId, trayNumber: tray, laneNumber: lane });
                              }}
                              disabled={updatePositionMutation.isPending}
                              data-testid={`button-save-position-${item.id}`}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingPositionId(null);
                                setPositionTray("");
                                setPositionLane("");
                              }}
                              data-testid={`button-cancel-position-${item.id}`}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-1">
                            {item.trayNumber && item.laneNumber ? (
                              <Badge variant="secondary" data-testid={`badge-position-${item.id}`}>
                                B{item.trayNumber}-C{item.laneNumber}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-position-${item.id}`}>
                                Sin posición
                              </Badge>
                            )}
                            {canEditLayout && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  setEditingPositionId(item.productId);
                                  setPositionTray(item.trayNumber ? String(item.trayNumber) : "none");
                                  setPositionLane(item.laneNumber ? String(item.laneNumber) : "none");
                                }}
                                data-testid={`button-edit-position-${item.id}`}
                              >
                                Editar posición
                              </Button>
                            )}
                          </div>
                        )}
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
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setPlanogramItem(item)}
                        data-testid={`button-planogram-${item.id}`}
                        title="Configurar planograma"
                      >
                        <SettingsIcon className="h-4 w-4" />
                      </Button>
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
                  <CheckCircle className="h-12 w-12 mx-auto text-primary mb-4" />
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
                      <div className="p-2 bg-muted rounded-lg">
                        <User className="h-5 w-5 text-muted-foreground" />
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

        <TabsContent value="ordenes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Órdenes de Trabajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {machineOrders.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Sin órdenes de trabajo para esta máquina</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {machineOrders.map((order) => {
                    const priorityColors: Record<string, string> = {
                      critica: "bg-destructive", alta: "bg-primary/70",
                      media: "bg-primary/40", baja: "bg-muted",
                    };
                    const statusLabels: Record<string, string> = {
                      pendiente: "Pendiente", asignada: "Asignada", en_proceso: "En proceso",
                      en_ruta: "En ruta", completada: "Completada", cerrada: "Cerrada", cancelada: "Cancelada",
                    };
                    const slaLabels: Record<string, string> = {
                      dentro_tiempo: "A tiempo", proximo_vencer: "Por vencer", vencido: "Vencido",
                    };
                    const slaColors: Record<string, string> = {
                      dentro_tiempo: "text-primary", proximo_vencer: "text-muted-foreground", vencido: "text-destructive",
                    };
                    return (
                      <div
                        key={order.id}
                        className="flex items-center gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                        data-testid={`row-machine-order-${order.id}`}
                        onClick={() => navigate(`/ordenes-trabajo?search=${order.orderNumber}`)}
                      >
                        <div className={`w-1.5 h-10 rounded-full shrink-0 ${priorityColors[order.priority] || "bg-muted"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{order.orderNumber}</span>
                            <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">{order.type}</Badge>
                            <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">{statusLabels[order.status] || order.status}</Badge>
                          </div>
                          {order.slaStatus && (
                            <p className={`text-xs mt-0.5 ${slaColors[order.slaStatus] || ""}`}>
                              SLA: {slaLabels[order.slaStatus] || order.slaStatus}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {new Date(order.createdAt).toLocaleDateString("es-DO")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de Configuración de Planograma */}
      <Dialog open={!!planogramItem} onOpenChange={(open) => !open && setPlanogramItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Planograma</DialogTitle>
            <DialogDescription>
              {planogramItem?.product?.name || "Producto"} — Define la capacidad, mínimo y carga estándar.
            </DialogDescription>
          </DialogHeader>
          <Form {...planogramForm}>
            <form
              onSubmit={planogramForm.handleSubmit((data) => {
                if (!planogramItem) return;
                updatePlanogramMutation.mutate({ productId: planogramItem.productId, data });
              })}
              className="space-y-4"
            >
              <FormField
                control={planogramForm.control}
                name="maxCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad máxima</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-planogram-max"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={planogramForm.control}
                name="minLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nivel mínimo (alerta)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-planogram-min"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={planogramForm.control}
                name="standardQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carga estándar (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Dejar vacío para usar capacidad máxima"
                        value={field.value === null || field.value === undefined ? "" : field.value}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? null : parseInt(v) || 0);
                        }}
                        data-testid="input-planogram-standard"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Cantidad fija sugerida en modo de carga estándar.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPlanogramItem(null)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updatePlanogramMutation.isPending}
                  data-testid="button-save-planogram"
                >
                  {updatePlanogramMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Configurar Layout (bandejas × carriles) */}
      <Dialog open={isLayoutDialogOpen} onOpenChange={setIsLayoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Layout</DialogTitle>
            <DialogDescription>
              Define cuántas bandejas tiene la máquina y cuántos carriles por bandeja. Si reduces el tamaño, las posiciones de productos fuera de rango se limpiarán.
            </DialogDescription>
          </DialogHeader>
          <Form {...layoutForm}>
            <form onSubmit={layoutForm.handleSubmit((data) => updateLayoutMutation.mutate(data))} className="space-y-4">
              <FormField
                control={layoutForm.control}
                name="trayCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bandejas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-tray-count"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={layoutForm.control}
                name="lanesPerTray"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carriles por bandeja</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-lanes-per-tray"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsLayoutDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateLayoutMutation.isPending} data-testid="button-save-layout">
                  {updateLayoutMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Copiar Planograma */}
      <Dialog open={isCopyPlanogramOpen} onOpenChange={setIsCopyPlanogramOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copiar Planograma</DialogTitle>
            <DialogDescription>
              Copia los productos y capacidades de otra máquina. Los productos existentes en esta máquina no se sobrescriben.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Máquina origen</Label>
              <Select value={copySourceMachineId} onValueChange={setCopySourceMachineId}>
                <SelectTrigger data-testid="select-copy-source-machine">
                  <SelectValue placeholder="Selecciona una máquina" />
                </SelectTrigger>
                <SelectContent>
                  {otherMachines
                    .filter((m) => m.id !== machineId)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.code ? `(${m.code})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCopyPlanogramOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => copySourceMachineId && copyPlanogramMutation.mutate(copySourceMachineId)}
                disabled={!copySourceMachineId || copyPlanogramMutation.isPending}
                data-testid="button-confirm-copy-planogram"
              >
                {copyPlanogramMutation.isPending ? "Copiando..." : "Copiar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanogramCellInlineEditor({
  machineId,
  productId,
  currentMaxCapacity,
  currentStandardQuantity,
  currentMinLevel,
  cellKey,
}: {
  machineId: string;
  productId: string;
  currentMaxCapacity: number;
  currentStandardQuantity: number | null;
  currentMinLevel: number;
  cellKey: string;
}) {
  const { toast } = useToast();
  const [maxCapacity, setMaxCapacity] = useState<string>(String(currentMaxCapacity));
  const [standardQuantity, setStandardQuantity] = useState<string>(
    currentStandardQuantity == null ? "" : String(currentStandardQuantity),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const cap = parseInt(maxCapacity, 10);
      const std = standardQuantity === "" ? null : parseInt(standardQuantity, 10);
      if (!Number.isInteger(cap) || cap < 1) {
        throw new Error("Capacidad inválida");
      }
      if (std !== null && (!Number.isInteger(std) || std < 0 || std > cap)) {
        throw new Error("Estándar inválido");
      }
      const response = await apiRequest("PATCH", `/api/machines/${machineId}/inventory/${productId}`, {
        maxCapacity: cap,
        minLevel: currentMinLevel,
        standardQuantity: std,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/machines/${machineId}`] });
      toast({ title: "Valores guardados" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="rounded-md border p-2 mb-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Capacidad</label>
          <Input
            type="number"
            min={1}
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(e.target.value)}
            className="h-8 text-xs"
            data-testid={`input-cell-capacity-${cellKey}`}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Estándar</label>
          <Input
            type="number"
            min={0}
            value={standardQuantity}
            onChange={(e) => setStandardQuantity(e.target.value)}
            className="h-8 text-xs"
            placeholder="—"
            data-testid={`input-cell-standard-${cellKey}`}
          />
        </div>
      </div>
      <Button
        size="sm"
        className="w-full"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        data-testid={`button-save-cell-values-${cellKey}`}
      >
        {mutation.isPending ? "Guardando..." : "Guardar valores"}
      </Button>
    </div>
  );
}
