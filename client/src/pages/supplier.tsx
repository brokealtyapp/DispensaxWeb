import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceTimer } from "@/components/ServiceTimer";
import { ProductCard } from "@/components/ProductCard";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import {
  MapPin,
  Navigation,
  Clock,
  Package,
  DollarSign,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Play,
  Square,
  Loader2,
  ChevronRight,
  ChevronDown,
  Phone,
  User,
  ExternalLink,
  Wifi,
  WifiOff,
  History,
  ClipboardCheck,
  Truck,
  Plus,
  Minus,
  FileText,
  PenTool,
  X,
  Image,
  AlertCircle,
  Check,
  Thermometer,
  Sparkles,
  Eye,
  ShoppingCart,
  TrendingUp,
  Target,
  Award,
  RotateCcw,
  Fuel,
  Wrench,
} from "lucide-react";

interface MachineLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  zone?: string;
  latitude?: string;
  longitude?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

interface MachineDetails {
  id: string;
  name: string;
  code: string;
  type?: string;
  status?: string;
  lastVisit?: string;
  notes?: string;
  location?: MachineLocation;
  inventory?: any[];
  alerts?: any[];
  salesSummary?: {
    totalSales: number;
    totalRevenue: number;
  };
}

interface RouteStop {
  id: string;
  order: number;
  status: string;
  estimatedArrival: string;
  actualArrival?: string;
  actualDeparture?: string;
  notes?: string;
  machine: MachineDetails;
}

interface Route {
  id: string;
  date: string;
  status: string;
  totalStops: number;
  completedStops: number;
  estimatedDuration: number;
  actualDuration?: number;
  startTime?: string;
  endTime?: string;
  stops: RouteStop[];
}

interface ServiceChecklist {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

const defaultChecklist: ServiceChecklist[] = [
  { id: "clean_exterior", label: "Limpiar exterior de la máquina", checked: false, required: true },
  { id: "check_temp", label: "Verificar temperatura (refrigeración)", checked: false, required: true },
  { id: "check_display", label: "Revisar display/pantalla", checked: false, required: false },
  { id: "check_coin", label: "Revisar receptor de monedas", checked: false, required: true },
  { id: "check_products", label: "Acomodar productos visibles", checked: false, required: true },
  { id: "check_expiry", label: "Revisar fechas de caducidad", checked: false, required: true },
  { id: "remove_trash", label: "Retirar basura del área", checked: false, required: false },
];

interface ProductToLoad {
  productId: string;
  name: string;
  quantity: number;
  currentInMachine: number;
  maxCapacity: number;
}

export function SupplierPage() {
  // useSearch retorna el query string sin el "?" y se re-renderiza cuando cambia
  const searchString = useSearch();
  // useLocation retorna [path, navigate] - usamos navigate para actualizar la URL
  const [, navigate] = useLocation();
  
  // Extraer tab y id del query string (se recalcula cuando searchString cambia)
  const validTabs = ["ruta", "servicio", "inventario", "rendimiento", "analisis"];
  const { tabFromUrl, supplierIdFromUrl, hasExplicitTab } = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get("tab");
    const id = params.get("id");
    const isValidTab = tab !== null && validTabs.includes(tab);
    return {
      tabFromUrl: isValidTab ? tab : (id ? "analisis" : "ruta"),
      supplierIdFromUrl: id || null,
      hasExplicitTab: isValidTab // Indica si la URL tiene un tab explícito válido
    };
  }, [searchString]);
  
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [currentStop, setCurrentStop] = useState<RouteStop | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [issueType, setIssueType] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [issuePriority, setIssuePriority] = useState("media");
  const [issuePhotoUrl, setIssuePhotoUrl] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ServiceChecklist[]>(defaultChecklist);
  // Estados para registro de combustible
  const [isFuelDialogOpen, setIsFuelDialogOpen] = useState(false);
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelAmount, setFuelAmount] = useState("");
  const [fuelOdometer, setFuelOdometer] = useState("");
  const [fuelStation, setFuelStation] = useState("");
  const [fuelType, setFuelType] = useState("gasolina_regular");
  const [productsToLoad, setProductsToLoad] = useState<ProductToLoad[]>([]);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [responsibleName, setResponsibleName] = useState("");
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  // Inicializar con hasExplicitTab para evitar redirección cuando vienes de otra página con ?tab=ruta
  const userNavigatedExplicitly = useRef(hasExplicitTab);
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Determinar si es admin/supervisor viendo a otro abastecedor
  const isViewingOther = !!supplierIdFromUrl && user?.role && ["admin", "supervisor"].includes(user.role);
  const supplierId = isViewingOther ? supplierIdFromUrl : user?.id;

  // Cargar información del abastecedor cuando se ve a otro
  const { data: targetSupplier, isLoading: isLoadingTargetSupplier } = useQuery<{
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    role: string;
    isActive: boolean;
  }>({
    queryKey: ["/api/users", supplierIdFromUrl],
    enabled: isViewingOther && !!supplierIdFromUrl,
  });

  // Sincronizar activeTab cuando cambie tabFromUrl (navegación del sidebar)
  // Marcar que el usuario navegó explícitamente para evitar redirección automática
  useEffect(() => {
    if (tabFromUrl !== activeTab) {
      userNavigatedExplicitly.current = true;
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Actualizar URL cuando cambie el tab manualmente (click en pestañas internas)
  // Usa navigate de wouter para que useSearch se actualice correctamente
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    // Mantener el id en la URL si está viendo a otro abastecedor
    const idParam = supplierIdFromUrl ? `&id=${supplierIdFromUrl}` : "";
    navigate(`/abastecedor?tab=${newTab}${idParam}`, { replace: true });
  }, [navigate, supplierIdFromUrl]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: "Conexión restaurada", description: "Los datos se sincronizarán automáticamente" });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({ title: "Sin conexión", description: "Los cambios se guardarán localmente", variant: "destructive" });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  const { data: todayRoute, isLoading: isLoadingRoute, refetch: refetchRoute } = useQuery<Route>({
    queryKey: [`/api/supplier/today-route/${supplierId}`],
    enabled: !!supplierId,
  });

  const { data: supplierStats } = useQuery({
    queryKey: [`/api/supplier/stats/${supplierId}`],
    enabled: !!supplierId,
  });

  const getWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { startOfWeek, endOfWeek };
  };

  const weekDates = getWeekDates();

  const { data: weeklyStats, isLoading: isLoadingWeeklyStats } = useQuery<any>({
    queryKey: [`/api/supplier/stats/${supplierId}?startDate=${weekDates.startOfWeek.toISOString()}&endDate=${weekDates.endOfWeek.toISOString()}`],
    enabled: !!supplierId,
  });

  const { data: machineInventory } = useQuery({
    queryKey: [`/api/machines/${currentStop?.machine?.id}/inventory`],
    enabled: !!currentStop?.machine?.id && isServiceActive,
  });

  const { data: supplierInventory } = useQuery<any[]>({
    queryKey: [`/api/supplier/inventory/${supplierId}`],
    enabled: !!supplierId,
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  // Query para obtener el vehículo asignado al abastecedor
  const { data: assignedVehicles = [] } = useQuery<any[]>({
    queryKey: [`/api/vehicles?assignedUserId=${supplierId}`],
    enabled: !!supplierId && !isViewingOther,
  });

  const assignedVehicle = assignedVehicles?.[0] || null;

  // Query para registros de combustible del vehículo asignado
  const { data: fuelRecords = [], refetch: refetchFuelRecords } = useQuery<any[]>({
    queryKey: [`/api/fuel-records?vehicleId=${assignedVehicle?.id}&limit=10`],
    enabled: !!assignedVehicle?.id,
  });

  // Query para estadísticas de combustible del vehículo
  const { data: vehicleFuelStats } = useQuery<any>({
    queryKey: [`/api/vehicles/${assignedVehicle?.id}/fuel-stats`],
    enabled: !!assignedVehicle?.id,
  });

  const { data: machineHistory } = useQuery<any[]>({
    queryKey: [`/api/machines/${currentStop?.machine?.id}/history`],
    enabled: !!currentStop?.machine?.id && isHistoryDialogOpen,
  });

  const { data: pendingAlerts } = useQuery<any[]>({
    queryKey: ["/api/alerts", { resolved: false }],
    enabled: !!supplierId,
  });

  // Queries adicionales para análisis de admin
  const { data: supplierRouteHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/supplier/routes", { userId: supplierId }],
    enabled: isViewingOther && !!supplierId,
  });

  const { data: supplierCashCollections = [] } = useQuery<any[]>({
    queryKey: ["/api/supplier/cash", { userId: supplierId }],
    enabled: isViewingOther && !!supplierId,
  });

  const { data: supplierIssues = [] } = useQuery<any[]>({
    queryKey: ["/api/supplier/issues", { userId: supplierId }],
    enabled: isViewingOther && !!supplierId,
  });

  // Estadísticas mensuales para análisis
  const getMonthDates = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startOfMonth, endOfMonth };
  };

  const monthDates = getMonthDates();

  const { data: monthlyStats } = useQuery<any>({
    queryKey: ["/api/supplier/stats", supplierId, { startDate: monthDates.startOfMonth.toISOString(), endDate: monthDates.endOfMonth.toISOString() }],
    enabled: isViewingOther && !!supplierId,
  });

  // Detectar parada en progreso de la ruta del día
  const inProgressStop = useMemo(() => {
    if (!todayRoute?.stops || isViewingOther) return null;
    return todayRoute.stops.find((stop: RouteStop) => stop.status === "en_progreso") || null;
  }, [todayRoute, isViewingOther]);

  // Query para obtener servicio activo al cargar la página (busca por routeStopId si hay parada en progreso)
  const activeServiceUrl = inProgressStop?.id 
    ? `/api/supplier/active-service/${supplierId}?routeStopId=${inProgressStop.id}`
    : `/api/supplier/active-service/${supplierId}`;
  const { data: activeService } = useQuery<{ 
    id: string; 
    routeStopId: string; 
    startTime?: string;
    checklistData?: string;
    cashCollections?: any[];
    productLoads?: any[];
    issueReports?: any[];
  } | null>({
    queryKey: [activeServiceUrl],
    enabled: !!supplierId && !isViewingOther,
  });

  // Query para productos cargados en el servicio actual
  const { data: loadedProducts = [] } = useQuery<any[]>({
    queryKey: [`/api/supplier/services/${activeServiceId}/products`],
    enabled: !!activeServiceId && isServiceActive,
  });

  // Restaurar estado del servicio activo al cargar la página
  useEffect(() => {
    if (isViewingOther || isServiceActive) return;
    
    // Primero verificar si hay una parada "en_progreso" en la ruta de hoy
    const stopEnProgreso = todayRoute?.stops?.find((stop: RouteStop) => stop.status === "en_progreso");
    
    if (activeService?.id) {
      // Hay un servicio activo en backend - restaurar estado
      // Usar múltiples fuentes para encontrar la parada correspondiente
      let targetStop: RouteStop | null = inProgressStop || stopEnProgreso || null;
      
      // Si no encontramos por estado, buscar por ID del routeStop del servicio
      if (!targetStop && activeService.routeStopId && todayRoute?.stops) {
        targetStop = todayRoute.stops.find((stop: RouteStop) => stop.id === activeService.routeStopId) || null;
      }
      
      // Siempre restaurar el servicio activo (tenemos un ID válido del backend)
      setActiveServiceId(activeService.id);
      setIsServiceActive(true);
      
      // Establecer la parada si existe
      if (targetStop) {
        setCurrentStop(targetStop);
      }
      
      // Restaurar checklist si existe
      if (activeService.checklistData) {
        try {
          const savedChecklist = JSON.parse(activeService.checklistData);
          setChecklist(savedChecklist);
        } catch {
          setChecklist(defaultChecklist.map(item => ({ ...item, checked: false })));
        }
      } else {
        setChecklist(defaultChecklist.map(item => ({ ...item, checked: false })));
      }
      
      // Cambiar automáticamente al tab de servicio activo SOLO si el usuario NO navegó explícitamente
      if (activeTab === "ruta" && !userNavigatedExplicitly.current) {
        handleTabChange("servicio");
      }
    }
    // NOTA: No creamos estado fantasma cuando hay parada en progreso pero no hay servicio activo
    // El usuario debe iniciar el servicio manualmente desde la tarjeta de la parada
  }, [inProgressStop, activeService, isViewingOther, isServiceActive, activeTab, handleTabChange, todayRoute]);

  const startRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      return apiRequest("POST", `/api/supplier/routes/${routeId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supplier/today-route/${supplierId}`] });
      toast({ title: "Ruta iniciada", description: "Tu ruta del día ha comenzado" });
    },
  });

  const startStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      return apiRequest("POST", `/api/supplier/stops/${stopId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supplier/today-route/${supplierId}`] });
    },
  });

  const completeStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      return apiRequest("POST", `/api/supplier/stops/${stopId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supplier/today-route/${supplierId}`] });
    },
  });

  const startServiceMutation = useMutation({
    mutationFn: async (data: { userId: string; machineId: string; routeStopId?: string }) => {
      return apiRequest("POST", "/api/supplier/services", {
        ...data,
        startTime: new Date(),
      });
    },
    onSuccess: (data: any) => {
      setActiveServiceId(data.id);
      toast({ title: "Servicio iniciado" });
    },
  });

  const endServiceMutation = useMutation({
    mutationFn: async ({ serviceId, notes, signature, responsibleName, checklistData }: { serviceId: string; notes?: string; signature?: string; responsibleName?: string; checklistData?: string }) => {
      return apiRequest("POST", `/api/supplier/services/${serviceId}/end`, { notes, signature, responsibleName, checklistData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/services"] });
      queryClient.invalidateQueries({ queryKey: [`/api/supplier/services/${activeServiceId}/products`] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo finalizar el servicio", variant: "destructive" });
      setIsSignatureDialogOpen(false);
    },
  });

  const createCashCollectionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/supplier/cash", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/cash"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/stats", supplierId] });
      toast({ title: "Efectivo registrado", description: `${formatCurrency(parseFloat(cashAmount))} registrados` });
      setCashAmount("");
      setExpectedAmount("");
      setIsCashDialogOpen(false);
    },
  });

  const createIssueReportMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/supplier/issues", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/issues"] });
      queryClient.invalidateQueries({ queryKey: [`/api/supplier/today-route/${supplierId}`] });
      toast({ title: "Reporte enviado", description: "El supervisor ha sido notificado" });
      setIssueType("");
      setIssueDescription("");
      setIssuePriority("media");
      setIssuePhotoUrl(null);
      setIsReportDialogOpen(false);
    },
  });

  // Mutación para registrar carga de combustible
  const createFuelRecordMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/fuel-records", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fuel-records", { vehicleId: assignedVehicle?.id }] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", assignedVehicle?.id, "fuel-stats"] });
      toast({ title: "Combustible registrado", description: `${fuelLiters}L cargados exitosamente` });
      setFuelLiters("");
      setFuelAmount("");
      setFuelOdometer("");
      setFuelStation("");
      setIsFuelDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar la carga de combustible", variant: "destructive" });
    },
  });

  const loadProductsMutation = useMutation({
    mutationFn: async (data: { machineId: string; products: { productId: string; quantity: number }[]; serviceRecordId?: string; targetSupplierId?: string }) => {
      return apiRequest("POST", "/api/supplier/load-from-vehicle", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines", currentStop?.machine?.id, "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/stats", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/inventory", supplierId] });
      queryClient.invalidateQueries({ queryKey: [`/api/supplier/services/${activeServiceId}/products`] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-vehicle-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-transfers"] });
      toast({ title: "Productos cargados", description: "El inventario ha sido actualizado" });
      setProductsToLoad([]);
      setIsLoadDialogOpen(false);
    },
    onError: (error: any) => {
      let errorCode = "";
      let errorMessage = "No se pudieron cargar los productos";
      
      try {
        const errorString = error?.message || String(error);
        const jsonMatch = errorString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          errorCode = parsed.errorCode || "";
          errorMessage = parsed.error || errorMessage;
        }
      } catch {
        // ignore parse error
      }
      
      if (errorCode === "MACHINE_NOT_IN_ZONE") {
        toast({ 
          title: "Máquina fuera de zona", 
          description: "No tienes permiso para abastecer esta máquina. Contacta a tu supervisor.",
          variant: "destructive" 
        });
      } else if (errorCode === "NO_VEHICLE_ASSIGNED") {
        toast({ 
          title: "Sin vehículo asignado", 
          description: "No tienes un vehículo asignado. Contacta al administrador.",
          variant: "destructive" 
        });
      } else if (errorCode === "INSUFFICIENT_STOCK") {
        toast({ 
          title: "Inventario insuficiente", 
          description: "No tienes suficientes productos en tu vehículo",
          variant: "destructive" 
        });
      } else if (errorCode === "INVALID_TARGET_USER") {
        toast({ 
          title: "Usuario inválido", 
          description: "El abastecedor seleccionado no es válido o no existe.",
          variant: "destructive" 
        });
      } else if (errorCode === "SUPPLIER_NOT_IN_ZONE") {
        toast({ 
          title: "Abastecedor fuera de zona", 
          description: "No puedes operar en nombre de un abastecedor que no está en tu zona.",
          variant: "destructive" 
        });
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    },
  });

  const saveChecklistMutation = useMutation({
    mutationFn: async (data: { serviceId: string; checklistData: ServiceChecklist[] }) => {
      return apiRequest("PATCH", `/api/supplier/services/${data.serviceId}/checklist`, { checklistData: data.checklistData });
    },
  });

  const cancelServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      return apiRequest("POST", `/api/supplier/services/${serviceId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supplier/today-route/${supplierId}`] });
      toast({ title: "Servicio cancelado", description: "La parada ha vuelto a estado pendiente" });
      setIsServiceActive(false);
      setCurrentStop(null);
      setActiveServiceId(null);
      setActiveTab("ruta");
      setIsCancelDialogOpen(false);
    },
  });

  // Mutación para recuperar parada inconsistente (en_progreso sin servicio)
  const recoverStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      return apiRequest("POST", `/api/supplier/stops/${stopId}/recover`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/supplier/today-route/${supplierId}`] });
      toast({ title: "Parada recuperada", description: "La parada ha vuelto a estado pendiente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo recuperar la parada", variant: "destructive" });
    },
  });

  const handleStartRoute = () => {
    if (todayRoute?.id) {
      startRouteMutation.mutate(todayRoute.id);
    }
  };

  const handleStartService = async (stop: RouteStop) => {
    if (!supplierId) return;
    
    try {
      // Solo iniciar parada si está pendiente
      if (stop.status === "pendiente") {
        await startStopMutation.mutateAsync(stop.id);
      }
      
      // Crear el servicio
      await startServiceMutation.mutateAsync({
        userId: supplierId,
        machineId: stop.machine.id,
        routeStopId: stop.id,
      });
      
      // Solo cambiar estado local si ambas mutaciones tuvieron éxito
      setCurrentStop(stop);
      setIsServiceActive(true);
      setActiveTab("servicio");
      setChecklist(defaultChecklist.map(item => ({ ...item, checked: false })));
      
    } catch (error) {
      console.error("Error al iniciar servicio:", error);
      toast({
        title: "Error al iniciar servicio",
        description: "Hubo un problema al iniciar el servicio. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      // Refrescar datos para sincronizar con el servidor
      refetchRoute();
    }
  };

  const handleStopService = async (duration: number) => {
    const requiredUnchecked = checklist.filter(item => item.required && !item.checked);
    if (requiredUnchecked.length > 0) {
      toast({
        title: "Checklist incompleto",
        description: `Debes completar: ${requiredUnchecked.map(i => i.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    
    // Mostrar resumen antes de finalizar
    setIsSummaryDialogOpen(true);
  };

  const handleProceedToSignature = () => {
    setIsSummaryDialogOpen(false);
    setIsSignatureDialogOpen(true);
  };

  const handleConfirmServiceEnd = async () => {
    if (!activeServiceId || !currentStop) return;
    
    await endServiceMutation.mutateAsync({ 
      serviceId: activeServiceId,
      signature: signatureData || undefined,
      responsibleName: responsibleName || undefined,
      checklistData: JSON.stringify(checklist),
    });
    await completeStopMutation.mutateAsync(currentStop.id);
    
    toast({
      title: "Servicio finalizado",
      description: "El servicio ha sido registrado correctamente",
    });
    
    setIsServiceActive(false);
    setCurrentStop(null);
    setActiveServiceId(null);
    setActiveTab("ruta");
    setSignatureData(null);
    setResponsibleName("");
    setIsSignatureDialogOpen(false);
    refetchRoute();
  };

  const handleReportIssue = () => {
    if (!supplierId || !currentStop) return;
    
    createIssueReportMutation.mutate({
      machineId: currentStop.machine.id,
      userId: supplierId,
      serviceRecordId: activeServiceId,
      issueType: issueType || "otro",
      description: issueDescription,
      priority: issuePriority,
      photoUrl: issuePhotoUrl || undefined,
    });
  };

  const handleCashCollection = () => {
    if (!supplierId || !currentStop) return;
    
    createCashCollectionMutation.mutate({
      machineId: currentStop.machine.id,
      userId: supplierId,
      serviceRecordId: activeServiceId,
      actualAmount: cashAmount,
      expectedAmount: expectedAmount || undefined,
    });
  };

  const handleFuelRecord = () => {
    if (!supplierId || !assignedVehicle) return;
    
    createFuelRecordMutation.mutate({
      vehicleId: assignedVehicle.id,
      userId: supplierId,
      liters: parseFloat(fuelLiters),
      totalAmount: parseFloat(fuelAmount),
      currentOdometer: parseInt(fuelOdometer),
      fuelType: fuelType,
      gasStation: fuelStation || undefined,
      recordDate: new Date(),
    });
  };

  const handleLoadProducts = () => {
    if (!currentStop || productsToLoad.length === 0) return;
    
    const productsWithQuantity = productsToLoad.filter(p => p.quantity > 0);
    if (productsWithQuantity.length === 0) {
      toast({ title: "Sin productos", description: "Agrega al menos un producto para cargar", variant: "destructive" });
      return;
    }

    loadProductsMutation.mutate({
      machineId: currentStop.machine.id,
      products: productsWithQuantity.map(p => ({ productId: p.productId, quantity: p.quantity })),
      serviceRecordId: activeServiceId || undefined,
      targetSupplierId: isViewingOther ? supplierId : undefined,
    });
  };

  const openNavigator = (stop: RouteStop) => {
    const location = stop.machine?.location;
    if (location?.latitude && location?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
      window.open(url, "_blank");
    } else if (location?.address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
      window.open(url, "_blank");
    } else {
      toast({ title: "Sin ubicación", description: "Esta máquina no tiene dirección registrada", variant: "destructive" });
    }
  };

  const callContact = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  const handlePhotoCapture = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setIssuePhotoUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const initSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ("touches" in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const openLoadDialog = () => {
    const machineInv = currentStop?.machine?.inventory || [];
    const initialProducts: ProductToLoad[] = (products || []).map(p => {
      const invItem = machineInv.find((i: any) => i.productId === p.id);
      return {
        productId: p.id,
        name: p.name,
        quantity: 0,
        currentInMachine: invItem?.currentQuantity || 0,
        maxCapacity: invItem?.maxCapacity || 20,
      };
    });
    setProductsToLoad(initialProducts);
    setIsLoadDialogOpen(true);
  };

  const updateProductQuantity = (productId: string, delta: number) => {
    setProductsToLoad(prev => prev.map(p => {
      if (p.productId === productId) {
        const newQty = Math.max(0, Math.min(p.maxCapacity - p.currentInMachine, p.quantity + delta));
        return { ...p, quantity: newQty };
      }
      return p;
    }));
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => {
      const updated = prev.map(item => 
        item.id === id ? { ...item, checked: !item.checked } : item
      );
      // Guardar automáticamente en el servidor
      if (activeServiceId) {
        saveChecklistMutation.mutate({ serviceId: activeServiceId, checklistData: updated });
      }
      return updated;
    });
  };

  const handleCancelService = () => {
    if (activeServiceId) {
      cancelServiceMutation.mutate(activeServiceId);
    }
  };

  const completedStops = todayRoute?.completedStops || 0;
  const totalStops = todayRoute?.totalStops || 0;
  const estimatedDuration = todayRoute?.estimatedDuration || 0;
  const checklistProgress = Math.round((checklist.filter(i => i.checked).length / checklist.length) * 100);
  const urgentAlerts = (pendingAlerts || []).filter((a: any) => a.priority === "critica" || a.priority === "alta");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completada":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Completada</Badge>;
      case "en_progreso":
        return <Badge className="bg-blue-500 hover:bg-blue-600">En progreso</Badge>;
      default:
        return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  if (isAuthLoading || isLoadingRoute) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Banner cuando admin/supervisor ve a otro abastecedor */}
      {isViewingOther && targetSupplier && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-lg">{targetSupplier.fullName}</p>
                <p className="text-sm text-muted-foreground">{targetSupplier.email} {targetSupplier.phone ? `• ${targetSupplier.phone}` : ""}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/abastecedores")} data-testid="button-back-suppliers">
              Volver a lista
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Header con indicador de conexión */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">
              {isViewingOther ? `Análisis de ${targetSupplier?.fullName?.split(" ")[0] || "Abastecedor"}` : "Panel de Abastecedor"}
            </h1>
            {!isViewingOther && (
              <Badge variant={isOnline ? "outline" : "destructive"} className="gap-1">
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isOnline ? "En línea" : "Sin conexión"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm md:text-base">
            {todayRoute ? formatDate(todayRoute.date) : "Sin ruta asignada"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {urgentAlerts.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              {urgentAlerts.length} alertas urgentes
            </Badge>
          )}
          {todayRoute && todayRoute.status === "pendiente" && (
            <Button onClick={handleStartRoute} disabled={startRouteMutation.isPending} data-testid="button-start-route" size="lg">
              {startRouteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Iniciar Ruta
            </Button>
          )}
          <Badge variant="outline" className="gap-1 text-sm md:text-base py-1 px-3" data-testid="badge-progress">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {completedStops}/{totalStops} completadas
          </Badge>
        </div>
      </div>

      {/* Stats Cards - Más compactas en móvil */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card data-testid="card-stat-stops">
          <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-primary/10 text-primary">
              <Navigation className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{totalStops}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Paradas hoy</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-time">
          <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Clock className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{Math.round(estimatedDuration / 60)}h</p>
              <p className="text-xs md:text-sm text-muted-foreground">Tiempo estimado</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-products">
          <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-purple-500/10 text-purple-500">
              <Package className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{(supplierStats as any)?.productsLoaded || 0}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Productos cargados</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-cash">
          <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-amber-500/10 text-amber-500">
              <DollarSign className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">${((supplierStats as any)?.cashCollected || 0).toFixed(0)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Efectivo recolectado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList data-testid="tabs-list" className="w-full md:w-auto flex-wrap">
          {isViewingOther && (
            <TabsTrigger value="analisis" data-testid="tab-analysis" className="flex-1 md:flex-none">
              <Eye className="h-4 w-4 mr-1" />
              Análisis
            </TabsTrigger>
          )}
          <TabsTrigger value="ruta" data-testid="tab-route" className="flex-1 md:flex-none">
            {isViewingOther ? "Ruta Hoy" : "Mi Ruta"}
          </TabsTrigger>
          {!isViewingOther && (
            <TabsTrigger value="servicio" disabled={!isServiceActive} data-testid="tab-service" className="flex-1 md:flex-none">
              Servicio Activo
            </TabsTrigger>
          )}
          <TabsTrigger value="inventario" data-testid="tab-inventory" className="flex-1 md:flex-none">
            {isViewingOther ? "Inventario" : "Mi Vehículo"}
          </TabsTrigger>
          <TabsTrigger value="rendimiento" data-testid="tab-performance" className="flex-1 md:flex-none">
            {isViewingOther ? "Rendimiento" : "Mi Rendimiento"}
          </TabsTrigger>
        </TabsList>

        {/* TAB: Mi Ruta */}
        <TabsContent value="ruta" className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 space-y-3 md:space-y-4">
              <Card>
                <CardHeader className="pb-2 md:pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Navigation className="h-5 w-5" />
                    Ruta del Día
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!todayRoute ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No tienes una ruta asignada para hoy</p>
                    </div>
                  ) : (
                    todayRoute.stops?.map((stop) => (
                      <Collapsible 
                        key={stop.id} 
                        open={expandedStop === stop.id}
                        onOpenChange={() => setExpandedStop(expandedStop === stop.id ? null : stop.id)}
                      >
                        <div 
                          className={`p-3 md:p-4 rounded-lg border transition-colors ${
                            stop.status === "en_progreso" ? "border-primary bg-primary/5" : 
                            stop.status === "completada" ? "bg-muted/50" : ""
                          }`}
                          data-testid={`card-stop-${stop.id}`}
                        >
                          <div className="flex items-start justify-between gap-2 md:gap-4">
                            <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shrink-0 ${
                                stop.status === "completada" ? "bg-emerald-500 text-white" :
                                stop.status === "en_progreso" ? "bg-primary text-white" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {stop.status === "completada" ? <CheckCircle2 className="h-4 w-4" /> : stop.order}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-sm md:text-base truncate">{stop.machine?.name || "Máquina"}</h4>
                                <p className="text-xs md:text-sm text-muted-foreground truncate">
                                  {stop.machine?.location?.name || stop.machine?.code || ""}
                                </p>
                                <div className="flex items-center gap-2 md:gap-4 mt-1 md:mt-2 text-xs md:text-sm text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {stop.estimatedArrival ? formatTime(stop.estimatedArrival) : "--:--"}
                                  </span>
                                  {stop.machine?.location?.address && (
                                    <span className="flex items-center gap-1 truncate">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{stop.machine.location.address}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 shrink-0">
                              {getStatusBadge(stop.status)}
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedStop === stop.id ? "rotate-180" : ""}`} />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          
                          <CollapsibleContent className="mt-3 pt-3 border-t space-y-3">
                            {/* Información de contacto */}
                            {stop.machine?.location && (
                              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <User className="h-4 w-4" />
                                  Contacto del local
                                </div>
                                {stop.machine.location.contactName && (
                                  <p className="text-sm">{stop.machine.location.contactName}</p>
                                )}
                                {stop.machine.location.contactPhone && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="gap-2"
                                    onClick={() => callContact(stop.machine.location!.contactPhone!)}
                                    data-testid={`button-call-${stop.id}`}
                                  >
                                    <Phone className="h-4 w-4" />
                                    {stop.machine.location.contactPhone}
                                  </Button>
                                )}
                                {stop.machine.location.notes && (
                                  <p className="text-xs text-muted-foreground">{stop.machine.location.notes}</p>
                                )}
                              </div>
                            )}

                            {/* Última visita e historial */}
                            {stop.machine?.lastVisit && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <History className="h-4 w-4" />
                                Última visita: {formatDistanceToNow(new Date(stop.machine.lastVisit), { addSuffix: true, locale: es })}
                              </div>
                            )}

                            {/* Alertas de la máquina */}
                            {stop.machine?.alerts && stop.machine.alerts.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {stop.machine.alerts.slice(0, 3).map((alert: any) => (
                                  <Badge key={alert.id} variant={alert.priority === "critica" ? "destructive" : "secondary"} className="gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {alert.message}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Botones de acción */}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => openNavigator(stop)}
                                data-testid={`button-navigate-${stop.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                                Navegar
                              </Button>
                              
                              {/* Mostrar botón si: parada pendiente, o parada en_progreso sin servicio activo */}
                              {todayRoute.status === "en_progreso" && 
                               (stop.status === "pendiente" || (stop.status === "en_progreso" && !isServiceActive)) && (
                                <Button 
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => handleStartService(stop)}
                                  disabled={startServiceMutation.isPending || startStopMutation.isPending}
                                  data-testid={`button-start-service-${stop.id}`}
                                >
                                  {(startServiceMutation.isPending || startStopMutation.isPending) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4" />
                                      {stop.status === "en_progreso" ? "Continuar Servicio" : "Iniciar Servicio"}
                                    </>
                                  )}
                                </Button>
                              )}
                              {/* Botón para recuperar parada inconsistente */}
                              {todayRoute.status === "en_progreso" && 
                               stop.status === "en_progreso" && !isServiceActive && (
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-orange-600 border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                                  onClick={() => recoverStopMutation.mutate(stop.id)}
                                  disabled={recoverStopMutation.isPending}
                                  data-testid={`button-recover-stop-${stop.id}`}
                                >
                                  {recoverStopMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <RotateCcw className="h-4 w-4" />
                                      Recuperar Parada
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar de progreso */}
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Estado de la Ruta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span className="font-medium">{totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0}%</span>
                    </div>
                    <Progress value={totalStops > 0 ? (completedStops / totalStops) * 100 : 0} />
                  </div>
                  {todayRoute && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estado:</span>
                        <span>{getStatusBadge(todayRoute.status)}</span>
                      </div>
                      {todayRoute.startTime && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Inicio:</span>
                          <span>{formatTime(todayRoute.startTime)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB: Servicio Activo */}
        <TabsContent value="servicio" className="mt-4 md:mt-6">
          {isServiceActive && currentStop && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="lg:col-span-2 space-y-4 md:space-y-6">
                <ServiceTimer
                  machineName={currentStop.machine?.name || "Máquina"}
                  initialStartTime={activeService?.startTime}
                  autoStart={true}
                  onStop={handleStopService}
                />
                
                {/* Botón cancelar servicio */}
                <div className="flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setIsCancelDialogOpen(true)}
                    data-testid="button-cancel-service"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar Servicio
                  </Button>
                </div>

                {/* Checklist de servicio */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5" />
                        Checklist de Servicio
                      </CardTitle>
                      <Badge variant="outline">{checklistProgress}%</Badge>
                    </div>
                    <Progress value={checklistProgress} className="mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {checklist.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => toggleChecklistItem(item.id)}
                      >
                        <Checkbox 
                          checked={item.checked} 
                          onCheckedChange={() => toggleChecklistItem(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-${item.id}`}
                        />
                        <span className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                          {item.label}
                          {item.required && <span className="text-destructive ml-1">*</span>}
                        </span>
                        {item.checked && <Check className="h-4 w-4 text-emerald-500" />}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Productos en máquina */}
                <Card>
                  <CardHeader>
                    <CardTitle>Productos en Máquina</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentStop.machine?.inventory && currentStop.machine.inventory.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentStop.machine.inventory.map((item: any) => (
                          <ProductCard
                            key={item.id}
                            id={item.productId}
                            name={item.product?.name || "Producto"}
                            quantity={item.currentQuantity || 0}
                            maxQuantity={item.maxCapacity || 20}
                            price={parseFloat(item.product?.salePrice || "0")}
                            isLowStock={(item.currentQuantity || 0) <= (item.minLevel || 5)}
                            onClick={() => {}}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Sin inventario registrado</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Acciones del servicio */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Acciones de Servicio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      className="w-full justify-start gap-2" 
                      variant="outline"
                      onClick={openLoadDialog}
                      data-testid="button-load-products"
                    >
                      <Package className="h-4 w-4" />
                      Cargar Productos
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => setIsCashDialogOpen(true)}
                      data-testid="button-collect-cash"
                    >
                      <DollarSign className="h-4 w-4" />
                      Recolectar Efectivo
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => setIsReportDialogOpen(true)}
                      data-testid="button-report-issue"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Reportar Problema
                    </Button>
                    <Separator />
                    <Button
                      className="w-full justify-start gap-2"
                      variant="ghost"
                      onClick={() => setIsHistoryDialogOpen(true)}
                      data-testid="button-view-history"
                    >
                      <History className="h-4 w-4" />
                      Ver Historial
                    </Button>
                  </CardContent>
                </Card>

                {/* Info del contacto durante servicio */}
                {currentStop.machine?.location?.contactPhone && (
                  <Card className="bg-blue-500/10 border-blue-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/20">
                          <Phone className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {currentStop.machine.location.contactName || "Contacto"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {currentStop.machine.location.contactPhone}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => callContact(currentStop.machine.location!.contactPhone!)}
                          data-testid="button-call-contact-service"
                        >
                          Llamar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
          
          {/* Estado de carga cuando hay servicio activo pero aún no se cargó la parada */}
          {isServiceActive && !currentStop && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Cargando servicio activo...</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Estado vacío cuando no hay servicio activo */}
          {!isServiceActive && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-muted">
                    <Wrench className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">No hay servicio activo</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Para iniciar un servicio, ve a "Mi Ruta" y selecciona una máquina de tu lista de paradas.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setActiveTab("ruta")}
                    className="mt-2"
                    data-testid="button-go-to-route"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Ir a Mi Ruta
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Mi Vehículo (antes Inventario) */}
        <TabsContent value="inventario" className="mt-4 md:mt-6">
          <div className="space-y-6">
            {/* Información del Vehículo Asignado */}
            {assignedVehicle ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        {assignedVehicle.brand} {assignedVehicle.model}
                      </CardTitle>
                      <CardDescription>Placa: {assignedVehicle.plate} • Año: {assignedVehicle.year}</CardDescription>
                    </div>
                    <Badge variant={assignedVehicle.status === "activo" ? "default" : "secondary"} data-testid="badge-vehicle-status">
                      {assignedVehicle.status === "activo" ? "Activo" : assignedVehicle.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">{assignedVehicle.currentOdometer?.toLocaleString() || "—"}</p>
                      <p className="text-xs text-muted-foreground">Odómetro (km)</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">{vehicleFuelStats?.averageMileage?.toFixed(1) || "—"}</p>
                      <p className="text-xs text-muted-foreground">km/L promedio</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">{assignedVehicle.tankCapacity || "—"}</p>
                      <p className="text-xs text-muted-foreground">Capacidad (L)</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold capitalize">{assignedVehicle.fuelType?.replace("_", " ") || "—"}</p>
                      <p className="text-xs text-muted-foreground">Combustible</p>
                    </div>
                  </div>

                  {/* Próximo servicio / mantenimiento */}
                  {assignedVehicle.nextServiceOdometer && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">Próximo servicio</p>
                        <p className="text-xs text-muted-foreground">
                          A los {assignedVehicle.nextServiceOdometer.toLocaleString()} km 
                          {assignedVehicle.currentOdometer && (
                            <span> (faltan {(assignedVehicle.nextServiceOdometer - assignedVehicle.currentOdometer).toLocaleString()} km)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Sin vehículo asignado</p>
                  <p className="text-sm text-muted-foreground">Contacta a tu supervisor para asignar un vehículo</p>
                </CardContent>
              </Card>
            )}

            {/* Registros de Combustible */}
            {assignedVehicle && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Fuel className="h-5 w-5" />
                        Cargas de Combustible
                      </CardTitle>
                      <CardDescription>Últimas cargas registradas</CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => setIsFuelDialogOpen(true)}
                      data-testid="button-add-fuel"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Registrar Carga
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {fuelRecords.length > 0 ? (
                    <div className="space-y-3">
                      {fuelRecords.slice(0, 5).map((record: any) => (
                        <div key={record.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg" data-testid={`fuel-record-${record.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full">
                              <Fuel className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{parseFloat(record.liters || 0).toFixed(1)} L</p>
                              <p className="text-xs text-muted-foreground">
                                {record.gasStation || "Estación no especificada"} • {formatDate(record.recordDate)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(parseFloat(record.totalAmount || 0))}</p>
                            {record.distanceTraveled && (
                              <p className="text-xs text-muted-foreground">
                                {record.distanceTraveled} km • {record.mileage?.toFixed(1) || "—"} km/L
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Fuel className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">Sin registros de combustible</p>
                      <p className="text-sm">Registra tu primera carga de combustible</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Inventario de Productos */}
            <Card>
              <CardHeader className="pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Inventario de Productos
                  </CardTitle>
                  <CardDescription>Productos disponibles para cargar en máquinas</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {supplierInventory && supplierInventory.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {supplierInventory.map((item: any) => (
                      <Card key={item.id} className="bg-muted/30" data-testid={`inventory-item-${item.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{item.product?.name || "Producto"}</p>
                              <p className="text-sm text-muted-foreground">{item.product?.code}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">{item.quantity}</p>
                              <p className="text-xs text-muted-foreground">unidades</p>
                            </div>
                          </div>
                          {item.quantity <= 10 && (
                            <Badge variant="destructive" className="mt-2 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Stock bajo
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Sin productos cargados</p>
                    <p className="text-sm">Visita el almacén para cargar productos en tu vehículo</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: Mi Rendimiento */}
        <TabsContent value="rendimiento" className="mt-4 md:mt-6">
          <div className="space-y-6">
            {/* Resumen semanal */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Rendimiento Semanal
                    </CardTitle>
                    <CardDescription>
                      Semana del {formatDate(weekDates.startOfWeek)} al {formatDate(weekDates.endOfWeek)}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Award className="h-3 w-3" />
                    Esta semana
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingWeeklyStats ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <div className="p-2 bg-blue-500/20 rounded-full">
                          <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold text-blue-700 dark:text-blue-300">
                        {weeklyStats?.servicesCompleted || 0}
                      </p>
                      <p className="text-xs md:text-sm text-blue-600/80 dark:text-blue-400/80">Servicios completados</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <div className="p-2 bg-emerald-500/20 rounded-full">
                          <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                        {weeklyStats?.machinesVisited || 0}
                      </p>
                      <p className="text-xs md:text-sm text-emerald-600/80 dark:text-emerald-400/80">Máquinas atendidas</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <div className="p-2 bg-purple-500/20 rounded-full">
                          <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold text-purple-700 dark:text-purple-300">
                        {weeklyStats?.productsLoaded || 0}
                      </p>
                      <p className="text-xs md:text-sm text-purple-600/80 dark:text-purple-400/80">Productos cargados</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <div className="p-2 bg-amber-500/20 rounded-full">
                          <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                      </div>
                      <p className="text-2xl md:text-3xl font-bold text-amber-700 dark:text-amber-300">
                        {formatCurrency(weeklyStats?.cashCollected || 0)}
                      </p>
                      <p className="text-xs md:text-sm text-amber-600/80 dark:text-amber-400/80">Efectivo recolectado</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detalles adicionales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Tiempo trabajado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {Math.round((weeklyStats?.totalTimeMinutes || 0) / 60)}
                    </span>
                    <span className="text-muted-foreground">horas esta semana</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Promedio diario</span>
                      <span className="font-medium">
                        {Math.round((weeklyStats?.totalTimeMinutes || 0) / 60 / 5)}h
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, ((weeklyStats?.totalTimeMinutes || 0) / 60 / 40) * 100)} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Meta: 40 horas semanales
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Eficiencia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Servicios por día</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {((weeklyStats?.servicesCompleted || 0) / 5).toFixed(1)}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, ((weeklyStats?.servicesCompleted || 0) / 5 / 10) * 100)} 
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Tiempo promedio por servicio</span>
                        <span className="font-medium">
                          {weeklyStats?.servicesCompleted 
                            ? Math.round((weeklyStats?.totalTimeMinutes || 0) / (weeklyStats?.servicesCompleted || 1))
                            : 0} min
                        </span>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-muted-foreground">
                        {weeklyStats?.issuesReported || 0} problemas reportados esta semana
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB: Análisis (solo para admin/supervisor) */}
        {isViewingOther && (
          <TabsContent value="analisis" className="mt-4 md:mt-6">
            <div className="space-y-6">
              {/* Resumen de estadísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <div className="p-2 bg-blue-500/20 rounded-full">
                        <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-blue-700 dark:text-blue-300">
                      {monthlyStats?.machinesVisited || 0}
                    </p>
                    <p className="text-xs md:text-sm text-blue-600/80">Máquinas este mes</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <div className="p-2 bg-emerald-500/20 rounded-full">
                        <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                      {monthlyStats?.servicesCompleted || 0}
                    </p>
                    <p className="text-xs md:text-sm text-emerald-600/80">Servicios este mes</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <div className="p-2 bg-amber-500/20 rounded-full">
                        <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(monthlyStats?.cashCollected || 0)}
                    </p>
                    <p className="text-xs md:text-sm text-amber-600/80">Efectivo este mes</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <div className="p-2 bg-purple-500/20 rounded-full">
                        <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-purple-700 dark:text-purple-300">
                      {monthlyStats?.productsLoaded || 0}
                    </p>
                    <p className="text-xs md:text-sm text-purple-600/80">Productos cargados</p>
                  </CardContent>
                </Card>
              </div>

              {/* Historial de rutas y cash collections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Historial de rutas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Navigation className="h-5 w-5" />
                      Historial de Rutas
                    </CardTitle>
                    <CardDescription>Últimas rutas asignadas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      {supplierRouteHistory.length > 0 ? (
                        <div className="space-y-3">
                          {supplierRouteHistory.slice(0, 10).map((route: any) => (
                            <div key={route.id} className="flex items-center justify-between p-3 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                  route.status === "completada" ? "bg-emerald-500/10" :
                                  route.status === "en_progreso" ? "bg-blue-500/10" :
                                  "bg-muted"
                                }`}>
                                  <Navigation className={`h-4 w-4 ${
                                    route.status === "completada" ? "text-emerald-500" :
                                    route.status === "en_progreso" ? "text-blue-500" :
                                    "text-muted-foreground"
                                  }`} />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{formatDate(route.date)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {route.completedStops || 0}/{route.totalStops || 0} paradas
                                  </p>
                                </div>
                              </div>
                              <Badge variant={
                                route.status === "completada" ? "default" :
                                route.status === "en_progreso" ? "secondary" :
                                "outline"
                              }>
                                {route.status === "completada" ? "Completada" :
                                 route.status === "en_progreso" ? "En progreso" : "Pendiente"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Navigation className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>Sin historial de rutas</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Cash collections */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Recolecciones de Efectivo
                    </CardTitle>
                    <CardDescription>Últimas recolecciones registradas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      {supplierCashCollections.length > 0 ? (
                        <div className="space-y-3">
                          {supplierCashCollections.slice(0, 10).map((collection: any) => (
                            <div key={collection.id} className="flex items-center justify-between p-3 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-amber-500/10">
                                  <DollarSign className="h-4 w-4 text-amber-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{collection.machine?.name || "Máquina"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(collection.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(parseFloat(collection.actualAmount || "0"))}
                                </p>
                                {collection.difference && parseFloat(collection.difference) !== 0 && (
                                  <p className={`text-xs ${parseFloat(collection.difference) > 0 ? "text-emerald-500" : "text-red-500"}`}>
                                    {parseFloat(collection.difference) > 0 ? "+" : ""}{formatCurrency(parseFloat(collection.difference))}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>Sin recolecciones registradas</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Problemas reportados */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Problemas Reportados
                  </CardTitle>
                  <CardDescription>Incidencias registradas por este abastecedor</CardDescription>
                </CardHeader>
                <CardContent>
                  {supplierIssues.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {supplierIssues.slice(0, 6).map((issue: any) => (
                        <div key={issue.id} className="p-4 rounded-lg border">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                issue.priority === "critica" ? "destructive" :
                                issue.priority === "alta" ? "destructive" :
                                issue.priority === "media" ? "secondary" :
                                "outline"
                              }>
                                {issue.priority}
                              </Badge>
                              <Badge variant="outline">{issue.type}</Badge>
                            </div>
                            <Badge variant={issue.status === "resuelto" ? "default" : "secondary"}>
                              {issue.status === "resuelto" ? "Resuelto" : "Pendiente"}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{issue.machine?.name || "Máquina"}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {issue.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDate(issue.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50 text-emerald-500" />
                      <p>Sin problemas reportados</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* DIALOGO: Reportar Problema con fotos */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar Problema</DialogTitle>
            <DialogDescription>
              Describe el problema encontrado en la máquina
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de problema</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger data-testid="select-issue-type">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mecanico">Problema mecánico</SelectItem>
                  <SelectItem value="electrico">Problema eléctrico</SelectItem>
                  <SelectItem value="refrigeracion">Falla refrigeración</SelectItem>
                  <SelectItem value="vandalismo">Vandalismo</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={issuePriority} onValueChange={setIssuePriority}>
                <SelectTrigger data-testid="select-issue-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Describe el problema con detalle..."
                className="min-h-[100px]"
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                data-testid="input-issue-description"
              />
            </div>
            
            {/* Foto de evidencia (solo una) */}
            <div className="space-y-2">
              <Label>Evidencia fotográfica (opcional)</Label>
              <div className="flex gap-2">
                {issuePhotoUrl ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={issuePhotoUrl} alt="Evidencia" className="w-full h-full object-cover" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-0 right-0 h-5 w-5 rounded-full"
                      onClick={() => setIssuePhotoUrl(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-20 h-20 flex-col gap-1"
                    onClick={handlePhotoCapture}
                    data-testid="button-add-photo"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px]">Agregar foto</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsReportDialogOpen(false)} data-testid="button-cancel-issue">
                Cancelar
              </Button>
              <Button 
                onClick={handleReportIssue} 
                disabled={!issueDescription || createIssueReportMutation.isPending}
                data-testid="button-submit-issue"
              >
                {createIssueReportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enviar Reporte
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOGO: Recolección de Efectivo */}
      <Dialog open={isCashDialogOpen} onOpenChange={setIsCashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recolección de Efectivo</DialogTitle>
            <DialogDescription>
              Registra el monto recolectado de la máquina
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monto esperado (RD$) - opcional</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                data-testid="input-expected-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Monto recolectado (RD$)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                data-testid="input-actual-amount"
              />
            </div>
            {expectedAmount && cashAmount && (
              <div className={`p-3 rounded-lg ${parseFloat(cashAmount) >= parseFloat(expectedAmount) ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                <p className="text-sm">
                  Diferencia: <span className="font-bold">${(parseFloat(cashAmount) - parseFloat(expectedAmount)).toFixed(2)}</span>
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCashDialogOpen(false)} data-testid="button-cancel-cash">
                Cancelar
              </Button>
              <Button 
                onClick={handleCashCollection} 
                disabled={!cashAmount || createCashCollectionMutation.isPending}
                data-testid="button-submit-cash"
              >
                {createCashCollectionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOGO: Registro de Combustible */}
      <Dialog open={isFuelDialogOpen} onOpenChange={setIsFuelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Registrar Carga de Combustible
            </DialogTitle>
            <DialogDescription>
              Ingresa los datos de la carga de combustible
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Litros</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={fuelLiters}
                  onChange={(e) => setFuelLiters(e.target.value)}
                  data-testid="input-fuel-liters"
                />
              </div>
              <div className="space-y-2">
                <Label>Monto Total (RD$)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={fuelAmount}
                  onChange={(e) => setFuelAmount(e.target.value)}
                  data-testid="input-fuel-amount"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Odómetro actual (km)</Label>
              <Input
                type="number"
                placeholder="0"
                value={fuelOdometer}
                onChange={(e) => setFuelOdometer(e.target.value)}
                data-testid="input-fuel-odometer"
              />
              {assignedVehicle?.currentOdometer && (
                <p className="text-xs text-muted-foreground">
                  Último registro: {assignedVehicle.currentOdometer.toLocaleString()} km
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo de combustible</Label>
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger data-testid="select-fuel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasolina_regular">Gasolina Regular</SelectItem>
                  <SelectItem value="gasolina_premium">Gasolina Premium</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estación (opcional)</Label>
              <Input
                placeholder="Nombre de la estación"
                value={fuelStation}
                onChange={(e) => setFuelStation(e.target.value)}
                data-testid="input-fuel-station"
              />
            </div>
            {fuelLiters && fuelAmount && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  Precio por litro: <span className="font-bold">{formatCurrency(parseFloat(fuelAmount) / parseFloat(fuelLiters))}/L</span>
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsFuelDialogOpen(false)} data-testid="button-cancel-fuel">
                Cancelar
              </Button>
              <Button 
                onClick={handleFuelRecord} 
                disabled={!fuelLiters || !fuelAmount || !fuelOdometer || createFuelRecordMutation.isPending}
                data-testid="button-submit-fuel"
              >
                {createFuelRecordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOGO: Cargar Productos */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Cargar Productos
            </DialogTitle>
            <DialogDescription>
              Selecciona los productos y cantidades a cargar en la máquina
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {productsToLoad.map((product) => (
                <div key={product.productId} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      En máquina: {product.currentInMachine}/{product.maxCapacity}
                    </p>
                    <Progress 
                      value={(product.currentInMachine / product.maxCapacity) * 100} 
                      className="h-1.5 mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateProductQuantity(product.productId, -1)}
                      disabled={product.quantity === 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-bold">{product.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateProductQuantity(product.productId, 1)}
                      disabled={product.quantity >= product.maxCapacity - product.currentInMachine}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-muted-foreground">
                Total a cargar: <span className="font-bold">{productsToLoad.reduce((sum, p) => sum + p.quantity, 0)} unidades</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsLoadDialogOpen(false)} data-testid="button-cancel-load">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleLoadProducts}
                  disabled={productsToLoad.every(p => p.quantity === 0) || loadProductsMutation.isPending}
                  data-testid="button-submit-load"
                >
                  {loadProductsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirmar Carga
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO: Historial de la máquina */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de {currentStop?.machine?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {currentStop?.machine?.lastVisit && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Última visita</p>
                <p className="font-medium">
                  {formatDate(currentStop.machine.lastVisit)} a las {formatTime(currentStop.machine.lastVisit)}
                </p>
              </div>
            )}
            
            {currentStop?.machine?.salesSummary && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <p className="text-xs text-muted-foreground">Ventas recientes</p>
                  <p className="text-xl font-bold">{currentStop.machine.salesSummary.totalSales}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <p className="text-xs text-muted-foreground">Ingresos</p>
                  <p className="text-xl font-bold">${currentStop.machine.salesSummary.totalRevenue?.toFixed(0) || 0}</p>
                </div>
              </div>
            )}

            {currentStop?.machine?.alerts && currentStop.machine.alerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Alertas activas</p>
                {currentStop.machine.alerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-start gap-2 p-2 rounded-lg border">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${alert.priority === "critica" ? "text-destructive" : "text-amber-500"}`} />
                    <div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentStop?.machine?.notes && (
              <div className="p-3 rounded-lg bg-blue-500/10">
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm">{currentStop.machine.notes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOGO: Cancelar Servicio */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Cancelar Servicio
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar este servicio? La parada volverá a estado pendiente y perderás el progreso actual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)} data-testid="button-keep-service">
              No, continuar servicio
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelService}
              disabled={cancelServiceMutation.isPending}
              data-testid="button-confirm-cancel-service"
            >
              {cancelServiceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sí, cancelar servicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO: Resumen del Servicio */}
      <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resumen del Servicio
            </DialogTitle>
            <DialogDescription>
              Revisa el resumen antes de finalizar el servicio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Máquina */}
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">Máquina</p>
              <p className="text-sm text-muted-foreground">{currentStop?.machine?.name}</p>
            </div>

            {/* Checklist completado */}
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Checklist Completado
              </p>
              <div className="space-y-1">
                {checklist.filter(c => c.checked).map(item => (
                  <p key={item.id} className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" />
                    {item.label}
                  </p>
                ))}
              </div>
            </div>

            {/* Productos cargados */}
            {loadedProducts.length > 0 && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  Productos Cargados ({loadedProducts.reduce((sum: number, p: any) => sum + p.quantity, 0)} unidades)
                </p>
                <div className="space-y-1">
                  {loadedProducts.map((p: any) => (
                    <p key={p.id} className="text-xs text-muted-foreground flex justify-between">
                      <span>{p.productName || "Producto"}</span>
                      <span className="font-medium">+{p.quantity}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Sin productos cargados */}
            {loadedProducts.length === 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  No se cargaron productos en este servicio
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsSummaryDialogOpen(false)} data-testid="button-back-summary">
              Volver
            </Button>
            <Button onClick={handleProceedToSignature} data-testid="button-proceed-signature">
              Continuar a Firma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGO: Firma digital */}
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Firma del Responsable
            </DialogTitle>
            <DialogDescription>
              Solicita la firma del encargado del local para confirmar el servicio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del responsable</Label>
              <Input
                placeholder="Nombre completo"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                data-testid="input-responsible-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Firma</Label>
              <div className="border rounded-lg overflow-hidden bg-white">
                <canvas
                  ref={signatureCanvasRef}
                  width={350}
                  height={150}
                  className="w-full touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  data-testid="canvas-signature"
                />
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearSignature} data-testid="button-clear-signature">
                  Limpiar firma
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsSignatureDialogOpen(false);
                handleConfirmServiceEnd();
              }} data-testid="button-skip-signature">
                Omitir firma
              </Button>
              <Button 
                onClick={handleConfirmServiceEnd}
                disabled={endServiceMutation.isPending}
                data-testid="button-finish-service"
              >
                {endServiceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Finalizar Servicio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
