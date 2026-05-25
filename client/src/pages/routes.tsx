import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDateShort, formatDate, formatTime, getDateKeyInTimezone, getTodayInTimezone } from "@/lib/utils";
import { 
  Route, MapPin, Plus, Search, Edit2, Trash2, Eye, 
  Calendar, Clock, CheckCircle2, XCircle, Play, Truck,
  ChevronUp, ChevronDown, Settings, ArrowRight, Bell, 
  Shield, AlertTriangle, Timer, GripVertical, History,
  Layers, Save, RefreshCw, ChevronRight, Info, LayoutGrid
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DataPagination } from "@/components/DataPagination";

interface RouteData {
  id: string;
  name?: string;
  date: string;
  supplierId: string;
  supervisorId?: string;
  status: string;
  recorridos?: number;
  totalStops: number;
  completedStops: number;
  estimatedDuration?: number;
  actualDuration?: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
  supplierName?: string;
  supervisorName?: string;
  stops?: RouteStop[];
  currentStageId?: string;
  slaStatus?: string;
  currentStageEnteredAt?: string;
  supplier?: { fullName?: string; username: string };
}

interface RouteStage {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isTerminal: boolean;
  slaHours?: string | null;
  slaAlertThresholdPct?: number;
  alertOnSlaWarning?: boolean;
  alertOnSlaExpired?: boolean;
  createdAt?: string;
}

interface RouteStageLogEntry {
  id: string;
  routeId: string;
  stageId: string;
  stageName: string;
  enteredAt: string;
  exitedAt?: string | null;
  slaHours?: string | null;
  changedBy?: string;
  notes?: string;
  changedByUser?: { username: string; fullName?: string | null };
}

interface RouteModuleAlertConfig {
  id?: string;
  tenantId: string;
  globalAlertOnExpiry?: boolean;
  alertRecipientsJson?: string;
  updatedAt?: string;
}

interface RouteActionPermission {
  id: string;
  tenantId: string;
  action: string;
  allowedRoles: string[];
  updatedAt?: string;
}

const AVAILABLE_ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "operacional", label: "Operacional" },
  { value: "abastecedor", label: "Abastecedor" },
];

const ACTION_LABELS: Record<string, string> = {
  iniciar_ruta: "Iniciar Ruta",
  terminar_ruta: "Terminar Ruta",
  editar_ruta: "Editar Ruta",
  avanzar_etapa: "Avanzar Etapa",
  configurar_modulo: "Configurar Módulo",
};

interface RouteStop {
  id: string;
  routeId: string;
  machineId: string;
  order: number;
  status: string;
  estimatedArrival?: string;
  actualArrival?: string;
  actualDeparture?: string;
  durationMinutes?: number;
  notes?: string;
  machineName?: string;
  machineCode?: string;
  machineLocation?: string;
}

interface Machine {
  id: string;
  name: string;
  code?: string;
  status: string;
  locationId?: string;
  locationName?: string;
}

interface User {
  id: string;
  username: string;
  fullName?: string;
  role: string;
  isActive: boolean;
}

function getApiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "";
  const colonIdx = error.message.indexOf(": ");
  if (colonIdx === -1) return error.message;
  try {
    const body = error.message.slice(colonIdx + 2);
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed.error)) {
      return parsed.error
        .map((e: unknown) =>
          typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : ""
        )
        .filter(Boolean)
        .join(", ");
    }
    return typeof parsed.error === "string" ? parsed.error : error.message;
  } catch {
    return error.message;
  }
}

// Schema para CREAR ruta — etapa inicial requerida
const routeCreateSchema = z.object({
  name: z.string().min(1, "El nombre de la ruta es requerido"),
  date: z.string().min(1, "La fecha es requerida"),
  supplierId: z.string().min(1, "Seleccione un abastecedor"),
  supervisorId: z.string().optional(),
  estimatedDuration: z.coerce.number().optional(),
  notes: z.string().optional(),
  startingStageId: z.string().min(1, "La etapa es requerida"),
});
type RouteCreateData = z.infer<typeof routeCreateSchema>;

// Schema para EDITAR ruta — stageId requerida (se pre-rellena con etapa actual o vacío para rutas legacy)
const routeEditSchema = z.object({
  name: z.string().min(1, "El nombre de la ruta es requerido"),
  date: z.string().min(1, "La fecha es requerida"),
  supplierId: z.string().min(1, "Seleccione un abastecedor"),
  notes: z.string().optional(),
  stageId: z.string().min(1, "La etapa es requerida"),
});
type RouteEditData = z.infer<typeof routeEditSchema>;

const stopFormSchema = z.object({
  machineId: z.string().min(1, "Seleccione una máquina"),
  estimatedArrival: z.string().optional(),
  notes: z.string().optional(),
});

type StopFormData = z.infer<typeof stopFormSchema>;

const ITEMS_PER_PAGE = 20;

// ── Componente sortable de etapa para DnD ──
function SortableStageItem({
  stage,
  onEdit,
  onDelete,
}: {
  stage: RouteStage;
  onEdit: (s: RouteStage) => void;
  onDelete: (s: RouteStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
      data-testid={`config-stage-${stage.id}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground flex-shrink-0 focus:outline-none"
        aria-label="Arrastrar para reordenar"
        tabIndex={0}
        data-testid={`drag-handle-stage-${stage.id}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{stage.name}</p>
          {stage.isDefault && <Badge variant="outline" className="text-xs">Inicial</Badge>}
          {stage.isTerminal && <Badge variant="outline" className="text-xs">Terminal</Badge>}
          {stage.slaHours && (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs gap-1">
              <Timer className="h-3 w-3" />
              SLA {stage.slaHours}h
            </Badge>
          )}
          {stage.alertOnSlaExpired && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs gap-1">
              <Bell className="h-3 w-3" />Alerta
            </Badge>
          )}
        </div>
        {stage.slaHours && (
          <p className="text-xs text-muted-foreground">Umbral: {stage.slaAlertThresholdPct ?? 80}%</p>
        )}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(stage)} data-testid={`button-edit-stage-${stage.id}`}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(stage)} data-testid={`button-delete-stage-${stage.id}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ── Helpers Kanban ──────────────────────────────────────────────────────────

function computeSlaBar(route: RouteData, stage: RouteStage | undefined): { pct: number; color: string } | null {
  if (!stage?.slaHours || !route.currentStageEnteredAt) return null;
  const slaHours = parseFloat(stage.slaHours);
  if (!slaHours) return null;
  const elapsed = (Date.now() - new Date(route.currentStageEnteredAt).getTime()) / 3_600_000;
  const threshold = stage.slaAlertThresholdPct ?? 80;
  const pct = Math.min(100, (elapsed / slaHours) * 100);
  const color = pct >= 100 ? "bg-red-500" : pct >= threshold ? "bg-yellow-500" : "bg-green-500";
  return { pct, color };
}

// ── Tarjeta Kanban de ruta ────────────────────────────────────────────────────
function RouteKanbanCard({
  route,
  stage,
  sortedStages,
  canAdvanceStage,
  onViewDetail,
  onAdvance,
  onEdit,
}: {
  route: RouteData;
  stage: RouteStage | undefined;
  sortedStages: RouteStage[];
  canAdvanceStage: boolean;
  onViewDetail: (route: RouteData) => void;
  onAdvance: (routeId: string, stageId: string) => void;
  onEdit?: (route: RouteData) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: route.id,
    disabled: !canAdvanceStage,
  });
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : {};

  const progress = route.totalStops > 0 ? Math.round((route.completedStops / route.totalStops) * 100) : 0;
  const slaBar = computeSlaBar(route, stage);

  const currentIdx = stage ? sortedStages.findIndex(s => s.id === stage.id) : -1;
  const nextStage = currentIdx >= 0 && currentIdx < sortedStages.length - 1 ? sortedStages[currentIdx + 1] : null;
  const advanceTarget = nextStage ?? (sortedStages.length > 0 && !stage ? sortedStages[0] : null);

  const statusColors: Record<string, string> = {
    activa: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    inactiva: "bg-muted text-muted-foreground",
  };
  const statusLabels: Record<string, string> = {
    activa: "Activa",
    inactiva: "Inactiva",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border rounded-md p-3 space-y-2 select-none transition-opacity ${isDragging ? "opacity-40" : ""}`}
      data-testid={`kanban-card-route-${route.id}`}
    >
      {!stage && (
        <div className="flex items-center justify-between gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded px-2 py-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>Sin etapa asignada</span>
          </div>
          {onEdit && (
            <button
              onClick={() => onEdit(route)}
              className="underline font-medium hover:text-amber-800 dark:hover:text-amber-300 focus:outline-none"
              data-testid={`kanban-button-assign-stage-${route.id}`}
            >
              Asignar etapa
            </button>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 text-sm font-medium">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{formatDateShort(new Date(route.date))}</span>
        </div>
        <Badge className={`no-default-hover-elevate no-default-active-elevate text-xs ${statusColors[route.status] ?? ""}`}>
          {statusLabels[route.status] ?? route.status}
        </Badge>
      </div>

      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Truck className="h-3.5 w-3.5" />
        <span className="truncate">{route.supplierName ?? route.supplierId}</span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {route.completedStops}/{route.totalStops} paradas
        </span>
        {route.estimatedDuration ? (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~{route.estimatedDuration} min
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
      </div>

      {slaBar && (
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>SLA</span>
            <span>{Math.round(slaBar.pct)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${slaBar.color}`}
              style={{ width: `${slaBar.pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onViewDetail(route)}
          data-testid={`kanban-button-view-${route.id}`}
          title="Ver detalle"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-1">
          {canAdvanceStage && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground hover:text-foreground focus:outline-none"
              title="Arrastrar a otra etapa"
              data-testid={`kanban-drag-${route.id}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {canAdvanceStage && advanceTarget && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAdvance(route.id, advanceTarget.id)}
              data-testid={`kanban-button-advance-${route.id}`}
              title={`Avanzar a: ${advanceTarget.name}`}
            >
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vista previa de arrastre Kanban ──────────────────────────────────────────
function RouteKanbanCardPreview({ route }: { route: RouteData }) {
  const progress = route.totalStops > 0 ? Math.round((route.completedStops / route.totalStops) * 100) : 0;
  return (
    <div className="bg-card border rounded-md p-3 space-y-2 shadow-lg w-72 opacity-95">
      <div className="flex items-center gap-1 text-sm font-medium">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{formatDateShort(new Date(route.date))}</span>
      </div>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Truck className="h-3.5 w-3.5" />
        <span className="truncate">{route.supplierName ?? route.supplierId}</span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
      </div>
    </div>
  );
}

// ── Columna Kanban ────────────────────────────────────────────────────────────
function RouteKanbanColumn({
  id,
  title,
  color,
  routes,
  stageMap,
  sortedStages,
  canAdvanceStage,
  onViewDetail,
  onAdvance,
  onEdit,
}: {
  id: string;
  title: string;
  color: string;
  routes: RouteData[];
  stageMap: Map<string, RouteStage>;
  sortedStages: RouteStage[];
  canAdvanceStage: boolean;
  onViewDetail: (route: RouteData) => void;
  onAdvance: (routeId: string, stageId: string) => void;
  onEdit?: (route: RouteData) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isNoStage = id === "no-stage";
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 flex-shrink-0 rounded-lg border bg-muted/20 transition-all ${isOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
      data-testid={`kanban-column-${id}`}
    >
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-lg"
        style={{ backgroundColor: color + "25", borderBottom: `2px solid ${color}` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold text-sm">{title}</span>
          {isNoStage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p>Estas rutas no tienen etapa asignada. Arrástralas a una etapa o usa el botón de avanzar para asignarles una.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Badge className="no-default-hover-elevate no-default-active-elevate text-xs">
          {routes.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[200px]">
        {routes.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground italic">
            Sin rutas en esta etapa
          </div>
        ) : (
          routes.map(route => (
            <RouteKanbanCard
              key={route.id}
              route={route}
              stage={stageMap.get(route.currentStageId ?? "")}
              sortedStages={sortedStages}
              canAdvanceStage={canAdvanceStage}
              onViewDetail={onViewDetail}
              onAdvance={onAdvance}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function RoutesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, isAdmin } = usePermissions();
  const [, setLocation] = useLocation();
  
  // Redirigir abastecedores a su página - no tienen acceso a gestión de rutas
  useEffect(() => {
    if (user?.role === "abastecedor") {
      setLocation("/abastecedor?tab=ruta");
    }
  }, [user, setLocation]);
  
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  // Filtros independientes del tablero Kanban
  const [boardSupplierFilter, setBoardSupplierFilter] = useState<string>("all");
  const [boardDateFilter, setBoardDateFilter] = useState<string>("");
  
  const [isNewRouteOpen, setIsNewRouteOpen] = useState(false);
  const [isEditRouteOpen, setIsEditRouteOpen] = useState(false);
  const [isRouteDetailOpen, setIsRouteDetailOpen] = useState(false);
  const [isAddStopOpen, setIsAddStopOpen] = useState(false);
  const [isDeleteRouteOpen, setIsDeleteRouteOpen] = useState(false);
  const [isDeleteStopOpen, setIsDeleteStopOpen] = useState(false);
  const [isCancelRouteOpen, setIsCancelRouteOpen] = useState(false);
  const [isCompleteRouteOpen, setIsCompleteRouteOpen] = useState(false);
  
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<RouteData | null>(null);
  const [stopToDelete, setStopToDelete] = useState<RouteStop | null>(null);
  const [pendingStops, setPendingStops] = useState<{machineId: string, order: number, notes?: string}[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(new Set());
  const [isBulkCancelOpen, setIsBulkCancelOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [deleteNotes, setDeleteNotes] = useState("");
  const [bulkDeleteNotes, setBulkDeleteNotes] = useState("");

  // Estado para etapas y configuración
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<"stages" | "alerts" | "permissions">("stages");
  const [isStageFormOpen, setIsStageFormOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<RouteStage | null>(null);
  const [isDeleteStageOpen, setIsDeleteStageOpen] = useState(false);
  const [stageToDelete, setStageToDelete] = useState<RouteStage | null>(null);
  const [isAdvanceStageOpen, setIsAdvanceStageOpen] = useState(false);
  const [advanceStageNotes, setAdvanceStageNotes] = useState("");
  const [targetStageId, setTargetStageId] = useState("");
  const [isStageLogOpen, setIsStageLogOpen] = useState(false);
  const [quickStageLogRouteId, setQuickStageLogRouteId] = useState<string | null>(null);
  const [quickStageLogRoute, setQuickStageLogRoute] = useState<RouteData | null>(null);
  const [alertConfig, setAlertConfig] = useState<RouteModuleAlertConfig | null>(null);
  const [boardDragRoute, setBoardDragRoute] = useState<RouteData | null>(null);

  // Formulario de etapa
  const stageFormSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    color: z.string().min(1, "El color es requerido"),
    slaHours: z.string().optional(),
    slaAlertThresholdPct: z.coerce.number().min(1).max(100).optional(),
    alertOnSlaWarning: z.boolean().optional(),
    alertOnSlaExpired: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
  });
  type StageFormData = z.infer<typeof stageFormSchema>;

  const stageForm = useForm<StageFormData>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: {
      name: "",
      color: "#6B7280",
      slaHours: "",
      slaAlertThresholdPct: 80,
      alertOnSlaWarning: false,
      alertOnSlaExpired: false,
      isDefault: false,
      isTerminal: false,
    },
  });

  const routeCreateForm = useForm<RouteCreateData>({
    resolver: zodResolver(routeCreateSchema),
    defaultValues: {
      name: "",
      date: getDateKeyInTimezone(getTodayInTimezone()),
      supplierId: "",
      supervisorId: "",
      estimatedDuration: 480,
      notes: "",
      startingStageId: "",
    },
  });

  const routeEditForm = useForm<RouteEditData>({
    resolver: zodResolver(routeEditSchema),
    defaultValues: {
      name: "",
      date: getDateKeyInTimezone(getTodayInTimezone()),
      supplierId: "",
      notes: "",
      stageId: "",
    },
  });

  const stopForm = useForm<StopFormData>({
    resolver: zodResolver(stopFormSchema),
    defaultValues: {
      machineId: "",
      estimatedArrival: "",
      notes: "",
    },
  });

  // Compute server-side filters from UI state
  const serverFilters = useMemo(() => {
    const filters: Record<string, string> = {};

    // Status: tab takes priority, then statusFilter dropdown
    if (activeTab === "active") {
      filters.status = "activa";
    } else if (activeTab === "inactive") {
      filters.status = "inactiva";
    } else if (statusFilter !== "all") {
      filters.status = statusFilter;
    }

    // Date: "today" tab overrides dateFilter
    if (activeTab === "today") {
      filters.date = getDateKeyInTimezone(getTodayInTimezone());
    } else if (dateFilter) {
      filters.date = dateFilter;
    }

    // Optional supplier filter (admin/supervisor only)
    if (supplierFilter !== "all") filters.supplierId = supplierFilter;

    // Search term
    const trimmed = searchTerm.trim();
    if (trimmed) filters.search = trimmed;

    return filters;
  }, [activeTab, statusFilter, dateFilter, supplierFilter, searchTerm]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRouteIds(new Set());
  }, [activeTab, statusFilter, dateFilter, supplierFilter, searchTerm]);

  const { data: routesData, isLoading: routesLoading } = useQuery<{ data: RouteData[], total: number, page: number, pageSize: number }>({
    queryKey: ["/api/supplier/routes", { ...serverFilters, page: currentPage, pageSize: ITEMS_PER_PAGE }],
    enabled: activeTab !== "board",
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const boardQueryParams = useMemo(() => {
    const params: Record<string, string | number> = { page: 1, pageSize: 500 };
    if (boardSupplierFilter !== "all") params.supplierId = boardSupplierFilter;
    if (boardDateFilter) params.date = boardDateFilter;
    return params;
  }, [boardSupplierFilter, boardDateFilter]);

  // Detectar visibilidad de la pestaña para ajustar el intervalo de refresco
  const [isTabVisible, setIsTabVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const handleVisibilityChange = () => setIsTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const { data: boardRoutesData, isLoading: boardLoading } = useQuery<{ data: RouteData[], total: number }>({
    queryKey: ["/api/supplier/routes", boardQueryParams],
    enabled: activeTab === "board",
    staleTime: 30000,
    // Cuando la pestaña está activa y el tablero está visible: refresca cada 10s
    // Cuando la pestaña está oculta: pausa el refresco para no saturar el servidor
    refetchInterval: activeTab === "board" && isTabVisible ? 10000 : false,
  });

  const paginatedRoutes = routesData?.data ?? [];
  const serverTotal = routesData?.total ?? 0;

  const { data: routeStats } = useQuery<{ total: number, today: number, pending: number, active: number, completed: number }>({
    queryKey: ["/api/supplier/routes", "stats"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: routeStops = [], isLoading: stopsLoading } = useQuery<RouteStop[]>({
    queryKey: ["/api/supplier/routes", selectedRoute?.id, "stops"],
    enabled: !!selectedRoute?.id && isRouteDetailOpen,
  });

  const { data: abastecedores = [] } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "abastecedor" }],
  });

  const { data: supervisores = [] } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "supervisor" }],
  });

  const { data: admins = [] } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "admin" }],
  });

  // ── Tick cada 30s para refrescar timers en vivo ──────────────────────────────
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });

  const { data: busyMachines = [] } = useQuery<{ machineId: string; supplierName: string }[]>({
    queryKey: ["/api/supplier/busy-machines"],
    staleTime: 30000,
  });

  const busyMachineIds = new Set(busyMachines.map(bm => bm.machineId));

  // ── Queries de etapas y configuración ──────────────────────────────────────

  const { data: routeStages = [] } = useQuery<RouteStage[]>({
    queryKey: ["/api/supplier/route-stages"],
    staleTime: 60000,
  });

  const { data: stageLog = [], isLoading: stageLogLoading } = useQuery<RouteStageLogEntry[]>({
    queryKey: ["/api/supplier/routes", selectedRoute?.id, "stage-log"],
    enabled: !!selectedRoute?.id && isStageLogOpen,
  });

  const { data: quickStageLog = [], isLoading: quickStageLogLoading } = useQuery<RouteStageLogEntry[]>({
    queryKey: ["/api/supplier/routes", quickStageLogRouteId, "stage-log"],
    enabled: !!quickStageLogRouteId,
  });

  const { data: fetchedAlertConfig } = useQuery<RouteModuleAlertConfig>({
    queryKey: ["/api/supplier/route-config/alerts"],
    enabled: isConfigOpen && configTab === "alerts",
  });

  useEffect(() => {
    if (fetchedAlertConfig) setAlertConfig(fetchedAlertConfig);
  }, [fetchedAlertConfig]);

  const { data: actionPermissions = [] } = useQuery<RouteActionPermission[]>({
    queryKey: ["/api/supplier/route-config/permissions"],
  });

  const stageMap = useMemo(() => new Map(routeStages.map(s => [s.id, s])), [routeStages]);
  const sortedStages = useMemo(() => [...routeStages].sort((a, b) => a.sortOrder - b.sortOrder), [routeStages]);

  // Auto-seleccionar la etapa por defecto cuando se abre el dialog de Nueva Ruta
  useEffect(() => {
    if (isNewRouteOpen && sortedStages.length > 0 && !routeCreateForm.getValues("startingStageId")) {
      const defaultStage = sortedStages.find(s => s.isDefault) ?? sortedStages[0];
      if (defaultStage) routeCreateForm.setValue("startingStageId", defaultStage.id);
    }
  }, [isNewRouteOpen, sortedStages]);
  const boardRoutes = useMemo(() => {
    const all = boardRoutesData?.data ?? [];
    return all.filter(r => r.status === "activa");
  }, [boardRoutesData]);

  const stats = {
    total: routeStats?.total ?? 0,
    today: routeStats?.today ?? 0,
    pending: routeStats?.pending ?? 0,
    active: routeStats?.active ?? 0,
    completed: routeStats?.completed ?? 0,
    todayProgress: 0,
  };

  const createRouteMutation = useMutation({
    mutationFn: async (data: RouteCreateData & { stops: typeof pendingStops }) => {
      const routeData = {
        name: data.name,
        date: new Date(data.date).toISOString(),
        supplierId: data.supplierId,
        supervisorId: data.supervisorId === "none" ? undefined : data.supervisorId || undefined,
        estimatedDuration: data.estimatedDuration,
        notes: data.notes,
        startingStageId: data.startingStageId,
      };
      
      const response = await apiRequest("POST", "/api/supplier/routes", routeData);
      const newRoute = await response.json();
      
      for (const stop of data.stops) {
        await apiRequest("POST", `/api/supplier/routes/${newRoute.id}/stops`, {
          machineId: stop.machineId,
          order: stop.order,
          notes: stop.notes,
          status: "pendiente",
        });
      }
      
      return newRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/busy-machines"] });
      toast({ title: "Ruta creada", description: "La ruta se ha creado correctamente" });
      setIsNewRouteOpen(false);
      routeCreateForm.reset();
      setPendingStops([]);
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al crear ruta", description: detail || "No se pudo crear la ruta", variant: "destructive" });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RouteEditData; prevStageId?: string | null }) => {
      await apiRequest("PATCH", `/api/supplier/routes/${id}`, {
        name: data.name,
        date: data.date ? new Date(data.date).toISOString() : undefined,
        supplierId: data.supplierId,
        notes: data.notes,
        stageId: data.stageId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Ruta actualizada", description: "La ruta se ha actualizado correctamente" });
      setIsEditRouteOpen(false);
      setSelectedRoute(null);
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al actualizar ruta", description: detail || "No se pudo actualizar la ruta", variant: "destructive" });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest("DELETE", `/api/supplier/routes/${id}`, { notes });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/busy-machines"] });
      toast({ title: "Ruta eliminada", description: variables.notes ? `Motivo: ${variables.notes}` : "La ruta se ha eliminado correctamente" });
      setIsDeleteRouteOpen(false);
      setRouteToDelete(null);
      setDeleteNotes("");
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al eliminar ruta", description: detail || "No se pudo eliminar la ruta", variant: "destructive" });
    },
  });

  const addStopMutation = useMutation({
    mutationFn: async ({ routeId, data }: { routeId: string; data: StopFormData & { order: number } }) => {
      return apiRequest("POST", `/api/supplier/routes/${routeId}/stops`, {
        ...data,
        status: "pendiente",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes", selectedRoute?.id, "stops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/busy-machines"] });
      toast({ title: "Parada agregada", description: "La parada se ha agregado a la ruta" });
      setIsAddStopOpen(false);
      stopForm.reset();
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al agregar parada", description: detail || "No se pudo agregar la parada", variant: "destructive" });
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      return apiRequest("DELETE", `/api/supplier/stops/${stopId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes", selectedRoute?.id, "stops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/busy-machines"] });
      toast({ title: "Parada eliminada", description: "La parada se ha eliminado de la ruta" });
      setIsDeleteStopOpen(false);
      setStopToDelete(null);
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al eliminar parada", description: detail || "No se pudo eliminar la parada", variant: "destructive" });
    },
  });

  const cancelRouteMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId?: string | null }) => {
      return apiRequest("PATCH", `/api/supplier/routes/${id}`, {
        status: "inactiva",
        stageId: stageId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/busy-machines"] });
      toast({ title: "Ruta desactivada", description: "La ruta ha sido desactivada" });
      setIsCancelRouteOpen(false);
      setSelectedRoute(null);
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al desactivar ruta", description: detail || "No se pudo desactivar la ruta", variant: "destructive" });
    },
  });

  const completeRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/supplier/routes/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/busy-machines"] });
      toast({ title: "Ruta finalizada", description: "La ruta ha sido marcada como inactiva y el recorrido contabilizado" });
      setIsCompleteRouteOpen(false);
      setSelectedRoute(null);
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al finalizar ruta", description: detail || "No se pudo finalizar la ruta", variant: "destructive" });
    },
  });

  const startRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/supplier/routes/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      toast({ title: "Ruta activada", description: "La ruta está ahora activa" });
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al activar ruta", description: detail || "No se pudo activar la ruta", variant: "destructive" });
    },
  });

  const reorderStopMutation = useMutation({
    mutationFn: async ({ stopId, newOrder }: { stopId: string; newOrder: number }) => {
      return apiRequest("PATCH", `/api/supplier/stops/${stopId}`, { order: newOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes", selectedRoute?.id, "stops"] });
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al reordenar parada", description: detail || "No se pudo reordenar", variant: "destructive" });
    },
  });

  // ── Mutations de etapas ─────────────────────────────────────────────────────

  const createStageMutation = useMutation({
    mutationFn: async (data: StageFormData) => {
      const payload = { ...data, slaHours: data.slaHours === "" ? undefined : data.slaHours };
      const res = await apiRequest("POST", "/api/supplier/route-stages", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/route-stages"] });
      toast({ title: "Etapa creada", description: "La etapa se ha creado correctamente" });
      setIsStageFormOpen(false);
      stageForm.reset();
    },
    onError: (error) => {
      toast({ title: "Error al crear etapa", description: getApiErrorMessage(error), variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<StageFormData> }) => {
      const payload = { ...data, slaHours: data.slaHours === "" ? undefined : data.slaHours };
      const res = await apiRequest("PATCH", `/api/supplier/route-stages/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/route-stages"] });
      toast({ title: "Etapa actualizada" });
      setIsStageFormOpen(false);
      setEditingStage(null);
    },
    onError: (error) => {
      toast({ title: "Error al actualizar etapa", description: getApiErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/supplier/route-stages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/route-stages"] });
      toast({ title: "Etapa eliminada" });
      setIsDeleteStageOpen(false);
      setStageToDelete(null);
    },
    onError: (error) => {
      toast({ title: "Error al eliminar etapa", description: getApiErrorMessage(error), variant: "destructive" });
    },
  });

  const reorderStagesMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiRequest("POST", "/api/supplier/route-stages/reorder", { ids: orderedIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/route-stages"] });
    },
    onError: (error) => {
      toast({ title: "Error al reordenar etapas", description: getApiErrorMessage(error), variant: "destructive" });
    },
  });

  // ── Sensores DnD para reordenar etapas ──
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleStageDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sorted = [...routeStages].sort((a, b) => a.sortOrder - b.sortOrder);
    const oldIndex = sorted.findIndex(s => s.id === active.id);
    const newIndex = sorted.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reorderStagesMutation.mutate(reordered.map(s => s.id));
  }, [routeStages, reorderStagesMutation]);

  // ── Permisos de acción de ruta basados en configuración DB ──
  const userRole = user?.role ?? "";
  const canStartRoute   = actionPermissions.find(p => p.action === "iniciar_ruta")?.allowedRoles.includes(userRole) ?? isAdmin;
  const canCompleteRoute = actionPermissions.find(p => p.action === "terminar_ruta")?.allowedRoles.includes(userRole) ?? isAdmin;
  const canEditRoute    = actionPermissions.find(p => p.action === "editar_ruta")?.allowedRoles.includes(userRole) ?? isAdmin;
  // Cancelar usa el mismo permiso que editar (spec: Cancelar → editar_ruta)
  const canCancelRoute  = actionPermissions.find(p => p.action === "editar_ruta")?.allowedRoles.includes(userRole) ?? isAdmin;
  const canAdvanceStage = actionPermissions.find(p => p.action === "avanzar_etapa")?.allowedRoles.includes(userRole) ?? isAdmin;
  const canConfigModule = actionPermissions.find(p => p.action === "configurar_modulo")?.allowedRoles.includes(userRole) ?? isAdmin;
  // Eliminar rutas es exclusivo del rol admin (spec: "siempre admin")
  const canDeleteRoute  = isAdmin;

  const initDefaultStagesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/supplier/route-stages/init-defaults", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/route-stages"] });
      toast({ title: "Etapas inicializadas", description: "Se crearon las etapas por defecto" });
    },
    onError: (error) => {
      toast({ title: "Error", description: getApiErrorMessage(error), variant: "destructive" });
    },
  });

  const advanceStageMutation = useMutation({
    mutationFn: async ({ routeId, newStageId, notes }: { routeId: string; newStageId: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/supplier/routes/${routeId}/advance-stage`, { newStageId, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes", selectedRoute?.id, "stage-log"] });
      toast({ title: "Etapa avanzada", description: "La ruta ha avanzado a la siguiente etapa" });
      setIsAdvanceStageOpen(false);
      setAdvanceStageNotes("");
      setTargetStageId("");
    },
    onError: (error) => {
      toast({ title: "Error al avanzar etapa", description: getApiErrorMessage(error), variant: "destructive" });
    },
  });

  // ── Sensores y handlers del tablero Kanban ──────────────────────────────────
  const boardSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleBoardDragStart = useCallback((event: DragStartEvent) => {
    const route = boardRoutes.find(r => r.id === event.active.id);
    setBoardDragRoute(route ?? null);
  }, [boardRoutes]);

  const handleBoardDragEnd = useCallback((event: DragEndEvent) => {
    setBoardDragRoute(null);
    const { active, over } = event;
    if (!over) return;
    const routeId = active.id as string;
    const targetColumnId = over.id as string;
    const route = boardRoutes.find(r => r.id === routeId);
    if (!route) return;
    const currentColId = route.currentStageId ?? "no-stage";
    if (targetColumnId === currentColId) return;
    if (targetColumnId === "no-stage") return;
    advanceStageMutation.mutate({ routeId, newStageId: targetColumnId });
  }, [boardRoutes, advanceStageMutation]);

  const handleBoardAdvance = useCallback((routeId: string, stageId: string) => {
    advanceStageMutation.mutate({ routeId, newStageId: stageId });
  }, [advanceStageMutation]);

  const updateAlertConfigMutation = useMutation({
    mutationFn: async (data: Partial<RouteModuleAlertConfig>) => {
      const res = await apiRequest("PUT", "/api/supplier/route-config/alerts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/route-config/alerts"] });
      toast({ title: "Configuración de alertas guardada" });
    },
    onError: (error) => {
      toast({ title: "Error al guardar configuración", description: getApiErrorMessage(error), variant: "destructive" });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ action, allowedRoles }: { action: string; allowedRoles: string[] }) => {
      const res = await apiRequest("PUT", "/api/supplier/route-config/permissions", { action, allowedRoles });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/route-config/permissions"] });
      toast({ title: "Permiso actualizado" });
    },
    onError: (error) => {
      toast({ title: "Error al guardar permiso", description: getApiErrorMessage(error), variant: "destructive" });
    },
  });

  const bulkCancelMutation = useMutation({
    mutationFn: async (routes: { id: string; stageId?: string | null }[]) => {
      for (const r of routes) {
        await apiRequest("PATCH", `/api/supplier/routes/${r.id}`, {
          status: "inactiva",
          stageId: r.stageId || undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/busy-machines"] });
      toast({ title: "Rutas desactivadas", description: `${selectedRouteIds.size} ruta(s) desactivada(s)` });
      setSelectedRouteIds(new Set());
      setIsBulkCancelOpen(false);
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al desactivar rutas", description: detail || "No se pudieron desactivar algunas rutas", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      for (const id of ids) {
        await apiRequest("DELETE", `/api/supplier/routes/${id}`, { notes });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/routes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/busy-machines"] });
      const desc = variables.notes ? `${variables.ids.length} ruta(s) eliminada(s). Motivo: ${variables.notes}` : `${variables.ids.length} ruta(s) eliminada(s)`;
      toast({ title: "Rutas eliminadas", description: desc });
      setSelectedRouteIds(new Set());
      setIsBulkDeleteOpen(false);
      setBulkDeleteNotes("");
    },
    onError: (error) => {
      const detail = getApiErrorMessage(error);
      toast({ title: "Error al eliminar rutas", description: detail || "No se pudieron eliminar algunas rutas", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "activa":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Activa</Badge>;
      case "inactiva":
        return <Badge className="bg-muted text-muted-foreground">Inactiva</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSlaStatusBadge = (slaStatus?: string) => {
    if (!slaStatus || slaStatus === "sin_sla") return null;
    switch (slaStatus) {
      case "dentro_tiempo":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            En tiempo
          </Badge>
        );
      case "proximo_vencer":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 gap-1">
            <Timer className="h-3 w-3" />
            Por vencer
          </Badge>
        );
      case "vencido":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Vencido
          </Badge>
        );
      case "finalizada_a_tiempo":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            A tiempo
          </Badge>
        );
      case "finalizada_fuera_de_tiempo":
        return (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Fuera de tiempo
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStageBadge = (stageId?: string) => {
    if (!stageId) return null;
    const stage = stageMap.get(stageId);
    if (!stage) return null;
    return (
      <Badge
        style={{ backgroundColor: stage.color + "20", color: stage.color, borderColor: stage.color + "40" }}
        className="border text-xs"
      >
        {stage.name}
      </Badge>
    );
  };

  const computeSlaElapsed = (enteredAt?: string) => {
    if (!enteredAt) return "";
    const ms = Date.now() - new Date(enteredAt).getTime();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleOpenStageForm = (stage?: RouteStage) => {
    if (stage) {
      setEditingStage(stage);
      stageForm.reset({
        name: stage.name,
        color: stage.color,
        slaHours: stage.slaHours ?? "",
        slaAlertThresholdPct: stage.slaAlertThresholdPct ?? 80,
        alertOnSlaWarning: stage.alertOnSlaWarning ?? false,
        alertOnSlaExpired: stage.alertOnSlaExpired ?? false,
        isDefault: stage.isDefault ?? false,
        isTerminal: stage.isTerminal ?? false,
      });
    } else {
      setEditingStage(null);
      stageForm.reset();
    }
    setIsStageFormOpen(true);
  };

  const handleSubmitStageForm = (data: StageFormData) => {
    if (editingStage) {
      updateStageMutation.mutate({ id: editingStage.id, data });
    } else {
      createStageMutation.mutate(data);
    }
  };

  const togglePermissionRole = (perm: RouteActionPermission, role: string) => {
    const current = perm.allowedRoles ?? [];
    const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
    updatePermissionMutation.mutate({ action: perm.action, allowedRoles: next });
  };

  const handleCreateRoute = (data: RouteCreateData) => {
    if (pendingStops.length === 0) {
      toast({ 
        title: "Sin paradas", 
        description: "Agregue al menos una parada a la ruta", 
        variant: "destructive" 
      });
      return;
    }
    createRouteMutation.mutate({ ...data, stops: pendingStops });
  };

  const handleEditRoute = (route: RouteData) => {
    setSelectedRoute(route);
    routeEditForm.reset({
      name: route.name || "",
      date: getDateKeyInTimezone(route.date),
      supplierId: route.supplierId,
      notes: route.notes || "",
      stageId: route.currentStageId || "",
    });
    setIsEditRouteOpen(true);
  };

  const handleAddPendingStop = (machineId: string, notes?: string) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;
    
    const alreadyAdded = pendingStops.some(s => s.machineId === machineId);
    if (alreadyAdded) {
      toast({ title: "Ya agregada", description: "Esta máquina ya está en la ruta", variant: "destructive" });
      return;
    }
    
    setPendingStops(prev => [
      ...prev,
      { machineId, order: prev.length + 1, notes }
    ]);
    stopForm.reset();
  };

  const handleRemovePendingStop = (machineId: string) => {
    setPendingStops(prev => {
      const filtered = prev.filter(s => s.machineId !== machineId);
      return filtered.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const handleViewDetail = (route: RouteData) => {
    setSelectedRoute(route);
    setIsRouteDetailOpen(true);
  };

  const handleAddStop = (data: StopFormData) => {
    if (!selectedRoute) return;
    const order = (routeStops?.length || 0) + 1;
    addStopMutation.mutate({ routeId: selectedRoute.id, data: { ...data, order } });
  };

  const handleMoveStop = (stop: RouteStop, direction: "up" | "down") => {
    const sorted = [...routeStops].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === stop.id);
    if (direction === "up" && idx <= 0) return;
    if (direction === "down" && idx >= sorted.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const swapStop = sorted[swapIdx];
    reorderStopMutation.mutate({ stopId: stop.id, newOrder: swapStop.order });
    reorderStopMutation.mutate({ stopId: swapStop.id, newOrder: stop.order });
  };

  const toggleRouteSelection = (id: string) => {
    setSelectedRouteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedRouteIds(new Set(paginatedRoutes.map(r => r.id)));
    } else {
      setSelectedRouteIds(new Set());
    }
  };

  const bulkDeletableIds = Array.from(selectedRouteIds).filter(id => {
    const s = paginatedRoutes.find(r => r.id === id)?.status;
    return s === "inactiva";
  });
  const bulkCancellableRoutes = Array.from(selectedRouteIds).flatMap(id => {
    const route = paginatedRoutes.find(r => r.id === id);
    if (!route || route.status !== "activa") return [];
    return [{ id: route.id, stageId: route.currentStageId }];
  });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-4" data-testid="routes-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Gestión de Rutas</h1>
          <p className="text-muted-foreground">Planifica y administra las rutas de abastecimiento</p>
        </div>
        <div className="flex gap-2">
          {canConfigModule && (
            <Button
              variant="outline"
              onClick={() => { setIsConfigOpen(true); setConfigTab("stages"); }}
              className="gap-2"
              data-testid="button-route-config"
            >
              <Settings className="h-4 w-4" />
              Configuración
            </Button>
          )}
          {canCreate("routes") && (
            <Button onClick={() => setIsNewRouteOpen(true)} className="gap-2" data-testid="button-new-route">
              <Plus className="h-4 w-4" />
              Nueva Ruta
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card data-testid="stat-total-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rutas</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-today-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rutas Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <Progress value={stats.todayProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card data-testid="stat-pending-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <Play className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-completed-routes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recorridos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar rutas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-routes"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-40"
            data-testid="input-filter-date"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="activa">Activa</SelectItem>
              <SelectItem value="inactiva">Inactiva</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-supplier">
              <SelectValue placeholder="Abastecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {abastecedores.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName || user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">Todas</TabsTrigger>
          <TabsTrigger value="today" data-testid="tab-today">Hoy</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">Activas</TabsTrigger>
          <TabsTrigger value="inactive" data-testid="tab-inactive">Inactivas</TabsTrigger>
          <TabsTrigger value="board" className="gap-1.5" data-testid="tab-board">
            <LayoutGrid className="h-3.5 w-3.5" />
            Tablero
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {/* Barra de filtros independiente del tablero Kanban */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Select
              value={boardSupplierFilter}
              onValueChange={setBoardSupplierFilter}
            >
              <SelectTrigger className="w-[200px]" data-testid="select-board-filter-supplier">
                <SelectValue placeholder="Abastecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los abastecedores</SelectItem>
                {abastecedores.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={boardDateFilter}
              onChange={(e) => setBoardDateFilter(e.target.value)}
              className="w-40"
              data-testid="input-board-filter-date"
            />
            {(boardSupplierFilter !== "all" || boardDateFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setBoardSupplierFilter("all"); setBoardDateFilter(""); }}
                data-testid="button-board-clear-filters"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          {routeStages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay etapas configuradas</h3>
                <p className="text-muted-foreground mb-4">
                  Configura las etapas del flujo de rutas para usar el tablero Kanban
                </p>
                {canConfigModule && (
                  <Button
                    variant="outline"
                    onClick={() => { setIsConfigOpen(true); setConfigTab("stages"); }}
                    className="gap-2"
                    data-testid="button-board-go-config"
                  >
                    <Settings className="h-4 w-4" />
                    Ir a Configuración
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : boardLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-72 flex-shrink-0 rounded-lg border bg-muted/20">
                  <Skeleton className="h-10 w-full rounded-t-lg" />
                  <div className="p-2 space-y-2">
                    {[...Array(3)].map((_, j) => (
                      <Skeleton key={j} className="h-32 w-full rounded-md" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DndContext
              sensors={boardSensors}
              onDragStart={handleBoardDragStart}
              onDragEnd={handleBoardDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]" data-testid="kanban-board">
                {boardRoutes.some(r => !r.currentStageId) && (
                  <RouteKanbanColumn
                    id="no-stage"
                    title="Sin etapa"
                    color="#6B7280"
                    routes={boardRoutes.filter(r => !r.currentStageId)}
                    stageMap={stageMap}
                    sortedStages={sortedStages}
                    canAdvanceStage={canAdvanceStage}
                    onViewDetail={handleViewDetail}
                    onAdvance={handleBoardAdvance}
                    onEdit={handleEditRoute}
                  />
                )}
                {sortedStages.map(stage => (
                  <RouteKanbanColumn
                    key={stage.id}
                    id={stage.id}
                    title={stage.name}
                    color={stage.color}
                    routes={boardRoutes.filter(r => r.currentStageId === stage.id)}
                    stageMap={stageMap}
                    sortedStages={sortedStages}
                    canAdvanceStage={canAdvanceStage}
                    onViewDetail={handleViewDetail}
                    onAdvance={handleBoardAdvance}
                    onEdit={handleEditRoute}
                  />
                ))}
              </div>
              <DragOverlay>
                {boardDragRoute && <RouteKanbanCardPreview route={boardDragRoute} />}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>

        {activeTab !== "board" && (
        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Rutas ({serverTotal})</CardTitle>
              <CardDescription>
                {activeTab === "today" && "Rutas programadas para hoy"}
                {activeTab === "active" && "Rutas actualmente activas"}
                {activeTab === "inactive" && "Rutas inactivas"}
                {activeTab === "all" && "Todas las rutas del sistema"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {routesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : paginatedRoutes.length === 0 ? (
                <div className="text-center py-12">
                  <Route className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Sin rutas</h3>
                  <p className="text-muted-foreground mb-4">
                    {activeTab === "today" 
                      ? "No hay rutas programadas para hoy" 
                      : "No se encontraron rutas con los filtros seleccionados"}
                  </p>
                  <Button onClick={() => setIsNewRouteOpen(true)} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Crear Primera Ruta
                  </Button>
                </div>
              ) : (
                <>
                  {selectedRouteIds.size > 0 && (
                    <div className="flex items-center gap-3 mb-3 p-3 rounded-md bg-muted border">
                      <span className="text-sm font-medium">{selectedRouteIds.size} ruta(s) seleccionada(s)</span>
                      <div className="flex gap-2 ml-auto">
                        {bulkCancellableRoutes.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsBulkCancelOpen(true)}
                            className="gap-1 text-orange-600"
                            data-testid="button-bulk-cancel"
                          >
                            <XCircle className="h-4 w-4" />
                            Cancelar ({bulkCancellableRoutes.length})
                          </Button>
                        )}
                        {bulkDeletableIds.length > 0 && canDeleteRoute && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsBulkDeleteOpen(true)}
                            className="gap-1 text-destructive"
                            data-testid="button-bulk-delete"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar ({bulkDeletableIds.length})
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRouteIds(new Set())}
                          data-testid="button-clear-selection"
                        >
                          Limpiar
                        </Button>
                      </div>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={paginatedRoutes.length > 0 && paginatedRoutes.every(r => selectedRouteIds.has(r.id))}
                            onCheckedChange={(v) => toggleAllVisible(!!v)}
                            aria-label="Seleccionar todas"
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Abastecedor</TableHead>
                        <TableHead>Paradas</TableHead>
                        <TableHead>Progreso</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-center">Recorridos</TableHead>
                        {routeStages.length > 0 && <TableHead>Etapa</TableHead>}
                        <TableHead>Duración</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRoutes.map((route) => {
                        const supplier = abastecedores.find(u => u.id === route.supplierId);
                        const progress = route.totalStops > 0 
                          ? Math.round((route.completedStops / route.totalStops) * 100)
                          : 0;
                        
                        return (
                          <TableRow key={route.id} data-testid={`row-route-${route.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRouteIds.has(route.id)}
                                onCheckedChange={() => toggleRouteSelection(route.id)}
                                aria-label={`Seleccionar ruta ${route.id}`}
                                data-testid={`checkbox-route-${route.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-sm">{route.name || <span className="text-muted-foreground italic">Sin nombre</span>}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{formatDateShort(new Date(route.date))}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span>{supplier?.fullName || route.supplierName || route.supplierId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>{route.completedStops}/{route.totalStops}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <Progress value={progress} className="h-2 flex-1" />
                                <span className="text-sm text-muted-foreground w-10">{progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(route.status)}</TableCell>
                            <TableCell className="text-center">
                              <span className="font-medium">{route.recorridos ?? 0}</span>
                            </TableCell>
                            {routeStages.length > 0 && (
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {route.status === "activa" ? (
                                    <>
                                      {getStageBadge(route.currentStageId)}
                                      {getSlaStatusBadge(route.slaStatus)}
                                      {route.currentStageEnteredAt && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {computeSlaElapsed(route.currentStageEnteredAt)}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              {route.actualDuration ? (
                                <span>{route.actualDuration} min</span>
                              ) : route.estimatedDuration ? (
                                <span className="text-muted-foreground">~{route.estimatedDuration} min</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDetail(route)}
                                  data-testid={`button-view-route-${route.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {routeStages.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setQuickStageLogRouteId(route.id);
                                      setQuickStageLogRoute(route);
                                    }}
                                    data-testid={`button-stage-history-${route.id}`}
                                    title="Ver historial de etapas"
                                  >
                                    <History className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
                                {route.status === "inactiva" && (
                                  <>
                                    {canStartRoute && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => startRouteMutation.mutate(route.id)}
                                        disabled={startRouteMutation.isPending}
                                        data-testid={`button-start-route-${route.id}`}
                                        title="Activar ruta"
                                      >
                                        <Play className="h-4 w-4 text-green-500" />
                                      </Button>
                                    )}
                                    {canEditRoute && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditRoute(route)}
                                        data-testid={`button-edit-route-${route.id}`}
                                        title="Editar ruta"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                {route.status === "activa" && (
                                  <>
                                    {canCompleteRoute && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setSelectedRoute(route);
                                          setIsCompleteRouteOpen(true);
                                        }}
                                        data-testid={`button-complete-route-${route.id}`}
                                        title="Finalizar ruta"
                                      >
                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                      </Button>
                                    )}
                                    {canCancelRoute && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setSelectedRoute(route);
                                          setIsCancelRouteOpen(true);
                                        }}
                                        data-testid={`button-cancel-active-route-${route.id}`}
                                        title="Desactivar ruta"
                                      >
                                        <XCircle className="h-4 w-4 text-orange-500" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                {route.status !== "activa" && canDeleteRoute && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setRouteToDelete(route);
                                      setDeleteNotes("");
                                      setIsDeleteRouteOpen(true);
                                    }}
                                    data-testid={`button-delete-route-${route.id}`}
                                    title="Eliminar ruta"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  {serverTotal > ITEMS_PER_PAGE && (
                    <div className="mt-4">
                      <DataPagination
                        currentPage={currentPage}
                        totalItems={serverTotal}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>

      <Dialog open={isNewRouteOpen} onOpenChange={setIsNewRouteOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Ruta</DialogTitle>
            <DialogDescription>
              Crea una nueva ruta de abastecimiento asignando fecha, abastecedor y paradas
            </DialogDescription>
          </DialogHeader>
          
          <Form {...routeCreateForm}>
            <form onSubmit={routeCreateForm.handleSubmit(handleCreateRoute)} className="space-y-6">
              <FormField
                control={routeCreateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la ruta</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: Ruta Norte – Lunes" data-testid="input-route-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={routeCreateForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-route-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={routeCreateForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abastecedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-route-supplier">
                            <SelectValue placeholder="Seleccionar abastecedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {abastecedores.filter(u => u.isActive).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={routeCreateForm.control}
                  name="supervisorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supervisor (opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-route-supervisor">
                            <SelectValue placeholder="Seleccionar supervisor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {supervisores.filter(u => u.isActive).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={routeCreateForm.control}
                  name="estimatedDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duración estimada (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-route-duration" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={routeCreateForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Instrucciones especiales..." data-testid="input-route-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {sortedStages.length === 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-md border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    No hay etapas configuradas. Ve a{" "}
                    <strong>Configuración → Etapas de Ruta</strong> para
                    crear una antes de registrar rutas.
                  </span>
                </div>
              )}

              <Separator />
              
              <div>
                <h4 className="font-medium mb-4">Paradas de la Ruta ({pendingStops.length})</h4>
                
                <div className="flex gap-2 mb-4">
                  <Select onValueChange={(v) => handleAddPendingStop(v)}>
                    <SelectTrigger className="flex-1" data-testid="select-add-stop">
                      <SelectValue placeholder="Agregar máquina a la ruta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {machines
                        .filter(m => m.status !== "fuera_servicio")
                        .filter(m => !pendingStops.some(s => s.machineId === m.id))
                        .filter(m => !busyMachineIds.has(m.id))
                        .map((machine) => (
                          <SelectItem key={machine.id} value={machine.id}>
                            {machine.name}{machine.code ? ` (${machine.code})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {pendingStops.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {pendingStops.map((stop, index) => {
                      const machine = machines.find(m => m.id === stop.machineId);
                      return (
                        <div key={stop.machineId} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium">{machine?.name || stop.machineId}</p>
                              <p className="text-sm text-muted-foreground">{machine?.code}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePendingStop(stop.machineId)}
                            data-testid={`button-remove-stop-${stop.machineId}`}
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-lg border-dashed">
                    <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Agrega máquinas para crear las paradas de la ruta</p>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsNewRouteOpen(false);
                  setPendingStops([]);
                  routeCreateForm.reset();
                }}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createRouteMutation.isPending || pendingStops.length === 0 || sortedStages.length === 0}
                  data-testid="button-save-route"
                >
                  {createRouteMutation.isPending ? "Guardando..." : "Crear Ruta"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditRouteOpen} onOpenChange={setIsEditRouteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ruta</DialogTitle>
            <DialogDescription>
              Modifica los datos de la ruta
            </DialogDescription>
          </DialogHeader>
          
          <Form {...routeEditForm}>
            <form onSubmit={routeEditForm.handleSubmit((data) => {
              if (!selectedRoute) return;
              updateRouteMutation.mutate({
                id: selectedRoute.id,
                data,
                prevStageId: selectedRoute.currentStageId,
              });
            })} className="space-y-4">
              <FormField
                control={routeEditForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la ruta</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: Ruta Norte – Lunes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={routeEditForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={routeEditForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abastecedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {abastecedores.filter(u => u.isActive).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName || user.username}
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
                control={routeEditForm.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Etapa{!selectedRoute?.currentStageId && <span className="text-destructive"> *</span>}
                    </FormLabel>
                    {sortedStages.length === 0 ? (
                      <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-md border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>No hay etapas configuradas. Ve a <strong>Configuración → Etapas de Ruta</strong>.</span>
                      </div>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-route-stage">
                            <SelectValue placeholder="Seleccionar etapa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sortedStages.map(stage => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: stage.color ?? "#6B7280" }}
                                />
                                <span>{stage.name}</span>
                                {stage.isDefault && (
                                  <span className="text-xs text-muted-foreground">(por defecto)</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={routeEditForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditRouteOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateRouteMutation.isPending}>
                  {updateRouteMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isRouteDetailOpen} onOpenChange={setIsRouteDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              {selectedRoute?.name || "Detalle de Ruta"}
            </DialogTitle>
            <DialogDescription>
              {selectedRoute && formatDate(new Date(selectedRoute.date))}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRoute && (
            <div className="space-y-6">
              {selectedRoute.status === "inactiva" && canStartRoute && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => { startRouteMutation.mutate(selectedRoute.id); setIsRouteDetailOpen(false); }}
                    disabled={startRouteMutation.isPending}
                    data-testid="button-activate-route-viewer"
                  >
                    <Play className="h-4 w-4" />
                    Activar Ruta
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Abastecedor</p>
                  <p className="font-medium">
                    {abastecedores.find(u => u.id === selectedRoute.supplierId)?.fullName || selectedRoute.supplierId}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Estado</p>
                  {getStatusBadge(selectedRoute.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Progreso</p>
                  <p className="font-medium">{selectedRoute.completedStops}/{selectedRoute.totalStops} paradas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Duración</p>
                  <p className="font-medium">
                    {selectedRoute.actualDuration 
                      ? `${selectedRoute.actualDuration} min`
                      : `~${selectedRoute.estimatedDuration || 0} min (estimado)`}
                  </p>
                </div>
              </div>

              {/* Sección de etapa actual + SLA */}
              {routeStages.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Etapa Actual
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setIsStageLogOpen(true)}
                          data-testid="button-view-stage-log"
                        >
                          <History className="h-4 w-4" />
                          Historial
                        </Button>
                        {canAdvanceStage && selectedRoute.status !== "inactiva" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => { setIsAdvanceStageOpen(true); setTargetStageId(""); setAdvanceStageNotes(""); }}
                            data-testid="button-advance-stage"
                          >
                            <ArrowRight className="h-4 w-4" />
                            Avanzar Etapa
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      {selectedRoute.currentStageId ? (
                        <>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: stageMap.get(selectedRoute.currentStageId)?.color ?? "#6B7280" }}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{stageMap.get(selectedRoute.currentStageId)?.name ?? "—"}</p>
                              {selectedRoute.currentStageEnteredAt && (
                                <p className="text-xs text-muted-foreground">
                                  Desde: {formatDate(new Date(selectedRoute.currentStageEnteredAt))}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {getSlaStatusBadge(selectedRoute.slaStatus)}
                            </div>
                          </div>
                          {/* ── SLA progress bar en vivo ── */}
                          {(() => {
                            const stage = stageMap.get(selectedRoute.currentStageId);
                            const enteredAt = selectedRoute.currentStageEnteredAt;
                            if (!stage?.slaHours || !enteredAt) return null;
                            void tick; // fuerza re-render cada 30s
                            const slaMs = Number(stage.slaHours) * 3_600_000;
                            const elapsedMs = Date.now() - new Date(enteredAt).getTime();
                            const pct = Math.min(100, Math.round((elapsedMs / slaMs) * 100));
                            const elapsedH = Math.floor(elapsedMs / 3_600_000);
                            const elapsedM = Math.floor((elapsedMs % 3_600_000) / 60_000);
                            const elapsedLabel = elapsedH > 0 ? `${elapsedH}h ${elapsedM}m` : `${elapsedM}m`;
                            const slaLabel = `${Number(stage.slaHours)}h`;
                            const barColor = pct >= 100 ? "bg-destructive" : pct >= (stage.slaAlertThresholdPct ?? 80) ? "bg-amber-500" : "bg-emerald-500";
                            return (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {elapsedLabel} transcurridos</span>
                                  <span>SLA: {slaLabel} ({pct}%)</span>
                                </div>
                                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin etapa asignada</p>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              <Separator />
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Paradas ({routeStops.length})</h4>
                  {selectedRoute.status === "inactiva" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1"
                      onClick={() => setIsAddStopOpen(true)}
                      data-testid="button-add-stop"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                  )}
                </div>
                
                {stopsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : routeStops.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Sin paradas registradas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...routeStops].sort((a, b) => a.order - b.order).map((stop, idx, sortedArr) => {
                      const machine = machines.find(m => m.id === stop.machineId);
                      return (
                        <div 
                          key={stop.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            stop.status === "completada" ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" :
                            stop.status === "en_progreso" ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" :
                            "bg-muted/50"
                          }`}
                          data-testid={`stop-${stop.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {selectedRoute.status === "inactiva" && (
                              <div className="flex flex-col gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  disabled={idx === 0 || reorderStopMutation.isPending}
                                  onClick={() => handleMoveStop(stop, "up")}
                                  data-testid={`button-stop-up-${stop.id}`}
                                  title="Mover arriba"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  disabled={idx === sortedArr.length - 1 || reorderStopMutation.isPending}
                                  onClick={() => handleMoveStop(stop, "down")}
                                  data-testid={`button-stop-down-${stop.id}`}
                                  title="Mover abajo"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
                              stop.status === "completada" ? "bg-green-500 text-white" :
                              stop.status === "en_progreso" ? "bg-blue-500 text-white" :
                              "bg-muted-foreground/20 text-muted-foreground"
                            }`}>
                              {stop.order}
                            </span>
                            <div>
                              <p className="font-medium">{machine?.name || stop.machineId}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{machine?.code}</span>
                                {stop.actualArrival && (
                                  <span>• Llegada: {formatTime(new Date(stop.actualArrival))}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(stop.status)}
                            {selectedRoute.status === "inactiva" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setStopToDelete(stop);
                                  setIsDeleteStopOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStopOpen} onOpenChange={setIsAddStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Parada</DialogTitle>
            <DialogDescription>
              Selecciona una máquina para agregar a la ruta
            </DialogDescription>
          </DialogHeader>
          
          <Form {...stopForm}>
            <form onSubmit={stopForm.handleSubmit(handleAddStop)} className="space-y-4">
              <FormField
                control={stopForm.control}
                name="machineId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máquina</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar máquina" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {machines
                          .filter(m => m.status !== "fuera_servicio")
                          .filter(m => !routeStops.some(s => s.machineId === m.id))
                          .filter(m => !busyMachineIds.has(m.id))
                          .map((machine) => (
                            <SelectItem key={machine.id} value={machine.id}>
                              {machine.name}{machine.code ? ` (${machine.code})` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={stopForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Instrucciones especiales..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddStopOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={addStopMutation.isPending}>
                  {addStopMutation.isPending ? "Agregando..." : "Agregar Parada"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteRouteOpen} onOpenChange={(open) => { setIsDeleteRouteOpen(open); if (!open) setDeleteNotes(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la ruta y todas sus paradas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo de eliminación (opcional)</label>
            <Textarea
              placeholder="Escribe el motivo de la eliminación..."
              value={deleteNotes}
              onChange={(e) => setDeleteNotes(e.target.value)}
              data-testid="input-delete-route-notes"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => routeToDelete && deleteRouteMutation.mutate({ id: routeToDelete.id, notes: deleteNotes || undefined })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRouteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteStopOpen} onOpenChange={setIsDeleteStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar parada?</AlertDialogTitle>
            <AlertDialogDescription>
              La parada será eliminada de la ruta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => stopToDelete && deleteStopMutation.mutate(stopToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStopMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCancelRouteOpen} onOpenChange={setIsCancelRouteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              La ruta será marcada como inactiva. Podrá activarse de nuevo cuando sea necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRoute && cancelRouteMutation.mutate({ id: selectedRoute.id, stageId: selectedRoute.currentStageId })}
              className="bg-orange-500 text-white hover:bg-orange-600"
              data-testid="button-confirm-cancel-route"
            >
              {cancelRouteMutation.isPending ? "Desactivando..." : "Desactivar Ruta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCompleteRouteOpen} onOpenChange={setIsCompleteRouteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              La ruta quedará marcada como inactiva y el recorrido será contabilizado. Use esta opción para cerrar el ciclo de la ruta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRoute && completeRouteMutation.mutate(selectedRoute.id)}
              className="bg-primary text-primary-foreground"
              data-testid="button-confirm-complete-route"
            >
              {completeRouteMutation.isPending ? "Finalizando..." : "Finalizar Ruta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkCancelOpen} onOpenChange={setIsBulkCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar {bulkCancellableRoutes.length} ruta(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Las rutas seleccionadas serán marcadas como inactivas. Podrán activarse de nuevo cuando sea necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkCancelMutation.mutate(bulkCancellableRoutes)}
              className="bg-orange-500 text-white hover:bg-orange-600"
              data-testid="button-confirm-bulk-cancel"
            >
              {bulkCancelMutation.isPending ? "Desactivando..." : "Desactivar Rutas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={(open) => { setIsBulkDeleteOpen(open); if (!open) setBulkDeleteNotes(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {bulkDeletableIds.length} ruta(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán las rutas seleccionadas y sus paradas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo de eliminación (opcional)</label>
            <Textarea
              placeholder="Escribe el motivo de la eliminación..."
              value={bulkDeleteNotes}
              onChange={(e) => setBulkDeleteNotes(e.target.value)}
              data-testid="input-bulk-delete-notes"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate({ ids: bulkDeletableIds, notes: bulkDeleteNotes || undefined })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Eliminando..." : "Eliminar Rutas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Avanzar Etapa ─────────────────────────────────────── */}
      <Dialog open={isAdvanceStageOpen} onOpenChange={setIsAdvanceStageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Avanzar Etapa
            </DialogTitle>
            <DialogDescription>
              Selecciona la siguiente etapa para esta ruta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva Etapa</Label>
              <Select value={targetStageId} onValueChange={setTargetStageId}>
                <SelectTrigger data-testid="select-target-stage">
                  <SelectValue placeholder="Seleccionar etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const sortedAll = [...routeStages].sort((a, b) => a.sortOrder - b.sortOrder);
                    const currentIdx = selectedRoute?.currentStageId
                      ? sortedAll.findIndex(s => s.id === selectedRoute.currentStageId)
                      : -1;
                    // Admin puede saltar a cualquier etapa; resto solo a la siguiente por sortOrder
                    const available = isAdmin
                      ? sortedAll.filter(s => s.id !== selectedRoute?.currentStageId)
                      : sortedAll.slice(currentIdx + 1).slice(0, 1); // solo la inmediata siguiente
                    return available.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                          {stage.name}
                          {stage.isTerminal && (
                            <Badge variant="outline" className="text-xs ml-1">Terminal</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Motivo del cambio de etapa..."
                value={advanceStageNotes}
                onChange={(e) => setAdvanceStageNotes(e.target.value)}
                data-testid="input-advance-stage-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdvanceStageOpen(false)}>Cancelar</Button>
            <Button
              disabled={!targetStageId || advanceStageMutation.isPending}
              onClick={() => selectedRoute && advanceStageMutation.mutate({
                routeId: selectedRoute.id,
                newStageId: targetStageId,
                notes: advanceStageNotes || undefined,
              })}
              data-testid="button-confirm-advance-stage"
            >
              {advanceStageMutation.isPending ? "Avanzando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Historial de Etapas ───────────────────────────────── */}
      <Dialog open={isStageLogOpen} onOpenChange={setIsStageLogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Etapas
            </DialogTitle>
            <DialogDescription>
              Registro de todas las transiciones de etapa de esta ruta
            </DialogDescription>
          </DialogHeader>
          {stageLogLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : stageLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Sin historial de etapas registrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stageLog.map((entry, idx) => {
                const stage = stageMap.get(entry.stageId);
                const elapsed = entry.exitedAt
                  ? Math.round((new Date(entry.exitedAt).getTime() - new Date(entry.enteredAt).getTime()) / 60_000)
                  : null;
                const isLast = idx === stageLog.length - 1;
                return (
                  <div
                    key={entry.id}
                    className={`relative flex gap-3 pb-4 ${isLast ? "" : "border-l-2 border-muted ml-4 pl-4"}`}
                    data-testid={`stage-log-entry-${entry.id}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1 -ml-5 border-2 border-background"
                      style={{ backgroundColor: stage?.color ?? "#6B7280" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-medium text-sm">{entry.stageName}</p>
                        {entry.exitedAt ? (
                          <Badge variant="outline" className="text-xs">
                            {elapsed !== null ? (elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`) : "—"}
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">En curso</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Entrada: {formatDate(new Date(entry.enteredAt))}{" "}
                        {entry.exitedAt && `→ ${formatDate(new Date(entry.exitedAt))}`}
                      </p>
                      {entry.changedByUser && (
                        <p className="text-xs text-muted-foreground">
                          Por: {entry.changedByUser.fullName || entry.changedByUser.username}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground italic">"{entry.notes}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Historial de Etapas (acceso rápido desde tabla) ─────── */}
      <Dialog
        open={!!quickStageLogRouteId}
        onOpenChange={(open) => { if (!open) { setQuickStageLogRouteId(null); setQuickStageLogRoute(null); } }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Etapas
            </DialogTitle>
            {quickStageLogRoute && (
              <DialogDescription>
                {formatDateShort(new Date(quickStageLogRoute.date))} — {quickStageLogRoute.supplierName || quickStageLogRoute.supplierId}
              </DialogDescription>
            )}
          </DialogHeader>
          {quickStageLogLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : quickStageLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Sin historial de etapas registrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {quickStageLog.map((entry, idx) => {
                const stage = stageMap.get(entry.stageId);
                const endTime = entry.exitedAt ? new Date(entry.exitedAt).getTime() : Date.now();
                const elapsed = Math.round((endTime - new Date(entry.enteredAt).getTime()) / 60_000);
                const isLast = idx === quickStageLog.length - 1;
                const slaMins = entry.slaHours ? Number(entry.slaHours) * 60 : null;
                const exceededSla = slaMins !== null && elapsed > slaMins;
                const isOngoing = !entry.exitedAt;
                return (
                  <div
                    key={entry.id}
                    className={`relative flex gap-3 pb-4 ${isLast ? "" : "border-l-2 border-muted ml-4 pl-4"} ${exceededSla ? "rounded-md bg-red-50/60 dark:bg-red-900/10 px-2" : ""}`}
                    data-testid={`quick-stage-log-entry-${entry.id}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1 -ml-5 border-2 border-background"
                      style={{ backgroundColor: stage?.color ?? "#6B7280" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className={`font-medium text-sm flex items-center gap-1 ${exceededSla ? "text-destructive" : ""}`}>
                          {entry.stageName}
                          {exceededSla && <AlertTriangle className="h-3 w-3 text-destructive" />}
                        </p>
                        {isOngoing ? (
                          <Badge variant={exceededSla ? "destructive" : "secondary"} className="text-xs">
                            En curso · {elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`}
                          </Badge>
                        ) : (
                          <Badge variant={exceededSla ? "destructive" : "outline"} className="text-xs">
                            {elapsed >= 60 ? `${Math.floor(elapsed / 60)}h ${elapsed % 60}m` : `${elapsed}m`}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Entrada: {formatDate(new Date(entry.enteredAt))}{" "}
                        {entry.exitedAt && `→ ${formatDate(new Date(entry.exitedAt))}`}
                      </p>
                      {entry.slaHours && (
                        <p className={`text-xs ${exceededSla ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          SLA: {Number(entry.slaHours)}h{exceededSla ? " — Superado" : ""}
                        </p>
                      )}
                      {entry.changedByUser && (
                        <p className="text-xs text-muted-foreground">
                          Por: {entry.changedByUser.fullName || entry.changedByUser.username}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground italic">"{entry.notes}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Formulario Crear/Editar Etapa ─────────────────────── */}
      <Dialog open={isStageFormOpen} onOpenChange={(open) => { setIsStageFormOpen(open); if (!open) { setEditingStage(null); stageForm.reset(); }}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStage ? "Editar Etapa" : "Nueva Etapa"}</DialogTitle>
            <DialogDescription>
              {editingStage ? "Modifica los datos de la etapa" : "Crea una nueva etapa para el flujo de rutas"}
            </DialogDescription>
          </DialogHeader>
          <Form {...stageForm}>
            <form onSubmit={stageForm.handleSubmit(handleSubmitStageForm)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={stageForm.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input {...field} placeholder="Ej: En Ruta" data-testid="input-stage-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={stageForm.control} name="color" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={field.value} onChange={field.onChange} className="w-10 h-9 rounded cursor-pointer border" data-testid="input-stage-color" />
                        <Input {...field} placeholder="#6B7280" className="flex-1" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={stageForm.control} name="slaHours" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SLA (horas)</FormLabel>
                    <FormControl><Input {...field} type="number" placeholder="Ej: 8" data-testid="input-stage-sla" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={stageForm.control} name="slaAlertThresholdPct" render={({ field }) => (
                <FormItem>
                  <FormLabel>Umbral de alerta SLA (%)</FormLabel>
                  <FormControl><Input {...field} type="number" min={1} max={100} placeholder="80" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={stageForm.control} name="alertOnSlaWarning" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Alerta por vencer</FormLabel>
                  </FormItem>
                )} />
                <FormField control={stageForm.control} name="alertOnSlaExpired" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Alerta al vencer</FormLabel>
                  </FormItem>
                )} />
                <FormField control={stageForm.control} name="isDefault" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Etapa inicial</FormLabel>
                  </FormItem>
                )} />
                <FormField control={stageForm.control} name="isTerminal" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Etapa terminal</FormLabel>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsStageFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createStageMutation.isPending || updateStageMutation.isPending}>
                  {(createStageMutation.isPending || updateStageMutation.isPending) ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar Etapa ────────────────────────────────────── */}
      <AlertDialog open={isDeleteStageOpen} onOpenChange={setIsDeleteStageOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la etapa <strong>"{stageToDelete?.name}"</strong>. No podrá eliminarse si hay rutas activas en ella.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => stageToDelete && deleteStageMutation.mutate(stageToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStageMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Panel de Configuración ────────────────────────────── */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración de Rutas
            </DialogTitle>
            <DialogDescription>
              Administra etapas del flujo, configuración de alertas SLA y permisos por acción
            </DialogDescription>
          </DialogHeader>

          <Tabs value={configTab} onValueChange={(v) => setConfigTab(v as "stages" | "alerts" | "permissions")}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="stages" className="gap-2">
                <Layers className="h-4 w-4" />Etapas
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2">
                <Bell className="h-4 w-4" />Alertas
              </TabsTrigger>
              <TabsTrigger value="permissions" className="gap-2">
                <Shield className="h-4 w-4" />Permisos
              </TabsTrigger>
            </TabsList>

            {/* ── Tab Etapas ── */}
            <TabsContent value="stages" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Define las etapas del flujo de trabajo de rutas</p>
                <div className="flex gap-2">
                  {routeStages.length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => initDefaultStagesMutation.mutate()}
                      disabled={initDefaultStagesMutation.isPending}
                      className="gap-1"
                      data-testid="button-init-default-stages"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Usar Predeterminadas
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleOpenStageForm()} className="gap-1" data-testid="button-new-stage">
                    <Plus className="h-4 w-4" />
                    Nueva Etapa
                  </Button>
                </div>
              </div>
              {routeStages.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                  <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">No hay etapas configuradas</p>
                  <p className="text-xs text-muted-foreground">Crea etapas personalizadas o usa las predeterminadas</p>
                </div>
              ) : (
                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleStageDragEnd}
                >
                  <SortableContext
                    items={[...routeStages].sort((a, b) => a.sortOrder - b.sortOrder).map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {[...routeStages].sort((a, b) => a.sortOrder - b.sortOrder).map((stage) => (
                        <SortableStageItem
                          key={stage.id}
                          stage={stage}
                          onEdit={handleOpenStageForm}
                          onDelete={(s) => { setStageToDelete(s); setIsDeleteStageOpen(true); }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </TabsContent>

            {/* ── Tab Alertas ── */}
            <TabsContent value="alerts" className="mt-4 space-y-6">
              <div className="space-y-1">
                <h4 className="font-medium">Configuración Global de Alertas</h4>
                <p className="text-sm text-muted-foreground">Define quién recibe las alertas SLA de rutas</p>
              </div>
              <div className="space-y-4 p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Alertas globales de SLA</Label>
                    <p className="text-xs text-muted-foreground">Enviar email cuando una ruta supere su SLA</p>
                  </div>
                  <Switch
                    checked={alertConfig?.globalAlertOnExpiry ?? true}
                    onCheckedChange={(v) => {
                      setAlertConfig(prev => prev ? { ...prev, globalAlertOnExpiry: v } : { tenantId: "", globalAlertOnExpiry: v });
                    }}
                    data-testid="switch-global-alert"
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label>Destinatarios de alertas</Label>
                  {/* Selector visual de destinatarios */}
                  {(() => {
                    let selected: string[] = [];
                    try { selected = JSON.parse(alertConfig?.alertRecipientsJson ?? '["all_admins"]'); } catch { selected = ["all_admins"]; }
                    const isAllAdmins = selected.includes("all_admins");
                    const isAllSupervisors = selected.includes("all_supervisors");
                    const hasGroupToken = isAllAdmins || isAllSupervisors;
                    const allSelectableUsers: User[] = [...admins, ...supervisores];
                    const updateSelected = (next: string[]) =>
                      setAlertConfig(prev => prev
                        ? { ...prev, alertRecipientsJson: JSON.stringify(next) }
                        : { tenantId: "", alertRecipientsJson: JSON.stringify(next) }
                      );
                    const toggleToken = (token: string, checked: boolean) => {
                      const withoutToken = selected.filter(s => s !== token);
                      updateSelected(checked ? [...withoutToken, token] : withoutToken);
                    };
                    const toggleUser = (userId: string, checked: boolean) => {
                      const withoutGroups = selected.filter(s => s !== "all_admins" && s !== "all_supervisors");
                      updateSelected(checked ? [...withoutGroups, userId] : withoutGroups.filter(s => s !== userId));
                    };
                    return (
                      <div className="space-y-2">
                        {/* Tokens de grupo */}
                        <div className="flex items-center gap-2 p-2 rounded-md border bg-background">
                          <Checkbox
                            id="chk-all-admins"
                            checked={isAllAdmins}
                            onCheckedChange={(v) => toggleToken("all_admins", !!v)}
                            data-testid="checkbox-all-admins"
                          />
                          <label htmlFor="chk-all-admins" className="text-sm cursor-pointer select-none">
                            Todos los administradores
                          </label>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-md border bg-background">
                          <Checkbox
                            id="chk-all-supervisors"
                            checked={isAllSupervisors}
                            onCheckedChange={(v) => toggleToken("all_supervisors", !!v)}
                            data-testid="checkbox-all-supervisors"
                          />
                          <label htmlFor="chk-all-supervisors" className="text-sm cursor-pointer select-none">
                            Todos los supervisores
                          </label>
                        </div>
                        {/* Usuarios individuales */}
                        {!hasGroupToken && (
                          <div className="space-y-1 pl-1">
                            <p className="text-xs text-muted-foreground mb-1">O selecciona usuarios específicos:</p>
                            {allSelectableUsers.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">Sin usuarios admin/supervisor</p>
                            ) : allSelectableUsers.map(u => (
                              <div key={u.id} className="flex items-center gap-2 p-2 rounded-md border bg-background">
                                <Checkbox
                                  id={`chk-user-${u.id}`}
                                  checked={selected.includes(u.id)}
                                  onCheckedChange={(v) => toggleUser(u.id, !!v)}
                                  data-testid={`checkbox-recipient-${u.id}`}
                                />
                                <label htmlFor={`chk-user-${u.id}`} className="text-sm cursor-pointer select-none">
                                  {u.fullName ?? u.username}
                                  <span className="ml-1 text-xs text-muted-foreground">({u.role})</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => alertConfig && updateAlertConfigMutation.mutate({
                      globalAlertOnExpiry: alertConfig.globalAlertOnExpiry,
                      alertRecipientsJson: alertConfig.alertRecipientsJson,
                    })}
                    disabled={updateAlertConfigMutation.isPending}
                    className="gap-1"
                    data-testid="button-save-alert-config"
                  >
                    <Save className="h-4 w-4" />
                    {updateAlertConfigMutation.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>Las alertas por etapa específica se configuran en cada etapa (umbral de % y activación). Esta sección controla el comportamiento global del módulo.</p>
              </div>
            </TabsContent>

            {/* ── Tab Permisos ── */}
            <TabsContent value="permissions" className="mt-4 space-y-4">
              <div className="space-y-1">
                <h4 className="font-medium">Permisos por Acción</h4>
                <p className="text-sm text-muted-foreground">Define qué roles pueden ejecutar cada acción del módulo de rutas</p>
              </div>
              {actionPermissions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>Cargando permisos...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actionPermissions.map(perm => (
                    <div key={perm.action} className="p-4 rounded-lg border space-y-3" data-testid={`perm-${perm.action}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{ACTION_LABELS[perm.action] ?? perm.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {perm.allowedRoles.length > 0
                              ? `Permitido: ${perm.allowedRoles.map(r => AVAILABLE_ROLES.find(x => x.value === r)?.label ?? r).join(", ")}`
                              : "Sin acceso (nadie puede ejecutar esta acción)"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {AVAILABLE_ROLES.map(role => (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() => togglePermissionRole(perm, role.value)}
                            disabled={updatePermissionMutation.isPending}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              perm.allowedRoles.includes(role.value)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border"
                            }`}
                            data-testid={`perm-role-${perm.action}-${role.value}`}
                          >
                            {role.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
