import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingDown,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Pencil,
  Trash2,
  Power,
  CreditCard,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────

interface EgresoCategoria {
  id: string;
  nombre: string;
  color: string;
  icono: string;
  presupuestoMensual: string | null;
  isDefault: boolean;
  isActive: boolean;
  gastoDelMes: number;
}

interface EgresoFijo {
  id: string;
  nombre: string;
  monto: string;
  moneda: string;
  frecuencia: string;
  proximaFecha: string | null;
  alertDiasPrevios: number;
  totalPagadoCiclo: string;
  isActive: boolean;
  categoriaId: string | null;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  categoriaIcono: string | null;
  cuentaBancariaId: string | null;
  metodoPago: string;
  notas: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  estado: "al_dia" | "alerta" | "vencido" | "parcial" | "inactivo";
}

interface EgresoRegistro {
  id: string;
  fijoId: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  fijoNombre: string | null;
  monto: string;
  moneda: string;
  fecha: string;
  metodoPago: string;
  descripcion: string;
  notas: string | null;
  esParcial: boolean;
}

interface Dashboard {
  totalMes: number;
  totalMesAnterior: number;
  variacionPct: number;
  totalAnio: number;
  tasaDiaria: number;
  gastoFijosActivosMensual: number;
  gastoPorCategoria: { categoriaId: string; nombre: string; color: string; total: number }[];
  tendencia: { mes: string; total: number }[];
}

interface CuentaBancaria {
  id: string;
  nombre: string;
  tipo: string;
  moneda: string;
  saldo: string;
}

// ────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────

function estadoBadge(estado: EgresoFijo["estado"]) {
  switch (estado) {
    case "al_dia":
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20" data-testid="badge-estado-al-dia">
          <CheckCircle className="w-3 h-3 mr-1" />Al día
        </Badge>
      );
    case "alerta":
      return (
        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40" data-testid="badge-estado-alerta">
          <Clock className="w-3 h-3 mr-1" />Por vencer
        </Badge>
      );
    case "vencido":
      return (
        <Badge variant="destructive" data-testid="badge-estado-vencido">
          <AlertTriangle className="w-3 h-3 mr-1" />Vencido
        </Badge>
      );
    case "parcial":
      return (
        <Badge variant="outline" className="text-muted-foreground" data-testid="badge-estado-parcial">
          Parcial
        </Badge>
      );
    case "inactivo":
      return (
        <Badge variant="secondary" data-testid="badge-estado-inactivo">
          Inactivo
        </Badge>
      );
  }
}

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

const METODOS_PAGO = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "cheque", label: "Cheque" },
  { value: "debito_automatico", label: "Débito automático" },
];

// ────────────────────────────────────────────────
// SCHEMAS
// ────────────────────────────────────────────────

const fijoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  categoriaId: z.string().optional(),
  monto: z.string().min(1, "Monto requerido"),
  moneda: z.enum(["DOP", "USD"]),
  frecuencia: z.string().min(1),
  fechaInicio: z.string().min(1, "Fecha inicio requerida"),
  fechaFin: z.string().optional(),
  cuentaBancariaId: z.string().optional(),
  metodoPago: z.string().default("transferencia"),
  alertDiasPrevios: z.number().min(0).max(30).default(3),
  notas: z.string().optional(),
});

const pagoSchema = z.object({
  monto: z.string().min(1, "Monto requerido"),
  metodoPago: z.string().default("transferencia"),
  cuentaBancariaId: z.string().optional(),
  fecha: z.string().optional(),
  notas: z.string().optional(),
});

const variableSchema = z.object({
  categoriaId: z.string().min(1, "Categoría requerida"),
  monto: z.string().min(1, "Monto requerido"),
  moneda: z.enum(["DOP", "USD"]),
  fecha: z.string().min(1, "Fecha requerida"),
  metodoPago: z.string().default("transferencia"),
  cuentaBancariaId: z.string().optional(),
  descripcion: z.string().min(1, "Descripción requerida"),
  notas: z.string().optional(),
});

// ────────────────────────────────────────────────
// MAIN PAGE
// ────────────────────────────────────────────────

export default function EgresosPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("dashboard");
  const [fijoModal, setFijoModal] = useState<{ open: boolean; editando?: EgresoFijo }>({ open: false });
  const [pagoSheet, setPagoSheet] = useState<{ open: boolean; fijo?: EgresoFijo }>({ open: false });
  const [catModal, setCatModal] = useState<{ open: boolean; editando?: EgresoCategoria | null }>({ open: false });
  const [histPage, setHistPage] = useState(1);
  const [histFiltros, setHistFiltros] = useState({
    desde: "",
    hasta: "",
    categoriaId: "",
    moneda: "",
    search: "",
  });

  // ── Queries ──
  const dashQuery = useQuery<Dashboard>({
    queryKey: ["/api/egresos/dashboard"],
    queryFn: () => apiRequest("GET", "/api/egresos/dashboard").then((r) => r.json()),
  });

  const categoriasQuery = useQuery<EgresoCategoria[]>({
    queryKey: ["/api/egresos/categorias"],
    queryFn: () => apiRequest("GET", "/api/egresos/categorias").then((r) => r.json()),
  });

  const fijosQuery = useQuery<EgresoFijo[]>({
    queryKey: ["/api/egresos/fijos"],
    queryFn: () => apiRequest("GET", "/api/egresos/fijos").then((r) => r.json()),
  });

  const alertasQuery = useQuery<EgresoFijo[]>({
    queryKey: ["/api/egresos/alertas-vencimiento"],
    queryFn: () => apiRequest("GET", "/api/egresos/alertas-vencimiento").then((r) => r.json()),
  });

  const cuentasQuery = useQuery<CuentaBancaria[]>({
    queryKey: ["/api/egresos/cuentas-bancarias"],
    queryFn: () => apiRequest("GET", "/api/egresos/cuentas-bancarias").then((r) => r.json()),
  });

  const histParams = new URLSearchParams({
    page: String(histPage),
    pageSize: "20",
    ...(histFiltros.desde && { desde: histFiltros.desde }),
    ...(histFiltros.hasta && { hasta: histFiltros.hasta }),
    ...(histFiltros.categoriaId && histFiltros.categoriaId !== "__all__" && { categoriaId: histFiltros.categoriaId }),
    ...(histFiltros.moneda && histFiltros.moneda !== "__all__" && { moneda: histFiltros.moneda }),
    ...(histFiltros.search && { search: histFiltros.search }),
  });

  const histQuery = useQuery<{
    data: EgresoRegistro[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ["/api/egresos/registros", histFiltros, histPage],
    queryFn: () =>
      apiRequest("GET", `/api/egresos/registros?${histParams}`).then((r) => r.json()),
  });

  // ── Mutations ──
  const invalidarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/egresos/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/egresos/fijos"] });
    queryClient.invalidateQueries({ queryKey: ["/api/egresos/alertas-vencimiento"] });
    queryClient.invalidateQueries({ queryKey: ["/api/egresos/registros"] });
    queryClient.invalidateQueries({ queryKey: ["/api/egresos/categorias"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
  };

  const crearFijoMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/egresos/fijos", data),
    onSuccess: () => { invalidarTodo(); setFijoModal({ open: false }); toast({ title: "Gasto fijo creado" }); },
    onError: () => toast({ title: "Error al crear gasto fijo", variant: "destructive" }),
  });

  const editarFijoMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/egresos/fijos/${id}`, data),
    onSuccess: () => { invalidarTodo(); setFijoModal({ open: false }); toast({ title: "Gasto fijo actualizado" }); },
    onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
  });

  const eliminarFijoMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/egresos/fijos/${id}`),
    onSuccess: () => { invalidarTodo(); toast({ title: "Gasto fijo eliminado" }); },
  });

  const toggleFijoMut = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/egresos/fijos/${id}/toggle`),
    onSuccess: () => invalidarTodo(),
  });

  const registrarPagoMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("POST", `/api/egresos/fijos/${id}/registrar-pago`, data),
    onSuccess: (_, vars) => {
      invalidarTodo();
      setPagoSheet({ open: false });
      toast({ title: "Pago registrado correctamente" });
    },
    onError: () => toast({ title: "Error al registrar pago", variant: "destructive" }),
  });

  const crearVariableMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/egresos/registros", data),
    onSuccess: () => { invalidarTodo(); toast({ title: "Gasto registrado" }); variableForm.reset({ moneda: "DOP", metodoPago: "transferencia", fecha: new Date().toISOString().split("T")[0] }); },
    onError: () => toast({ title: "Error al registrar gasto", variant: "destructive" }),
  });

  const eliminarRegistroMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/egresos/registros/${id}`),
    onSuccess: () => { invalidarTodo(); toast({ title: "Registro eliminado" }); },
  });

  // ── Forms ──
  const fijoForm = useForm<z.infer<typeof fijoSchema>>({
    resolver: zodResolver(fijoSchema),
    defaultValues: { moneda: "DOP", frecuencia: "mensual", alertDiasPrevios: 3, metodoPago: "transferencia" },
  });

  const pagoForm = useForm<z.infer<typeof pagoSchema>>({
    resolver: zodResolver(pagoSchema),
    defaultValues: { metodoPago: "transferencia", fecha: new Date().toISOString().split("T")[0] },
  });

  const variableForm = useForm<z.infer<typeof variableSchema>>({
    resolver: zodResolver(variableSchema),
    defaultValues: {
      moneda: "DOP",
      metodoPago: "transferencia",
      fecha: new Date().toISOString().split("T")[0],
    },
  });

  const handleOpenFijo = (fijo?: EgresoFijo) => {
    if (fijo) {
      fijoForm.reset({
        nombre: fijo.nombre,
        categoriaId: fijo.categoriaId ?? undefined,
        monto: fijo.monto,
        moneda: fijo.moneda as "DOP" | "USD",
        frecuencia: fijo.frecuencia,
        fechaInicio: fijo.fechaInicio?.split("T")[0],
        fechaFin: fijo.fechaFin?.split("T")[0] ?? undefined,
        cuentaBancariaId: fijo.cuentaBancariaId ?? undefined,
        metodoPago: fijo.metodoPago,
        alertDiasPrevios: fijo.alertDiasPrevios,
        notas: fijo.notas ?? undefined,
      });
    } else {
      fijoForm.reset({ moneda: "DOP", frecuencia: "mensual", alertDiasPrevios: 3, metodoPago: "transferencia" });
    }
    setFijoModal({ open: true, editando: fijo });
  };

  const cleanSentinel = (v: string | undefined | null) =>
    !v || v === "__none__" || v === "__all__" ? null : v;

  const handleSubmitFijo = fijoForm.handleSubmit((data) => {
    const payload = {
      ...data,
      categoriaId: cleanSentinel(data.categoriaId),
      cuentaBancariaId: cleanSentinel(data.cuentaBancariaId),
      fechaFin: data.fechaFin || null,
    };
    if (fijoModal.editando) {
      editarFijoMut.mutate({ id: fijoModal.editando.id, data: payload });
    } else {
      crearFijoMut.mutate(payload);
    }
  });

  const handleSubmitPago = pagoForm.handleSubmit((data) => {
    if (!pagoSheet.fijo) return;
    registrarPagoMut.mutate({
      id: pagoSheet.fijo.id,
      data: {
        ...data,
        cuentaBancariaId: cleanSentinel(data.cuentaBancariaId),
      },
    });
  });

  const handleOpenPago = (fijo: EgresoFijo) => {
    pagoForm.reset({
      monto: fijo.monto,
      metodoPago: fijo.metodoPago,
      cuentaBancariaId: fijo.cuentaBancariaId ?? undefined,
      fecha: new Date().toISOString().split("T")[0],
    });
    setPagoSheet({ open: true, fijo });
  };

  const handleExportCSV = () => {
    if (!histQuery.data?.data) return;
    const rows = histQuery.data.data;
    const header = ["Fecha", "Descripción", "Categoría", "Gasto Fijo", "Monto", "Moneda", "Método de pago", "Parcial"];
    const lines = rows.map((r) =>
      [
        formatDate(r.fecha),
        r.descripcion,
        r.categoriaNombre ?? "",
        r.fijoNombre ?? "",
        r.monto,
        r.moneda,
        r.metodoPago,
        r.esParcial ? "Sí" : "No",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `egresos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dash = dashQuery.data;
  const categorias = categoriasQuery.data ?? [];
  const fijos = fijosQuery.data ?? [];
  const alertas = alertasQuery.data ?? [];
  const cuentas = cuentasQuery.data ?? [];
  const hist = histQuery.data;

  // ────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TrendingDown className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-egresos-title">Egresos</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="tabs-egresos">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="fijos" data-testid="tab-fijos">Gastos Fijos</TabsTrigger>
          <TabsTrigger value="variables" data-testid="tab-variables">Variables</TabsTrigger>
          <TabsTrigger value="historial" data-testid="tab-historial">Historial</TabsTrigger>
          <TabsTrigger value="categorias" data-testid="tab-categorias">Categorías</TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD ── */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {dashQuery.isLoading ? (
            <div className="text-muted-foreground">Cargando...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total del Mes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold" data-testid="text-total-mes">{formatCurrency(dash?.totalMes)}</p>
                    <p className={`text-xs mt-1 ${(dash?.variacionPct ?? 0) > 0 ? "text-destructive" : "text-primary"}`}>
                      {(dash?.variacionPct ?? 0) > 0 ? "+" : ""}{dash?.variacionPct ?? 0}% vs mes anterior
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total del Año</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold" data-testid="text-total-anio">{formatCurrency(dash?.totalAnio)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Tasa Diaria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(dash?.tasaDiaria)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Promedio diario este mes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Fijos Activos/Mes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(dash?.gastoFijosActivosMensual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Compromisos recurrentes</p>
                  </CardContent>
                </Card>
              </div>

              {alertas.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-4 h-4" />
                      Alertas de vencimiento ({alertas.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {alertas.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            {estadoBadge(a.estado)}
                            <span className="font-medium text-sm">{a.nombre}</span>
                            {a.categoriaNombre && (
                              <span className="text-xs text-muted-foreground">{a.categoriaNombre}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{formatCurrency(a.monto)} {a.moneda}</span>
                            {a.proximaFecha && (
                              <span className="text-xs text-muted-foreground">{formatDate(a.proximaFecha)}</span>
                            )}
                            <Button size="sm" onClick={() => { setTab("fijos"); handleOpenPago(a); }} data-testid={`button-pagar-alerta-${a.id}`}>
                              Pagar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Distribución por Categoría</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(dash?.gastoPorCategoria?.length ?? 0) === 0 ? (
                      <div className="text-muted-foreground text-sm text-center py-6">Sin datos este mes</div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={dash?.gastoPorCategoria}
                              dataKey="total"
                              nameKey="nombre"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                            >
                              {dash?.gastoPorCategoria.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="w-full space-y-1">
                          {dash?.gastoPorCategoria.map((c) => (
                            <div key={c.categoriaId} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm" style={{ background: c.color }} />
                                <span className="text-muted-foreground">{c.nombre}</span>
                              </div>
                              <span className="font-medium">{formatCurrency(c.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Tendencia (6 meses)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={dash?.tendencia} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Egresos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── GASTOS FIJOS ── */}
        <TabsContent value="fijos" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{fijos.length} gasto{fijos.length !== 1 ? "s" : ""} fijo{fijos.length !== 1 ? "s" : ""}</p>
            <Button onClick={() => handleOpenFijo()} data-testid="button-nuevo-fijo">
              <Plus className="w-4 h-4 mr-2" />Nuevo gasto fijo
            </Button>
          </div>

          {fijosQuery.isLoading ? (
            <div className="text-muted-foreground">Cargando...</div>
          ) : fijos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay gastos fijos registrados. Agrega el primero.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {fijos.map((f) => (
                <Card key={f.id} className={!f.isActive ? "opacity-60" : ""} data-testid={`card-fijo-${f.id}`}>
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center gap-4 justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {f.categoriaColor && (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: f.categoriaColor }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{f.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.categoriaNombre ?? "Sin categoría"} · {FRECUENCIAS.find((fr) => fr.value === f.frecuencia)?.label}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {estadoBadge(f.estado)}
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(f.monto)} {f.moneda !== "DOP" ? f.moneda : ""}</p>
                          {f.proximaFecha && (
                            <p className="text-xs text-muted-foreground">Vence {formatDate(f.proximaFecha)}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenPago(f)}
                            disabled={!f.isActive}
                            title="Registrar pago"
                            data-testid={`button-pagar-${f.id}`}
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenFijo(f)}
                            title="Editar"
                            data-testid={`button-editar-fijo-${f.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleFijoMut.mutate(f.id)}
                            title={f.isActive ? "Desactivar" : "Activar"}
                            data-testid={`button-toggle-fijo-${f.id}`}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("¿Eliminar este gasto fijo?")) eliminarFijoMut.mutate(f.id);
                            }}
                            title="Eliminar"
                            data-testid={`button-eliminar-fijo-${f.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {f.estado === "parcial" && (
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.min(100, (parseFloat(f.totalPagadoCiclo) / parseFloat(f.monto)) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── VARIABLES ── */}
        <TabsContent value="variables" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar gasto variable</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...variableForm}>
                <form
                  onSubmit={variableForm.handleSubmit((data) =>
                    crearVariableMut.mutate({
                      ...data,
                      categoriaId: data.categoriaId,
                      cuentaBancariaId: cleanSentinel(data.cuentaBancariaId),
                      fecha: data.fecha,
                    })
                  )}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  <FormField
                    control={variableForm.control}
                    name="categoriaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-categoria-variable">
                              <SelectValue placeholder="Selecciona categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categorias.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variableForm.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Compra de repuestos" {...field} data-testid="input-descripcion-variable" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variableForm.control}
                    name="monto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-monto-variable" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variableForm.control}
                    name="moneda"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moneda</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-moneda-variable">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="DOP">DOP (RD$)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variableForm.control}
                    name="fecha"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-fecha-variable" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variableForm.control}
                    name="metodoPago"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método de pago</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-metodo-variable">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {METODOS_PAGO.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variableForm.control}
                    name="cuentaBancariaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cuenta bancaria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-cuenta-variable">
                              <SelectValue placeholder="Sin cuenta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Sin cuenta</SelectItem>
                            {cuentas.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variableForm.control}
                    name="notas"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Notas</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Observaciones opcionales..." {...field} data-testid="input-notas-variable" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="sm:col-span-full flex justify-end">
                    <Button type="submit" disabled={crearVariableMut.isPending} data-testid="button-guardar-variable">
                      {crearVariableMut.isPending ? "Guardando..." : "Registrar gasto"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── HISTORIAL ── */}
        <TabsContent value="historial" className="space-y-4 mt-4">
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Input
                  type="date"
                  placeholder="Desde"
                  value={histFiltros.desde}
                  onChange={(e) => { setHistFiltros((p) => ({ ...p, desde: e.target.value })); setHistPage(1); }}
                  data-testid="input-hist-desde"
                />
                <Input
                  type="date"
                  placeholder="Hasta"
                  value={histFiltros.hasta}
                  onChange={(e) => { setHistFiltros((p) => ({ ...p, hasta: e.target.value })); setHistPage(1); }}
                  data-testid="input-hist-hasta"
                />
                <Select
                  value={histFiltros.categoriaId || "__all__"}
                  onValueChange={(v) => { setHistFiltros((p) => ({ ...p, categoriaId: v === "__all__" ? "" : v })); setHistPage(1); }}
                >
                  <SelectTrigger data-testid="select-hist-categoria">
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas las categorías</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={histFiltros.moneda || "__all__"}
                  onValueChange={(v) => { setHistFiltros((p) => ({ ...p, moneda: v === "__all__" ? "" : v })); setHistPage(1); }}
                >
                  <SelectTrigger data-testid="select-hist-moneda">
                    <SelectValue placeholder="Moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    <SelectItem value="DOP">DOP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Buscar descripción..."
                  value={histFiltros.search}
                  onChange={(e) => { setHistFiltros((p) => ({ ...p, search: e.target.value })); setHistPage(1); }}
                  data-testid="input-hist-search"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {hist ? `${hist.total} registro${hist.total !== 1 ? "s" : ""}` : "Cargando..."}
            </p>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!hist?.data.length} data-testid="button-exportar-csv">
              <Download className="w-4 h-4 mr-2" />Exportar CSV
            </Button>
          </div>

          {histQuery.isLoading ? (
            <div className="text-muted-foreground">Cargando...</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descripción</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">Categoría</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Monto</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Método</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(hist?.data ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          No hay registros con los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      hist?.data.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover-elevate" data-testid={`row-registro-${r.id}`}>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{formatDate(r.fecha)}</td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{r.descripcion}</p>
                              {r.fijoNombre && (
                                <p className="text-xs text-muted-foreground">Fijo: {r.fijoNombre}</p>
                              )}
                              {r.esParcial && <Badge variant="secondary" className="text-xs mt-0.5">Parcial</Badge>}
                            </div>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            {r.categoriaNombre ? (
                              <div className="flex items-center gap-2">
                                {r.categoriaColor && (
                                  <span className="w-2 h-2 rounded-full" style={{ background: r.categoriaColor }} />
                                )}
                                <span className="text-muted-foreground">{r.categoriaNombre}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-medium whitespace-nowrap">
                            {formatCurrency(r.monto)} {r.moneda !== "DOP" ? r.moneda : ""}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground hidden md:table-cell capitalize">
                            {METODOS_PAGO.find((m) => m.value === r.metodoPago)?.label ?? r.metodoPago}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!r.fijoId && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm("¿Eliminar este registro?")) eliminarRegistroMut.mutate(r.id);
                                }}
                                data-testid={`button-eliminar-registro-${r.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {hist && hist.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                disabled={histPage === 1}
                data-testid="button-hist-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {histPage} de {hist.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistPage((p) => Math.min(hist.totalPages, p + 1))}
                disabled={histPage >= hist.totalPages}
                data-testid="button-hist-next"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── CATEGORÍAS ── */}
        <TabsContent value="categorias" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{categorias.length} categorías</p>
            <Button onClick={() => setCatModal(true)} data-testid="button-nueva-categoria">
              <Plus className="w-4 h-4 mr-2" />Nueva categoría
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorias.map((c) => (
              <Card key={c.id} data-testid={`card-categoria-${c.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                      <div>
                        <p className="font-medium text-sm">{c.nombre}</p>
                        {c.presupuestoMensual && (
                          <p className="text-xs text-muted-foreground">
                            Presupuesto: {formatCurrency(c.presupuestoMensual)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="text-right mr-2">
                        <p className="text-sm font-semibold">{formatCurrency(c.gastoDelMes)}</p>
                        <p className="text-xs text-muted-foreground">este mes</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setCatModal({ open: true, editando: c })}
                        data-testid={`button-editar-categoria-${c.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`¿Eliminar categoría "${c.nombre}"? Los registros quedarán sin categoría.`)) {
                            apiRequest("DELETE", `/api/egresos/categorias/${c.id}`)
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/egresos/categorias"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/egresos/dashboard"] });
                                toast({ title: "Categoría eliminada" });
                              })
                              .catch(() => toast({ title: "Error al eliminar categoría", variant: "destructive" }));
                          }
                        }}
                        data-testid={`button-eliminar-categoria-${c.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {c.presupuestoMensual && parseFloat(c.presupuestoMensual) > 0 && (
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (c.gastoDelMes / parseFloat(c.presupuestoMensual)) * 100)}%`,
                          background: c.gastoDelMes > parseFloat(c.presupuestoMensual) ? "hsl(var(--destructive))" : c.color,
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── MODAL GASTO FIJO ── */}
      <Dialog open={fijoModal.open} onOpenChange={(o) => !o && setFijoModal({ open: false })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{fijoModal.editando ? "Editar gasto fijo" : "Nuevo gasto fijo"}</DialogTitle>
          </DialogHeader>
          <Form {...fijoForm}>
            <form onSubmit={handleSubmitFijo} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={fijoForm.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Renta local Centro Comercial" {...field} data-testid="input-nombre-fijo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="categoriaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-categoria-fijo">
                          <SelectValue placeholder="Sin categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin categoría</SelectItem>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="frecuencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frecuencia *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-frecuencia-fijo">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FRECUENCIAS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="monto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-monto-fijo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="moneda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-moneda-fijo">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DOP">DOP (RD$)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="fechaInicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha inicio *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-fecha-inicio-fijo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="fechaFin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha fin (opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-fecha-fin-fijo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="metodoPago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de pago</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-metodo-fijo">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METODOS_PAGO.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="cuentaBancariaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta bancaria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cuenta-fijo">
                          <SelectValue placeholder="Sin cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin cuenta</SelectItem>
                        {cuentas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="alertDiasPrevios"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días de alerta previos</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-alert-dias"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fijoForm.control}
                name="notas"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observaciones..." {...field} data-testid="input-notas-fijo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setFijoModal({ open: false })}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={crearFijoMut.isPending || editarFijoMut.isPending}
                  data-testid="button-guardar-fijo"
                >
                  {crearFijoMut.isPending || editarFijoMut.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── SHEET REGISTRAR PAGO ── */}
      <Sheet open={pagoSheet.open} onOpenChange={(o) => !o && setPagoSheet({ open: false })}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Registrar pago — {pagoSheet.fijo?.nombre}</SheetTitle>
          </SheetHeader>

          {pagoSheet.fijo && (
            <div className="mt-4 p-3 bg-muted/40 rounded-md text-sm space-y-1">
              <p className="text-muted-foreground">Monto del ciclo: <span className="font-medium text-foreground">{formatCurrency(pagoSheet.fijo.monto)} {pagoSheet.fijo.moneda}</span></p>
              {parseFloat(pagoSheet.fijo.totalPagadoCiclo) > 0 && (
                <p className="text-muted-foreground">Ya pagado: <span className="font-medium text-foreground">{formatCurrency(pagoSheet.fijo.totalPagadoCiclo)}</span></p>
              )}
            </div>
          )}

          <Form {...pagoForm}>
            <form onSubmit={handleSubmitPago} className="mt-6 space-y-4">
              <FormField
                control={pagoForm.control}
                name="monto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto a pagar *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-monto-pago" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pagoForm.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de pago</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-fecha-pago" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pagoForm.control}
                name="metodoPago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de pago</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-metodo-pago">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METODOS_PAGO.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pagoForm.control}
                name="cuentaBancariaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta bancaria (descuenta saldo)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cuenta-pago">
                          <SelectValue placeholder="Sin cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin cuenta</SelectItem>
                        {cuentas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre} ({formatCurrency(c.saldo)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pagoForm.control}
                name="notas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observaciones..." {...field} data-testid="input-notas-pago" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SheetFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setPagoSheet({ open: false })}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={registrarPagoMut.isPending} data-testid="button-confirmar-pago">
                  {registrarPagoMut.isPending ? "Registrando..." : "Confirmar pago"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* ── MODAL CATEGORÍA (crear / editar) ── */}
      <CategoriaModal
        open={catModal.open}
        editando={catModal.editando}
        onClose={() => setCatModal({ open: false })}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/egresos/categorias"] });
          queryClient.invalidateQueries({ queryKey: ["/api/egresos/dashboard"] });
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────
// MODAL CATEGORÍA
// ────────────────────────────────────────────────

const catSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  color: z.string().default("#E84545"),
  presupuestoMensual: z.string().optional(),
});

function CategoriaModal({
  open,
  editando,
  onClose,
  onSuccess,
}: {
  open: boolean;
  editando?: EgresoCategoria | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof catSchema>>({
    resolver: zodResolver(catSchema),
    defaultValues: { color: "#E84545" },
  });

  useEffect(() => {
    if (open && editando) {
      form.reset({
        nombre: editando.nombre,
        color: editando.color ?? "#E84545",
        presupuestoMensual: editando.presupuestoMensual ?? undefined,
      });
    } else if (open && !editando) {
      form.reset({ color: "#E84545" });
    }
  }, [open, editando]);

  const crearMut = useMutation({
    mutationFn: (data: z.infer<typeof catSchema>) => apiRequest("POST", "/api/egresos/categorias", data),
    onSuccess: () => {
      onSuccess();
      onClose();
      form.reset({ color: "#E84545" });
      toast({ title: "Categoría creada" });
    },
    onError: () => toast({ title: "Error al crear categoría", variant: "destructive" }),
  });

  const editarMut = useMutation({
    mutationFn: (data: z.infer<typeof catSchema>) =>
      apiRequest("PUT", `/api/egresos/categorias/${editando!.id}`, data),
    onSuccess: () => {
      onSuccess();
      onClose();
      toast({ title: "Categoría actualizada" });
    },
    onError: () => toast({ title: "Error al actualizar categoría", variant: "destructive" }),
  });

  const isPending = crearMut.isPending || editarMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => editando ? editarMut.mutate(d) : crearMut.mutate(d))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Servicios contables" {...field} data-testid="input-nombre-categoria" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        {...field}
                        className="h-9 w-14 rounded border cursor-pointer"
                        data-testid="input-color-categoria"
                      />
                      <span className="text-sm text-muted-foreground">{field.value}</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="presupuestoMensual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Presupuesto mensual (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      data-testid="input-presupuesto-categoria"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-guardar-categoria">
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
