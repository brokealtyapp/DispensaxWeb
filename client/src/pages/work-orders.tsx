import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAccessToken } from "@/lib/auth-context";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ClipboardList,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  Check,
  CheckCircle2,
  Wrench,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  User,
  Calendar,
  MapPin,
  TicketCheck,
  ArrowRight,
  Pencil,
  Trash2,
  UserPlus,
  History,
  RefreshCcw,
  Settings,
  ChevronUp,
  ChevronDown,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Save,
  PlusCircle,
  Camera,
  Loader2,
  ListChecks,
  CircleDot,
  SquareCheck,
  MessageSquare,
  Hash,
  ImageIcon,
  List,
  LayoutGrid,
  Layers,
  Play,
  Pause,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#4ECB71", "#FF6B3D", "#E84545", "#2F6FED", "#8E59FF", "#6B7280", "#F59E0B"];
const ITEMS_PER_PAGE = 15;

type WorkOrderType = {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
};

type WorkOrderStage = {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  sortOrder: number;
  isFinal: boolean;
  statuses: string[];
  createdAt: string;
};

const PRIORITY_LABELS: Record<string, string> = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  en_proceso: "En Proceso",
  en_ruta: "En Ruta",
  completada: "Completada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

const TICKET_TYPE_LABELS: Record<string, string> = {
  falla_cliente: "Falla Cliente",
  alerta_sistema: "Alerta Sistema",
  incidencia_interna: "Incidencia Interna",
  solicitud_servicio: "Solicitud Servicio",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  en_ruta: "En Ruta",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

const SLA_LABELS: Record<string, string> = {
  dentro_tiempo: "En Tiempo",
  proximo_vencer: "Próximo a Vencer",
  vencido: "Vencido",
};

interface WorkOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  machineId: string;
  type: string;
  priority: string;
  status: string;
  stageId: string | null;
  assignedUserId: string | null;
  ticketId: string | null;
  description: string | null;
  slaDeadline: string | null;
  slaStatus: string | null;
  stageSlaStatus: string | null;
  slaPausedAt: string | null;
  stageEnteredAt: string | null;
  stageSlaHoursEffective: string | null;
  stageSlaSource: string | null;
  stagePausedSeconds: number | null;
  stageEscalateAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  notes: string | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkOrderStageInfo {
  id: string;
  name: string;
  color: string;
  sortOrder: number | null;
  isFinal: boolean;
  statuses: string[];
  slaHours: string | null;
  slaPriorityHours: { critico?: number; alto?: number; medio?: number; bajo?: number } | null;
  slaTypeHours: Record<string, number> | null;
  slaPauseOnStatuses: string[];
  slaEscalateAt: string | null;
}

interface StageLogEntry {
  id: string;
  workOrderId: string;
  stageId: string | null;
  stageName: string | null;
  enteredAt: string;
  exitedAt: string | null;
  slaHours: string | null;
  pausedSeconds: number | null;
  slaStatus: string | null;
}

interface Ticket {
  id: string;
  tenantId: string;
  ticketNumber: string;
  machineId: string;
  type: string;
  priority: string;
  status: string;
  reportedBy: string | null;
  assignedUserId: string | null;
  description: string;
  resolution: string | null;
  slaDeadline: string | null;
  slaStatus: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type ChecklistItemType = "checkbox" | "multiple_choice" | "multi_select" | "open_question" | "numeric" | "photo";

interface ChecklistItem {
  id: string;
  workOrderId: string;
  tenantId: string;
  label: string;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  sortOrder: number;
  notes: string | null;
  requiresPhoto: boolean;
  photoUrl: string | null;
  photoTakenAt: string | null;
  photoIp: string | null;
  photoLat: string | null;
  photoLng: string | null;
  photoTechnicianName: string | null;
  itemType: ChecklistItemType | null;
  options: string[] | null;
  answer: string | null;
}

interface Machine {
  id: string;
  name: string;
  code: string;
  locationName?: string;
}

interface UserInfo {
  id: string;
  fullName: string;
  role: string;
}

interface WOStats {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  bySla: Record<string, number>;
  byStageSla: Record<string, number>;
  slaBreached: number;
  stageSlaBreached: number;
  total: number;
}

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    critico: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    alto: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    medio: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    bajo: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <Badge className={`no-default-hover-elevate no-default-active-elevate ${variants[priority] || ""}`}>
      {PRIORITY_LABELS[priority] || priority}
    </Badge>
  );
}

function StatusBadge({ status, labels = STATUS_LABELS }: { status: string; labels?: Record<string, string> }) {
  const variants: Record<string, string> = {
    pendiente: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    asignada: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    en_proceso: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    en_ruta: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    completada: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cerrada: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
    cancelada: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    resuelto: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cerrado: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };
  return (
    <Badge className={`no-default-hover-elevate no-default-active-elevate ${variants[status] || ""}`}>
      {labels[status] || status}
    </Badge>
  );
}

function SlaBadge({ slaStatus }: { slaStatus: string | null }) {
  if (!slaStatus) return null;
  const variants: Record<string, string> = {
    dentro_tiempo: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    proximo_vencer: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    vencido: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <Badge className={`no-default-hover-elevate no-default-active-elevate ${variants[slaStatus] || ""}`}>
      {SLA_LABELS[slaStatus] || slaStatus}
    </Badge>
  );
}

function SimpleModal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description: string; children: React.ReactNode }) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, handleEscape]);

  if (!open) return null;
  const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const descId = `modal-desc-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
      <div className="fixed inset-0 bg-black/80 animate-in fade-in-0" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-background rounded-lg shadow-lg border max-w-2xl w-full max-h-[85vh] flex flex-col pointer-events-auto p-6 relative animate-in fade-in-0 zoom-in-95 overflow-y-auto">
          <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col space-y-1.5 text-left flex-shrink-0 mb-4">
            <h2 id={titleId} className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
            <p id={descId} className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        data-testid="button-prev-page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        Página {currentPage} de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        data-testid="button-next-page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

const createOrderSchema = z.object({
  machineId: z.string().min(1, "Seleccione una máquina"),
  type: z.string().min(1, "Tipo requerido"),
  priority: z.enum(["critico", "alto", "medio", "bajo"]),
  assignedUserId: z.string().nullable().optional(),
  description: z.string().min(1, "Descripción requerida"),
  notes: z.string().nullable().optional(),
});

const editOrderSchema = z.object({
  type: z.string().min(1, "Tipo requerido"),
  priority: z.enum(["critico", "alto", "medio", "bajo"]),
  status: z.enum(["pendiente", "asignada", "en_proceso", "en_ruta", "completada", "cerrada", "cancelada"]),
  assignedUserId: z.string().nullable().optional(),
  description: z.string().min(1, "Descripción requerida"),
  notes: z.string().nullable().optional(),
});

const editOrderAbastecedorSchema = z.object({
  status: z.enum(["en_proceso", "en_ruta", "completada"]),
  notes: z.string().nullable().optional(),
});

const createTicketSchema = z.object({
  machineId: z.string().min(1, "Seleccione una máquina"),
  type: z.enum(["falla_cliente", "alerta_sistema", "incidencia_interna", "solicitud_servicio"]),
  priority: z.enum(["critico", "alto", "medio", "bajo"]),
  reportedBy: z.string().nullable().optional(),
  description: z.string().min(1, "Descripción requerida"),
});

const editTicketSchema = z.object({
  type: z.enum(["falla_cliente", "alerta_sistema", "incidencia_interna", "solicitud_servicio"]),
  priority: z.enum(["critico", "alto", "medio", "bajo"]),
  status: z.enum(["pendiente", "en_proceso", "en_ruta", "resuelto", "cerrado"]),
  resolution: z.string().nullable().optional(),
});

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatSlaCountdown(deadline: string | null, _tick?: number) {
  if (!deadline) return "—";
  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  if (diff <= 0) return "Vencido";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${mins}m`;
}

function useSlaTimer() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);
  return tick;
}

function OrderDetailView({
  order,
  machines,
  users,
  onBack,
  onEdit,
  onReassign,
  onDelete,
  typeLabels = {},
}: {
  order: WorkOrder;
  machines: Machine[];
  users: UserInfo[];
  onBack: () => void;
  onEdit: () => void;
  onReassign: () => void;
  onDelete: () => void;
  typeLabels?: Record<string, string>;
}) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const slaTick = useSlaTimer();
  const machine = machines.find(m => m.id === order.machineId);
  const assignee = users.find(u => u.id === order.assignedUserId);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [capturingItemId, setCapturingItemId] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [replacePhotoItemId, setReplacePhotoItemId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const pendingGeoRef = useRef<{ lat: string; lng: string }>({ lat: "", lng: "" });
  const [photoBlobUrls, setPhotoBlobUrls] = useState<Record<string, string>>({});
  // Track which item IDs have been fetched — avoids stale-closure issues with photoBlobUrls state
  const fetchedPhotoIdsRef = useRef<Set<string>>(new Set());
  const [photoModal, setPhotoModal] = useState<{
    url: string;
    technicianName: string | null;
    takenAt: string | null;
    lat: string | null;
    lng: string | null;
  } | null>(null);

  const { data: checklist = [], isLoading: checklistLoading } = useQuery<ChecklistItem[]>({
    queryKey: ["/api/work-orders", order.id, "checklist"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/work-orders/${order.id}/checklist`);
      return res.json();
    },
  });

  const { data: stageLog = [] } = useQuery<StageLogEntry[]>({
    queryKey: ["/api/work-orders", order.id, "stage-log"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/work-orders/${order.id}/stage-log`);
      return res.json();
    },
  });

  // Fetch photo blob URLs with auth headers for checklist items that have photos.
  // fetchedPhotoIdsRef (not state) is used as the guard to avoid stale-closure issues.
  useEffect(() => {
    const itemsWithPhotos = checklist.filter(i => (i.requiresPhoto || i.itemType === "photo") && i.photoUrl);
    if (itemsWithPhotos.length === 0) return;

    const blobMap: Record<string, string> = {};
    const fetchPromises = itemsWithPhotos.map(async (item) => {
      if (fetchedPhotoIdsRef.current.has(item.id)) return; // already fetched or in-flight
      fetchedPhotoIdsRef.current.add(item.id); // mark immediately to prevent concurrent duplicates
      try {
        const token = getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/work-orders/${order.id}/checklist/${item.id}/photo`, { headers, credentials: "include" });
        if (res.ok) {
          const blob = await res.blob();
          blobMap[item.id] = URL.createObjectURL(blob);
        } else {
          // Remove from fetched set so retry is possible on next checklist refresh
          fetchedPhotoIdsRef.current.delete(item.id);
        }
      } catch {
        fetchedPhotoIdsRef.current.delete(item.id); // allow retry on error
      }
    });

    Promise.all(fetchPromises).then(() => {
      if (Object.keys(blobMap).length > 0) {
        setPhotoBlobUrls(prev => ({ ...prev, ...blobMap }));
      }
    });
  }, [checklist]);

  // Revoke blob URLs when component unmounts (using ref to avoid stale closure)
  const photoBlobUrlsRef = useRef(photoBlobUrls);
  useEffect(() => {
    photoBlobUrlsRef.current = photoBlobUrls;
  }, [photoBlobUrls]);
  useEffect(() => {
    return () => {
      Object.values(photoBlobUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setPendingAnswers({});
  }, [order.id]);

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted, answer }: { itemId: string; isCompleted?: boolean; answer?: string | null }) => {
      const body: Record<string, unknown> = {};
      if (isCompleted !== undefined) body.isCompleted = isCompleted;
      if (answer !== undefined) body.answer = answer;
      await apiRequest("PATCH", `/api/work-orders/${order.id}/checklist/${itemId}`, body);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", order.id, "checklist"] });
      if (variables.answer !== undefined) {
        setPendingAnswers(prev => {
          const next = { ...prev };
          delete next[variables.itemId];
          return next;
        });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el checklist", variant: "destructive" });
    },
  });

  const pauseStageSla = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/work-orders/${order.id}/sla-pause`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Error al pausar SLA"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", order.id, "stage-log"] });
      toast({ title: "SLA de etapa pausado" });
    },
    onError: (err: unknown) => { toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo pausar", variant: "destructive" }); },
  });

  const resumeStageSla = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/work-orders/${order.id}/sla-resume`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Error al reanudar SLA"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", order.id, "stage-log"] });
      toast({ title: "SLA de etapa reanudado" });
    },
    onError: (err: unknown) => { toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo reanudar", variant: "destructive" }); },
  });

  const handleCameraCapture = async (itemId: string) => {
    // Request geolocation BEFORE opening camera
    pendingGeoRef.current = { lat: "", lng: "" };
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, enableHighAccuracy: true });
      });
      pendingGeoRef.current = { lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) };
    } catch {
      // Geolocation optional — proceed without coordinates
    }
    setCapturingItemId(itemId);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
      cameraInputRef.current.click();
    }
  };

  const uploadChecklistPhoto = async (itemId: string, file: File, lat: string, lng: string, replace: boolean) => {
    setUploadingItemId(itemId);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("lat", lat);
      formData.append("lng", lng);

      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const endpoint = `/api/work-orders/${order.id}/checklist/${itemId}/photo${replace ? "?replace=true" : ""}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || "Error al subir foto");
      }

      // Create blob URL immediately for instant thumbnail display
      const blobUrl = URL.createObjectURL(file);
      fetchedPhotoIdsRef.current.add(itemId); // mark as fetched so useEffect doesn't re-fetch
      setPhotoBlobUrls(prev => {
        if (prev[itemId]) URL.revokeObjectURL(prev[itemId]);
        return { ...prev, [itemId]: blobUrl };
      });

      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", order.id, "checklist"] });
      toast({
        title: replace ? "Foto reemplazada" : "Foto guardada",
        description: replace ? "La foto anterior fue eliminada y la nueva fue guardada" : "El ítem se marcó como completado",
      });
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message || "No se pudo subir la foto", variant: "destructive" });
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = capturingItemId;
    const { lat, lng } = pendingGeoRef.current;
    setCapturingItemId(null);
    if (!file || !itemId) return;
    await uploadChecklistPhoto(itemId, file, lat, lng, false);
  };

  const handleReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = capturingItemId;
    const { lat, lng } = pendingGeoRef.current;
    setCapturingItemId(null);
    if (!file || !itemId) return;
    await uploadChecklistPhoto(itemId, file, lat, lng, true);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/work-orders/${order.id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders/stats"] });
      toast({ title: "Estado actualizado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    },
  });

  const completedCount = checklist.filter(i => i.isCompleted).length;
  const totalItems = checklist.length;
  const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const timelineEntries = useMemo(() => {
    const entries: { label: string; date: string; icon: string }[] = [];
    entries.push({ label: "Orden creada", date: order.createdAt, icon: "created" });
    if (order.status !== "pendiente" && order.updatedAt !== order.createdAt) {
      entries.push({ label: `Estado: ${STATUS_LABELS[order.status] || order.status}`, date: order.updatedAt, icon: "status" });
    }
    if (order.completedAt) {
      entries.push({ label: "Orden completada", date: order.completedAt, icon: "completed" });
    }
    if (order.closedAt) {
      entries.push({ label: "Orden cerrada", date: order.closedAt, icon: "closed" });
    }
    return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [order]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-orders">
          <ChevronLeft />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold" data-testid="text-order-number">{order.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">{typeLabels[order.type] || order.type}</p>
        </div>
        <PriorityBadge priority={order.priority} />
        <StatusBadge status={order.status} />
        <SlaBadge slaStatus={order.slaStatus} />
        {can("work_orders", "edit") && (
          <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-order-detail">
            <Pencil className="mr-1 h-3 w-3" />
            Editar
          </Button>
        )}
        {can("work_orders", "edit") && !["cerrada", "cancelada"].includes(order.status) && (
          <Button variant="outline" size="sm" onClick={onReassign} data-testid="button-reassign-order">
            <UserPlus className="mr-1 h-3 w-3" />
            Reasignar
          </Button>
        )}
        {can("work_orders", "delete") && (
          <Button variant="outline" size="sm" onClick={onDelete} data-testid="button-delete-order-detail">
            <Trash2 className="mr-1 h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Máquina:</span>
              <span className="font-medium" data-testid="text-order-machine">{machine?.name || order.machineId}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Asignado:</span>
              <span className="font-medium" data-testid="text-order-assignee">{assignee?.fullName || "Sin asignar"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Creada:</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">SLA:</span>
              <span className={order.slaStatus === "vencido" ? "text-red-600 font-semibold" : ""}>{formatSlaCountdown(order.slaDeadline, slaTick)}</span>
            </div>
            {order.stageSlaStatus && order.stageEnteredAt && order.stageSlaHoursEffective && (() => {
              const slaH = Number(order.stageSlaHoursEffective);
              const enteredMs = new Date(order.stageEnteredAt).getTime();
              const accPausedMs = (order.stagePausedSeconds ?? 0) * 1000;
              const curPausedMs = order.slaPausedAt ? Date.now() + slaTick * 0 - new Date(order.slaPausedAt).getTime() : 0;
              const elapsedMs = Math.max(0, Date.now() + slaTick * 0 - enteredMs - accPausedMs - curPausedMs);
              const totalMs = slaH * 3600 * 1000;
              const pct = Math.min(100, (elapsedMs / totalMs) * 100);
              const elapsedH = elapsedMs / 3600000;
              const remainingH = Math.max(0, slaH - elapsedH);
              const isVencido = order.stageSlaStatus === "vencido";
              const isProximo = order.stageSlaStatus === "proximo_vencer";
              const fmtH = (h: number) => h < 1 ? `${Math.round(h * 60)}min` : `${h.toFixed(1)}h`;
              const barColor = isVencido ? "bg-red-500" : isProximo ? "bg-amber-400" : "bg-green-500";
              const textColor = isVencido ? "text-red-600 font-semibold" : isProximo ? "text-amber-600 font-medium" : "text-green-600";
              const detailSlaSourceLabels: Record<string, string> = {
                prioridad: "por prioridad",
                tipo: "por tipo",
                etapa: "etapa",
                global: "global",
              };
              const detailSlaSourceLabel = order.stageSlaSource ? detailSlaSourceLabels[order.stageSlaSource] ?? order.stageSlaSource : null;
              return (
                <div className="pt-2 border-t space-y-2" data-testid="detail-stage-sla">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">SLA de Etapa Actual</span>
                      {detailSlaSourceLabel && (
                        <span className="text-xs text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded" data-testid="text-detail-sla-source">
                          {detailSlaSourceLabel}
                        </span>
                      )}
                    </div>
                    {can("work_orders", "edit") && !["cerrada", "cancelada"].includes(order.status) && (
                      order.slaPausedAt ? (
                        <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => resumeStageSla.mutate()} disabled={resumeStageSla.isPending} data-testid="button-sla-resume">
                          <Play className="h-3 w-3 mr-1" />Reanudar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => pauseStageSla.mutate()} disabled={pauseStageSla.isPending} data-testid="button-sla-pause">
                          <Pause className="h-3 w-3 mr-1" />Pausar
                        </Button>
                      )
                    )}
                  </div>
                  <div className={`flex items-center justify-between text-xs ${textColor}`}>
                    <span className="flex items-center gap-1">
                      {(isVencido || isProximo) && <AlertTriangle className="h-3 w-3 shrink-0" />}
                      <span>{fmtH(elapsedH)} consumido / {fmtH(slaH)} total</span>
                      {order.slaPausedAt && <span className="opacity-70">(pausado)</span>}
                    </span>
                    <span>{isVencido ? "Vencido" : isProximo ? "Próx. a vencer" : `−${fmtH(remainingH)} restante`}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
            {order.stageSlaStatus && (!order.stageEnteredAt || !order.stageSlaHoursEffective) && (
              <div className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">SLA etapa:</span>
                <span className={order.stageSlaStatus === "vencido" ? "text-red-600 font-semibold" : order.stageSlaStatus === "proximo_vencer" ? "text-amber-600 font-medium" : "text-green-600"}>
                  {SLA_LABELS[order.stageSlaStatus] || order.stageSlaStatus}
                </span>
                {order.slaPausedAt && <span className="text-xs text-muted-foreground">(pausado)</span>}
                {can("work_orders", "edit") && !["cerrada", "cancelada"].includes(order.status) && (
                  order.slaPausedAt ? (
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2 ml-auto" onClick={() => resumeStageSla.mutate()} disabled={resumeStageSla.isPending} data-testid="button-sla-resume">
                      <Play className="h-3 w-3 mr-1" />Reanudar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2 ml-auto" onClick={() => pauseStageSla.mutate()} disabled={pauseStageSla.isPending} data-testid="button-sla-pause">
                      <Pause className="h-3 w-3 mr-1" />Pausar
                    </Button>
                  )
                )}
              </div>
            )}
            {order.description && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Descripción:</p>
                <p className="text-sm" data-testid="text-order-description">{order.description}</p>
              </div>
            )}
            {order.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Notas:</p>
                <p className="text-sm">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Checklist ({completedCount}/{totalItems}) — {progress}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checklistLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin items de checklist</p>
            ) : (
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-2 mb-3">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {checklist.map((item) => {
                  const itype: ChecklistItemType = item.itemType ?? "checkbox";
                  const opts = item.options ?? [];
                  const canEdit = can("work_orders", "edit");
                  const isPhotoType = itype === "photo";
                  const effectiveRequiresPhoto = item.requiresPhoto || isPhotoType;
                  const selectedMulti: string[] = (() => { try { return item.answer ? JSON.parse(item.answer) : []; } catch { return []; } })();
                  return (
                  <div key={item.id} className="space-y-1.5" data-testid={`checklist-item-${item.id}`}>
                    <div className="flex items-start gap-3">
                      {/* Left control column */}
                      {effectiveRequiresPhoto ? (
                        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                          {item.isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" data-testid={`checkbox-checklist-${item.id}`} />
                          ) : uploadingItemId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                          ) : canEdit ? (
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleCameraCapture(item.id)}
                              disabled={uploadingItemId !== null}
                              data-testid={`button-camera-${item.id}`}
                              title="Tomar foto para completar este ítem"
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Camera className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      ) : itype === "checkbox" ? (
                        <Checkbox
                          checked={item.isCompleted}
                          onCheckedChange={(checked) => {
                            if (canEdit) {
                              updateChecklistMutation.mutate({ itemId: item.id, isCompleted: !!checked });
                            }
                          }}
                          disabled={!canEdit || updateChecklistMutation.isPending}
                          data-testid={`checkbox-checklist-${item.id}`}
                        />
                      ) : (
                        <div className="mt-0.5 shrink-0">
                          {item.isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${item.isCompleted ? "text-muted-foreground" : ""}`}>
                          {item.label}
                        </span>
                        {effectiveRequiresPhoto && !item.isCompleted && !isPhotoType && (
                          <Badge className="ml-2 no-default-hover-elevate no-default-active-elevate text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            <Camera className="h-2.5 w-2.5 mr-1" />
                            Requiere foto
                          </Badge>
                        )}
                        {/* Answer controls by type */}
                        {itype === "multiple_choice" && opts.length > 0 && (
                          <RadioGroup
                            value={item.answer ?? pendingAnswers[item.id] ?? ""}
                            onValueChange={(val) => {
                              if (!canEdit) return;
                              setPendingAnswers(prev => ({ ...prev, [item.id]: val }));
                              updateChecklistMutation.mutate({ itemId: item.id, answer: val });
                            }}
                            disabled={!canEdit || updateChecklistMutation.isPending}
                            className="mt-2 space-y-1"
                            data-testid={`radio-group-${item.id}`}
                          >
                            {opts.map((opt) => (
                              <div key={opt} className="flex items-center gap-2">
                                <RadioGroupItem value={opt} id={`${item.id}-${opt}`} data-testid={`radio-${item.id}-${opt}`} />
                                <Label htmlFor={`${item.id}-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}
                        {itype === "multi_select" && opts.length > 0 && (
                          <div className="mt-2 space-y-1" data-testid={`multi-select-${item.id}`}>
                            {opts.map((opt) => {
                              const checked = selectedMulti.includes(opt);
                              return (
                                <div key={opt} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${item.id}-${opt}`}
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      if (!canEdit) return;
                                      const next = c ? [...selectedMulti, opt] : selectedMulti.filter(o => o !== opt);
                                      const val = JSON.stringify(next);
                                      updateChecklistMutation.mutate({ itemId: item.id, answer: next.length > 0 ? val : null });
                                    }}
                                    disabled={!canEdit || updateChecklistMutation.isPending}
                                    data-testid={`checkbox-multi-${item.id}-${opt}`}
                                  />
                                  <Label htmlFor={`${item.id}-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {itype === "open_question" && (
                          <div className="mt-2" data-testid={`open-question-${item.id}`}>
                            {canEdit ? (
                              <div className="flex gap-2">
                                <Textarea
                                  value={pendingAnswers[item.id] ?? item.answer ?? ""}
                                  onChange={e => setPendingAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  placeholder="Escribe tu respuesta..."
                                  className="text-sm resize-none min-h-[60px]"
                                  disabled={updateChecklistMutation.isPending}
                                  data-testid={`textarea-answer-${item.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const ans = (pendingAnswers[item.id] ?? item.answer ?? "").trim();
                                    updateChecklistMutation.mutate({ itemId: item.id, answer: ans || null });
                                  }}
                                  disabled={updateChecklistMutation.isPending}
                                  data-testid={`button-save-answer-${item.id}`}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : item.answer ? (
                              <p className="text-sm bg-muted/50 rounded p-2">{item.answer}</p>
                            ) : null}
                          </div>
                        )}
                        {itype === "numeric" && (
                          <div className="mt-2 flex gap-2 items-center" data-testid={`numeric-input-${item.id}`}>
                            {canEdit ? (
                              <>
                                <Input
                                  type="number"
                                  value={pendingAnswers[item.id] ?? item.answer ?? ""}
                                  onChange={e => setPendingAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  placeholder="0"
                                  className="w-32 text-sm"
                                  disabled={updateChecklistMutation.isPending}
                                  data-testid={`input-numeric-${item.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const ans = (pendingAnswers[item.id] ?? item.answer ?? "").trim();
                                    updateChecklistMutation.mutate({ itemId: item.id, answer: ans || null });
                                  }}
                                  disabled={updateChecklistMutation.isPending}
                                  data-testid={`button-save-numeric-${item.id}`}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </>
                            ) : item.answer ? (
                              <span className="text-sm font-medium">{item.answer}</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                    {effectiveRequiresPhoto && item.photoUrl && (
                      <div className="ml-8 space-y-1.5">
                        <Badge className="no-default-hover-elevate no-default-active-elevate text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                          Foto tomada
                        </Badge>
                        <div className="flex items-center gap-2">
                          {photoBlobUrls[item.id] && (
                            <img
                              src={photoBlobUrls[item.id]}
                              alt="Foto del checklist"
                              className="h-20 w-28 object-cover rounded-md border cursor-pointer hover-elevate"
                              onClick={() => setPhotoModal({
                                url: photoBlobUrls[item.id],
                                technicianName: item.photoTechnicianName ?? null,
                                takenAt: item.photoTakenAt ?? null,
                                lat: item.photoLat ?? null,
                                lng: item.photoLng ?? null,
                              })}
                              title="Ver foto completa"
                              data-testid={`photo-checklist-${item.id}`}
                            />
                          )}
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {item.photoTechnicianName && <p><span className="font-medium">Técnico:</span> {item.photoTechnicianName}</p>}
                            {item.photoTakenAt && <p><span className="font-medium">Fecha:</span> {formatDate(item.photoTakenAt)}</p>}
                            {item.photoLat && item.photoLng && <p><span className="font-medium">GPS:</span> {item.photoLat}, {item.photoLng}</p>}
                            {can("work_orders", "edit") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-1"
                                onClick={() => setReplacePhotoItemId(item.id)}
                                disabled={uploadingItemId === item.id}
                                data-testid={`btn-replace-photo-${item.id}`}
                              >
                                <RefreshCcw className="h-3 w-3 mr-1" />
                                Reemplazar foto
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelected}
                  data-testid="input-camera-capture"
                />
                <input
                  ref={replaceInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleReplaceFileSelected}
                  data-testid="input-camera-replace"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stageLog.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Historial de etapas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stageLog.map((entry) => {
                const entered = new Date(entry.enteredAt);
                const exited = entry.exitedAt ? new Date(entry.exitedAt) : null;
                // nowMs uses slaTick to force re-render every minute for live active-stage timer
                const nowMs = Date.now() + slaTick * 0;
                const rawElapsedMs = exited ? exited.getTime() - entered.getTime() : nowMs - entered.getTime();
                // Subtract paused time from effective elapsed
                const pausedMs = (entry.pausedSeconds ?? 0) * 1000;
                const elapsedMs = Math.max(0, rawElapsedMs - pausedMs);
                const elapsedH = Math.floor(elapsedMs / 3_600_000);
                const elapsedM = Math.floor((elapsedMs % 3_600_000) / 60_000);
                const slaH = entry.slaHours ? Number(entry.slaHours) : null;
                const pausedH = entry.pausedSeconds ? Math.floor(entry.pausedSeconds / 3600) : 0;
                const pausedM = entry.pausedSeconds ? Math.floor((entry.pausedSeconds % 3600) / 60) : 0;
                const pct = slaH && slaH > 0 ? Math.min(100, Math.round((elapsedMs / 3_600_000 / slaH) * 100)) : null;
                return (
                  <div key={entry.id} className="flex items-start gap-3 text-sm border rounded-md p-2" data-testid={`stage-log-${entry.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.stageName ?? "Sin etapa"}</p>
                      <p className="text-xs text-muted-foreground">
                        {entered.toLocaleDateString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {exited && ` → ${exited.toLocaleDateString("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                      {entry.pausedSeconds != null && entry.pausedSeconds > 0 && (
                        <p className="text-xs text-muted-foreground">Pausado: {pausedH}h {pausedM}m</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xs font-medium ${
                        entry.slaStatus === "vencido" || entry.slaStatus === "incumplido"
                          ? "text-red-600"
                          : entry.slaStatus === "proximo_vencer"
                          ? "text-amber-600"
                          : "text-muted-foreground"
                      }`}>
                        {elapsedH}h {elapsedM}m{slaH ? ` / ${slaH}h` : ""}
                      </p>
                      {pct !== null && (
                        <div className="mt-1 w-20 bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              entry.slaStatus === "incumplido" || pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      )}
                      {entry.slaStatus && (
                        <span className={`text-xs ${
                          entry.slaStatus === "incumplido" || entry.slaStatus === "vencido"
                            ? "text-red-600"
                            : entry.slaStatus === "cumplido"
                            ? "text-green-600"
                            : entry.slaStatus === "proximo_vencer"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }`}>
                          {entry.slaStatus === "cumplido" ? "Cumplido" : entry.slaStatus === "incumplido" ? "Incumplido" : SLA_LABELS[entry.slaStatus] ?? entry.slaStatus}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <SimpleModal
        open={replacePhotoItemId !== null}
        onClose={() => setReplacePhotoItemId(null)}
        title="Reemplazar foto"
        description="La foto anterior será eliminada permanentemente y no podrá recuperarse. ¿Deseas continuar?"
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setReplacePhotoItemId(null)} data-testid="btn-cancel-replace-photo">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              const itemId = replacePhotoItemId!;
              setReplacePhotoItemId(null);
              // Use geo flow then open the dedicated replace file input
              pendingGeoRef.current = { lat: "", lng: "" };
              try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, enableHighAccuracy: true });
                });
                pendingGeoRef.current = { lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) };
              } catch { /* geo optional */ }
              setCapturingItemId(itemId);
              if (replaceInputRef.current) {
                replaceInputRef.current.value = "";
                replaceInputRef.current.click();
              }
            }}
            data-testid="btn-confirm-replace-photo"
          >
            Sí, reemplazar
          </Button>
        </div>
      </SimpleModal>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial / Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
            {timelineEntries.map((entry, idx) => (
              <div key={idx} className="relative flex items-start gap-3" data-testid={`timeline-entry-${idx}`}>
                <div className="absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                <div>
                  <p className="text-sm font-medium">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {can("work_orders", "edit") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Acciones de Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              {order.status === "pendiente" && (
                <Button size="sm" onClick={() => updateStatusMutation.mutate("asignada")} disabled={updateStatusMutation.isPending} data-testid="button-status-asignada">
                  Marcar Asignada
                </Button>
              )}
              {(order.status === "pendiente" || order.status === "asignada") && (
                <Button size="sm" onClick={() => updateStatusMutation.mutate("en_proceso")} disabled={updateStatusMutation.isPending} data-testid="button-status-en-proceso">
                  Iniciar Trabajo
                </Button>
              )}
              {order.status === "en_proceso" && (
                <Button size="sm" onClick={() => updateStatusMutation.mutate("en_ruta")} disabled={updateStatusMutation.isPending} data-testid="button-status-en-ruta">
                  En Ruta
                </Button>
              )}
              {(order.status === "en_proceso" || order.status === "en_ruta") && (
                <Button size="sm" variant="default" onClick={() => updateStatusMutation.mutate("completada")} disabled={updateStatusMutation.isPending} data-testid="button-status-completada">
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Completar
                </Button>
              )}
              {can("work_orders", "approve") && order.status === "completada" && (
                <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate("cerrada")} disabled={updateStatusMutation.isPending} data-testid="button-status-cerrada">
                  Cerrar Orden
                </Button>
              )}
              {can("work_orders", "approve") && !["cerrada", "cancelada", "completada"].includes(order.status) && (
                <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate("cancelada")} disabled={updateStatusMutation.isPending} data-testid="button-status-cancelada">
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!photoModal} onOpenChange={(open) => { if (!open) setPhotoModal(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Foto del checklist</DialogTitle>
          </DialogHeader>
          {photoModal && (
            <div className="space-y-3">
              <img
                src={photoModal.url}
                alt="Foto del checklist"
                className="w-full max-h-[65vh] object-contain rounded-md"
              />
              <div className="text-sm text-muted-foreground space-y-1">
                {photoModal.technicianName && (
                  <p><span className="font-medium text-foreground">Técnico:</span> {photoModal.technicianName}</p>
                )}
                {photoModal.takenAt && (
                  <p><span className="font-medium text-foreground">Fecha:</span> {formatDate(photoModal.takenAt)}</p>
                )}
                {photoModal.lat && photoModal.lng && (
                  <p><span className="font-medium text-foreground">GPS:</span> {photoModal.lat}, {photoModal.lng}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SLADashboard({ stats, orders, machines, users, onSelectOrder, typeLabels = {} }: { stats: WOStats | undefined; orders: WorkOrder[]; machines: Machine[]; users: UserInfo[]; onSelectOrder: (o: WorkOrder) => void; typeLabels?: Record<string, string> }) {
  if (!stats) return <p className="text-sm text-muted-foreground p-4">Cargando estadísticas...</p>;

  const bySla = stats.bySla || {};
  const slaBarData = [
    { name: "En Tiempo", cantidad: bySla["dentro_tiempo"] || 0, fill: "#4ECB71" },
    { name: "Próx. Vencer", cantidad: bySla["proximo_vencer"] || 0, fill: "#F59E0B" },
    { name: "Vencido", cantidad: bySla["vencido"] || 0, fill: "#E84545" },
  ];

  const byStageSla = stats.byStageSla || {};
  const stageSlaBarData = [
    { name: "En Tiempo", cantidad: byStageSla["dentro_tiempo"] || 0, fill: "#4ECB71" },
    { name: "Próx. Vencer", cantidad: byStageSla["proximo_vencer"] || 0, fill: "#F59E0B" },
    { name: "Vencido", cantidad: byStageSla["vencido"] || 0, fill: "#E84545" },
  ];

  const typeData = Object.entries(stats.byType).map(([key, value]) => ({
    name: typeLabels[key] || key,
    cantidad: value,
  }));

  const overdueOrders = orders.filter(o => o.slaStatus === "vencido" && !["cerrada", "cancelada", "completada"].includes(o.status));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Estado SLA de Órdenes</CardTitle>
          </CardHeader>
          <CardContent>
            {slaBarData.every(d => d.cantidad === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de SLA</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={slaBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                    {slaBarData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">SLA de Etapa Activa</CardTitle>
          </CardHeader>
          <CardContent>
            {stageSlaBarData.every(d => d.cantidad === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de SLA de etapa</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stageSlaBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                    {stageSlaBarData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Distribución por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {typeData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" outerRadius={80} dataKey="cantidad" nameKey="name" label>
                    {typeData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Resumen SLA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Órdenes vencidas (global):</span>
                <span className={`font-semibold ${(stats.slaBreached ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>{stats.slaBreached ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Órdenes etapa vencida:</span>
                <span className={`font-semibold ${(stats.stageSlaBreached ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>{stats.stageSlaBreached ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total órdenes:</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Órdenes con SLA Vencido ({overdueOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdueOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay órdenes con SLA vencido</p>
          ) : (
            <div className="space-y-2">
              {overdueOrders.map((order) => {
                const machine = machines.find(m => m.id === order.machineId);
                const assignee = users.find(u => u.id === order.assignedUserId);
                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 p-3 rounded-md border border-red-200 dark:border-red-900/40 cursor-pointer hover-elevate flex-wrap"
                    onClick={() => onSelectOrder(order)}
                    data-testid={`sla-overdue-order-${order.id}`}
                  >
                    <span className="font-semibold text-sm">{order.orderNumber}</span>
                    <span className="text-xs text-muted-foreground">{machine?.name || "—"}</span>
                    <PriorityBadge priority={order.priority} />
                    <StatusBadge status={order.status} />
                    <span className="text-xs text-muted-foreground ml-auto">{assignee?.fullName || "Sin asignar"}</span>
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">SLA: {formatSlaCountdown(order.slaDeadline)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Kanban Board ──────────────────────────────────────────────────────────

const NEXT_STATUS: Record<string, string> = {
  pendiente: "asignada",
  asignada: "en_proceso",
  en_proceso: "en_ruta",
  en_ruta: "completada",
  completada: "cerrada",
};

const STATUS_ORDER = ["pendiente", "asignada", "en_proceso", "en_ruta", "completada", "cerrada"];

function isValidTransition(from: string, to: string): boolean {
  const fromIdx = STATUS_ORDER.indexOf(from);
  const toIdx = STATUS_ORDER.indexOf(to);
  const closedIdx = STATUS_ORDER.indexOf("cerrada");
  return fromIdx !== -1 && toIdx !== -1 && toIdx !== fromIdx && fromIdx !== closedIdx;
}

const STAGE_COLOR_OPTIONS = ["slate", "amber", "green", "red", "blue", "violet", "orange", "pink"] as const;
const STAGE_COLOR_LABELS: Record<string, string> = {
  slate: "Gris",
  amber: "Ámbar",
  green: "Verde",
  red: "Rojo",
  blue: "Azul",
  violet: "Violeta",
  orange: "Naranja",
  pink: "Rosa",
};
const STAGE_COLORS: Record<string, { headerClass: string; countClass: string; dotClass: string; dotPreview: string }> = {
  slate:  { headerClass: "bg-slate-100 dark:bg-slate-800/60",   countClass: "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300",         dotClass: "bg-slate-500",    dotPreview: "bg-slate-500" },
  amber:  { headerClass: "bg-amber-50 dark:bg-amber-900/20",    countClass: "bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300",       dotClass: "bg-amber-500",    dotPreview: "bg-amber-400" },
  green:  { headerClass: "bg-green-50 dark:bg-green-900/20",    countClass: "bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-300",       dotClass: "bg-green-500",    dotPreview: "bg-green-500" },
  red:    { headerClass: "bg-red-50 dark:bg-red-900/20",        countClass: "bg-red-100 dark:bg-red-900/30 text-[#E84545] dark:text-red-400",            dotClass: "bg-[#E84545]",   dotPreview: "bg-red-500" },
  blue:   { headerClass: "bg-blue-50 dark:bg-blue-900/20",      countClass: "bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300",           dotClass: "bg-blue-500",     dotPreview: "bg-blue-500" },
  violet: { headerClass: "bg-violet-50 dark:bg-violet-900/20",  countClass: "bg-violet-100 dark:bg-violet-800/40 text-violet-700 dark:text-violet-300",   dotClass: "bg-violet-500",   dotPreview: "bg-violet-500" },
  orange: { headerClass: "bg-orange-50 dark:bg-orange-900/20",  countClass: "bg-orange-100 dark:bg-orange-800/40 text-orange-700 dark:text-orange-300",   dotClass: "bg-orange-500",   dotPreview: "bg-orange-500" },
  pink:   { headerClass: "bg-pink-50 dark:bg-pink-900/20",      countClass: "bg-pink-100 dark:bg-pink-800/40 text-pink-700 dark:text-pink-300",           dotClass: "bg-pink-500",     dotPreview: "bg-pink-500" },
};

type KanbanColumn = {
  id: string;
  label: string;
  statuses: string[];
  headerClass: string;
  countClass: string;
  dotClass: string;
};

function stageToColumn(stage: WorkOrderStage): KanbanColumn {
  const colorMeta = STAGE_COLORS[stage.color] ?? STAGE_COLORS.slate;
  return {
    id: stage.id,
    label: stage.name,
    statuses: stage.statuses,
    headerClass: colorMeta.headerClass,
    countClass: colorMeta.countClass,
    dotClass: colorMeta.dotClass,
  };
}

function formatElapsed(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const PRIORITY_STRIP: Record<string, string> = {
  critico: "bg-[#E84545]",
  alto: "bg-orange-500",
  medio: "bg-amber-400",
  bajo: "bg-slate-300 dark:bg-slate-600",
};

function KanbanCard({
  order,
  machines,
  users,
  typeLabels,
  onSelect,
  onAdvance,
  canEdit,
  canApprove,
  isAdvancing,
  ghost,
  isPreFinalStage,
}: {
  order: WorkOrder;
  machines: Machine[];
  users: UserInfo[];
  typeLabels: Record<string, string>;
  onSelect: () => void;
  onAdvance?: () => void;
  canEdit: boolean;
  canApprove: boolean;
  isAdvancing: boolean;
  ghost?: boolean;
  isPreFinalStage?: boolean;
}) {
  const slaTick = useSlaTimer();
  const machine = machines.find((m) => m.id === order.machineId);
  const assignee = users.find((u) => u.id === order.assignedUserId);
  const nextStatus = NEXT_STATUS[order.status];
  // slaTick drives a re-render every minute so elapsed and countdown stay current
  const _tick = slaTick;
  const elapsed = formatElapsed(order.updatedAt);
  const slaIsOverdue = order.slaStatus === "vencido";
  const slaIsAtRisk = order.slaStatus === "proximo_vencer";

  const canAdvanceToNext =
    nextStatus &&
    ((order.status === "completada" || isPreFinalStage) ? canApprove : canEdit);

  return (
    <div
      className={`bg-background border rounded-md cursor-pointer hover-elevate overflow-visible transition-opacity${ghost ? " opacity-40 pointer-events-none" : ""}`}
      onClick={onSelect}
      data-testid={`kanban-card-${order.id}`}
    >
      <div className="flex">
        <div className={`w-1.5 rounded-l-md shrink-0 ${PRIORITY_STRIP[order.priority] || "bg-slate-300"}`} />
        <div className="flex-1 p-3 space-y-2 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <span className="font-semibold text-sm leading-tight" data-testid={`kanban-order-number-${order.id}`}>
              {order.orderNumber}
            </span>
            <StatusBadge status={order.status} />
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{machine?.name || "—"}</span>
          </div>

          {order.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{order.description}</p>
          )}

          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs py-0">
              {typeLabels[order.type] || order.type}
            </Badge>
            <PriorityBadge priority={order.priority} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{assignee?.fullName || "Sin asignar"}</span>
            </div>
            <div
              className={`flex items-center gap-1 text-xs shrink-0 ${
                slaIsOverdue
                  ? "text-red-600 dark:text-red-400 font-medium"
                  : slaIsAtRisk
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              }`}
            >
              {slaIsOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              <span>{elapsed}</span>
            </div>
          </div>

          {order.stageEnteredAt && order.stageSlaHoursEffective && (() => {
            // _tick consumed here so every 1-min tick triggers a fresh Date.now() computation
            void _tick;
            const slaHours = Number(order.stageSlaHoursEffective);
            const enteredMs = new Date(order.stageEnteredAt).getTime();
            // Total paused = accumulated pausedSeconds from prior cycles + current pause interval (if active)
            const accPausedMs = (order.stagePausedSeconds ?? 0) * 1000;
            const isPaused = !!order.slaPausedAt;
            const curPausedMs = isPaused ? Date.now() - new Date(order.slaPausedAt!).getTime() : 0;
            const pausedMs = accPausedMs + curPausedMs;
            const elapsedMs = Math.max(0, Date.now() - enteredMs - pausedMs);
            const totalMs = slaHours * 3600 * 1000;
            const remainingMs = Math.max(0, totalMs - elapsedMs);
            const pct = Math.min(100, (elapsedMs / totalMs) * 100);
            const elapsedH = elapsedMs / 3600000;
            // Compute severity live from elapsed time so it transitions on the 1-min tick
            // without waiting for the next API refetch. escalateAt defaults to 80 (same as server).
            const parsedEscalate = Number(order.stageEscalateAt);
            const escalatePct = Number.isFinite(parsedEscalate) && order.stageEscalateAt != null ? parsedEscalate : 80;
            const isVencido = elapsedMs >= totalMs;
            const isProximo = !isVencido && elapsedMs >= (escalatePct / 100) * totalMs;
            const barColor = isVencido ? "bg-red-500" : isProximo ? "bg-amber-400" : "bg-green-500";
            const textColor = isVencido
              ? "text-red-600 dark:text-red-400"
              : isProximo
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground";
            // Format duration in human-friendly "Xh Ym" or "Ym" style
            const fmtDuration = (ms: number) => {
              const totalMin = Math.floor(ms / 60000);
              const h = Math.floor(totalMin / 60);
              const m = totalMin % 60;
              if (h === 0) return `${m}m`;
              if (m === 0) return `${h}h`;
              return `${h}h ${m}m`;
            };
            const fmtH = (h: number) =>
              h < 1 ? `${Math.round(h * 60)}min` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
            // Countdown label: only show when active (not paused) and not exceeded
            const countdownLabel = isVencido
              ? null
              : isPaused
              ? null
              : fmtDuration(remainingMs);
            const slaSourceLabels: Record<string, string> = {
              prioridad: "por prioridad",
              tipo: "por tipo",
              etapa: "etapa",
              global: "global",
            };
            const slaSourceLabel = order.stageSlaSource ? slaSourceLabels[order.stageSlaSource] ?? order.stageSlaSource : null;
            return (
              <div className="space-y-1" data-testid={`kanban-stage-sla-${order.id}`}>
                <div className={`flex items-center justify-between text-xs ${textColor}`}>
                  <span className="flex items-center gap-1">
                    {(isVencido || isProximo) && <AlertTriangle className="h-3 w-3 shrink-0" />}
                    <span>{fmtH(elapsedH)} / {fmtH(slaHours)}</span>
                    {isPaused && <span className="opacity-60">(pausado)</span>}
                  </span>
                  {isVencido ? (
                    <span className="font-medium">Vencido</span>
                  ) : countdownLabel ? (
                    <span
                      className={`flex items-center gap-0.5 font-medium ${textColor}`}
                      data-testid={`kanban-stage-countdown-${order.id}`}
                    >
                      <Clock className="h-3 w-3 shrink-0" />
                      {countdownLabel} restante
                    </span>
                  ) : isPaused ? (
                    <span className="opacity-60 text-xs">pausado</span>
                  ) : null}
                </div>
                <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {slaSourceLabel && (
                  <div className="text-xs text-muted-foreground/70 text-right" data-testid={`kanban-stage-sla-source-${order.id}`}>
                    Regla: {slaSourceLabel}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-1 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
            <Button
              size="icon"
              variant="ghost"
              onClick={onSelect}
              data-testid={`kanban-view-${order.id}`}
              title="Ver detalle"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {canAdvanceToNext && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={onAdvance}
                disabled={isAdvancing}
                data-testid={`kanban-advance-${order.id}`}
              >
                {isAdvancing ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <ArrowRight className="h-3 w-3 mr-1" />
                )}
                Avanzar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DraggableKanbanCard({
  order,
  machines,
  users,
  typeLabels,
  onSelect,
  onAdvance,
  canEdit,
  canApprove,
  isAdvancing,
  isActiveItem,
  isPreFinalStage,
}: {
  order: WorkOrder;
  machines: Machine[];
  users: UserInfo[];
  typeLabels: Record<string, string>;
  onSelect: () => void;
  onAdvance?: () => void;
  canEdit: boolean;
  canApprove: boolean;
  isAdvancing: boolean;
  isActiveItem: boolean;
  isPreFinalStage?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id, data: { order } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard
        order={order}
        machines={machines}
        users={users}
        typeLabels={typeLabels}
        onSelect={onSelect}
        onAdvance={onAdvance}
        canEdit={canEdit}
        canApprove={canApprove}
        isAdvancing={isAdvancing}
        ghost={isActiveItem}
        isPreFinalStage={isPreFinalStage}
      />
    </div>
  );
}

function DroppableColumn({
  col,
  children,
  isOver,
  isActive,
}: {
  col: KanbanColumn;
  children: React.ReactNode;
  isOver: boolean;
  isActive: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 rounded-md border bg-muted/20 transition-colors${isOver ? " ring-2 ring-primary bg-primary/5" : ""}${isActive && !isOver ? " border-dashed border-muted-foreground/40" : ""}`}
      data-testid={`kanban-column-${col.id}`}
    >
      {children}
    </div>
  );
}

function KanbanBoard({
  orders,
  machines,
  users,
  typeLabels,
  onSelectOrder,
  onMoveStatus,
  canEdit,
  canApprove,
  movingOrderId,
  stages,
}: {
  orders: WorkOrder[];
  machines: Machine[];
  users: UserInfo[];
  typeLabels: Record<string, string>;
  onSelectOrder: (order: WorkOrder) => void;
  onMoveStatus: (orderId: string, status: string, stageId?: string) => void;
  canEdit: boolean;
  canApprove: boolean;
  movingOrderId: string | null;
  stages: WorkOrderStage[];
}) {
  const [activeOrder, setActiveOrder] = useState<WorkOrder | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({});
  const columnOrdersRef = useRef<Record<string, string[]>>({});
  const columnOrdersSnapshot = useRef<Record<string, string[]>>({});

  const columns = useMemo(() => stages.map(stageToColumn), [stages]);

  // Keep ref in sync with state so event handlers always read the latest value
  // even if dnd-kit calls the handler via a stale closure.
  function setColumnOrdersSynced(updater: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) {
    setColumnOrders((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      columnOrdersRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    setColumnOrdersSynced((prev) => {
      const next: Record<string, string[]> = {};
      columns.forEach((col) => {
        const colOrders = orders
          .filter((o) => o.stageId === col.id || (!o.stageId && col.statuses.includes(o.status)))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const newIds = colOrders.map((o) => o.id);
        const prevIds = prev[col.id] ?? [];
        const kept = prevIds.filter((id) => newIds.includes(id));
        const added = newIds.filter((id) => !kept.includes(id));
        next[col.id] = [...kept, ...added];
      });
      return next;
    });
  }, [orders, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  function findColumnOfItem(colMap: Record<string, string[]>, itemId: string): string | null {
    for (const col of columns) {
      if ((colMap[col.id] ?? []).includes(itemId)) return col.id;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const order = orders.find((o) => o.id === event.active.id);
    setActiveOrder(order ?? null);
    columnOrdersSnapshot.current = columnOrdersRef.current;
  }

  function handleDragCancel() {
    setActiveOrder(null);
    setOverColumnId(null);
    setColumnOrdersSynced(columnOrdersSnapshot.current);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const current = columnOrdersRef.current;

    const overIsColumn = columns.some((c) => c.id === overId);
    const resolvedOverColId = overIsColumn ? overId : findColumnOfItem(current, overId);
    setOverColumnId(resolvedOverColId);

    const activeColId = findColumnOfItem(current, activeId);
    if (!activeColId || !resolvedOverColId) return;

    if (activeColId === resolvedOverColId) {
      if (!overIsColumn) {
        setColumnOrdersSynced((prev) => {
          const ids = [...(prev[activeColId] ?? [])];
          const oldIndex = ids.indexOf(activeId);
          const newIndex = ids.indexOf(overId);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
          return { ...prev, [activeColId]: arrayMove(ids, oldIndex, newIndex) };
        });
      }
    } else {
      // Cross-column: move card into target column at the appropriate position
      setColumnOrdersSynced((prev) => {
        const sourceIds = (prev[activeColId] ?? []).filter((id) => id !== activeId);
        const targetIds = (prev[resolvedOverColId] ?? []).filter((id) => id !== activeId);

        let insertIndex: number;
        if (overIsColumn) {
          insertIndex = targetIds.length;
        } else {
          const overIndex = targetIds.indexOf(overId);
          if (overIndex === -1) {
            insertIndex = targetIds.length;
          } else {
            // Insert before or after the over card depending on pointer position
            const overRect = over.rect;
            const activeTranslated = active.rect.current.translated;
            if (activeTranslated && overRect) {
              const activeCenter = activeTranslated.top + activeTranslated.height / 2;
              const overCenter = overRect.top + overRect.height / 2;
              insertIndex = activeCenter < overCenter ? overIndex : overIndex + 1;
            } else {
              insertIndex = overIndex;
            }
          }
        }

        const newTargetIds = [...targetIds];
        newTargetIds.splice(insertIndex, 0, activeId);
        return { ...prev, [activeColId]: sourceIds, [resolvedOverColId]: newTargetIds };
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOrder(null);
    setOverColumnId(null);
    const { active, over } = event;
    if (!over) {
      setColumnOrdersSynced(columnOrdersSnapshot.current);
      return;
    }

    const activeId = String(active.id);
    const latest = columnOrdersRef.current;

    // Determine the original column from the snapshot (before any drag-over moves)
    const originalColId =
      columns.find((col) =>
        (columnOrdersSnapshot.current[col.id] ?? []).includes(activeId)
      )?.id ?? null;

    // The current column reflects where handleDragOver placed the card
    const currentColId = findColumnOfItem(latest, activeId);

    if (!originalColId || !currentColId) return;

    if (originalColId === currentColId) {
      // Same column: persist the new order if it changed
      const currentIds = latest[currentColId] ?? [];
      const snapshotIds = columnOrdersSnapshot.current[currentColId] ?? [];
      if (JSON.stringify(currentIds) !== JSON.stringify(snapshotIds)) {
        apiRequest("PATCH", "/api/work-orders/reorder", { orderedIds: currentIds }).catch(() => {
          setColumnOrdersSynced(columnOrdersSnapshot.current);
        });
      }
      return;
    }

    // Cross-column move: validate the status transition
    const targetCol = columns.find((c) => c.id === currentColId);
    const order = orders.find((o) => o.id === activeId);
    if (!targetCol || !order) {
      setColumnOrdersSynced(columnOrdersSnapshot.current);
      return;
    }

    // Determine effective target status: final→cerrada, mapped statuses→first valid, empty→preserve current
    const targetStage = stages.find(s => s.id === targetCol.id);
    const targetIsFinal = targetStage?.isFinal ?? false;
    const hasStatuses = targetCol.statuses.length > 0;

    // Custom stages (no mapped statuses) act as visual buckets: status is preserved, only stageId moves
    const isCustomBucket = !targetIsFinal && !hasStatuses;

    if (!isCustomBucket && targetCol.statuses.includes(order.status)) {
      // Already in a stage that maps this status: no-op if stageId also matches
      if (order.stageId === targetCol.id) {
        setColumnOrdersSynced(columnOrdersSnapshot.current);
        return;
      }
    }

    const targetStatus = targetIsFinal ? "cerrada" : (hasStatuses ? (targetCol.statuses[0] ?? order.status) : order.status);

    // For stages with mapped statuses validate the transition; custom buckets skip this check
    if (!isCustomBucket && !isValidTransition(order.status, targetStatus)) {
      setColumnOrdersSynced(columnOrdersSnapshot.current);
      return;
    }
    if (targetIsFinal && !canApprove) {
      setColumnOrdersSynced(columnOrdersSnapshot.current);
      return;
    }
    if (!targetIsFinal && !canEdit) {
      setColumnOrdersSynced(columnOrdersSnapshot.current);
      return;
    }

    onMoveStatus(activeId, targetStatus, targetCol.id);
  }

  const isDraggingAny = activeOrder !== null;

  const finalStageIndex = useMemo(
    () => stages.findIndex((s) => s.isFinal),
    [stages]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="overflow-x-auto pb-4" data-testid="kanban-board">
        <div className="flex gap-3 min-w-max">
          {columns.map((col, colIdx) => {
            const colIds = columnOrders[col.id] ?? [];
            const colOrders = colIds
              .map((id) => orders.find((o) => o.id === id))
              .filter((o): o is WorkOrder => Boolean(o));
            const isOver = overColumnId === col.id;
            const incomingFromOtherCol =
              isOver &&
              activeOrder &&
              !col.statuses.includes(activeOrder.status) &&
              !colIds.includes(activeOrder.id);

            // Determine the next column so the "Avanzar" button uses the correct stageId
            const nextCol = columns[colIdx + 1] ?? null;
            const nextStage = stages[colIdx + 1] ?? null;
            const isPreFinalStage = nextStage?.isFinal ?? false;
            const nextIsFinal = nextStage?.isFinal ?? false;
            const nextHasStatuses = (nextCol?.statuses.length ?? 0) > 0;

            return (
              <DroppableColumn
                key={col.id}
                col={col}
                isOver={isOver}
                isActive={isDraggingAny}
              >
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-md ${col.headerClass}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${col.dotClass}`} />
                    <span className="font-semibold text-sm">{col.label}</span>
                  </div>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${col.countClass}`}>
                    {colOrders.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-380px)]">
                  <SortableContext items={colIds} strategy={verticalListSortingStrategy}>
                    {colOrders.length === 0 ? (
                      <div className={`text-center py-8 text-xs text-muted-foreground${isOver ? " text-primary" : ""}`}>
                        {isOver ? "Soltar aquí" : "Sin órdenes"}
                      </div>
                    ) : (
                      colOrders.map((order) => {
                        // Mirror the same target-status logic used by handleDragEnd
                        const advanceTargetStatus = nextIsFinal
                          ? "cerrada"
                          : nextHasStatuses
                          ? (nextCol!.statuses[0] ?? order.status)
                          : order.status;
                        return (
                        <DraggableKanbanCard
                          key={order.id}
                          order={order}
                          machines={machines}
                          users={users}
                          typeLabels={typeLabels}
                          onSelect={() => onSelectOrder(order)}
                          onAdvance={nextCol ? () => onMoveStatus(order.id, advanceTargetStatus, nextCol.id) : undefined}
                          canEdit={canEdit}
                          canApprove={canApprove}
                          isAdvancing={movingOrderId === order.id}
                          isActiveItem={activeOrder?.id === order.id}
                          isPreFinalStage={isPreFinalStage}
                        />
                        );
                      })
                    )}
                  </SortableContext>
                  {incomingFromOtherCol && (
                    <div className="border-2 border-dashed border-primary/40 rounded-md h-16 flex items-center justify-center text-xs text-primary/60">
                      Soltar aquí
                    </div>
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOrder ? (
          <div className="w-72 rotate-1 shadow-lg opacity-95">
            <KanbanCard
              order={activeOrder}
              machines={machines}
              users={users}
              typeLabels={typeLabels}
              onSelect={() => {}}
              canEdit={canEdit}
              canApprove={canApprove}
              isAdvancing={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── End Kanban Board ───────────────────────────────────────────────────────

const ITEM_TYPE_META: Record<ChecklistItemType, { label: string; icon: React.ElementType; color: string }> = {
  checkbox: { label: "Casilla", icon: SquareCheck, color: "text-muted-foreground" },
  multiple_choice: { label: "Selección única", icon: CircleDot, color: "text-blue-600" },
  multi_select: { label: "Selección múltiple", icon: ListChecks, color: "text-violet-600" },
  open_question: { label: "Pregunta abierta", icon: MessageSquare, color: "text-amber-600" },
  numeric: { label: "Numérico", icon: Hash, color: "text-green-600" },
  photo: { label: "Foto obligatoria", icon: ImageIcon, color: "text-pink-600" },
};

const ITEM_TYPE_OPTIONS: ChecklistItemType[] = ["checkbox", "multiple_choice", "multi_select", "open_question", "numeric", "photo"];

function SortableStageItem({ id, children, ...rest }: { id: string; children: React.ReactNode; [key: string]: unknown }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 rounded-md border p-2 bg-muted/30"
      {...(rest as Record<string, unknown>)}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
        tabIndex={-1}
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

export function WorkOrdersPage() {
  const { user } = useAuth();
  const isAbastecedor = user?.role === "abastecedor";
  const { can, isLoading: permLoading } = usePermissions();
  const { toast } = useToast();
  const stageSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const [activeTab, setActiveTab] = useState("ordenes");
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState<WorkOrder | null>(null);
  const [showEditTicket, setShowEditTicket] = useState<Ticket | null>(null);
  const [showReassign, setShowReassign] = useState<WorkOrder | null>(null);
  const [showDeleteOrder, setShowDeleteOrder] = useState<WorkOrder | null>(null);
  const [showDeleteTicket, setShowDeleteTicket] = useState<Ticket | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderPriorityFilter, setOrderPriorityFilter] = useState("all");
  const [orderAssigneeFilter, setOrderAssigneeFilter] = useState("all");
  const [kanbanQuickMyOrders, setKanbanQuickMyOrders] = useState(false);
  const [kanbanQuickUrgent, setKanbanQuickUrgent] = useState(false);
  const [kanbanQuickSlaOverdue, setKanbanQuickSlaOverdue] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("all");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("all");
  const [ticketPage, setTicketPage] = useState(1);
  const [reassignUserId, setReassignUserId] = useState("");
  const [showChecklistSettings, setShowChecklistSettings] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [editingStageColor, setEditingStageColor] = useState("slate");
  const [editingStageIsFinal, setEditingStageIsFinal] = useState(false);
  const [editingStageStatuses, setEditingStageStatuses] = useState<string[]>([]);
  const [editingSlaHours, setEditingSlaHours] = useState<string>("");
  const [editingSlaPriorityHours, setEditingSlaPriorityHours] = useState<{ critico: string; alto: string; medio: string; bajo: string }>({ critico: "", alto: "", medio: "", bajo: "" });
  const [editingSlaTypeHours, setEditingSlaTypeHours] = useState<Record<string, string>>({});
  const [editingSlaPauseOnStatuses, setEditingSlaPauseOnStatuses] = useState<string[]>([]);
  const [editingSlaEscalateAt, setEditingSlaEscalateAt] = useState<string>("");
  const [newStageColor, setNewStageColor] = useState("slate");
  const [activeTemplateTab, setActiveTemplateTab] = useState("tecnico");
  const [newItemLabels, setNewItemLabels] = useState<Record<string, string>>({});
  const [newItemTypes, setNewItemTypes] = useState<Record<string, ChecklistItemType>>({});
  const [newItemOptions, setNewItemOptions] = useState<Record<string, string[]>>({});
  const [newItemOptionInput, setNewItemOptionInput] = useState<Record<string, string>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingItemType, setEditingItemType] = useState<ChecklistItemType>("checkbox");
  const [editingOptions, setEditingOptions] = useState<string[]>([]);
  const [editingOptionInput, setEditingOptionInput] = useState("");
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeLabel, setEditingTypeLabel] = useState("");
  const [confirmDeleteTypeId, setConfirmDeleteTypeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    try { return (localStorage.getItem("wo-view-mode") as "list" | "kanban") || "list"; } catch { return "list"; }
  });
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);

  const [slaReportFrom, setSlaReportFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [slaReportTo, setSlaReportTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const { data: orders = [], isLoading: ordersLoading, isError: ordersError } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders"],
  });

  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedOrder)) {
        setSelectedOrder(updated);
      } else if (!updated && orders.length > 0) {
        setSelectedOrder(null);
      }
    }
  }, [orders]);

  const { data: tickets = [], isLoading: ticketsLoading, isError: ticketsError } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: stats, isError: statsError, refetch: refetchStats } = useQuery<WOStats>({
    queryKey: ["/api/work-orders/stats"],
  });

  type StageSlaRow = { stageId: string | null; stageName: string; total: number; withinSla: number; atRisk: number; exceeded: number; avgElapsedHours: number };
  const { data: stageSlaReport = [], isLoading: stageSlaLoading, isError: stageSlaError, refetch: refetchStageSla } = useQuery<StageSlaRow[]>({
    queryKey: ["/api/work-orders/reports/stage-sla", slaReportFrom, slaReportTo],
    queryFn: async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/work-orders/reports/stage-sla?from=${slaReportFrom}&to=${slaReportTo}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al cargar reporte");
      return res.json();
    },
    enabled: activeTab === "reportes-sla",
  });

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });

  const { data: users = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/users"],
  });

  type ChecklistTemplate = { id: string; tenantId: string; orderType: string; label: string; sortOrder: number; isActive: boolean; requiresPhoto: boolean; createdAt: string; itemType: ChecklistItemType; options: string[] | null };
  type ChecklistTemplatesGrouped = Record<string, ChecklistTemplate[]>;

  const { data: checklistTemplates = {}, isLoading: templatesLoading } = useQuery<ChecklistTemplatesGrouped>({
    queryKey: ["/api/work-orders/checklist-templates"],
    enabled: showChecklistSettings,
    staleTime: 0,
  });

  const { data: orderTypes = [], isLoading: orderTypesLoading } = useQuery<WorkOrderType[]>({
    queryKey: ["/api/work-order-types"],
  });

  const { data: orderTypesAll = [] } = useQuery<WorkOrderType[]>({
    queryKey: ["/api/work-order-types", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/work-order-types?includeInactive=true");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<WorkOrderStage[]>({
    queryKey: ["/api/work-order-stages"],
    staleTime: 30000,
  });

  const typeLabels = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const t of orderTypes) map[t.key] = t.label;
    for (const t of orderTypesAll) if (!map[t.key]) map[t.key] = t.label;
    return map;
  }, [orderTypes, orderTypesAll]);

  const createStageMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const res = await apiRequest("POST", "/api/work-order-stages", { name, color });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Error al crear etapa"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-stages"] });
      setNewStageName("");
      setNewStageColor("slate");
      toast({ title: "Etapa creada" });
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo crear la etapa", variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string; isFinal?: boolean; statuses?: string[]; slaHours?: number | null; slaPriorityHours?: { critico?: number; alto?: number; medio?: number; bajo?: number } | null; slaTypeHours?: Record<string, number> | null; slaPauseOnStatuses?: string[]; slaEscalateAt?: number | null }) => {
      const res = await apiRequest("PATCH", `/api/work-order-stages/${id}`, data);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Error al actualizar etapa"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders/stats"] });
      setEditingStageId(null);
      toast({ title: "Etapa actualizada" });
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo actualizar la etapa", variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/work-order-stages/${id}`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Error al eliminar etapa"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-stages"] });
      toast({ title: "Etapa eliminada" });
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo eliminar la etapa", variant: "destructive" });
    },
  });

  const reorderStagesMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiRequest("PATCH", "/api/work-order-stages/reorder", { orderedIds });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Error al reordenar"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-stages"] });
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo reordenar", variant: "destructive" });
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest("POST", "/api/work-order-types", { label });
      return res.json();
    },
    onSuccess: (created: WorkOrderType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-types", "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders/checklist-templates"] });
      setShowAddType(false);
      setNewTypeLabel("");
      setActiveTemplateTab(created.key);
      toast({ title: "Tipo creado", description: `"${created.label}" agregado correctamente` });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "No se pudo crear el tipo";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; label?: string; isActive?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/work-order-types/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-types", "all"] });
      setEditingTypeId(null);
      setEditingTypeLabel("");
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar el tipo", variant: "destructive" }),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/work-order-types/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-types", "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders/checklist-templates"] });
      toast({ title: "Tipo eliminado" });
    },
    onError: (err: unknown) => {
      let description = "Error al eliminar tipo";
      if (err instanceof Error) {
        const match = err.message.match(/^\d+:\s*(.+)$/s);
        if (match) {
          try { description = JSON.parse(match[1]).error || match[1]; } catch { description = match[1]; }
        } else {
          description = err.message;
        }
      }
      toast({ title: "No se puede eliminar", description, variant: "destructive" });
    },
  });

  const addTemplateMutation = useMutation({
    mutationFn: async ({ orderType, label, itemType, options }: { orderType: string; label: string; itemType?: ChecklistItemType; options?: string[] | null }) => {
      const res = await apiRequest("POST", "/api/work-orders/checklist-templates", { orderType, label, isActive: true, itemType: itemType ?? "checkbox", options: options ?? null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders/checklist-templates"] });
      setNewItemLabels(prev => ({ ...prev, [activeTemplateTab]: "" }));
      setNewItemTypes(prev => ({ ...prev, [activeTemplateTab]: "checkbox" }));
      setNewItemOptions(prev => ({ ...prev, [activeTemplateTab]: [] }));
      setNewItemOptionInput(prev => ({ ...prev, [activeTemplateTab]: "" }));
    },
    onError: () => toast({ title: "Error", description: "No se pudo agregar el ítem", variant: "destructive" }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; label?: string; sortOrder?: number; isActive?: boolean; requiresPhoto?: boolean; itemType?: ChecklistItemType; options?: string[] | null }) => {
      const res = await apiRequest("PATCH", `/api/work-orders/checklist-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders/checklist-templates"] });
      setEditingItemId(null);
      setEditingLabel("");
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar el ítem", variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/work-orders/checklist-templates/${id}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/work-orders/checklist-templates"] }),
    onError: () => toast({ title: "Error", description: "No se pudo eliminar el ítem", variant: "destructive" }),
  });

  const moveTemplateItem = (items: ChecklistTemplate[], idx: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx];
    const b = items[swapIdx];
    updateTemplateMutation.mutate({ id: a.id, sortOrder: swapIdx });
    updateTemplateMutation.mutate({ id: b.id, sortOrder: idx });
  };

  const stageOrderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const sid = o.stageId || stages.find(s => (s.statuses as string[]).includes(o.status))?.id;
      if (sid) counts[sid] = (counts[sid] || 0) + 1;
    }
    return counts;
  }, [orders, stages]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderSearch) {
        const s = orderSearch.toLowerCase();
        const machine = machines.find(m => m.id === o.machineId);
        const matchesSearch = o.orderNumber.toLowerCase().includes(s) ||
          o.description?.toLowerCase().includes(s) ||
          machine?.name?.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      if (orderTypeFilter !== "all" && o.type !== orderTypeFilter) return false;
      if (viewMode !== "kanban" && orderStatusFilter !== "all" && o.status !== orderStatusFilter) return false;
      if (orderPriorityFilter !== "all" && o.priority !== orderPriorityFilter) return false;
      if (orderAssigneeFilter !== "all") {
        if (orderAssigneeFilter === "unassigned") {
          if (o.assignedUserId) return false;
        } else {
          if (o.assignedUserId !== orderAssigneeFilter) return false;
        }
      }
      if (viewMode === "kanban" && kanbanQuickMyOrders && o.assignedUserId !== user?.id) return false;
      if (viewMode === "kanban" && kanbanQuickUrgent && o.priority !== "critico") return false;
      if (viewMode === "kanban" && kanbanQuickSlaOverdue && o.slaStatus !== "vencido") return false;
      return true;
    });
  }, [orders, orderSearch, orderTypeFilter, orderStatusFilter, orderPriorityFilter, orderAssigneeFilter, machines, kanbanQuickMyOrders, kanbanQuickUrgent, kanbanQuickSlaOverdue, user?.id, viewMode]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, orderPage]);

  useEffect(() => { setOrderPage(1); }, [orderSearch, orderTypeFilter, orderStatusFilter, orderPriorityFilter, orderAssigneeFilter]);

  const moveStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, stageId }: { orderId: string; status: string; stageId?: string }) => {
      await apiRequest("PATCH", `/api/work-orders/${orderId}`, { status, ...(stageId ? { stageId } : {}) });
    },
    onMutate: ({ orderId }) => setMovingOrderId(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders/stats"] });
      toast({ title: "Estado actualizado" });
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" }),
    onSettled: () => setMovingOrderId(null),
  });

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (ticketSearch) {
        const s = ticketSearch.toLowerCase();
        const machine = machines.find(m => m.id === t.machineId);
        const matchesSearch = t.ticketNumber.toLowerCase().includes(s) ||
          t.description?.toLowerCase().includes(s) ||
          machine?.name?.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      if (ticketTypeFilter !== "all" && t.type !== ticketTypeFilter) return false;
      if (ticketStatusFilter !== "all" && t.status !== ticketStatusFilter) return false;
      if (ticketPriorityFilter !== "all" && t.priority !== ticketPriorityFilter) return false;
      return true;
    });
  }, [tickets, ticketSearch, ticketTypeFilter, ticketStatusFilter, ticketPriorityFilter, machines]);

  const ticketTotalPages = Math.max(1, Math.ceil(filteredTickets.length / ITEMS_PER_PAGE));
  const paginatedTickets = useMemo(() => {
    const start = (ticketPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, ticketPage]);

  useEffect(() => { setTicketPage(1); }, [ticketSearch, ticketTypeFilter, ticketStatusFilter, ticketPriorityFilter]);

  const orderForm = useForm<z.infer<typeof createOrderSchema>>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      machineId: "",
      type: "",
      priority: "medio",
      assignedUserId: null,
      description: "",
      notes: "",
    },
  });

  const editOrderForm = useForm<z.infer<typeof editOrderSchema>>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      type: "",
      priority: "medio",
      status: "pendiente",
      assignedUserId: null,
      description: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (orderTypes.length === 0) return;
    const validKeys = new Set(orderTypes.map(t => t.key));
    const currentType = orderForm.getValues("type");
    if (!currentType || !validKeys.has(currentType)) {
      orderForm.setValue("type", orderTypes[0].key);
    }
  }, [orderTypes, orderForm]);

  useEffect(() => {
    if (orderTypes.length === 0) return;
    const validKeys = new Set(orderTypes.map(t => t.key));
    const currentType = editOrderForm.getValues("type");
    if (!currentType || !validKeys.has(currentType)) {
      editOrderForm.setValue("type", orderTypes[0].key);
    }
  }, [orderTypes, editOrderForm]);

  useEffect(() => {
    if (orderTypesAll.length === 0) return;
    const validKeys = new Set(orderTypesAll.map(t => t.key));
    if (!validKeys.has(activeTemplateTab)) {
      setActiveTemplateTab(orderTypesAll[0].key);
    }
  }, [orderTypesAll, activeTemplateTab]);

  const editOrderAbastecedorForm = useForm<z.infer<typeof editOrderAbastecedorSchema>>({
    resolver: zodResolver(editOrderAbastecedorSchema),
    defaultValues: {
      status: "en_proceso",
      notes: "",
    },
  });

  const ticketForm = useForm<z.infer<typeof createTicketSchema>>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      machineId: "",
      type: "falla_cliente",
      priority: "medio",
      reportedBy: "",
      description: "",
    },
  });

  const editTicketForm = useForm<z.infer<typeof editTicketSchema>>({
    resolver: zodResolver(editTicketSchema),
    defaultValues: {
      type: "falla_cliente",
      priority: "medio",
      status: "pendiente",
      resolution: "",
    },
  });

  useEffect(() => {
    if (showEditOrder) {
      if (isAbastecedor) {
        const currentStatus = showEditOrder.status as z.infer<typeof editOrderAbastecedorSchema>["status"];
        const allowedStatuses = ["en_proceso", "en_ruta", "completada"] as const;
        editOrderAbastecedorForm.reset({
          status: allowedStatuses.includes(currentStatus) ? currentStatus : "en_proceso",
          notes: showEditOrder.notes || "",
        });
      } else {
        editOrderForm.reset({
          type: showEditOrder.type as z.infer<typeof editOrderSchema>["type"],
          priority: showEditOrder.priority as z.infer<typeof editOrderSchema>["priority"],
          status: showEditOrder.status as z.infer<typeof editOrderSchema>["status"],
          assignedUserId: showEditOrder.assignedUserId || null,
          description: showEditOrder.description || "",
          notes: showEditOrder.notes || "",
        });
      }
    }
  }, [showEditOrder, isAbastecedor]);

  useEffect(() => {
    if (showEditTicket) {
      editTicketForm.reset({
        type: showEditTicket.type as z.infer<typeof editTicketSchema>["type"],
        priority: showEditTicket.priority as z.infer<typeof editTicketSchema>["priority"],
        status: showEditTicket.status as z.infer<typeof editTicketSchema>["status"],
        resolution: showEditTicket.resolution || "",
      });
    }
  }, [showEditTicket]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders/stats"] });
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createOrderSchema>) => {
      const payload = { ...data };
      if (payload.assignedUserId === "none" || !payload.assignedUserId) {
        payload.assignedUserId = null;
      }
      await apiRequest("POST", "/api/work-orders", payload);
    },
    onSuccess: () => {
      invalidateAll();
      setShowCreateOrder(false);
      orderForm.reset();
      toast({ title: "Orden creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la orden", variant: "destructive" });
    },
  });

  const editOrderMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editOrderSchema>) => {
      const payload = { ...data };
      if (payload.assignedUserId === "none" || !payload.assignedUserId) {
        payload.assignedUserId = null;
      }
      await apiRequest("PATCH", `/api/work-orders/${showEditOrder!.id}`, payload);
    },
    onSuccess: () => {
      invalidateAll();
      setShowEditOrder(null);
      setSelectedOrder(null);
      toast({ title: "Orden actualizada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la orden", variant: "destructive" });
    },
  });

  const editOrderAbastecedorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editOrderAbastecedorSchema>) => {
      await apiRequest("PATCH", `/api/work-orders/${showEditOrder!.id}`, data);
    },
    onSuccess: () => {
      invalidateAll();
      setShowEditOrder(null);
      setSelectedOrder(null);
      toast({ title: "Orden actualizada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la orden", variant: "destructive" });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/work-orders/${id}`);
    },
    onSuccess: () => {
      invalidateAll();
      setShowDeleteOrder(null);
      setSelectedOrder(null);
      toast({ title: "Orden eliminada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la orden", variant: "destructive" });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ orderId, userId }: { orderId: string; userId: string }) => {
      const normalizedUserId = (!userId || userId === "none" || userId === "") ? null : userId;
      const payload: Record<string, string | null> = { assignedUserId: normalizedUserId };
      if (normalizedUserId) {
        payload.status = "asignada";
      }
      await apiRequest("PATCH", `/api/work-orders/${orderId}`, payload);
    },
    onSuccess: () => {
      invalidateAll();
      setShowReassign(null);
      setSelectedOrder(null);
      setReassignUserId("");
      toast({ title: "Orden reasignada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo reasignar la orden", variant: "destructive" });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createTicketSchema>) => {
      await apiRequest("POST", "/api/tickets", data);
    },
    onSuccess: () => {
      invalidateAll();
      setShowCreateTicket(false);
      ticketForm.reset();
      toast({ title: "Ticket creado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el ticket", variant: "destructive" });
    },
  });

  const editTicketMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editTicketSchema>) => {
      await apiRequest("PATCH", `/api/tickets/${showEditTicket!.id}`, data);
    },
    onSuccess: () => {
      invalidateAll();
      setShowEditTicket(null);
      toast({ title: "Ticket actualizado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el ticket", variant: "destructive" });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tickets/${id}`);
    },
    onSuccess: () => {
      invalidateAll();
      setShowDeleteTicket(null);
      toast({ title: "Ticket eliminado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el ticket", variant: "destructive" });
    },
  });

  const createOrderFromTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      await apiRequest("POST", `/api/tickets/${ticketId}/create-order`, {});
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Orden creada desde ticket" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la orden desde ticket", variant: "destructive" });
    },
  });

  const updateSlaMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/work-orders/update-sla", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders/stats"] });
    },
  });

  useEffect(() => {
    updateSlaMutation.mutate();
  }, []);

  const activeOrders = orders.filter(o => !["cerrada", "cancelada", "completada"].includes(o.status)).length;
  const pendingTickets = tickets.filter(t => t.status === "pendiente").length;
  const completedToday = orders.filter(o => {
    if (!o.completedAt) return false;
    const d = new Date(o.completedAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const assignableUsers = users.filter(u => ["admin", "supervisor", "abastecedor"].includes(u.role));

  const sharedModals = (
    <>
      <SimpleModal
        open={!!showEditOrder}
        onClose={() => setShowEditOrder(null)}
        title="Editar Orden de Trabajo"
        description={`Editando ${showEditOrder?.orderNumber || ""}`}
      >
        {isAbastecedor ? (
          <Form {...editOrderAbastecedorForm}>
            <form onSubmit={editOrderAbastecedorForm.handleSubmit((data) => editOrderAbastecedorMutation.mutate(data))} className="space-y-4">
              <FormField control={editOrderAbastecedorForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-edit-order-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="en_proceso">En Proceso</SelectItem>
                      <SelectItem value="en_ruta">En Ruta</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editOrderAbastecedorForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea {...field} value={field.value || ""} data-testid="textarea-edit-order-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEditOrder(null)}>Cancelar</Button>
                <Button type="submit" disabled={editOrderAbastecedorMutation.isPending} data-testid="button-submit-edit-order">
                  {editOrderAbastecedorMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Form {...editOrderForm}>
            <form onSubmit={editOrderForm.handleSubmit((data) => editOrderMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={editOrderForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-edit-order-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {orderTypes.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                        {/* Si el tipo actual está inactivo, mostrarlo igualmente */}
                        {editOrderForm.getValues("type") && !orderTypes.find(t => t.key === editOrderForm.getValues("type")) && (
                          <SelectItem key={editOrderForm.getValues("type")} value={editOrderForm.getValues("type")}>
                            {typeLabels[editOrderForm.getValues("type")] || editOrderForm.getValues("type")} (inactivo)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editOrderForm.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-edit-order-priority"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editOrderForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-edit-order-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editOrderForm.control} name="assignedUserId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Asignar a</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl><SelectTrigger data-testid="select-edit-order-assignee"><SelectValue placeholder="Sin asignar" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {assignableUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName} ({u.role})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editOrderForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl><Textarea {...field} data-testid="textarea-edit-order-description" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editOrderForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea {...field} value={field.value || ""} data-testid="textarea-edit-order-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEditOrder(null)}>Cancelar</Button>
                <Button type="submit" disabled={editOrderMutation.isPending} data-testid="button-submit-edit-order">
                  {editOrderMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </SimpleModal>

      <SimpleModal
        open={!!showReassign}
        onClose={() => { setShowReassign(null); setReassignUserId(""); }}
        title="Reasignar Orden"
        description={`Reasignar ${showReassign?.orderNumber || ""} a otro usuario`}
      >
        <div className="space-y-4">
          <Select value={reassignUserId || "none"} onValueChange={setReassignUserId}>
            <SelectTrigger data-testid="select-reassign-user"><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {assignableUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName} ({u.role})</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowReassign(null); setReassignUserId(""); }}>Cancelar</Button>
            <Button
              onClick={() => reassignMutation.mutate({ orderId: showReassign!.id, userId: reassignUserId })}
              disabled={reassignMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {reassignMutation.isPending ? "Reasignando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </SimpleModal>

      <SimpleModal
        open={!!showDeleteOrder}
        onClose={() => setShowDeleteOrder(null)}
        title="Eliminar Orden"
        description={`¿Está seguro que desea eliminar ${showDeleteOrder?.orderNumber || ""}? Esta acción no se puede deshacer.`}
      >
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowDeleteOrder(null)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => deleteOrderMutation.mutate(showDeleteOrder!.id)}
            disabled={deleteOrderMutation.isPending}
            data-testid="button-confirm-delete-order"
          >
            {deleteOrderMutation.isPending ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </SimpleModal>

      <SimpleModal
        open={!!showEditTicket}
        onClose={() => setShowEditTicket(null)}
        title="Editar Ticket"
        description={`Editando ${showEditTicket?.ticketNumber || ""}`}
      >
        <Form {...editTicketForm}>
          <form onSubmit={editTicketForm.handleSubmit((data) => editTicketMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <FormField control={editTicketForm.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-edit-ticket-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(TICKET_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editTicketForm.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridad</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-edit-ticket-priority"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editTicketForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-edit-ticket-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={editTicketForm.control} name="resolution" render={({ field }) => (
              <FormItem>
                <FormLabel>Resolución</FormLabel>
                <FormControl><Textarea {...field} value={field.value || ""} placeholder="Describa la resolución..." data-testid="textarea-edit-ticket-resolution" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowEditTicket(null)}>Cancelar</Button>
              <Button type="submit" disabled={editTicketMutation.isPending} data-testid="button-submit-edit-ticket">
                {editTicketMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </SimpleModal>

      <SimpleModal
        open={!!showDeleteTicket}
        onClose={() => setShowDeleteTicket(null)}
        title="Eliminar Ticket"
        description={`¿Está seguro que desea eliminar ${showDeleteTicket?.ticketNumber || ""}? Esta acción no se puede deshacer.`}
      >
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowDeleteTicket(null)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => deleteTicketMutation.mutate(showDeleteTicket!.id)}
            disabled={deleteTicketMutation.isPending}
            data-testid="button-confirm-delete-ticket"
          >
            {deleteTicketMutation.isPending ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </SimpleModal>

      <SimpleModal
        open={showChecklistSettings}
        onClose={() => { setShowChecklistSettings(false); setEditingItemId(null); setEditingLabel(""); setEditingTypeId(null); setEditingTypeLabel(""); setShowAddType(false); setNewTypeLabel(""); }}
        title="Configurar Checklists por Tipo de Orden"
        description="Personaliza los tipos de orden y los ítems de checklist asignados automáticamente al crear órdenes."
      >
        <div className="mt-2">
          {(templatesLoading || orderTypesLoading) ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <>
              {(user?.role === "admin" || user?.isSuperAdmin) && (
                <div className="mb-4 rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipos de Orden</p>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddType(v => !v); setNewTypeLabel(""); }} data-testid="button-toggle-add-type">
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Nuevo Tipo
                    </Button>
                  </div>
                  {showAddType && (
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        placeholder="Nombre del nuevo tipo..."
                        value={newTypeLabel}
                        onChange={e => setNewTypeLabel(e.target.value)}
                        className="flex-1"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter" && newTypeLabel.trim()) createTypeMutation.mutate(newTypeLabel.trim());
                          if (e.key === "Escape") { setShowAddType(false); setNewTypeLabel(""); }
                        }}
                        data-testid="input-new-type-label"
                      />
                      <Button size="sm" onClick={() => { if (newTypeLabel.trim()) createTypeMutation.mutate(newTypeLabel.trim()); }} disabled={!newTypeLabel.trim() || createTypeMutation.isPending} data-testid="button-confirm-add-type">
                        {createTypeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Crear"}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setShowAddType(false); setNewTypeLabel(""); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <div className="space-y-1">
                    {orderTypesAll.map(wot => (
                      <div key={wot.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 bg-background border ${!wot.isActive ? "opacity-50" : ""}`}>
                        {editingTypeId === wot.id ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={editingTypeLabel}
                              onChange={e => setEditingTypeLabel(e.target.value)}
                              className="h-7 text-sm flex-1"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter" && editingTypeLabel.trim()) updateTypeMutation.mutate({ id: wot.id, label: editingTypeLabel.trim() });
                                if (e.key === "Escape") { setEditingTypeId(null); setEditingTypeLabel(""); }
                              }}
                              data-testid={`input-rename-type-${wot.id}`}
                            />
                            <Button size="icon" variant="ghost" onClick={() => { if (editingTypeLabel.trim()) updateTypeMutation.mutate({ id: wot.id, label: editingTypeLabel.trim() }); }} disabled={!editingTypeLabel.trim() || updateTypeMutation.isPending} data-testid={`button-save-type-${wot.id}`}>
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setEditingTypeId(null); setEditingTypeLabel(""); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-sm truncate">{wot.label}</span>
                            {wot.isDefault && (
                              <Badge variant="outline" className="text-xs py-0 shrink-0 no-default-hover-elevate no-default-active-elevate">Default</Badge>
                            )}
                          </div>
                        )}
                        {editingTypeId !== wot.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateTypeMutation.mutate({ id: wot.id, isActive: !wot.isActive })}
                              disabled={updateTypeMutation.isPending}
                              data-testid={`button-toggle-type-${wot.id}`}
                              title={wot.isActive ? "Desactivar tipo" : "Activar tipo"}
                            >
                              {wot.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setEditingTypeId(wot.id); setEditingTypeLabel(wot.label); }} data-testid={`button-rename-type-${wot.id}`} title="Renombrar">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {confirmDeleteTypeId === wot.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-destructive">¿Confirmar?</span>
                                <Button size="icon" variant="ghost" onClick={() => { deleteTypeMutation.mutate(wot.id); setConfirmDeleteTypeId(null); }} disabled={deleteTypeMutation.isPending} data-testid={`button-confirm-delete-type-${wot.id}`} title="Confirmar eliminación">
                                  <Check className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteTypeId(null)} data-testid={`button-cancel-delete-type-${wot.id}`} title="Cancelar">
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteTypeId(wot.id)} disabled={deleteTypeMutation.isPending} data-testid={`button-delete-type-${wot.id}`} title="Eliminar tipo">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orderTypesAll.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay tipos de orden configurados.</p>
              ) : (
                <Tabs value={activeTemplateTab} onValueChange={setActiveTemplateTab}>
                  <TabsList className="flex flex-wrap gap-1 h-auto mb-4">
                    {orderTypesAll.map(wot => (
                      <TabsTrigger key={wot.key} value={wot.key} data-testid={`tab-checklist-${wot.key}`}>
                        {wot.label}
                        {!wot.isActive && <span className="ml-1 text-xs text-muted-foreground">(inactivo)</span>}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {orderTypesAll.map(wot => {
                    const type = wot.key;
                    const items: ChecklistTemplate[] = checklistTemplates[type] || [];
                    return (
                      <TabsContent key={type} value={type} className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-3">
                          {items.filter(i => i.isActive).length} de {items.length} ítems activos se agregarán a nuevas órdenes de este tipo.
                        </p>
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                          {items.map((item, idx) => {
                              const itype: ChecklistItemType = item.itemType ?? "checkbox";
                              const meta = ITEM_TYPE_META[itype];
                              const TypeIcon = meta.icon;
                              const isEditing = editingItemId === item.id;
                              return (
                                <div key={item.id} className={`rounded-md border ${item.isActive ? "bg-card" : "bg-muted/40 opacity-60"}`}>
                                  <div className="flex items-center gap-2 px-2 py-1.5">
                                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                      <button
                                        className="disabled:opacity-30 hover:text-foreground text-muted-foreground transition-colors"
                                        onClick={() => moveTemplateItem(items, idx, "up")}
                                        disabled={idx === 0 || updateTemplateMutation.isPending}
                                        data-testid={`button-move-up-${item.id}`}
                                        title="Mover arriba"
                                      >
                                        <ChevronUp className="h-3 w-3" />
                                      </button>
                                      <button
                                        className="disabled:opacity-30 hover:text-foreground text-muted-foreground transition-colors"
                                        onClick={() => moveTemplateItem(items, idx, "down")}
                                        disabled={idx === items.length - 1 || updateTemplateMutation.isPending}
                                        data-testid={`button-move-down-${item.id}`}
                                        title="Mover abajo"
                                      >
                                        <ChevronDown className="h-3 w-3" />
                                      </button>
                                    </div>
                                    {isEditing ? (
                                      <div className="flex items-center gap-1 flex-1">
                                        <Input
                                          value={editingLabel}
                                          onChange={e => setEditingLabel(e.target.value)}
                                          className="h-7 text-sm flex-1"
                                          onKeyDown={e => {
                                            if (e.key === "Escape") { setEditingItemId(null); setEditingLabel(""); }
                                          }}
                                          autoFocus
                                          data-testid={`input-edit-label-${item.id}`}
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                                        <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} title={meta.label} />
                                        <span className="text-sm leading-tight line-clamp-2">{item.label}</span>
                                        {item.requiresPhoto && itype !== "photo" && (
                                          <Camera className="h-3 w-3 text-blue-600 flex-shrink-0" title="Requiere foto" />
                                        )}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isEditing ? (
                                        <Button size="icon" variant="ghost" onClick={() => updateTemplateMutation.mutate({ id: item.id, label: editingLabel, itemType: editingItemType, options: (editingItemType === "multiple_choice" || editingItemType === "multi_select") ? editingOptions : null })} disabled={!editingLabel.trim() || updateTemplateMutation.isPending} data-testid={`button-save-label-${item.id}`}>
                                          <Save className="h-3.5 w-3.5" />
                                        </Button>
                                      ) : (
                                        <Button size="icon" variant="ghost" onClick={() => { setEditingItemId(item.id); setEditingLabel(item.label); setEditingItemType(itype); setEditingOptions(item.options ?? []); setEditingOptionInput(""); }} data-testid={`button-edit-${item.id}`} title="Editar">
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                      {itype !== "photo" && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => updateTemplateMutation.mutate({ id: item.id, requiresPhoto: !item.requiresPhoto })}
                                          disabled={updateTemplateMutation.isPending}
                                          data-testid={`button-toggle-photo-${item.id}`}
                                          title={item.requiresPhoto ? "Quitar requisito de foto" : "Requerir foto para completar"}
                                        >
                                          <Camera className={`h-3.5 w-3.5 ${item.requiresPhoto ? "text-blue-600" : "text-muted-foreground"}`} />
                                        </Button>
                                      )}
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => updateTemplateMutation.mutate({ id: item.id, isActive: !item.isActive })}
                                        disabled={updateTemplateMutation.isPending}
                                        data-testid={`button-toggle-${item.id}`}
                                        title={item.isActive ? "Desactivar" : "Activar"}
                                      >
                                        {item.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => deleteTemplateMutation.mutate(item.id)}
                                        disabled={deleteTemplateMutation.isPending}
                                        data-testid={`button-delete-template-${item.id}`}
                                        title="Eliminar"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                  {isEditing && (
                                    <div className="px-3 pb-2 pt-1 border-t flex flex-col gap-2">
                                      <div className="flex flex-wrap gap-1.5">
                                        {ITEM_TYPE_OPTIONS.map(t => {
                                          const m = ITEM_TYPE_META[t];
                                          const TIcon = m.icon;
                                          return (
                                            <button
                                              key={t}
                                              type="button"
                                              onClick={() => { setEditingItemType(t); if (t !== "multiple_choice" && t !== "multi_select") setEditingOptions([]); }}
                                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${editingItemType === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                                              data-testid={`button-type-${t}-${item.id}`}
                                            >
                                              <TIcon className="h-3 w-3" />
                                              {m.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {(editingItemType === "multiple_choice" || editingItemType === "multi_select") && (
                                        <div className="flex flex-col gap-1">
                                          <span className="text-xs text-muted-foreground">Opciones:</span>
                                          {editingOptions.map((opt, oi) => (
                                            <div key={oi} className="flex items-center gap-1">
                                              <span className="text-xs flex-1 bg-muted/50 rounded px-2 py-0.5">{opt}</span>
                                              <button type="button" onClick={() => setEditingOptions(prev => prev.filter((_, i) => i !== oi))} className="text-destructive hover:text-destructive/80">
                                                <X className="h-3 w-3" />
                                              </button>
                                            </div>
                                          ))}
                                          <div className="flex gap-1">
                                            <Input
                                              value={editingOptionInput}
                                              onChange={e => setEditingOptionInput(e.target.value)}
                                              placeholder="Nueva opción..."
                                              className="h-7 text-xs flex-1"
                                              onKeyDown={e => {
                                                if (e.key === "Enter" && editingOptionInput.trim()) {
                                                  setEditingOptions(prev => [...prev, editingOptionInput.trim()]);
                                                  setEditingOptionInput("");
                                                }
                                              }}
                                              data-testid={`input-option-edit-${item.id}`}
                                            />
                                            <Button size="icon" variant="ghost" onClick={() => { if (editingOptionInput.trim()) { setEditingOptions(prev => [...prev, editingOptionInput.trim()]); setEditingOptionInput(""); } }} disabled={!editingOptionInput.trim()}>
                                              <PlusCircle className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          {items.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No hay ítems. Agrega el primero.</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 pt-2 border-t">
                          <div className="flex flex-wrap gap-1.5">
                            {ITEM_TYPE_OPTIONS.map(t => {
                              const m = ITEM_TYPE_META[t];
                              const TIcon = m.icon;
                              const current = newItemTypes[type] ?? "checkbox";
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => { setNewItemTypes(prev => ({ ...prev, [type]: t })); if (t !== "multiple_choice" && t !== "multi_select") setNewItemOptions(prev => ({ ...prev, [type]: [] })); }}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${current === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                                  data-testid={`button-new-type-${t}-${type}`}
                                >
                                  <TIcon className="h-3 w-3" />
                                  {m.label}
                                </button>
                              );
                            })}
                          </div>
                          {((newItemTypes[type] ?? "checkbox") === "multiple_choice" || (newItemTypes[type] ?? "checkbox") === "multi_select") && (
                            <div className="flex flex-col gap-1 pl-1">
                              <span className="text-xs text-muted-foreground">Opciones:</span>
                              {(newItemOptions[type] ?? []).map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-1">
                                  <span className="text-xs flex-1 bg-muted/50 rounded px-2 py-0.5">{opt}</span>
                                  <button type="button" onClick={() => setNewItemOptions(prev => ({ ...prev, [type]: (prev[type] ?? []).filter((_, i) => i !== oi) }))} className="text-destructive hover:text-destructive/80">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              <div className="flex gap-1">
                                <Input
                                  value={newItemOptionInput[type] ?? ""}
                                  onChange={e => setNewItemOptionInput(prev => ({ ...prev, [type]: e.target.value }))}
                                  placeholder="Nueva opción..."
                                  className="h-7 text-xs flex-1"
                                  onKeyDown={e => {
                                    if (e.key === "Enter" && (newItemOptionInput[type] ?? "").trim()) {
                                      const val = (newItemOptionInput[type] ?? "").trim();
                                      setNewItemOptions(prev => ({ ...prev, [type]: [...(prev[type] ?? []), val] }));
                                      setNewItemOptionInput(prev => ({ ...prev, [type]: "" }));
                                    }
                                  }}
                                  data-testid={`input-new-option-${type}`}
                                />
                                <Button size="icon" variant="ghost" onClick={() => { const val = (newItemOptionInput[type] ?? "").trim(); if (val) { setNewItemOptions(prev => ({ ...prev, [type]: [...(prev[type] ?? []), val] })); setNewItemOptionInput(prev => ({ ...prev, [type]: "" })); }}} disabled={!(newItemOptionInput[type] ?? "").trim()}>
                                  <PlusCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Nuevo ítem de checklist..."
                              value={newItemLabels[type] || ""}
                              onChange={e => setNewItemLabels(prev => ({ ...prev, [type]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === "Enter" && (newItemLabels[type] || "").trim()) {
                                  const itype = newItemTypes[type] ?? "checkbox";
                                  const opts = (itype === "multiple_choice" || itype === "multi_select") ? (newItemOptions[type] ?? []) : null;
                                  addTemplateMutation.mutate({ orderType: type, label: (newItemLabels[type] || "").trim(), itemType: itype, options: opts });
                                }
                              }}
                              className="flex-1"
                              data-testid={`input-new-item-${type}`}
                            />
                            <Button
                              onClick={() => {
                                const label = (newItemLabels[type] || "").trim();
                                const itype = newItemTypes[type] ?? "checkbox";
                                const opts = (itype === "multiple_choice" || itype === "multi_select") ? (newItemOptions[type] ?? []) : null;
                                if (label) addTemplateMutation.mutate({ orderType: type, label, itemType: itype, options: opts });
                              }}
                              disabled={!newItemLabels[type]?.trim() || addTemplateMutation.isPending}
                              data-testid={`button-add-item-${type}`}
                            >
                              <PlusCircle className="mr-1 h-4 w-4" />
                              Agregar
                            </Button>
                          </div>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </>
          )}
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => { setShowChecklistSettings(false); setEditingItemId(null); setEditingLabel(""); setEditingTypeId(null); setEditingTypeLabel(""); setShowAddType(false); setNewTypeLabel(""); }} data-testid="button-close-checklist-settings">
              Cerrar
            </Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );

  if (permLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Cargando...</p></div>;
  }

  if (selectedOrder) {
    return (
      <>
        <div className="p-6">
          <OrderDetailView
            order={selectedOrder}
            machines={machines}
            users={users}
            onBack={() => setSelectedOrder(null)}
            onEdit={() => setShowEditOrder(selectedOrder)}
            onReassign={() => { setShowReassign(selectedOrder); setReassignUserId(selectedOrder.assignedUserId || ""); }}
            onDelete={() => setShowDeleteOrder(selectedOrder)}
            typeLabels={typeLabels}
          />
        </div>
        {sharedModals}
      </>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Órdenes de Trabajo</h1>
          <p className="text-sm text-muted-foreground">Gestión de órdenes de trabajo y tickets</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {can("work_orders", "create") && (
            <Button onClick={() => setShowCreateOrder(true)} data-testid="button-new-order">
              <Plus className="mr-1 h-4 w-4" />
              Nueva Orden
            </Button>
          )}
          {can("work_order_tickets", "create") && (
            <Button variant="outline" onClick={() => setShowCreateTicket(true)} data-testid="button-new-ticket">
              <TicketCheck className="mr-1 h-4 w-4" />
              Nuevo Ticket
            </Button>
          )}
          {can("work_orders", "edit") && user?.role === "admin" && (
            <Button variant="outline" size="icon" onClick={() => setShowChecklistSettings(true)} data-testid="button-checklist-settings" title="Configurar checklists">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-orders">{activeOrders}</p>
                <p className="text-xs text-muted-foreground">Órdenes Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <TicketCheck className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-pending-tickets">{pendingTickets}</p>
                <p className="text-xs text-muted-foreground">Tickets Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-sla-breached">{statsError ? "—" : (stats?.slaBreached || 0)}</p>
                <p className="text-xs text-muted-foreground">SLA Vencidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-completed-today">{completedToday}</p>
                <p className="text-xs text-muted-foreground">Completadas Hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ordenes" data-testid="tab-ordenes">Órdenes</TabsTrigger>
          <TabsTrigger value="tickets" data-testid="tab-tickets">Tickets</TabsTrigger>
          <TabsTrigger value="sla" data-testid="tab-sla">Dashboard SLA</TabsTrigger>
          <TabsTrigger value="reportes-sla" data-testid="tab-reportes-sla">Reporte SLA por Etapa</TabsTrigger>
        </TabsList>

        <TabsContent value="ordenes" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por # orden, máquina..."
                className="pl-9"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                data-testid="input-order-search"
              />
            </div>
            <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-order-type">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(typeLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {viewMode !== "kanban" && (
              <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-order-status">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={orderPriorityFilter} onValueChange={setOrderPriorityFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-order-priority">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={orderAssigneeFilter} onValueChange={setOrderAssigneeFilter}>
              <SelectTrigger className="w-[170px]" data-testid="select-order-assignee">
                <SelectValue placeholder="Asignado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {assignableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border overflow-hidden shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-none ${viewMode === "list" ? "bg-muted" : ""}`}
                onClick={() => { setViewMode("list"); try { localStorage.setItem("wo-view-mode", "list"); } catch {} }}
                title="Vista lista"
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-none ${viewMode === "kanban" ? "bg-muted" : ""}`}
                onClick={() => { setViewMode("kanban"); try { localStorage.setItem("wo-view-mode", "kanban"); } catch {} }}
                title="Vista tablero"
                data-testid="button-view-kanban"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            {viewMode === "kanban" && can("settings", "edit") && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowStageSettings(true)}
                title="Gestionar etapas del tablero"
                data-testid="button-stage-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateSlaMutation.mutate()}
              disabled={updateSlaMutation.isPending}
              title="Actualizar estados SLA"
              data-testid="button-refresh-sla"
            >
              <RefreshCcw className={`h-4 w-4 ${updateSlaMutation.isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {viewMode === "kanban" && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="kanban-quick-filters">
              <button
                type="button"
                onClick={() => setKanbanQuickMyOrders(v => !v)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${kanbanQuickMyOrders ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                data-testid="chip-kanban-my-orders"
              >
                <User className="h-3.5 w-3.5" />
                Mis órdenes
              </button>
              <button
                type="button"
                onClick={() => setKanbanQuickUrgent(v => !v)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${kanbanQuickUrgent ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                data-testid="chip-kanban-urgent"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Urgente
              </button>
              <button
                type="button"
                onClick={() => setKanbanQuickSlaOverdue(v => !v)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${kanbanQuickSlaOverdue ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background border-border hover-elevate"}`}
                data-testid="chip-kanban-sla-overdue"
              >
                <Clock className="h-3.5 w-3.5" />
                Vencidas SLA
              </button>
              {(kanbanQuickMyOrders || kanbanQuickUrgent || kanbanQuickSlaOverdue) && (
                <button
                  type="button"
                  onClick={() => { setKanbanQuickMyOrders(false); setKanbanQuickUrgent(false); setKanbanQuickSlaOverdue(false); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="chip-kanban-clear-quick"
                >
                  <X className="h-3 w-3" />
                  Limpiar
                </button>
              )}
            </div>
          )}

          {ordersError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
                <p className="text-destructive font-medium">Error al cargar órdenes de trabajo</p>
                <p className="text-sm text-muted-foreground mt-1">Intente recargar la página</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] })} data-testid="button-retry-orders">
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : ordersLoading || (viewMode === "kanban" && stagesLoading) ? (
            viewMode === "kanban" ? (
              <div className="flex gap-4 overflow-x-auto pb-2" data-testid="kanban-skeleton">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-72">
                    <div className="h-8 rounded-md bg-muted animate-pulse mb-3" />
                    {[...Array(3)].map((__, j) => (
                      <div key={j} className="h-24 rounded-md bg-muted/60 animate-pulse mb-2" />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32"><p className="text-muted-foreground">Cargando órdenes...</p></div>
            )
          ) : viewMode === "kanban" ? (
            <KanbanBoard
              orders={filteredOrders.filter((o) => o.status !== "cancelada")}
              machines={machines}
              users={users}
              typeLabels={typeLabels}
              onSelectOrder={setSelectedOrder}
              onMoveStatus={(orderId, status, stageId) => moveStatusMutation.mutate({ orderId, status, stageId })}
              canEdit={can("work_orders", "edit")}
              canApprove={can("work_orders", "approve")}
              movingOrderId={movingOrderId}
              stages={stages}
            />
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No se encontraron órdenes de trabajo</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{filteredOrders.length} resultado(s)</p>
              {paginatedOrders.map((order) => {
                const machine = machines.find(m => m.id === order.machineId);
                const assignee = users.find(u => u.id === order.assignedUserId);
                return (
                  <Card
                    key={order.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                    data-testid={`card-order-${order.id}`}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" data-testid={`text-order-number-${order.id}`}>{order.orderNumber}</span>
                            <span className="text-xs text-muted-foreground">{machine?.name || "—"}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{order.description || "Sin descripción"}</p>
                        </div>
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">
                          {typeLabels[order.type] || order.type}
                        </Badge>
                        <PriorityBadge priority={order.priority} />
                        <StatusBadge status={order.status} />
                        <SlaBadge slaStatus={order.slaStatus} />
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {assignee?.fullName || "Sin asignar"}
                        </span>
                        <span className="text-xs text-muted-foreground hidden md:inline">
                          {formatDate(order.createdAt)}
                        </span>
                        {can("work_orders", "edit") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setShowEditOrder(order); }}
                            data-testid={`button-edit-order-${order.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {can("work_orders", "delete") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setShowDeleteOrder(order); }}
                            data-testid={`button-delete-order-${order.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              <Pagination currentPage={orderPage} totalPages={orderTotalPages} onPageChange={setOrderPage} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por # ticket, máquina..."
                className="pl-9"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                data-testid="input-ticket-search"
              />
            </div>
            <Select value={ticketTypeFilter} onValueChange={setTicketTypeFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-ticket-type">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(TICKET_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-ticket-status">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ticketPriorityFilter} onValueChange={setTicketPriorityFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-ticket-priority">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {ticketsError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
                <p className="text-destructive font-medium">Error al cargar tickets</p>
                <p className="text-sm text-muted-foreground mt-1">Intente recargar la página</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/tickets"] })} data-testid="button-retry-tickets">
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : ticketsLoading ? (
            <div className="flex items-center justify-center h-32"><p className="text-muted-foreground">Cargando tickets...</p></div>
          ) : filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TicketCheck className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No se encontraron tickets</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{filteredTickets.length} resultado(s)</p>
              {paginatedTickets.map((ticket) => {
                const machine = machines.find(m => m.id === ticket.machineId);
                return (
                  <Card key={ticket.id} data-testid={`card-ticket-${ticket.id}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" data-testid={`text-ticket-number-${ticket.id}`}>{ticket.ticketNumber}</span>
                            <span className="text-xs text-muted-foreground">{machine?.name || "—"}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{ticket.description}</p>
                        </div>
                        <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs">
                          {TICKET_TYPE_LABELS[ticket.type] || ticket.type}
                        </Badge>
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} labels={TICKET_STATUS_LABELS} />
                        <SlaBadge slaStatus={ticket.slaStatus} />
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {ticket.reportedBy || "—"}
                        </span>
                        {can("work_orders", "create") && !["resuelto", "cerrado"].includes(ticket.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              createOrderFromTicketMutation.mutate(ticket.id);
                            }}
                            disabled={createOrderFromTicketMutation.isPending}
                            data-testid={`button-create-order-from-ticket-${ticket.id}`}
                          >
                            <ArrowRight className="mr-1 h-3 w-3" />
                            Crear Orden
                          </Button>
                        )}
                        {can("work_order_tickets", "edit") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setShowEditTicket(ticket); }}
                            data-testid={`button-edit-ticket-${ticket.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {can("work_order_tickets", "delete") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setShowDeleteTicket(ticket); }}
                            data-testid={`button-delete-ticket-${ticket.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              <Pagination currentPage={ticketPage} totalPages={ticketTotalPages} onPageChange={setTicketPage} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="sla">
          {statsError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="text-muted-foreground">Error al cargar estadísticas SLA</p>
                <Button variant="outline" size="sm" onClick={() => refetchStats()} data-testid="button-retry-stats">
                  <RefreshCcw className="mr-1 h-4 w-4" /> Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : (
            <SLADashboard stats={stats} orders={orders} machines={machines} users={users} onSelectOrder={setSelectedOrder} typeLabels={typeLabels} />
          )}
        </TabsContent>

        <TabsContent value="reportes-sla" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold">Cumplimiento SLA por Etapa</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground">Desde</label>
                    <Input
                      type="date"
                      value={slaReportFrom}
                      onChange={(e) => setSlaReportFrom(e.target.value)}
                      className="w-[145px] text-xs"
                      data-testid="input-sla-report-from"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground">Hasta</label>
                    <Input
                      type="date"
                      value={slaReportTo}
                      onChange={(e) => setSlaReportTo(e.target.value)}
                      className="w-[145px] text-xs"
                      data-testid="input-sla-report-to"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchStageSla()}
                    data-testid="button-sla-report-refresh"
                  >
                    <RefreshCcw className="h-4 w-4 mr-1" />
                    Actualizar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={stageSlaReport.length === 0}
                    onClick={() => {
                      const escCsv = (v: string | number) => {
                        const s = String(v);
                        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                      };
                      const headers = ["Etapa", "Total", "En Tiempo", "% En Tiempo", "Próx. Vencer", "% Próx. Vencer", "Vencido", "% Vencido", "Prom. Horas"];
                      const rows = stageSlaReport.map((r) => {
                        const pct = (n: number) => r.total > 0 ? ((n / r.total) * 100).toFixed(1) : "0.0";
                        return [r.stageName, r.total, r.withinSla, `${pct(r.withinSla)}%`, r.atRisk, `${pct(r.atRisk)}%`, r.exceeded, `${pct(r.exceeded)}%`, r.avgElapsedHours.toFixed(2)];
                      });
                      const csv = [headers, ...rows].map(row => row.map(escCsv).join(",")).join("\n");
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `sla-etapas-${slaReportFrom}-${slaReportTo}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    data-testid="button-sla-report-export"
                  >
                    <List className="h-4 w-4 mr-1" />
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {stageSlaLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Cargando reporte...</span>
                </div>
              ) : stageSlaError ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-muted-foreground">Error al cargar reporte SLA</p>
                  <Button variant="outline" size="sm" onClick={() => refetchStageSla()} data-testid="button-retry-sla-report">
                    <RefreshCcw className="mr-1 h-4 w-4" /> Reintentar
                  </Button>
                </div>
              ) : stageSlaReport.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 opacity-40" />
                  <p className="text-sm">No hay datos de log de etapas para el período seleccionado.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse" data-testid="table-sla-report">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Etapa</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                            <span className="text-[#4ECB71]">En Tiempo</span>
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">% En T.</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                            <span className="text-[#F59E0B]">Próx. Vencer</span>
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">% P.V.</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                            <span className="text-destructive">Vencido</span>
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">% Venc.</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Prom. Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stageSlaReport.map((row, idx) => {
                          const pct = (n: number) => row.total > 0 ? ((n / row.total) * 100).toFixed(1) : "0.0";
                          return (
                            <tr key={row.stageId ?? idx} className="border-b last:border-0 hover-elevate" data-testid={`row-sla-stage-${idx}`}>
                              <td className="py-2 px-3 font-medium">{row.stageName}</td>
                              <td className="py-2 px-3 text-right">{row.total}</td>
                              <td className="py-2 px-3 text-right text-[#4ECB71] font-medium">{row.withinSla}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{pct(row.withinSla)}%</td>
                              <td className="py-2 px-3 text-right text-[#F59E0B] font-medium">{row.atRisk}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{pct(row.atRisk)}%</td>
                              <td className="py-2 px-3 text-right text-destructive font-medium">{row.exceeded}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{pct(row.exceeded)}%</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{row.avgElapsedHours.toFixed(1)}h</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">Distribución SLA por Etapa</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={stageSlaReport.map((r) => ({
                          name: r.stageName,
                          "En Tiempo": r.withinSla,
                          "Próx. Vencer": r.atRisk,
                          "Vencido": r.exceeded,
                        }))}
                        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={11} tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} fontSize={11} />
                        <Tooltip />
                        <Legend fontSize={11} />
                        <Bar dataKey="En Tiempo" stackId="sla" fill="#4ECB71" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Próx. Vencer" stackId="sla" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Vencido" stackId="sla" fill="#E84545" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">Tiempo Promedio por Etapa (horas)</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={stageSlaReport.map((r) => ({
                          name: r.stageName,
                          "Prom. Horas": r.avgElapsedHours,
                        }))}
                        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis allowDecimals={false} fontSize={11} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} />
                        <Bar dataKey="Prom. Horas" fill="#2F6FED" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SimpleModal
        open={showCreateOrder}
        onClose={() => { setShowCreateOrder(false); orderForm.reset(); }}
        title="Nueva Orden de Trabajo"
        description="Complete los datos para crear una nueva orden de trabajo"
      >
        <Form {...orderForm}>
          <form onSubmit={orderForm.handleSubmit((data) => createOrderMutation.mutate(data))} className="space-y-4">
            <FormField
              control={orderForm.control}
              name="machineId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Máquina *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-order-machine">
                        <SelectValue placeholder="Seleccionar máquina" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.code ? `${m.code} - ${m.name}` : m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={orderForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Orden</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-order-form-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {orderTypes.map((t) => (
                          <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orderForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-order-form-priority">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={orderForm.control}
              name="assignedUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asignar a</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-order-form-assignee">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {assignableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName} ({u.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={orderForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describa el trabajo a realizar..." data-testid="textarea-order-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={orderForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} placeholder="Notas adicionales..." data-testid="textarea-order-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setShowCreateOrder(false); orderForm.reset(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createOrderMutation.isPending} data-testid="button-submit-order">
                {createOrderMutation.isPending ? "Creando..." : "Crear Orden"}
              </Button>
            </div>
          </form>
        </Form>
      </SimpleModal>

      <SimpleModal
        open={showCreateTicket}
        onClose={() => { setShowCreateTicket(false); ticketForm.reset(); }}
        title="Nuevo Ticket"
        description="Reporte una incidencia o solicitud de servicio"
      >
        <Form {...ticketForm}>
          <form onSubmit={ticketForm.handleSubmit((data) => createTicketMutation.mutate(data))} className="space-y-4">
            <FormField
              control={ticketForm.control}
              name="machineId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Máquina *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-ticket-machine">
                        <SelectValue placeholder="Seleccionar máquina" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.code ? `${m.code} - ${m.name}` : m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={ticketForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Incidencia</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ticket-form-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(TICKET_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={ticketForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ticket-form-priority">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={ticketForm.control}
              name="reportedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reportado por</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Nombre de quien reporta" data-testid="input-ticket-reported-by" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={ticketForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describa la incidencia o solicitud..." data-testid="textarea-ticket-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setShowCreateTicket(false); ticketForm.reset(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTicketMutation.isPending} data-testid="button-submit-ticket">
                {createTicketMutation.isPending ? "Creando..." : "Crear Ticket"}
              </Button>
            </div>
          </form>
        </Form>
      </SimpleModal>

      <SimpleModal
        open={showStageSettings}
        onClose={() => { setShowStageSettings(false); setEditingStageId(null); setNewStageName(""); setNewStageColor("slate"); }}
        title="Gestionar Etapas del Tablero"
        description="Personaliza las columnas del tablero Kanban. Arrastra para reordenar, edita el nombre y el color de cada etapa."
      >
        <div className="space-y-3">
          <DndContext
            sensors={stageSensors}
            onDragEnd={(event: DragEndEvent) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;
              const ids = stages.map(s => s.id);
              const oldIdx = ids.indexOf(String(active.id));
              const newIdx = ids.indexOf(String(over.id));
              if (oldIdx !== -1 && newIdx !== -1) {
                reorderStagesMutation.mutate(arrayMove(ids, oldIdx, newIdx));
              }
            }}
          >
            <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {stages.map((stage) => {
                const isEditing = editingStageId === stage.id;
                const orderCount = stageOrderCounts[stage.id] ?? 0;
                const canDelete = stages.length > 1 && orderCount === 0;
                return (
                  <SortableStageItem key={stage.id} id={stage.id} data-testid={`stage-item-${stage.id}`}>
                    {isEditing ? (
                      <div className="flex-1 space-y-2">
                        <input
                          className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                          value={editingStageName}
                          onChange={e => setEditingStageName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && editingStageName.trim()) {
                              const ph = editingSlaPriorityHours;
                              const thEntries = Object.entries(editingSlaTypeHours).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]);
                              updateStageMutation.mutate({ id: stage.id, name: editingStageName.trim(), color: editingStageColor, isFinal: editingStageIsFinal, statuses: editingStageStatuses, slaHours: editingSlaHours ? Number(editingSlaHours) : null, slaPriorityHours: (ph.critico || ph.alto || ph.medio || ph.bajo) ? { ...(ph.critico ? { critico: Number(ph.critico) } : {}), ...(ph.alto ? { alto: Number(ph.alto) } : {}), ...(ph.medio ? { medio: Number(ph.medio) } : {}), ...(ph.bajo ? { bajo: Number(ph.bajo) } : {}) } : null, slaTypeHours: thEntries.length > 0 ? Object.fromEntries(thEntries) : null, slaPauseOnStatuses: editingSlaPauseOnStatuses, slaEscalateAt: editingSlaEscalateAt ? Number(editingSlaEscalateAt) : null });
                            }
                            if (e.key === "Escape") setEditingStageId(null);
                          }}
                          autoFocus
                          data-testid={`input-stage-name-${stage.id}`}
                        />
                        <div className="flex gap-1.5 flex-wrap">
                          {STAGE_COLOR_OPTIONS.map(c => {
                            const meta = STAGE_COLORS[c];
                            return (
                              <button
                                key={c}
                                type="button"
                                title={STAGE_COLOR_LABELS[c]}
                                className={`h-5 w-5 rounded-full ${meta.dotPreview} ring-offset-1 ${editingStageColor === c ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-muted-foreground"}`}
                                onClick={() => setEditingStageColor(c)}
                                data-testid={`color-swatch-edit-${c}`}
                              />
                            );
                          })}
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`toggle-stage-final-${stage.id}`}>
                          <input
                            type="checkbox"
                            checked={editingStageIsFinal}
                            onChange={e => setEditingStageIsFinal(e.target.checked)}
                            className="rounded"
                          />
                          <span>Etapa final (requiere permiso de aprobación para mover órdenes aquí)</span>
                        </label>
                        <div className="rounded-md border bg-muted/20 p-2 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Estados incluidos en esta etapa</p>
                          {(["pendiente", "asignada", "en_proceso", "en_ruta", "completada", "cerrada"] as const).map(st => {
                            const isChecked = editingStageStatuses.includes(st);
                            const ownerStage = !isChecked ? stages.find(s => s.id !== stage.id && (s.statuses as string[]).includes(st)) : undefined;
                            return (
                              <label key={st} className="flex items-center gap-2 text-sm cursor-pointer select-none" data-testid={`checkbox-status-${st}-${stage.id}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setEditingStageStatuses(prev => [...prev, st]);
                                    } else {
                                      setEditingStageStatuses(prev => prev.filter(s => s !== st));
                                    }
                                  }}
                                  className="rounded"
                                />
                                <span>{STATUS_LABELS[st]}</span>
                                {ownerStage && (
                                  <span className="text-xs text-muted-foreground">(actualmente en &quot;{ownerStage.name}&quot;)</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">SLA de etapa</p>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground w-32 shrink-0">Horas (predeterminado)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                              placeholder="ej. 4"
                              value={editingSlaHours}
                              onChange={e => setEditingSlaHours(e.target.value)}
                              data-testid={`input-stage-sla-hours-${stage.id}`}
                            />
                            <span className="text-xs text-muted-foreground shrink-0">h</span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Horas por prioridad (opcional):</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {(["critico", "alto", "medio", "bajo"] as const).map(p => (
                                <div key={p} className="flex items-center gap-1.5">
                                  <span className={`text-xs shrink-0 w-14 ${p === "critico" ? "text-red-600" : p === "alto" ? "text-orange-500" : p === "medio" ? "text-amber-500" : "text-slate-500"}`}>{PRIORITY_LABELS[p]}</span>
                                  <input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                                    placeholder="h"
                                    value={editingSlaPriorityHours[p]}
                                    onChange={e => setEditingSlaPriorityHours(prev => ({ ...prev, [p]: e.target.value }))}
                                    data-testid={`input-stage-sla-${p}-${stage.id}`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          {orderTypes.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Horas por tipo de orden (opcional):</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {orderTypes.map(ot => (
                                  <div key={ot.key} className="flex items-center gap-1.5">
                                    <span className="text-xs shrink-0 w-20 truncate text-muted-foreground" title={ot.label}>{ot.label}</span>
                                    <input
                                      type="number"
                                      min="0.5"
                                      step="0.5"
                                      className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                                      placeholder="h"
                                      value={editingSlaTypeHours[ot.key] ?? ""}
                                      onChange={e => setEditingSlaTypeHours(prev => ({ ...prev, [ot.key]: e.target.value }))}
                                      data-testid={`input-stage-sla-type-${ot.key}-${stage.id}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Pausar SLA cuando el estado sea:</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {(["pendiente", "asignada", "en_proceso", "en_ruta"] as const).map(st => (
                                <label key={st} className="flex items-center gap-1 text-xs cursor-pointer select-none" data-testid={`checkbox-sla-pause-${st}-${stage.id}`}>
                                  <input
                                    type="checkbox"
                                    checked={editingSlaPauseOnStatuses.includes(st)}
                                    onChange={e => {
                                      if (e.target.checked) setEditingSlaPauseOnStatuses(prev => [...prev, st]);
                                      else setEditingSlaPauseOnStatuses(prev => prev.filter(s => s !== st));
                                    }}
                                    className="rounded"
                                  />
                                  {STATUS_LABELS[st]}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground w-32 shrink-0">Alertar cuando se use</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="5"
                              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                              placeholder="ej. 80"
                              value={editingSlaEscalateAt}
                              onChange={e => setEditingSlaEscalateAt(e.target.value)}
                              data-testid={`input-stage-sla-escalate-${stage.id}`}
                            />
                            <span className="text-xs text-muted-foreground shrink-0">% del tiempo</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={!editingStageName.trim() || updateStageMutation.isPending}
                            onClick={() => {
                              const ph = editingSlaPriorityHours;
                              const thEntries = Object.entries(editingSlaTypeHours).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]);
                              updateStageMutation.mutate({ id: stage.id, name: editingStageName.trim(), color: editingStageColor, isFinal: editingStageIsFinal, statuses: editingStageStatuses, slaHours: editingSlaHours ? Number(editingSlaHours) : null, slaPriorityHours: (ph.critico || ph.alto || ph.medio || ph.bajo) ? { ...(ph.critico ? { critico: Number(ph.critico) } : {}), ...(ph.alto ? { alto: Number(ph.alto) } : {}), ...(ph.medio ? { medio: Number(ph.medio) } : {}), ...(ph.bajo ? { bajo: Number(ph.bajo) } : {}) } : null, slaTypeHours: thEntries.length > 0 ? Object.fromEntries(thEntries) : null, slaPauseOnStatuses: editingSlaPauseOnStatuses, slaEscalateAt: editingSlaEscalateAt ? Number(editingSlaEscalateAt) : null });
                            }}
                            data-testid={`button-stage-save-${stage.id}`}
                          >
                            {updateStageMutation.isPending ? "Guardando..." : "Guardar"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingStageId(null)} data-testid={`button-stage-cancel-${stage.id}`}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`h-3 w-3 rounded-full ${STAGE_COLORS[stage.color]?.dotPreview ?? "bg-slate-500"} shrink-0`} />
                        <span className="flex-1 text-sm font-medium truncate">{stage.name}</span>
                        {stage.isFinal && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">Final</span>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">{orderCount > 0 ? `${orderCount} orden(es)` : "vacía"}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => {
                            const s = stage as WorkOrderStageInfo;
                            setEditingStageId(stage.id);
                            setEditingStageName(stage.name);
                            setEditingStageColor(stage.color);
                            setEditingStageIsFinal(stage.isFinal ?? false);
                            setEditingStageStatuses((stage.statuses as string[]) ?? []);
                            setEditingSlaHours(s.slaHours ?? "");
                            setEditingSlaPriorityHours({ critico: String(s.slaPriorityHours?.critico ?? ""), alto: String(s.slaPriorityHours?.alto ?? ""), medio: String(s.slaPriorityHours?.medio ?? ""), bajo: String(s.slaPriorityHours?.bajo ?? "") });
                            setEditingSlaTypeHours(Object.fromEntries(Object.entries(s.slaTypeHours ?? {}).map(([k, v]) => [k, String(v)])));
                            setEditingSlaPauseOnStatuses((s.slaPauseOnStatuses as string[]) ?? []);
                            setEditingSlaEscalateAt(s.slaEscalateAt ?? "");
                          }}
                          data-testid={`button-stage-edit-${stage.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive"
                          disabled={!canDelete || deleteStageMutation.isPending}
                          onClick={() => deleteStageMutation.mutate(stage.id)}
                          title={!canDelete ? (stages.length <= 1 ? "Debe existir al menos una etapa" : `Etapa con ${orderCount} orden(es) activa(s)`) : "Eliminar etapa"}
                          data-testid={`button-stage-delete-${stage.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </SortableStageItem>
                );
              })}
            </SortableContext>
          </DndContext>

          <div className="flex flex-col gap-2 pt-1 rounded-md border p-2 bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground">Nueva etapa</p>
            <div className="flex gap-1.5 flex-wrap">
              {STAGE_COLOR_OPTIONS.map(c => {
                const meta = STAGE_COLORS[c];
                return (
                  <button
                    key={c}
                    type="button"
                    title={STAGE_COLOR_LABELS[c]}
                    className={`h-5 w-5 rounded-full ${meta.dotPreview} ring-offset-1 ${newStageColor === c ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-muted-foreground"}`}
                    onClick={() => setNewStageColor(c)}
                    data-testid={`color-swatch-new-${c}`}
                  />
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground"
                placeholder="Nombre de nueva etapa..."
                value={newStageName}
                onChange={e => setNewStageName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newStageName.trim()) {
                    createStageMutation.mutate({ name: newStageName.trim(), color: newStageColor });
                  }
                }}
                data-testid="input-new-stage-name"
              />
              <Button
                size="sm"
                disabled={!newStageName.trim() || createStageMutation.isPending}
                onClick={() => createStageMutation.mutate({ name: newStageName.trim(), color: newStageColor })}
                data-testid="button-add-stage"
              >
                <Plus className="h-4 w-4 mr-1" />
                {createStageMutation.isPending ? "Creando..." : "Agregar"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-1">
            Las etapas son columnas del tablero Kanban. Edita cada etapa para elegir qué estados del sistema pertenecen a ella. El estado "Cancelada" siempre queda excluido del tablero.
          </p>
        </div>
      </SimpleModal>

      {sharedModals}
    </div>
  );
}
