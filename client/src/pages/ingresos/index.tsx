import { useState, useEffect, type ComponentType } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PowerOff,
  MoreHorizontal,
  DollarSign,
  Building2,
  ShoppingCart,
  Wrench,
  Package,
  Truck,
  Tag,
  Landmark,
  BarChart3,
  CalendarDays,
  ArrowUpRight,
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Categoria {
  id: string;
  nombre: string;
  color: string;
  icono: string;
  metaMensual: string | null;
  isDefault: boolean;
  isActive: boolean;
  recaudoDelMes: number;
}

interface IngresoFijo {
  id: string;
  nombre: string;
  montoEsperado: string;
  moneda: string;
  frecuencia: string;
  proximaFecha: string | null;
  alertDiasPrevios: number;
  isActive: boolean;
  categoriaId: string | null;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  categoriaIcono: string | null;
  cuentaBancariaId: string | null;
  metodoCobro: string;
  notas: string | null;
  fechaInicio: string;
  estado: "al_dia" | "alerta" | "vencido" | "inactivo";
}

interface Registro {
  id: string;
  categoriaId: string | null;
  cuentaBancariaId: string | null;
  monto: string;
  moneda: string;
  fecha: string;
  metodoCobro: string;
  descripcion: string;
  notas: string | null;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  cuentaNombre: string | null;
  fijoId: string | null;
}

interface Dashboard {
  totalMes: number;
  totalMesAnterior: number;
  totalAnual: number;
  tasaDiaria: number;
  metaMensualFijos: number;
  variacionVsMesAnterior: number | null;
  fijosActivos: number;
  recaudoPorCategoria: { nombre: string; color: string; total: number }[];
  proximosCobros: {
    id: string;
    nombre: string;
    montoEsperado: string;
    moneda: string;
    proximaFecha: string;
    categoriaColor: string | null;
  }[];
  tendencia: { mes: string; total: number }[];
}

interface CuentaBancaria {
  id: string;
  nombre: string;
  tipo: string;
  moneda: string;
  saldo: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const ICONOS_CATEGORIA: Record<string, ComponentType<any>> = {
  ShoppingCart,
  Building2,
  Wrench,
  Package,
  Truck,
  DollarSign,
  Tag,
  Landmark,
  MoreHorizontal,
  TrendingUp,
};

const FRECUENCIAS = [
  { value: "diario", label: "Diario" },
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const METODOS_COBRO = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "cheque", label: "Cheque" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "deposito", label: "Depósito" },
];

const ESTADO_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: ComponentType<any> }> = {
  al_dia:  { label: "Al día",   variant: "secondary",  icon: CheckCircle2 },
  alerta:  { label: "Alerta",   variant: "outline",    icon: AlertTriangle },
  vencido: { label: "Vencido",  variant: "destructive", icon: XCircle },
  inactivo:{ label: "Inactivo", variant: "secondary",  icon: PowerOff },
};

const ICONOS_LUCIDE = [
  "ShoppingCart","Building2","Wrench","Package","Truck","DollarSign","Tag","Landmark","MoreHorizontal","TrendingUp",
];

const COLORES_PRESET = [
  "#E84545","#8b5cf6","#0ea5e9","#f59e0b","#10b981","#64748b","#ec4899","#14b8a6","#f97316","#3b82f6",
];

function cleanSentinel(val: string | undefined | null): string | null {
  if (!val || val === "__none__") return null;
  return val;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const categoriaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  color: z.string().min(1),
  icono: z.string().min(1),
  metaMensual: z.string().optional(),
});

const fijoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  categoriaId: z.string().optional(),
  montoEsperado: z.coerce.number({ invalid_type_error: "Ingrese monto" }).positive("Debe ser mayor a 0"),
  moneda: z.string().default("DOP"),
  frecuencia: z.string().min(1, "Frecuencia requerida"),
  fechaInicio: z.string().min(1, "Fecha inicio requerida"),
  proximaFecha: z.string().optional(),
  cuentaBancariaId: z.string().optional(),
  metodoCobro: z.string().default("transferencia"),
  alertDiasPrevios: z.coerce.number().min(0).default(3),
  notas: z.string().optional(),
});

const registroSchema = z.object({
  categoriaId: z.string().optional(),
  fijoId: z.string().optional(),
  monto: z.coerce.number({ invalid_type_error: "Ingrese monto" }).positive("Debe ser mayor a 0"),
  moneda: z.string().default("DOP"),
  fecha: z.string().min(1, "Fecha requerida"),
  metodoCobro: z.string().default("transferencia"),
  cuentaBancariaId: z.string().optional(),
  descripcion: z.string().min(1, "Descripción requerida"),
  notas: z.string().optional(),
});

const cobrarSchema = z.object({
  monto: z.coerce.number({ invalid_type_error: "Ingrese monto" }).positive("Debe ser mayor a 0"),
  fecha: z.string().optional(),
  metodoCobro: z.string().default("transferencia"),
  cuentaBancariaId: z.string().optional(),
  notas: z.string().optional(),
});

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function IngresosPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Ingresos</h1>
          <p className="text-sm text-muted-foreground">Gestión de cobros fijos, variables y categorías</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="fijos" data-testid="tab-fijos">Cobros Fijos</TabsTrigger>
          <TabsTrigger value="variables" data-testid="tab-variables">Cobros Variables</TabsTrigger>
          <TabsTrigger value="historial" data-testid="tab-historial">Historial</TabsTrigger>
          <TabsTrigger value="categorias" data-testid="tab-categorias">Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="fijos"><FijosTab /></TabsContent>
        <TabsContent value="variables"><VariablesTab /></TabsContent>
        <TabsContent value="historial"><HistorialTab /></TabsContent>
        <TabsContent value="categorias"><CategoriasTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── TAB DASHBOARD ───────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["/api/ingresos/dashboard"],
    queryFn: () => apiRequest("GET", "/api/ingresos/dashboard").then((r) => r.json()),
  });

  if (isLoading) return <div className="space-y-4 mt-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!data) return null;

  const variacion = data.variacionVsMesAnterior;
  const cumplimiento = data.metaMensualFijos > 0 ? Math.min(100, (data.totalMes / data.metaMensualFijos) * 100) : null;

  return (
    <div className="space-y-6 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Recaudado este mes</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.totalMes)}</p>
            {variacion !== null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${variacion >= 0 ? "text-primary" : "text-destructive"}`}>
                <ArrowUpRight className={`h-3 w-3 ${variacion < 0 ? "rotate-180" : ""}`} />
                {variacion >= 0 ? "+" : ""}{variacion.toFixed(1)}% vs mes anterior
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Meta mensual (fijos)</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.metaMensualFijos)}</p>
            {cumplimiento !== null && (
              <p className="text-xs mt-1 text-muted-foreground">{cumplimiento.toFixed(0)}% cumplido</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Total anual</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.totalAnual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Tasa diaria (mes)</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.tasaDiaria)}</p>
            <p className="text-xs mt-1 text-muted-foreground">{data.fijosActivos} cobros fijos activos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia 6 meses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tendencia de ingresos (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.tendencia} barSize={28}>
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" fill="#E84545" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recaudo por categoría */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recaudo por categoría (mes)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recaudoPorCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin registros este mes</p>
            ) : (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.recaudoPorCategoria}
                      dataKey="total"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={36}
                    >
                      {data.recaudoPorCategoria.map((entry: { nombre: string; total: number; color: string }, idx: number) => (
                        <Cell key={idx} fill={entry.color || "#E84545"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {data.recaudoPorCategoria.sort((a: { total: number }, b: { total: number }) => b.total - a.total).map((c: { nombre: string; total: number; color: string }) => (
                    <div key={c.nombre} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-xs truncate">{c.nombre}</span>
                      </div>
                      <span className="text-xs font-medium flex-shrink-0">{formatCurrency(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos cobros */}
      {data.proximosCobros.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Próximos cobros (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.proximosCobros.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.categoriaColor ?? "#E84545" }} />
                    <span className="text-sm">{c.nombre}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{formatDate(c.proximaFecha)}</span>
                    <span className="text-sm font-medium">{formatCurrency(parseFloat(c.montoEsperado))}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── TAB COBROS FIJOS ─────────────────────────────────────────────────────────

function FijosTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fijoModal, setFijoModal] = useState<{ open: boolean; editando: IngresoFijo | null }>({ open: false, editando: null });
  const [cobrarModal, setCobrarModal] = useState<{ open: boolean; fijo: IngresoFijo | null }>({ open: false, fijo: null });
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  const { data: fijos = [], isLoading } = useQuery<IngresoFijo[]>({
    queryKey: ["/api/ingresos/fijos"],
    queryFn: () => apiRequest("GET", "/api/ingresos/fijos").then((r) => r.json()),
  });

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/ingresos/categorias"],
    queryFn: () => apiRequest("GET", "/api/ingresos/categorias").then((r) => r.json()),
  });

  const { data: cuentas = [] } = useQuery<CuentaBancaria[]>({
    queryKey: ["/api/ingresos/cuentas-bancarias"],
    queryFn: () => apiRequest("GET", "/api/ingresos/cuentas-bancarias").then((r) => r.json()),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["/api/ingresos/fijos"] });
    qc.invalidateQueries({ queryKey: ["/api/ingresos/dashboard"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/ingresos/fijos/${id}/toggle`),
    onSuccess: invalidar,
    onError: () => toast({ title: "Error", description: "No se pudo cambiar el estado", variant: "destructive" }),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ingresos/fijos/${id}`),
    onSuccess: () => { invalidar(); toast({ title: "Cobro fijo eliminado" }); },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" }),
  });

  if (isLoading) return <div className="mt-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={() => setFijoModal({ open: true, editando: null })} data-testid="button-nuevo-fijo">
          <Plus className="h-4 w-4 mr-1" /> Nuevo cobro fijo
        </Button>
      </div>

      {fijos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No hay cobros fijos configurados</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {fijos.map((f) => {
            const est = ESTADO_CONFIG[f.estado] ?? ESTADO_CONFIG.al_dia;
            const EstIcon = est.icon;
            const IconoCat = f.categoriaIcono ? (ICONOS_CATEGORIA[f.categoriaIcono] ?? TrendingUp) : TrendingUp;
            return (
              <Card key={f.id} className={!f.isActive ? "opacity-60" : ""} data-testid={`card-fijo-${f.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div
                      className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: f.categoriaColor ?? "#E84545", opacity: 0.15 }}
                    >
                      <IconoCat className="h-5 w-5" style={{ color: f.categoriaColor ?? "#E84545", opacity: 1 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{f.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {f.categoriaNombre ?? "Sin categoría"} · {FRECUENCIAS.find(fr => fr.value === f.frecuencia)?.label ?? f.frecuencia}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(parseFloat(f.montoEsperado))}</p>
                      {f.proximaFecha && (
                        <p className="text-xs text-muted-foreground">Próximo: {formatDate(f.proximaFecha)}</p>
                      )}
                    </div>
                    <Badge variant={est.variant} className="flex items-center gap-1">
                      <EstIcon className="h-3 w-3" />{est.label}
                    </Badge>
                    <div className="flex gap-1">
                      {f.isActive && (
                        <Button size="icon" variant="ghost" onClick={() => setCobrarModal({ open: true, fijo: f })} data-testid={`button-cobrar-${f.id}`} title="Registrar cobro">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setFijoModal({ open: true, editando: f })} data-testid={`button-editar-fijo-${f.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleMutation.mutate(f.id)} data-testid={`button-toggle-${f.id}`} title={f.isActive ? "Desactivar" : "Activar"}>
                        <PowerOff className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEliminarId(f.id)} data-testid={`button-eliminar-fijo-${f.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FijoModal
        open={fijoModal.open}
        editando={fijoModal.editando}
        categorias={categorias}
        cuentas={cuentas}
        onClose={() => setFijoModal({ open: false, editando: null })}
        onSaved={invalidar}
      />

      {cobrarModal.fijo && (
        <CobrarModal
          open={cobrarModal.open}
          fijo={cobrarModal.fijo}
          cuentas={cuentas}
          onClose={() => setCobrarModal({ open: false, fijo: null })}
          onSaved={invalidar}
        />
      )}

      <AlertDialog open={!!eliminarId} onOpenChange={() => setEliminarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cobro fijo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (eliminarId) { eliminarMutation.mutate(eliminarId); setEliminarId(null); } }} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Modal Cobro Fijo ────────────────────────────────────────────────────────

function FijoModal({
  open, editando, categorias, cuentas, onClose, onSaved,
}: {
  open: boolean;
  editando: IngresoFijo | null;
  categorias: Categoria[];
  cuentas: CuentaBancaria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof fijoSchema>>({
    resolver: zodResolver(fijoSchema),
    defaultValues: {
      nombre: "",
      categoriaId: "__none__",
      montoEsperado: 0 as any,
      moneda: "DOP",
      frecuencia: "mensual",
      fechaInicio: new Date().toISOString().split("T")[0],
      proximaFecha: "",
      cuentaBancariaId: "__none__",
      metodoCobro: "transferencia",
      alertDiasPrevios: 3,
      notas: "",
    },
  });

  useEffect(() => {
    if (editando) {
      form.reset({
        nombre: editando.nombre,
        categoriaId: editando.categoriaId ?? "__none__",
        montoEsperado: parseFloat(editando.montoEsperado) as any,
        moneda: editando.moneda,
        frecuencia: editando.frecuencia,
        fechaInicio: editando.fechaInicio?.split("T")[0] ?? "",
        proximaFecha: editando.proximaFecha?.split("T")[0] ?? "",
        cuentaBancariaId: editando.cuentaBancariaId ?? "__none__",
        metodoCobro: editando.metodoCobro,
        alertDiasPrevios: editando.alertDiasPrevios,
        notas: editando.notas ?? "",
      });
    } else {
      form.reset({
        nombre: "",
        categoriaId: "__none__",
        montoEsperado: 0 as any,
        moneda: "DOP",
        frecuencia: "mensual",
        fechaInicio: new Date().toISOString().split("T")[0],
        proximaFecha: "",
        cuentaBancariaId: "__none__",
        metodoCobro: "transferencia",
        alertDiasPrevios: 3,
        notas: "",
      });
    }
  }, [editando, open]);

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof fijoSchema>) => {
      const body = {
        ...values,
        categoriaId: cleanSentinel(values.categoriaId),
        cuentaBancariaId: cleanSentinel(values.cuentaBancariaId),
        proximaFecha: values.proximaFecha || null,
      };
      if (editando) return apiRequest("PUT", `/api/ingresos/fijos/${editando.id}`, body);
      return apiRequest("POST", "/api/ingresos/fijos", body);
    },
    onSuccess: () => {
      toast({ title: editando ? "Cobro fijo actualizado" : "Cobro fijo creado" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar cobro fijo" : "Nuevo cobro fijo"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="nombre" render={({ field }) => (
              <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} data-testid="input-nombre-fijo" /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="montoEsperado" render={({ field }) => (
                <FormItem><FormLabel>Monto esperado</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-monto-fijo" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="moneda" render={({ field }) => (
                <FormItem><FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="DOP">DOP (RD$)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="frecuencia" render={({ field }) => (
                <FormItem><FormLabel>Frecuencia</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {FRECUENCIAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="metodoCobro" render={({ field }) => (
                <FormItem><FormLabel>Método de cobro</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {METODOS_COBRO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="fechaInicio" render={({ field }) => (
                <FormItem><FormLabel>Fecha inicio</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="proximaFecha" render={({ field }) => (
                <FormItem><FormLabel>Próxima fecha</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="categoriaId" render={({ field }) => (
              <FormItem><FormLabel>Categoría</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? "__none__"}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {cuentas.length > 0 && (
              <FormField control={form.control} name="cuentaBancariaId" render={({ field }) => (
                <FormItem><FormLabel>Cuenta bancaria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "__none__"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sin cuenta" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cuenta</SelectItem>
                      {cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="alertDiasPrevios" render={({ field }) => (
              <FormItem><FormLabel>Días de alerta previos</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="notas" render={({ field }) => (
              <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-guardar-fijo">
                {mutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Registrar Cobro ───────────────────────────────────────────────────

function CobrarModal({
  open, fijo, cuentas, onClose, onSaved,
}: {
  open: boolean;
  fijo: IngresoFijo;
  cuentas: CuentaBancaria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof cobrarSchema>>({
    resolver: zodResolver(cobrarSchema),
    defaultValues: {
      monto: parseFloat(fijo.montoEsperado) as any,
      fecha: new Date().toISOString().split("T")[0],
      metodoCobro: fijo.metodoCobro,
      cuentaBancariaId: fijo.cuentaBancariaId ?? "__none__",
      notas: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        monto: parseFloat(fijo.montoEsperado) as any,
        fecha: new Date().toISOString().split("T")[0],
        metodoCobro: fijo.metodoCobro,
        cuentaBancariaId: fijo.cuentaBancariaId ?? "__none__",
        notas: "",
      });
    }
  }, [open, fijo]);

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof cobrarSchema>) =>
      apiRequest("POST", `/api/ingresos/fijos/${fijo.id}/registrar-cobro`, {
        ...values,
        cuentaBancariaId: cleanSentinel(values.cuentaBancariaId),
      }),
    onSuccess: () => {
      toast({ title: "Cobro registrado correctamente" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Error", description: "No se pudo registrar el cobro", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cobro: {fijo.nombre}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="monto" render={({ field }) => (
              <FormItem><FormLabel>Monto cobrado</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-monto-cobro" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="fecha" render={({ field }) => (
              <FormItem><FormLabel>Fecha de cobro</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="metodoCobro" render={({ field }) => (
              <FormItem><FormLabel>Método de cobro</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {METODOS_COBRO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {cuentas.length > 0 && (
              <FormField control={form.control} name="cuentaBancariaId" render={({ field }) => (
                <FormItem><FormLabel>Acreditar a cuenta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "__none__"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sin cuenta" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cuenta</SelectItem>
                      {cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} ({c.moneda})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="notas" render={({ field }) => (
              <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-confirmar-cobro">
                {mutation.isPending ? "Registrando..." : "Registrar cobro"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── TAB COBROS VARIABLES ────────────────────────────────────────────────────

function VariablesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [modal, setModal] = useState<{ open: boolean; editando: Registro | null }>({ open: false, editando: null });
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  const { data: registros = [], isLoading } = useQuery<Registro[]>({
    queryKey: ["/api/ingresos/registros", { pageSize: 50, page: 1 }],
    queryFn: () => apiRequest("GET", "/api/ingresos/registros?pageSize=50&page=1").then((r) => r.json()).then((d) => d.rows ?? []),
  });

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/ingresos/categorias"],
    queryFn: () => apiRequest("GET", "/api/ingresos/categorias").then((r) => r.json()),
  });

  const { data: cuentas = [] } = useQuery<CuentaBancaria[]>({
    queryKey: ["/api/ingresos/cuentas-bancarias"],
    queryFn: () => apiRequest("GET", "/api/ingresos/cuentas-bancarias").then((r) => r.json()),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["/api/ingresos/registros"] });
    qc.invalidateQueries({ queryKey: ["/api/ingresos/dashboard"] });
  };

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ingresos/registros/${id}`),
    onSuccess: () => { invalidar(); toast({ title: "Registro eliminado" }); },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" }),
  });

  if (isLoading) return <div className="mt-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal({ open: true, editando: null })} data-testid="button-nuevo-ingreso">
          <Plus className="h-4 w-4 mr-1" /> Registrar ingreso
        </Button>
      </div>

      {registros.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sin registros de ingresos</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {registros.map((r) => (
            <Card key={r.id} data-testid={`card-registro-${r.id}`}>
              <CardContent className="py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.categoriaColor ?? "#9ca3af" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.descripcion}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.categoriaNombre ?? "Sin categoría"} · {formatDate(r.fecha)}
                      {r.cuentaNombre && <> · {r.cuentaNombre}</>}
                    </p>
                  </div>
                  <span className="font-semibold text-primary">{formatCurrency(parseFloat(r.monto))}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setModal({ open: true, editando: r })} data-testid={`button-editar-registro-${r.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEliminarId(r.id)} data-testid={`button-eliminar-registro-${r.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RegistroModal
        open={modal.open}
        editando={modal.editando}
        categorias={categorias}
        cuentas={cuentas}
        onClose={() => setModal({ open: false, editando: null })}
        onSaved={invalidar}
      />

      <AlertDialog open={!!eliminarId} onOpenChange={() => setEliminarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (eliminarId) { eliminarMutation.mutate(eliminarId); setEliminarId(null); } }} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Modal Registro ───────────────────────────────────────────────────────────

function RegistroModal({
  open, editando, categorias, cuentas, onClose, onSaved,
}: {
  open: boolean;
  editando: Registro | null;
  categorias: Categoria[];
  cuentas: CuentaBancaria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof registroSchema>>({
    resolver: zodResolver(registroSchema),
    defaultValues: {
      categoriaId: "__none__",
      monto: 0 as any,
      moneda: "DOP",
      fecha: new Date().toISOString().split("T")[0],
      metodoCobro: "transferencia",
      cuentaBancariaId: "__none__",
      descripcion: "",
      notas: "",
    },
  });

  useEffect(() => {
    if (editando) {
      form.reset({
        categoriaId: editando.categoriaId ?? "__none__",
        monto: parseFloat(editando.monto) as any,
        moneda: editando.moneda,
        fecha: editando.fecha?.split("T")[0] ?? "",
        metodoCobro: editando.metodoCobro,
        cuentaBancariaId: editando.cuentaBancariaId ?? "__none__",
        descripcion: editando.descripcion,
        notas: editando.notas ?? "",
      });
    } else {
      form.reset({
        categoriaId: "__none__",
        monto: 0 as any,
        moneda: "DOP",
        fecha: new Date().toISOString().split("T")[0],
        metodoCobro: "transferencia",
        cuentaBancariaId: "__none__",
        descripcion: "",
        notas: "",
      });
    }
  }, [editando, open]);

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof registroSchema>) => {
      const body = {
        ...values,
        categoriaId: cleanSentinel(values.categoriaId),
        cuentaBancariaId: cleanSentinel(values.cuentaBancariaId),
      };
      if (editando) return apiRequest("PUT", `/api/ingresos/registros/${editando.id}`, body);
      return apiRequest("POST", "/api/ingresos/registros", body);
    },
    onSuccess: () => {
      toast({ title: editando ? "Registro actualizado" : "Ingreso registrado" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar ingreso" : "Registrar ingreso"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="descripcion" render={({ field }) => (
              <FormItem><FormLabel>Descripción</FormLabel><FormControl><Input {...field} data-testid="input-descripcion-registro" /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="monto" render={({ field }) => (
                <FormItem><FormLabel>Monto</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-monto-registro" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="moneda" render={({ field }) => (
                <FormItem><FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="DOP">DOP (RD$)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="fecha" render={({ field }) => (
                <FormItem><FormLabel>Fecha</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="metodoCobro" render={({ field }) => (
                <FormItem><FormLabel>Método</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {METODOS_COBRO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="categoriaId" render={({ field }) => (
              <FormItem><FormLabel>Categoría</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? "__none__"}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {cuentas.length > 0 && (
              <FormField control={form.control} name="cuentaBancariaId" render={({ field }) => (
                <FormItem><FormLabel>Acreditar a cuenta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "__none__"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sin cuenta" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cuenta</SelectItem>
                      {cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} ({c.moneda})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="notas" render={({ field }) => (
              <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-guardar-registro">
                {mutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── TAB HISTORIAL ────────────────────────────────────────────────────────────

function HistorialTab() {
  const [page, setPage] = useState(1);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [catFiltro, setCatFiltro] = useState("__all__");
  const [monedaFiltro, setMonedaFiltro] = useState("__all__");

  const buildParams = (overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: "30", ...overrides });
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (catFiltro && catFiltro !== "__all__") params.set("categoriaId", catFiltro);
    if (monedaFiltro && monedaFiltro !== "__all__") params.set("moneda", monedaFiltro);
    return params;
  };

  const { data: paginado, isLoading } = useQuery<{ rows: Registro[]; total: number; totalPages: number }>({
    queryKey: ["/api/ingresos/registros", { page, desde, hasta, categoriaId: catFiltro, moneda: monedaFiltro }],
    queryFn: () => apiRequest("GET", `/api/ingresos/registros?${buildParams()}`).then((r) => r.json()),
  });

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/ingresos/categorias"],
    queryFn: () => apiRequest("GET", "/api/ingresos/categorias").then((r) => r.json()),
  });

  const rows = paginado?.rows ?? [];
  const totalPages = paginado?.totalPages ?? 1;
  const total = paginado?.total ?? 0;

  const handleExportCSV = () => {
    const params = buildParams({ page: "1", pageSize: "9999" });
    window.open(`/api/ingresos/registros/export?${params}`, "_blank");
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Desde</label>
                <Input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(1); }} className="w-36" data-testid="input-historial-desde" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Hasta</label>
                <Input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(1); }} className="w-36" data-testid="input-historial-hasta" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Categoría</label>
                <Select value={catFiltro} onValueChange={(v) => { setCatFiltro(v); setPage(1); }}>
                  <SelectTrigger className="w-44" data-testid="select-historial-categoria"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Moneda</label>
                <Select value={monedaFiltro} onValueChange={(v) => { setMonedaFiltro(v); setPage(1); }}>
                  <SelectTrigger className="w-32" data-testid="select-historial-moneda"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    <SelectItem value="DOP">DOP (RD$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" onClick={handleExportCSV} data-testid="button-exportar-csv">
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sin registros con los filtros seleccionados</CardContent></Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{total} registros encontrados</p>
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.categoriaColor ?? "#9ca3af" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.descripcion}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.categoriaNombre ?? "Sin categoría"} · {formatDate(r.fecha)}
                        {r.cuentaNombre && <> · {r.cuentaNombre}</>}
                        {r.fijoId && <> · Cobro fijo</>}
                      </p>
                    </div>
                    <span className="font-semibold text-primary">{formatCurrency(parseFloat(r.monto))}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
              <span className="text-sm">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Siguiente</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── TAB CATEGORÍAS ──────────────────────────────────────────────────────────

function CategoriasTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [catModal, setCatModal] = useState<{ open: boolean; editando: Categoria | null }>({ open: false, editando: null });
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  const { data: categorias = [], isLoading } = useQuery<Categoria[]>({
    queryKey: ["/api/ingresos/categorias"],
    queryFn: () => apiRequest("GET", "/api/ingresos/categorias").then((r) => r.json()),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["/api/ingresos/categorias"] });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ingresos/categorias/${id}`),
    onSuccess: () => { invalidar(); toast({ title: "Categoría eliminada" }); },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" }),
  });

  if (isLoading) return <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={() => setCatModal({ open: true, editando: null })} data-testid="button-nueva-categoria">
          <Plus className="h-4 w-4 mr-1" /> Nueva categoría
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categorias.map((c) => {
          const IconoComp = ICONOS_CATEGORIA[c.icono] ?? TrendingUp;
          return (
            <Card key={c.id} data-testid={`card-categoria-${c.id}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.color + "22" }}>
                    <IconoComp className="h-5 w-5" style={{ color: c.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.nombre}</p>
                    {c.metaMensual && (
                      <p className="text-xs text-muted-foreground">Meta: {formatCurrency(parseFloat(c.metaMensual))}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Recaudado este mes: {formatCurrency(c.recaudoDelMes)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => setCatModal({ open: true, editando: c })} data-testid={`button-editar-cat-${c.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!c.isDefault && (
                      <Button size="icon" variant="ghost" onClick={() => setEliminarId(c.id)} data-testid={`button-eliminar-cat-${c.id}`}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CategoriaModal
        open={catModal.open}
        editando={catModal.editando}
        onClose={() => setCatModal({ open: false, editando: null })}
        onSaved={invalidar}
      />

      <AlertDialog open={!!eliminarId} onOpenChange={() => setEliminarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>Los registros asociados quedarán sin categoría.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (eliminarId) { eliminarMutation.mutate(eliminarId); setEliminarId(null); } }} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Modal Categoría ─────────────────────────────────────────────────────────

function CategoriaModal({
  open, editando, onClose, onSaved,
}: {
  open: boolean;
  editando: Categoria | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof categoriaSchema>>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nombre: "", color: "#E84545", icono: "DollarSign", metaMensual: "" },
  });

  useEffect(() => {
    if (editando) {
      form.reset({
        nombre: editando.nombre,
        color: editando.color,
        icono: editando.icono,
        metaMensual: editando.metaMensual ?? "",
      });
    } else {
      form.reset({ nombre: "", color: "#E84545", icono: "DollarSign", metaMensual: "" });
    }
  }, [editando, open]);

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof categoriaSchema>) => {
      const body = { ...values, metaMensual: values.metaMensual || null };
      if (editando) return apiRequest("PUT", `/api/ingresos/categorias/${editando.id}`, body);
      return apiRequest("POST", "/api/ingresos/categorias", body);
    },
    onSuccess: () => {
      toast({ title: editando ? "Categoría actualizada" : "Categoría creada" });
      onSaved();
      onClose();
    },
    onError: () => toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" }),
  });

  const colorActual = form.watch("color");
  const iconoActual = form.watch("icono");
  const IconoActual = ICONOS_CATEGORIA[iconoActual] ?? TrendingUp;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="nombre" render={({ field }) => (
              <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} data-testid="input-nombre-categoria" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="metaMensual" render={({ field }) => (
              <FormItem><FormLabel>Meta mensual (opcional)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            {/* Selector de color */}
            <FormField control={form.control} name="color" render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {COLORES_PRESET.map((col) => (
                    <button
                      key={col}
                      type="button"
                      className={`h-7 w-7 rounded-md border-2 transition-transform ${field.value === col ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: col }}
                      onClick={() => field.onChange(col)}
                      data-testid={`color-${col}`}
                    />
                  ))}
                  <Input type="color" value={field.value} onChange={(e) => field.onChange(e.target.value)} className="h-7 w-16 p-0.5 cursor-pointer" />
                </div>
                <FormMessage />
              </FormItem>
            )} />

            {/* Selector de ícono */}
            <FormField control={form.control} name="icono" render={({ field }) => (
              <FormItem>
                <FormLabel>Ícono</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {ICONOS_LUCIDE.map((ico) => {
                    const Ic = ICONOS_CATEGORIA[ico] ?? TrendingUp;
                    return (
                      <button
                        key={ico}
                        type="button"
                        className={`h-8 w-8 rounded-md flex items-center justify-center border transition-colors ${field.value === ico ? "border-primary bg-primary/10" : "border-border hover-elevate"}`}
                        onClick={() => field.onChange(ico)}
                        data-testid={`icono-${ico}`}
                      >
                        <Ic className="h-4 w-4" style={{ color: field.value === ico ? colorActual : undefined }} />
                      </button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            {/* Preview */}
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
              <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: colorActual + "22" }}>
                <IconoActual className="h-4 w-4" style={{ color: colorActual }} />
              </div>
              <span className="text-sm font-medium">{form.watch("nombre") || "Vista previa"}</span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-guardar-categoria">
                {mutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
