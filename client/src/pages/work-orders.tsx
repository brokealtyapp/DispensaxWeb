import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";
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

const TYPE_LABELS: Record<string, string> = {
  abastecimiento: "Abastecimiento",
  tecnico: "Técnico",
  mantenimiento_preventivo: "Mant. Preventivo",
  instalacion: "Instalación",
  retiro: "Retiro",
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
  assignedUserId: string | null;
  ticketId: string | null;
  description: string | null;
  slaDeadline: string | null;
  slaStatus: string | null;
  completedAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  slaBreached: number;
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
  type: z.enum(["abastecimiento", "tecnico", "mantenimiento_preventivo", "instalacion", "retiro"]),
  priority: z.enum(["critico", "alto", "medio", "bajo"]),
  assignedUserId: z.string().nullable().optional(),
  description: z.string().min(1, "Descripción requerida"),
  notes: z.string().nullable().optional(),
});

const editOrderSchema = z.object({
  type: z.enum(["abastecimiento", "tecnico", "mantenimiento_preventivo", "instalacion", "retiro"]),
  priority: z.enum(["critico", "alto", "medio", "bajo"]),
  status: z.enum(["pendiente", "asignada", "en_proceso", "en_ruta", "completada", "cerrada", "cancelada"]),
  assignedUserId: z.string().nullable().optional(),
  description: z.string().min(1, "Descripción requerida"),
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

function formatSlaCountdown(deadline: string | null) {
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

function OrderDetailView({
  order,
  machines,
  users,
  onBack,
  onEdit,
  onReassign,
  onDelete,
}: {
  order: WorkOrder;
  machines: Machine[];
  users: UserInfo[];
  onBack: () => void;
  onEdit: () => void;
  onReassign: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const machine = machines.find(m => m.id === order.machineId);
  const assignee = users.find(u => u.id === order.assignedUserId);

  const { data: checklist = [], isLoading: checklistLoading } = useQuery<ChecklistItem[]>({
    queryKey: ["/api/work-orders", order.id, "checklist"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/work-orders/${order.id}/checklist`);
      return res.json();
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      await apiRequest("PATCH", `/api/work-orders/${order.id}/checklist/${itemId}`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", order.id, "checklist"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el checklist", variant: "destructive" });
    },
  });

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
          <p className="text-sm text-muted-foreground">{TYPE_LABELS[order.type] || order.type}</p>
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
              <span className={order.slaStatus === "vencido" ? "text-red-600 font-semibold" : ""}>{formatSlaCountdown(order.slaDeadline)}</span>
            </div>
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
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-start gap-3" data-testid={`checklist-item-${item.id}`}>
                    <Checkbox
                      checked={item.isCompleted}
                      onCheckedChange={(checked) => {
                        if (can("work_orders", "edit")) {
                          updateChecklistMutation.mutate({ itemId: item.id, isCompleted: !!checked });
                        }
                      }}
                      disabled={!can("work_orders", "edit") || updateChecklistMutation.isPending}
                      data-testid={`checkbox-checklist-${item.id}`}
                    />
                    <span className={`text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}

function SLADashboard({ stats, orders, machines, users, onSelectOrder }: { stats: WOStats | undefined; orders: WorkOrder[]; machines: Machine[]; users: UserInfo[]; onSelectOrder: (o: WorkOrder) => void }) {
  if (!stats) return <p className="text-sm text-muted-foreground p-4">Cargando estadísticas...</p>;

  const bySla = stats.bySla || {};
  const slaBarData = [
    { name: "En Tiempo", cantidad: bySla["dentro_tiempo"] || 0, fill: "#4ECB71" },
    { name: "Próx. Vencer", cantidad: bySla["proximo_vencer"] || 0, fill: "#F59E0B" },
    { name: "Vencido", cantidad: bySla["vencido"] || 0, fill: "#E84545" },
  ];

  const typeData = Object.entries(stats.byType).map(([key, value]) => ({
    name: TYPE_LABELS[key] || key,
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

export function WorkOrdersPage() {
  const { user } = useAuth();
  const { can, isLoading: permLoading } = usePermissions();
  const { toast } = useToast();
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
  const [orderPage, setOrderPage] = useState(1);
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("all");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("all");
  const [ticketPage, setTicketPage] = useState(1);
  const [reassignUserId, setReassignUserId] = useState("");

  const { data: orders = [], isLoading: ordersLoading } = useQuery<WorkOrder[]>({
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

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: stats } = useQuery<WOStats>({
    queryKey: ["/api/work-orders/stats"],
  });

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });

  const { data: users = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/users"],
  });

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
      if (orderStatusFilter !== "all" && o.status !== orderStatusFilter) return false;
      if (orderPriorityFilter !== "all" && o.priority !== orderPriorityFilter) return false;
      if (orderAssigneeFilter !== "all") {
        if (orderAssigneeFilter === "unassigned") {
          if (o.assignedUserId) return false;
        } else {
          if (o.assignedUserId !== orderAssigneeFilter) return false;
        }
      }
      return true;
    });
  }, [orders, orderSearch, orderTypeFilter, orderStatusFilter, orderPriorityFilter, orderAssigneeFilter, machines]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, orderPage]);

  useEffect(() => { setOrderPage(1); }, [orderSearch, orderTypeFilter, orderStatusFilter, orderPriorityFilter, orderAssigneeFilter]);

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
      type: "tecnico",
      priority: "medio",
      assignedUserId: null,
      description: "",
      notes: "",
    },
  });

  const editOrderForm = useForm<z.infer<typeof editOrderSchema>>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      type: "tecnico",
      priority: "medio",
      status: "pendiente",
      assignedUserId: null,
      description: "",
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
      editOrderForm.reset({
        type: showEditOrder.type as z.infer<typeof editOrderSchema>["type"],
        priority: showEditOrder.priority as z.infer<typeof editOrderSchema>["priority"],
        status: showEditOrder.status as z.infer<typeof editOrderSchema>["status"],
        assignedUserId: showEditOrder.assignedUserId || null,
        description: showEditOrder.description || "",
        notes: showEditOrder.notes || "",
      });
    }
  }, [showEditOrder]);

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
      const payload: Record<string, string | null> = { assignedUserId: userId === "none" ? null : userId };
      if (userId && userId !== "none") {
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

  const activeOrders = orders.filter(o => !["cerrada", "cancelada", "completada"].includes(o.status)).length;
  const pendingTickets = tickets.filter(t => t.status === "pendiente").length;
  const completedToday = orders.filter(o => {
    if (!o.completedAt) return false;
    const d = new Date(o.completedAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const assignableUsers = users.filter(u => ["admin", "supervisor", "abastecedor"].includes(u.role));

  if (permLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Cargando...</p></div>;
  }

  if (selectedOrder) {
    return (
      <div className="p-6">
        <OrderDetailView
          order={selectedOrder}
          machines={machines}
          users={users}
          onBack={() => setSelectedOrder(null)}
          onEdit={() => setShowEditOrder(selectedOrder)}
          onReassign={() => { setShowReassign(selectedOrder); setReassignUserId(selectedOrder.assignedUserId || ""); }}
          onDelete={() => setShowDeleteOrder(selectedOrder)}
        />

        <SimpleModal
          open={!!showEditOrder}
          onClose={() => setShowEditOrder(null)}
          title="Editar Orden de Trabajo"
          description={`Editando ${selectedOrder.orderNumber}`}
        >
          <Form {...editOrderForm}>
            <form onSubmit={editOrderForm.handleSubmit((data) => editOrderMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={editOrderForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-edit-order-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
        </SimpleModal>

        <SimpleModal
          open={!!showReassign}
          onClose={() => { setShowReassign(null); setReassignUserId(""); }}
          title="Reasignar Orden"
          description={`Reasignar ${selectedOrder.orderNumber} a otro usuario`}
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
          description={`¿Está seguro que desea eliminar ${showDeleteOrder?.orderNumber}? Esta acción no se puede deshacer.`}
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
      </div>
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
                <p className="text-2xl font-bold" data-testid="text-sla-breached">{stats?.slaBreached || 0}</p>
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
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center h-32"><p className="text-muted-foreground">Cargando órdenes...</p></div>
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
                          {TYPE_LABELS[order.type] || order.type}
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

          {ticketsLoading ? (
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
          <SLADashboard stats={stats} orders={orders} machines={machines} users={users} onSelectOrder={setSelectedOrder} />
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
                        {Object.entries(TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
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

      {showEditOrder && !selectedOrder && (
        <SimpleModal
          open={!!showEditOrder}
          onClose={() => setShowEditOrder(null)}
          title="Editar Orden de Trabajo"
          description={`Editando ${showEditOrder.orderNumber}`}
        >
          <Form {...editOrderForm}>
            <form onSubmit={editOrderForm.handleSubmit((data) => editOrderMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={editOrderForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-edit-order-type-list"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editOrderForm.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-edit-order-priority-list"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editOrderForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-edit-order-status-list"><SelectValue /></SelectTrigger></FormControl>
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
                    <FormControl><SelectTrigger data-testid="select-edit-order-assignee-list"><SelectValue placeholder="Sin asignar" /></SelectTrigger></FormControl>
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
                  <FormControl><Textarea {...field} data-testid="textarea-edit-order-description-list" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editOrderForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea {...field} value={field.value || ""} data-testid="textarea-edit-order-notes-list" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEditOrder(null)}>Cancelar</Button>
                <Button type="submit" disabled={editOrderMutation.isPending} data-testid="button-submit-edit-order-list">
                  {editOrderMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Form>
        </SimpleModal>
      )}

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

      {showDeleteOrder && !selectedOrder && (
        <SimpleModal
          open={!!showDeleteOrder}
          onClose={() => setShowDeleteOrder(null)}
          title="Eliminar Orden"
          description={`¿Está seguro que desea eliminar ${showDeleteOrder.orderNumber}? Esta acción no se puede deshacer.`}
        >
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteOrder(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteOrderMutation.mutate(showDeleteOrder.id)}
              disabled={deleteOrderMutation.isPending}
              data-testid="button-confirm-delete-order-list"
            >
              {deleteOrderMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </SimpleModal>
      )}

      <SimpleModal
        open={!!showDeleteTicket}
        onClose={() => setShowDeleteTicket(null)}
        title="Eliminar Ticket"
        description={`¿Está seguro que desea eliminar ${showDeleteTicket?.ticketNumber}? Esta acción no se puede deshacer.`}
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
    </div>
  );
}
