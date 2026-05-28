import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import {
  FileText, CreditCard, RefreshCw, AlertCircle, Plus, Search,
  Edit2, Trash2, Eye, Check, X, ChevronDown, Building2, Landmark,
  Calendar, DollarSign, Clock, CheckCircle2, XCircle, TrendingDown,
  SplitSquareHorizontal, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Supplier { id: string; name: string; }
interface BankAccount { id: string; name: string; currency: string; }
interface Invoice {
  id: string; invoiceNumber: string; description: string; supplierId: string | null;
  supplierName: string | null; subtotal: string; discountAmount: string; taxAmount: string;
  withholdingAmount: string; totalAmount: string; paidAmount: string; currency: string;
  ncfType: string | null; ncfNumber: string | null; issueDate: string; dueDate: string | null;
  status: string; attachmentUrl: string | null; notes: string | null; createdAt: string;
  items?: InvoiceItem[]; payments?: Payment[]; allocatedPayments?: any[];
}
interface InvoiceItem { id: string; description: string; quantity: string; unitPrice: string; amount: string; }
interface Payment {
  id: string; invoiceId: string | null; supplierId: string | null; recurringId: string | null;
  invoiceNumber?: string; supplierName?: string; bankAccountId: string | null;
  bankAccountName?: string; amount: string; currency: string; paymentDate: string;
  reference: string | null; notes: string | null; createdAt: string;
  allocations?: { invoiceId: string; invoiceNumber: string; allocatedAmount: string }[];
}
interface RecurringPayment {
  id: string; supplierId: string | null; supplierName?: string; description: string;
  amount: string; currency: string; frecuencia: string; proximaFecha: string | null;
  alertDiasPrevios: number; bankAccountId: string | null; bankAccountName?: string;
  isActive: boolean; notes: string | null; estado?: string;
}
interface DebitNote {
  id: string; invoiceId: string | null; invoiceNumber?: string; supplierId: string | null;
  supplierName?: string; noteNumber: string; reason: string; amount: string; currency: string;
  date: string; status: string; notes: string | null; items?: DebitNoteItem[];
}
interface DebitNoteItem { id: string; description: string; amount: string; }

// ─── Schemas ─────────────────────────────────────────────────────────────────
const SENTINEL = "__none__";
const clean = (v: string | null | undefined): string | null =>
  !v || v === SENTINEL ? null : v;

const NCF_TYPES = [
  { value: "B01", label: "B01 - Crédito Fiscal" },
  { value: "B02", label: "B02 - Consumidor Final" },
  { value: "B03", label: "B03 - Nota de Débito" },
  { value: "B04", label: "B04 - Nota de Crédito" },
  { value: "B14", label: "B14 - Gubernamental" },
  { value: "B15", label: "B15 - Régimen Especial" },
  { value: "B16", label: "B16 - Proveedores Informales" },
  { value: "E31", label: "E31 - Factura de Crédito Fiscal Electrónica" },
  { value: "E32", label: "E32 - Factura de Consumo Electrónica" },
  { value: "E33", label: "E33 - Nota de Débito Electrónica" },
  { value: "E34", label: "E34 - Nota de Crédito Electrónica" },
];

const INVOICE_STATUSES = [
  { value: "borrador", label: "Borrador" },
  { value: "recibida", label: "Recibida" },
  { value: "aprobada", label: "Aprobada" },
  { value: "pendiente", label: "Pendiente" },
  { value: "parcial", label: "Pago Parcial" },
  { value: "pagada", label: "Pagada" },
  { value: "vencida", label: "Vencida" },
  { value: "anulada", label: "Anulada" },
];

const invoiceFormSchema = z.object({
  supplierId: z.string().optional(),
  orderId: z.string().optional(),
  invoiceNumber: z.string().min(1, "Número de factura requerido"),
  description: z.string().min(1, "Descripción requerida"),
  subtotal: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  withholdingAmount: z.coerce.number().min(0).default(0),
  totalAmount: z.coerce.number().min(0.01, "Monto total requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  ncfType: z.string().optional(),
  ncfNumber: z.string().optional(),
  issueDate: z.string().min(1, "Fecha requerida"),
  dueDate: z.string().optional(),
  status: z.enum(["borrador", "recibida", "aprobada", "pendiente", "parcial", "pagada", "vencida", "anulada"]).default("borrador"),
  notes: z.string().optional(),
});
type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

const paymentFormSchema = z.object({
  supplierId: z.string().optional(),
  bankAccountId: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  paymentDate: z.string().min(1, "Fecha requerida"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  // Modo simple
  invoiceId: z.string().optional(),
  // Modo multi-factura
  allocations: z.array(z.object({
    invoiceId: z.string(),
    allocatedAmount: z.coerce.number().min(0),
    selected: z.boolean().default(false),
  })).optional().default([]),
});
type PaymentFormData = z.infer<typeof paymentFormSchema>;

const recurringFormSchema = z.object({
  supplierId: z.string().optional(),
  description: z.string().min(1, "Descripción requerida"),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  frecuencia: z.enum(["diario", "semanal", "quincenal", "mensual", "bimestral", "trimestral", "semestral", "anual"]).default("mensual"),
  proximaFecha: z.string().optional(),
  alertDiasPrevios: z.coerce.number().min(0).max(60).default(5),
  bankAccountId: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});
type RecurringFormData = z.infer<typeof recurringFormSchema>;

const DEBIT_NOTE_REASONS = [
  { value: "devolucion", label: "Devolución" },
  { value: "descuento", label: "Descuento" },
  { value: "correccion_error", label: "Corrección de Error" },
  { value: "ajuste_precio", label: "Ajuste de Precio" },
];

const debitNoteFormSchema = z.object({
  invoiceId: z.string().optional(),
  supplierId: z.string().optional(),
  noteNumber: z.string().min(1, "Número de nota requerido"),
  reason: z.enum(["devolucion", "descuento", "correccion_error", "ajuste_precio"], {
    errorMap: () => ({ message: "Seleccione un motivo" }),
  }),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  date: z.string().min(1, "Fecha requerida"),
  status: z.enum(["pendiente", "aplicada", "anulada"]).default("pendiente"),
  notes: z.string().optional(),
});
type DebitNoteFormData = z.infer<typeof debitNoteFormSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    borrador:  { label: "Borrador",  cls: "bg-muted text-muted-foreground" },
    recibida:  { label: "Recibida",  cls: "bg-muted text-muted-foreground" },
    aprobada:  { label: "Aprobada",  cls: "bg-primary/10 text-primary" },
    pendiente: { label: "Pendiente", cls: "bg-muted text-muted-foreground" },
    parcial:   { label: "Parcial",   cls: "bg-primary/10 text-primary" },
    pagada:    { label: "Pagada",    cls: "bg-primary/10 text-primary" },
    vencida:   { label: "Vencida",   cls: "bg-destructive/10 text-destructive" },
    anulada:   { label: "Anulada",   cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? map.pendiente;
  return <Badge className={s.cls}>{s.label}</Badge>;
}

function EstadoBadge({ estado }: { estado: string | undefined }) {
  const map: Record<string, { label: string; cls: string }> = {
    al_dia:   { label: "Al día",  cls: "bg-primary/10 text-primary" },
    alerta:   { label: "Alerta",  cls: "bg-muted text-muted-foreground" },
    vencido:  { label: "Vencido", cls: "bg-destructive/10 text-destructive" },
    parcial:  { label: "Parcial", cls: "bg-primary/10 text-primary" },
    inactivo: { label: "Inactivo",cls: "bg-muted text-muted-foreground" },
  };
  const s = map[estado ?? "al_dia"] ?? map.al_dia;
  return <Badge className={s.cls}>{s.label}</Badge>;
}

const FRECUENCIA_LABELS: Record<string, string> = {
  diario: "Diario", semanal: "Semanal", quincenal: "Quincenal",
  mensual: "Mensual", bimestral: "Bimestral", trimestral: "Trimestral",
  semestral: "Semestral", anual: "Anual",
};

const PATH_TO_TAB: Record<string, string> = {
  "/compras/facturas": "facturas",
  "/compras/pagos": "pagos",
  "/compras/recurrentes": "recurrentes",
  "/compras/notas-debito": "notas-debito",
};
const TAB_TO_PATH: Record<string, string> = {
  "facturas": "/compras/facturas",
  "pagos": "/compras/pagos",
  "recurrentes": "/compras/recurrentes",
  "notas-debito": "/compras/notas-debito",
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function ComprasFinancieroPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [location, setLocation] = useLocation();
  const [tab, setTab] = useState(() => PATH_TO_TAB[location] ?? "facturas");

  // Sync tab when user navigates via browser back/forward or sidebar link
  useEffect(() => {
    const newTab = PATH_TO_TAB[location];
    if (newTab && newTab !== tab) setTab(newTab);
  }, [location]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [desdeFilter, setDesdeFilter] = useState("");
  const [hastaFilter, setHastaFilter] = useState("");
  const [paymentMode, setPaymentMode] = useState<"simple" | "multi">("simple");

  // ── Facturas state ──
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<Invoice | null>(null);
  const [anularInvoiceTarget, setAnularInvoiceTarget] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<{ description: string; quantity: number; unitPrice: number; amount: number }[]>([]);

  // ── Pagos state ──
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<Payment | null>(null);

  // ── Recurrentes state ──
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringPayment | null>(null);
  const [deleteRecurringTarget, setDeleteRecurringTarget] = useState<RecurringPayment | null>(null);
  const [pagarRecurringTarget, setPagarRecurringTarget] = useState<RecurringPayment | null>(null);

  // ── Notas Débito state ──
  const [debitNoteDialogOpen, setDebitNoteDialogOpen] = useState(false);
  const [editingDebitNote, setEditingDebitNote] = useState<DebitNote | null>(null);
  const [deleteDebitNoteTarget, setDeleteDebitNoteTarget] = useState<DebitNote | null>(null);
  const [debitNoteItems, setDebitNoteItems] = useState<{ description: string; amount: number }[]>([]);

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/purchases/fin/facturas"],
    queryFn: () => apiRequest("GET", "/api/purchases/fin/facturas").then(r => r.json()),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/purchases/fin/facturas/stats"],
    queryFn: () => apiRequest("GET", "/api/purchases/fin/facturas/stats").then(r => r.json()),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/purchases/fin/pagos"],
    queryFn: () => apiRequest("GET", "/api/purchases/fin/pagos").then(r => r.json()),
  });

  const { data: recurrentes = [], isLoading: recurrentesLoading } = useQuery<RecurringPayment[]>({
    queryKey: ["/api/purchases/fin/recurrentes"],
    queryFn: () => apiRequest("GET", "/api/purchases/fin/recurrentes").then(r => r.json()),
  });

  const { data: debitNotes = [], isLoading: debitNotesLoading } = useQuery<DebitNote[]>({
    queryKey: ["/api/purchases/fin/notas-debito"],
    queryFn: () => apiRequest("GET", "/api/purchases/fin/notas-debito").then(r => r.json()),
  });

  const { data: proveedores = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/purchases/fin/proveedores"],
    queryFn: () => apiRequest("GET", "/api/purchases/fin/proveedores").then(r => r.json()),
  });

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: () => apiRequest("GET", "/api/bank-accounts").then(r => r.json()),
  });

  const { data: invoiceDetail } = useQuery<Invoice>({
    queryKey: ["/api/purchases/fin/facturas", viewingInvoice?.id],
    queryFn: () => apiRequest("GET", `/api/purchases/fin/facturas/${viewingInvoice!.id}`).then(r => r.json()),
    enabled: !!viewingInvoice?.id,
  });

  const { data: ordenesCompra = [] } = useQuery<{ id: string; orderNumber: string; supplierId: string; total: string | null; status: string }[]>({
    queryKey: ["/api/purchases/fin/ordenes"],
    queryFn: () => apiRequest("GET", "/api/purchases/fin/ordenes").then(r => r.json()),
  });

  const [importingOrder, setImportingOrder] = useState(false);
  const handleImportarOrden = async () => {
    const ordId = invoiceForm.getValues("orderId");
    if (!ordId || ordId === SENTINEL) return;
    setImportingOrder(true);
    try {
      const res = await apiRequest("GET", `/api/purchases/fin/ordenes/${ordId}/items`);
      const data = await res.json();
      const { orden, items } = data as { orden: { supplierId: string; total: string; subtotal: string; taxAmount: string }; items: { description: string; quantity: string; unitPrice: string; subtotal: string }[] };
      const desc = items.map(i => `${i.description} (x${i.quantity})`).join(", ");
      invoiceForm.setValue("supplierId", orden.supplierId ?? SENTINEL);
      invoiceForm.setValue("description", desc || invoiceForm.getValues("description"));
      invoiceForm.setValue("subtotal", parseFloat(orden.subtotal ?? "0"));
      invoiceForm.setValue("taxAmount", parseFloat(orden.taxAmount ?? "0"));
      invoiceForm.setValue("totalAmount", parseFloat(orden.total ?? "0"));
    } finally {
      setImportingOrder(false);
    }
  };

  // ─── Invoice form ────────────────────────────────────────────────────────────
  const invoiceForm = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      supplierId: SENTINEL, orderId: SENTINEL, invoiceNumber: "", description: "", subtotal: 0,
      discountAmount: 0, taxAmount: 0, withholdingAmount: 0, totalAmount: 0,
      currency: "DOP", ncfType: SENTINEL, ncfNumber: "", issueDate: today(),
      dueDate: "", status: "borrador", notes: "",
    },
  });
  const watchedOrderId = invoiceForm.watch("orderId");

  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      supplierId: SENTINEL, bankAccountId: SENTINEL, amount: 0, currency: "DOP",
      paymentDate: today(), reference: "", notes: "", invoiceId: SENTINEL, allocations: [],
    },
  });

  const recurringForm = useForm<RecurringFormData>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      supplierId: SENTINEL, description: "", amount: 0, currency: "DOP",
      frecuencia: "mensual", proximaFecha: "", alertDiasPrevios: 5,
      bankAccountId: SENTINEL, isActive: true, notes: "",
    },
  });

  const debitNoteForm = useForm<DebitNoteFormData>({
    resolver: zodResolver(debitNoteFormSchema),
    defaultValues: {
      invoiceId: SENTINEL, supplierId: SENTINEL, noteNumber: "", reason: "devolucion",
      amount: 0, currency: "DOP", date: today(), status: "pendiente", notes: "",
    },
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/facturas"] });
    queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/facturas/stats"] });
  };

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) =>
      apiRequest("POST", "/api/purchases/fin/facturas", {
        ...data,
        supplierId: clean(data.supplierId),
        ncfType: clean(data.ncfType),
        ncfNumber: data.ncfNumber || null,
        dueDate: data.dueDate || null,
        items: invoiceItems,
      }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Factura creada" });
      setInvoiceDialogOpen(false);
      invoiceForm.reset();
      setInvoiceItems([]);
    },
    onError: async (e: any) => {
      let msg = "No se pudo crear la factura";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) =>
      apiRequest("PATCH", `/api/purchases/fin/facturas/${editingInvoice!.id}`, {
        ...data,
        supplierId: clean(data.supplierId),
        ncfType: clean(data.ncfType),
        ncfNumber: data.ncfNumber || null,
        dueDate: data.dueDate || null,
      }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Factura actualizada" });
      setInvoiceDialogOpen(false);
      setEditingInvoice(null);
    },
    onError: async (e: any) => {
      let msg = "No se pudo actualizar";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/purchases/fin/facturas/${id}`),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Factura eliminada" });
      setDeleteInvoiceTarget(null);
    },
    onError: async (e: any) => {
      let msg = "No se pudo eliminar";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const anularInvoiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/purchases/fin/facturas/${id}/anular`),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Factura anulada" });
      setAnularInvoiceTarget(null);
    },
    onError: async (e: any) => {
      let msg = "No se pudo anular";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (body: Record<string, any>) =>
      apiRequest("POST", "/api/purchases/fin/pagos", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/pagos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/facturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/facturas/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Pago registrado" });
      setPaymentDialogOpen(false);
      paymentForm.reset();
    },
    onError: async (e: any) => {
      let msg = "No se pudo registrar el pago";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/purchases/fin/pagos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/pagos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/facturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/facturas/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Pago eliminado" });
      setDeletePaymentTarget(null);
    },
    onError: async (e: any) => {
      let msg = "No se pudo eliminar el pago";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: async (data: RecurringFormData) =>
      apiRequest("POST", "/api/purchases/fin/recurrentes", {
        ...data,
        supplierId: clean(data.supplierId),
        bankAccountId: clean(data.bankAccountId),
        proximaFecha: data.proximaFecha || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/recurrentes"] });
      toast({ title: "Pago recurrente creado" });
      setRecurringDialogOpen(false);
      recurringForm.reset();
    },
    onError: async (e: any) => {
      let msg = "No se pudo crear";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateRecurringMutation = useMutation({
    mutationFn: async (data: RecurringFormData) =>
      apiRequest("PATCH", `/api/purchases/fin/recurrentes/${editingRecurring!.id}`, {
        ...data,
        supplierId: clean(data.supplierId),
        bankAccountId: clean(data.bankAccountId),
        proximaFecha: data.proximaFecha || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/recurrentes"] });
      toast({ title: "Pago recurrente actualizado" });
      setRecurringDialogOpen(false);
      setEditingRecurring(null);
    },
    onError: async (e: any) => {
      let msg = "No se pudo actualizar";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/purchases/fin/recurrentes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/recurrentes"] });
      toast({ title: "Pago recurrente eliminado" });
      setDeleteRecurringTarget(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" }),
  });

  const registrarPagoRecurrenteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("POST", `/api/purchases/fin/recurrentes/${id}/registrar-pago`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/recurrentes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/pagos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Pago recurrente registrado" });
      setPagarRecurringTarget(null);
    },
    onError: async (e: any) => {
      let msg = "No se pudo registrar el pago";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const createDebitNoteMutation = useMutation({
    mutationFn: async (data: DebitNoteFormData) =>
      apiRequest("POST", "/api/purchases/fin/notas-debito", {
        ...data,
        invoiceId: clean(data.invoiceId),
        supplierId: clean(data.supplierId),
        items: debitNoteItems,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/notas-debito"] });
      toast({ title: "Nota de débito creada" });
      setDebitNoteDialogOpen(false);
      debitNoteForm.reset();
      setDebitNoteItems([]);
    },
    onError: async (e: any) => {
      let msg = "No se pudo crear la nota";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateDebitNoteMutation = useMutation({
    mutationFn: async (data: DebitNoteFormData) =>
      apiRequest("PATCH", `/api/purchases/fin/notas-debito/${editingDebitNote!.id}`, {
        ...data,
        invoiceId: clean(data.invoiceId),
        supplierId: clean(data.supplierId),
        items: debitNoteItems,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/notas-debito"] });
      toast({ title: "Nota actualizada" });
      setDebitNoteDialogOpen(false);
      setEditingDebitNote(null);
    },
    onError: async (e: any) => {
      let msg = "No se pudo actualizar";
      try { const j = await e.response?.json(); msg = j?.error ?? msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteDebitNoteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/purchases/fin/notas-debito/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/fin/notas-debito"] });
      toast({ title: "Nota eliminada" });
      setDeleteDebitNoteTarget(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" }),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const openNewInvoice = () => {
    setEditingInvoice(null);
    setInvoiceItems([]);
    invoiceForm.reset({
      supplierId: SENTINEL, orderId: SENTINEL, invoiceNumber: "", description: "", subtotal: 0,
      discountAmount: 0, taxAmount: 0, withholdingAmount: 0, totalAmount: 0,
      currency: "DOP", ncfType: SENTINEL, ncfNumber: "", issueDate: today(),
      dueDate: "", status: "borrador", notes: "",
    });
    setInvoiceDialogOpen(true);
  };

  const openEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    invoiceForm.reset({
      supplierId: inv.supplierId ?? SENTINEL,
      orderId: (inv as any).orderId ?? SENTINEL,
      invoiceNumber: inv.invoiceNumber,
      description: inv.description,
      subtotal: parseFloat(inv.subtotal),
      discountAmount: parseFloat(inv.discountAmount ?? "0"),
      taxAmount: parseFloat(inv.taxAmount),
      withholdingAmount: parseFloat(inv.withholdingAmount ?? "0"),
      totalAmount: parseFloat(inv.totalAmount),
      currency: inv.currency as any,
      ncfType: inv.ncfType ?? SENTINEL,
      ncfNumber: inv.ncfNumber ?? "",
      issueDate: inv.issueDate ? inv.issueDate.split("T")[0] : today(),
      dueDate: inv.dueDate ? inv.dueDate.split("T")[0] : "",
      status: inv.status as any,
      notes: inv.notes ?? "",
    });
    setInvoiceDialogOpen(true);
  };

  const openNewPaymentDialog = () => {
    setPaymentMode("simple");
    paymentForm.reset({
      supplierId: SENTINEL, bankAccountId: SENTINEL, amount: 0, currency: "DOP",
      paymentDate: today(), reference: "", notes: "", invoiceId: SENTINEL, allocations: [],
    });
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = (data: PaymentFormData) => {
    if (paymentMode === "simple") {
      createPaymentMutation.mutate({
        supplierId: clean(data.supplierId),
        bankAccountId: clean(data.bankAccountId),
        amount: data.amount,
        currency: data.currency,
        paymentDate: data.paymentDate,
        reference: data.reference || null,
        notes: data.notes || null,
        invoiceId: clean(data.invoiceId),
        allocations: [],
      });
    } else {
      const selectedAllocs = (data.allocations ?? []).filter(a => a.selected && a.allocatedAmount > 0);
      if (selectedAllocs.length === 0) {
        toast({ title: "Error", description: "Selecciona al menos una factura a pagar", variant: "destructive" });
        return;
      }
      createPaymentMutation.mutate({
        supplierId: clean(data.supplierId),
        bankAccountId: clean(data.bankAccountId),
        amount: data.amount,
        currency: data.currency,
        paymentDate: data.paymentDate,
        reference: data.reference || null,
        notes: data.notes || null,
        allocations: selectedAllocs.map(a => ({ invoiceId: a.invoiceId, allocatedAmount: a.allocatedAmount })),
      });
    }
  };

  const openNewRecurring = () => {
    setEditingRecurring(null);
    recurringForm.reset({
      supplierId: SENTINEL, description: "", amount: 0, currency: "DOP",
      frecuencia: "mensual", proximaFecha: "", alertDiasPrevios: 5,
      bankAccountId: SENTINEL, isActive: true, notes: "",
    });
    setRecurringDialogOpen(true);
  };

  const openEditRecurring = (r: RecurringPayment) => {
    setEditingRecurring(r);
    recurringForm.reset({
      supplierId: r.supplierId ?? SENTINEL,
      description: r.description,
      amount: parseFloat(r.amount),
      currency: r.currency as any,
      frecuencia: r.frecuencia as any,
      proximaFecha: r.proximaFecha ? r.proximaFecha.split("T")[0] : "",
      alertDiasPrevios: r.alertDiasPrevios,
      bankAccountId: r.bankAccountId ?? SENTINEL,
      isActive: r.isActive,
      notes: r.notes ?? "",
    });
    setRecurringDialogOpen(true);
  };

  const openNewDebitNote = () => {
    setEditingDebitNote(null);
    setDebitNoteItems([]);
    debitNoteForm.reset({
      invoiceId: SENTINEL, supplierId: SENTINEL, noteNumber: "", reason: "",
      amount: 0, currency: "DOP", date: today(), status: "pendiente", notes: "",
    });
    setDebitNoteDialogOpen(true);
  };

  const openEditDebitNote = (n: DebitNote) => {
    setEditingDebitNote(n);
    setDebitNoteItems(n.items?.map(i => ({ description: i.description, amount: parseFloat(i.amount) })) ?? []);
    debitNoteForm.reset({
      invoiceId: n.invoiceId ?? SENTINEL,
      supplierId: n.supplierId ?? SENTINEL,
      noteNumber: n.noteNumber,
      reason: n.reason,
      amount: parseFloat(n.amount),
      currency: n.currency as any,
      date: n.date ? n.date.split("T")[0] : today(),
      status: n.status as any,
      notes: n.notes ?? "",
    });
    setDebitNoteDialogOpen(true);
  };

  const addInvoiceItem = () =>
    setInvoiceItems(prev => [...prev, { description: "", quantity: 1, unitPrice: 0, amount: 0 }]);

  const updateInvoiceItem = (idx: number, field: string, value: string | number) => {
    setInvoiceItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        next[idx].amount = next[idx].quantity * next[idx].unitPrice;
      }
      return next;
    });
  };

  const removeInvoiceItem = (idx: number) =>
    setInvoiceItems(prev => prev.filter((_, i) => i !== idx));

  // Facturas pendientes de pago para modo multi-factura
  const openInvoicesForPayment = invoices.filter(i =>
    i.status !== "pagada" && i.status !== "anulada" &&
    parseFloat(i.totalAmount) - parseFloat(i.paidAmount) > 0
  );

  // Filtered data
  const filteredInvoices = invoices.filter(inv => {
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchSupplier = supplierFilter === "all" || inv.supplierId === supplierFilter;
    const matchSearch = !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.description.toLowerCase().includes(search.toLowerCase()) ||
      (inv.supplierName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchDesde = !desdeFilter || new Date(inv.issueDate) >= new Date(desdeFilter);
    const matchHasta = !hastaFilter || new Date(inv.issueDate) <= new Date(hastaFilter);
    return matchStatus && matchSupplier && matchSearch && matchDesde && matchHasta;
  });

  const filteredPayments = payments.filter(p => {
    const matchSupplier = supplierFilter === "all" || p.supplierId === supplierFilter;
    const matchBank = bankFilter === "all" || p.bankAccountId === bankFilter;
    const matchDesde = !desdeFilter || new Date(p.paymentDate) >= new Date(desdeFilter);
    const matchHasta = !hastaFilter || new Date(p.paymentDate) <= new Date(hastaFilter);
    const matchSearch = !search ||
      (p.invoiceNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.supplierName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? "").toLowerCase().includes(search.toLowerCase());
    return matchSupplier && matchBank && matchDesde && matchHasta && matchSearch;
  });

  const filteredRecurrentes = recurrentes.filter(r =>
    (supplierFilter === "all" || r.supplierId === supplierFilter) &&
    (!search ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      (r.supplierName ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDebitNotes = debitNotes.filter(n =>
    (supplierFilter === "all" || n.supplierId === supplierFilter) &&
    (!search ||
      n.noteNumber.toLowerCase().includes(search.toLowerCase()) ||
      n.reason.toLowerCase().includes(search.toLowerCase()) ||
      (n.supplierName ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Compras Financiero</h1>
          <p className="text-muted-foreground">Facturas de proveedores, pagos, recurrentes y notas de débito</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facturas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-facturas">{stats?.totalFacturas ?? 0}</div>
            <p className="text-xs text-muted-foreground">{(stats?.porStatus?.aprobada ?? 0) + (stats?.porStatus?.recibida ?? 0)} recibidas / aprobadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-monto">{formatCurrency(stats?.totalMonto ?? 0)}</div>
            <p className="text-xs text-muted-foreground">En facturas activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-pagado">{formatCurrency(stats?.totalPagado ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{stats?.porStatus?.pagada ?? 0} facturas pagadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Pagar</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-total-pendiente">{formatCurrency(stats?.totalPendiente ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{stats?.porStatus?.vencida ?? 0} vencidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setLocation(TAB_TO_PATH[v] ?? "/compras/facturas"); }} className="space-y-4">
        <TabsList data-testid="tabs-compras-fin">
          <TabsTrigger value="facturas" data-testid="tab-facturas"><FileText className="h-4 w-4 mr-2" />Facturas</TabsTrigger>
          <TabsTrigger value="pagos" data-testid="tab-pagos"><CreditCard className="h-4 w-4 mr-2" />Pagos</TabsTrigger>
          <TabsTrigger value="recurrentes" data-testid="tab-recurrentes"><RefreshCw className="h-4 w-4 mr-2" />Recurrentes</TabsTrigger>
          <TabsTrigger value="notas-debito" data-testid="tab-notas-debito"><AlertCircle className="h-4 w-4 mr-2" />Notas Débito</TabsTrigger>
        </TabsList>

        {/* ── FACTURAS ─────────────────────────────────────────────────────────── */}
        <TabsContent value="facturas" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 w-52" placeholder="Buscar facturas..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-facturas" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-facturas"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {INVOICE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-40" data-testid="select-supplier-facturas"><SelectValue placeholder="Proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {proveedores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" className="w-36" value={desdeFilter} onChange={e => setDesdeFilter(e.target.value)} title="Fecha desde" data-testid="input-desde-facturas" />
              <Input type="date" className="w-36" value={hastaFilter} onChange={e => setHastaFilter(e.target.value)} title="Fecha hasta" data-testid="input-hasta-facturas" />
            </div>
            {canCreate && (
              <Button onClick={openNewInvoice} data-testid="button-new-factura">
                <Plus className="h-4 w-4 mr-2" />Nueva Factura
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nro. Factura</TableHead>
                  <TableHead>NCF</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pagado</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicesLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay facturas</TableCell></TableRow>
                ) : filteredInvoices.map(inv => {
                  const balance = parseFloat(inv.totalAmount) - parseFloat(inv.paidAmount);
                  return (
                    <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{inv.ncfNumber ? `${inv.ncfType} ${inv.ncfNumber}` : "—"}</TableCell>
                      <TableCell>{inv.supplierName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{formatCurrency(parseFloat(inv.totalAmount))}</TableCell>
                      <TableCell>{formatCurrency(parseFloat(inv.paidAmount))}</TableCell>
                      <TableCell className={balance > 0 ? "text-destructive font-medium" : ""}>{balance > 0 ? formatCurrency(balance) : "—"}</TableCell>
                      <TableCell>{formatDate(inv.dueDate)}</TableCell>
                      <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewingInvoice(inv)} data-testid={`button-view-invoice-${inv.id}`}><Eye className="h-4 w-4" /></Button>
                          {canEdit && inv.status !== "anulada" && (
                            <Button variant="ghost" size="icon" onClick={() => openEditInvoice(inv)} data-testid={`button-edit-invoice-${inv.id}`}><Edit2 className="h-4 w-4" /></Button>
                          )}
                          {canDelete && parseFloat(inv.paidAmount) === 0 && inv.status !== "anulada" && (
                            <Button variant="ghost" size="icon" onClick={() => setAnularInvoiceTarget(inv)} data-testid={`button-anular-invoice-${inv.id}`}><XCircle className="h-4 w-4 text-destructive" /></Button>
                          )}
                          {canDelete && parseFloat(inv.paidAmount) === 0 && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteInvoiceTarget(inv)} data-testid={`button-delete-invoice-${inv.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── PAGOS ────────────────────────────────────────────────────────────── */}
        <TabsContent value="pagos" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 w-52" placeholder="Buscar pagos..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-pagos" />
              </div>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-40" data-testid="select-supplier-pagos"><SelectValue placeholder="Proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {proveedores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger className="w-40" data-testid="select-bank-pagos"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" className="w-36" value={desdeFilter} onChange={e => setDesdeFilter(e.target.value)} title="Fecha desde" data-testid="input-desde-pagos" />
              <Input type="date" className="w-36" value={hastaFilter} onChange={e => setHastaFilter(e.target.value)} title="Fecha hasta" data-testid="input-hasta-pagos" />
            </div>
            {canCreate && (
              <Button onClick={openNewPaymentDialog} data-testid="button-new-pago">
                <Plus className="h-4 w-4 mr-2" />Registrar Pago
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura / Asignación</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay pagos</TableCell></TableRow>
                ) : filteredPayments.map(p => (
                  <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                    <TableCell className="font-medium">
                      {p.invoiceId ? p.invoiceNumber ?? "—" : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <SplitSquareHorizontal className="h-3 w-3" />
                          {p.allocations && p.allocations.length > 0
                            ? p.allocations.map(a => a.invoiceNumber).join(", ")
                            : "Multi-factura"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{p.supplierName ?? "—"}</TableCell>
                    <TableCell>{p.bankAccountName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(p.amount))}</TableCell>
                    <TableCell>{formatDate(p.paymentDate)}</TableCell>
                    <TableCell>{p.reference ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => setDeletePaymentTarget(p)} data-testid={`button-delete-payment-${p.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── RECURRENTES ──────────────────────────────────────────────────────── */}
        <TabsContent value="recurrentes" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 w-64" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-recurrentes" />
            </div>
            {canCreate && (
              <Button onClick={openNewRecurring} data-testid="button-new-recurrente">
                <Plus className="h-4 w-4 mr-2" />Nuevo Recurrente
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Próxima Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurrentesLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filteredRecurrentes.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay pagos recurrentes</TableCell></TableRow>
                ) : filteredRecurrentes.map(r => (
                  <TableRow key={r.id} data-testid={`row-recurring-${r.id}`}>
                    <TableCell className="font-medium">{r.description}</TableCell>
                    <TableCell>{r.supplierName ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(r.amount))}</TableCell>
                    <TableCell>{FRECUENCIA_LABELS[r.frecuencia] ?? r.frecuencia}</TableCell>
                    <TableCell>{formatDate(r.proximaFecha)}</TableCell>
                    <TableCell><EstadoBadge estado={r.estado} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canCreate && r.isActive && (
                          <Button variant="ghost" size="icon" onClick={() => setPagarRecurringTarget(r)} title="Registrar pago del ciclo" data-testid={`button-pagar-recurring-${r.id}`}><Check className="h-4 w-4 text-primary" /></Button>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openEditRecurring(r)} data-testid={`button-edit-recurring-${r.id}`}><Edit2 className="h-4 w-4" /></Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteRecurringTarget(r)} data-testid={`button-delete-recurring-${r.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── NOTAS DE DÉBITO ──────────────────────────────────────────────────── */}
        <TabsContent value="notas-debito" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 w-52" placeholder="Buscar notas..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-notas" />
              </div>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-40" data-testid="select-supplier-notas"><SelectValue placeholder="Proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {proveedores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canCreate && (
              <Button onClick={openNewDebitNote} data-testid="button-new-nota">
                <Plus className="h-4 w-4 mr-2" />Nueva Nota
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nro. Nota</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Factura Ref.</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debitNotesLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filteredDebitNotes.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay notas de débito</TableCell></TableRow>
                ) : filteredDebitNotes.map(n => (
                  <TableRow key={n.id} data-testid={`row-debitnote-${n.id}`}>
                    <TableCell className="font-medium">{n.noteNumber}</TableCell>
                    <TableCell>{n.supplierName ?? "—"}</TableCell>
                    <TableCell>{n.invoiceNumber ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{n.reason}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(n.amount))}</TableCell>
                    <TableCell>{formatDate(n.date)}</TableCell>
                    <TableCell>
                      <Badge className={n.status === "aplicada" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                        {n.status === "pendiente" ? "Pendiente" : n.status === "aplicada" ? "Aplicada" : "Anulada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && n.status === "pendiente" && (
                          <Button variant="ghost" size="icon" onClick={() => openEditDebitNote(n)} data-testid={`button-edit-debitnote-${n.id}`}><Edit2 className="h-4 w-4" /></Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteDebitNoteTarget(n)} data-testid={`button-delete-debitnote-${n.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══ DIÁLOGO FACTURA ══════════════════════════════════════════════════════ */}
      <Dialog open={invoiceDialogOpen} onOpenChange={open => { setInvoiceDialogOpen(open); if (!open) { setEditingInvoice(null); setInvoiceItems([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? "Editar Factura" : "Nueva Factura de Proveedor"}</DialogTitle>
          </DialogHeader>
          <Form {...invoiceForm}>
            <form onSubmit={invoiceForm.handleSubmit(d => editingInvoice ? updateInvoiceMutation.mutate(d) : createInvoiceMutation.mutate(d))} className="space-y-4">
              {/* Orden de Compra (vincular e importar) */}
              {!editingInvoice && (
                <div className="flex gap-2 items-end">
                  <FormField control={invoiceForm.control} name="orderId" render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Orden de Compra (opcional)</FormLabel>
                      <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-order-invoice">
                            <SelectValue placeholder="Vincular a OC aprobada" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SENTINEL}>Sin orden de compra</SelectItem>
                          {ordenesCompra.map(o => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.orderNumber} — {formatCurrency(parseFloat(o.total ?? "0"))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!watchedOrderId || watchedOrderId === SENTINEL || importingOrder}
                    onClick={handleImportarOrden}
                    data-testid="button-import-po-items"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    {importingOrder ? "Importando…" : "Importar ítems"}
                  </Button>
                </div>
              )}

              {/* Proveedor + Número */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={invoiceForm.control} name="supplierId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor</FormLabel>
                    <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-supplier-invoice"><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={SENTINEL}>Sin proveedor</SelectItem>
                        {proveedores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="invoiceNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Factura *</FormLabel>
                    <FormControl><Input {...field} placeholder="FAC-001" data-testid="input-invoice-number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* NCF */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={invoiceForm.control} name="ncfType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo NCF</FormLabel>
                    <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-ncf-type"><SelectValue placeholder="Tipo de NCF" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={SENTINEL}>Sin NCF</SelectItem>
                        {NCF_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="ncfNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número NCF</FormLabel>
                    <FormControl><Input {...field} placeholder="B0100000001" data-testid="input-ncf-number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={invoiceForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl><Input {...field} placeholder="Descripción de la factura" data-testid="input-invoice-desc" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Montos */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={invoiceForm.control} name="subtotal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtotal</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invoice-subtotal" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="discountAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descuento</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invoice-discount" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={invoiceForm.control} name="taxAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ITBIS</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invoice-tax" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="withholdingAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retención ISR</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invoice-withholding" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={invoiceForm.control} name="totalAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total a Pagar *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invoice-total" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-invoice-currency"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="DOP">RD$ (DOP)</SelectItem>
                        <SelectItem value="USD">US$ (USD)</SelectItem>
                        <SelectItem value="EUR">€ (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-invoice-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {INVOICE_STATUSES.slice(0, 4).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={invoiceForm.control} name="issueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Emisión *</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-invoice-issue-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Vencimiento</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-invoice-due-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={invoiceForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea {...field} rows={2} placeholder="Notas adicionales..." data-testid="textarea-invoice-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Líneas de factura (solo en creación) */}
              {!editingInvoice && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>Líneas de factura (opcional)</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={addInvoiceItem} data-testid="button-add-item"><Plus className="h-3 w-3 mr-1" />Agregar</Button>
                  </div>
                  {invoiceItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_70px_90px_90px_36px] gap-2 items-center">
                      <Input placeholder="Descripción" value={item.description} onChange={e => updateInvoiceItem(idx, "description", e.target.value)} data-testid={`input-item-desc-${idx}`} />
                      <Input type="number" placeholder="Cant." value={item.quantity} onChange={e => updateInvoiceItem(idx, "quantity", parseFloat(e.target.value) || 0)} data-testid={`input-item-qty-${idx}`} />
                      <Input type="number" placeholder="Precio" value={item.unitPrice} onChange={e => updateInvoiceItem(idx, "unitPrice", parseFloat(e.target.value) || 0)} data-testid={`input-item-price-${idx}`} />
                      <Input type="number" placeholder="Monto" value={item.amount} readOnly className="bg-muted" data-testid={`input-item-amount-${idx}`} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeInvoiceItem(idx)} data-testid={`button-remove-item-${idx}`}><X className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setInvoiceDialogOpen(false); setEditingInvoice(null); setInvoiceItems([]); }}>Cancelar</Button>
                <Button type="submit" disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending} data-testid="button-submit-invoice">
                  {editingInvoice ? "Actualizar" : "Crear Factura"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ DIÁLOGO VER FACTURA ══════════════════════════════════════════════════ */}
      <Dialog open={!!viewingInvoice} onOpenChange={open => { if (!open) setViewingInvoice(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Factura {invoiceDetail?.invoiceNumber}</DialogTitle>
            <DialogDescription>{invoiceDetail?.supplierName ?? "Sin proveedor"}{invoiceDetail?.ncfNumber ? ` — NCF: ${invoiceDetail.ncfType} ${invoiceDetail.ncfNumber}` : ""}</DialogDescription>
          </DialogHeader>
          {invoiceDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Descripción: </span>{invoiceDetail.description}</div>
                <div><span className="text-muted-foreground">Estado: </span><InvoiceStatusBadge status={invoiceDetail.status} /></div>
                <div><span className="text-muted-foreground">Subtotal: </span>{formatCurrency(parseFloat(invoiceDetail.subtotal))}</div>
                <div><span className="text-muted-foreground">ITBIS: </span>{formatCurrency(parseFloat(invoiceDetail.taxAmount))}</div>
                <div><span className="text-muted-foreground">Descuento: </span>{formatCurrency(parseFloat(invoiceDetail.discountAmount ?? "0"))}</div>
                <div><span className="text-muted-foreground">Retención ISR: </span>{formatCurrency(parseFloat(invoiceDetail.withholdingAmount ?? "0"))}</div>
                <div><span className="text-muted-foreground font-medium">Total: </span><span className="font-semibold">{formatCurrency(parseFloat(invoiceDetail.totalAmount))}</span></div>
                <div><span className="text-muted-foreground font-medium">Pagado: </span><span className="font-semibold">{formatCurrency(parseFloat(invoiceDetail.paidAmount))}</span></div>
                <div><span className="text-muted-foreground">Emisión: </span>{formatDate(invoiceDetail.issueDate)}</div>
                <div><span className="text-muted-foreground">Vence: </span>{formatDate(invoiceDetail.dueDate)}</div>
              </div>
              {invoiceDetail.items && invoiceDetail.items.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Líneas</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Cant.</TableHead>
                          <TableHead>Precio Unit.</TableHead>
                          <TableHead>Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceDetail.items.map(it => (
                          <TableRow key={it.id}>
                            <TableCell>{it.description}</TableCell>
                            <TableCell>{it.quantity}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(it.unitPrice))}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(it.amount))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              {invoiceDetail.payments && invoiceDetail.payments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Pagos Directos</h4>
                    <Table>
                      <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Cuenta</TableHead><TableHead>Monto</TableHead><TableHead>Ref.</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {invoiceDetail.payments.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell>{formatDate(p.paymentDate)}</TableCell>
                            <TableCell>{p.bankAccountName ?? "—"}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(p.amount))}</TableCell>
                            <TableCell>{p.reference ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              {invoiceDetail.allocatedPayments && invoiceDetail.allocatedPayments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Pagos Asignados (multi-factura)</h4>
                    <Table>
                      <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Cuenta</TableHead><TableHead>Asignado</TableHead><TableHead>Ref.</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {invoiceDetail.allocatedPayments.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell>{formatDate(a.paymentDate)}</TableCell>
                            <TableCell>{a.bankAccountName ?? "—"}</TableCell>
                            <TableCell>{formatCurrency(parseFloat(a.allocatedAmount))}</TableCell>
                            <TableCell>{a.reference ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ DIÁLOGO PAGO ═════════════════════════════════════════════════════════ */}
      <Dialog open={paymentDialogOpen} onOpenChange={open => { setPaymentDialogOpen(open); if (!open) paymentForm.reset(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
              {/* Modo de pago */}
              <div className="flex gap-2">
                <Button type="button" variant={paymentMode === "simple" ? "default" : "outline"} size="sm" onClick={() => setPaymentMode("simple")} data-testid="button-mode-simple">
                  <FileText className="h-3 w-3 mr-1" />Factura única
                </Button>
                <Button type="button" variant={paymentMode === "multi" ? "default" : "outline"} size="sm" onClick={() => { setPaymentMode("multi"); paymentForm.setValue("allocations", openInvoicesForPayment.map(i => ({ invoiceId: i.id, allocatedAmount: 0, selected: false }))); }} data-testid="button-mode-multi">
                  <SplitSquareHorizontal className="h-3 w-3 mr-1" />Multi-factura
                </Button>
              </div>

              {/* Proveedor + Cuenta */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={paymentForm.control} name="supplierId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor</FormLabel>
                    <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-payment-supplier"><SelectValue placeholder="Sin proveedor" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={SENTINEL}>Sin proveedor</SelectItem>
                        {proveedores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={paymentForm.control} name="bankAccountId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta Bancaria</FormLabel>
                    <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-payment-bank"><SelectValue placeholder="Sin cuenta" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={SENTINEL}>Sin cuenta</SelectItem>
                        {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Modo simple: seleccionar factura */}
              {paymentMode === "simple" && (
                <FormField control={paymentForm.control} name="invoiceId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Factura *</FormLabel>
                    <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-payment-invoice"><SelectValue placeholder="Seleccionar factura" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={SENTINEL}>Sin factura específica</SelectItem>
                        {openInvoicesForPayment.map(i => {
                          const balance = parseFloat(i.totalAmount) - parseFloat(i.paidAmount);
                          return (
                            <SelectItem key={i.id} value={i.id}>
                              {i.invoiceNumber} — {i.supplierName ?? "Sin proveedor"} — Saldo: {formatCurrency(balance)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Modo multi: tabla de facturas */}
              {paymentMode === "multi" && (
                <div className="space-y-2">
                  <FormLabel>Distribución por Facturas</FormLabel>
                  {openInvoicesForPayment.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay facturas pendientes de pago.</p>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Factura</TableHead>
                            <TableHead>Saldo</TableHead>
                            <TableHead>Asignar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openInvoicesForPayment.map((inv, idx) => {
                            const balance = parseFloat(inv.totalAmount) - parseFloat(inv.paidAmount);
                            const currentAllocs = paymentForm.watch("allocations") ?? [];
                            const thisAlloc = currentAllocs.find(a => a.invoiceId === inv.id);
                            const isSelected = thisAlloc?.selected ?? false;
                            return (
                              <TableRow key={inv.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={checked => {
                                      const allocs = [...(paymentForm.getValues("allocations") ?? [])];
                                      const existingIdx = allocs.findIndex(a => a.invoiceId === inv.id);
                                      if (existingIdx >= 0) {
                                        allocs[existingIdx] = { ...allocs[existingIdx], selected: !!checked };
                                      } else {
                                        allocs.push({ invoiceId: inv.id, allocatedAmount: 0, selected: !!checked });
                                      }
                                      paymentForm.setValue("allocations", allocs);
                                    }}
                                    data-testid={`checkbox-alloc-${inv.id}`}
                                  />
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div className="font-medium">{inv.invoiceNumber}</div>
                                  <div className="text-muted-foreground text-xs">{inv.supplierName ?? "—"}</div>
                                </TableCell>
                                <TableCell className="text-sm">{formatCurrency(balance)}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={balance}
                                    disabled={!isSelected}
                                    placeholder="0.00"
                                    value={thisAlloc?.allocatedAmount ?? 0}
                                    onChange={e => {
                                      const allocs = [...(paymentForm.getValues("allocations") ?? [])];
                                      const existingIdx = allocs.findIndex(a => a.invoiceId === inv.id);
                                      const newVal = parseFloat(e.target.value) || 0;
                                      if (existingIdx >= 0) {
                                        allocs[existingIdx] = { ...allocs[existingIdx], allocatedAmount: newVal };
                                      } else {
                                        allocs.push({ invoiceId: inv.id, allocatedAmount: newVal, selected: false });
                                      }
                                      paymentForm.setValue("allocations", allocs);
                                    }}
                                    data-testid={`input-alloc-amount-${inv.id}`}
                                    className="w-28"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* Monto + Fecha + Referencia */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto Total *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-payment-amount" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={paymentForm.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-payment-currency"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="DOP">RD$ (DOP)</SelectItem>
                        <SelectItem value="USD">US$ (USD)</SelectItem>
                        <SelectItem value="EUR">€ (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={paymentForm.control} name="paymentDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Pago *</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-payment-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={paymentForm.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia / Cheque</FormLabel>
                  <FormControl><Input {...field} placeholder="N° transferencia, cheque..." data-testid="input-payment-ref" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={paymentForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea {...field} rows={2} data-testid="textarea-payment-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createPaymentMutation.isPending} data-testid="button-submit-pago">Registrar Pago</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ DIÁLOGO RECURRENTE ═══════════════════════════════════════════════════ */}
      <Dialog open={recurringDialogOpen} onOpenChange={open => { setRecurringDialogOpen(open); if (!open) { setEditingRecurring(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRecurring ? "Editar Pago Recurrente" : "Nuevo Pago Recurrente"}</DialogTitle></DialogHeader>
          <Form {...recurringForm}>
            <form onSubmit={recurringForm.handleSubmit(d => editingRecurring ? updateRecurringMutation.mutate(d) : createRecurringMutation.mutate(d))} className="space-y-4">
              <FormField control={recurringForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Descripción *</FormLabel><FormControl><Input {...field} placeholder="Ej: Renta de local" data-testid="input-recurring-desc" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={recurringForm.control} name="supplierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor</FormLabel>
                  <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-recurring-supplier"><SelectValue placeholder="Sin proveedor" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={SENTINEL}>Sin proveedor</SelectItem>
                      {proveedores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={recurringForm.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>Monto *</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-recurring-amount" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recurringForm.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-recurring-currency"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="DOP">RD$ (DOP)</SelectItem>
                        <SelectItem value="USD">US$ (USD)</SelectItem>
                        <SelectItem value="EUR">€ (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={recurringForm.control} name="frecuencia" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frecuencia *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-recurring-freq"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(FRECUENCIA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={recurringForm.control} name="alertDiasPrevios" render={({ field }) => (
                  <FormItem><FormLabel>Días de Alerta</FormLabel><FormControl><Input type="number" min={0} max={60} {...field} data-testid="input-recurring-alert-days" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={recurringForm.control} name="proximaFecha" render={({ field }) => (
                <FormItem><FormLabel>Próxima Fecha</FormLabel><FormControl><Input type="date" {...field} data-testid="input-recurring-next-date" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={recurringForm.control} name="bankAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Bancaria</FormLabel>
                  <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-recurring-bank"><SelectValue placeholder="Sin cuenta" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={SENTINEL}>Sin cuenta</SelectItem>
                      {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={recurringForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea {...field} rows={2} data-testid="textarea-recurring-notes" /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setRecurringDialogOpen(false); setEditingRecurring(null); }}>Cancelar</Button>
                <Button type="submit" disabled={createRecurringMutation.isPending || updateRecurringMutation.isPending} data-testid="button-submit-recurring">
                  {editingRecurring ? "Actualizar" : "Crear Recurrente"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ DIÁLOGO NOTA DÉBITO ══════════════════════════════════════════════════ */}
      <Dialog open={debitNoteDialogOpen} onOpenChange={open => { setDebitNoteDialogOpen(open); if (!open) { setEditingDebitNote(null); setDebitNoteItems([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingDebitNote ? "Editar Nota de Débito" : "Nueva Nota de Débito"}</DialogTitle></DialogHeader>
          <Form {...debitNoteForm}>
            <form onSubmit={debitNoteForm.handleSubmit(d => editingDebitNote ? updateDebitNoteMutation.mutate(d) : createDebitNoteMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={debitNoteForm.control} name="noteNumber" render={({ field }) => (
                  <FormItem><FormLabel>Número de Nota *</FormLabel><FormControl><Input {...field} placeholder="ND-001" data-testid="input-dn-number" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={debitNoteForm.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Fecha *</FormLabel><FormControl><Input type="date" {...field} data-testid="input-dn-date" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={debitNoteForm.control} name="supplierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor</FormLabel>
                  <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-dn-supplier"><SelectValue placeholder="Sin proveedor" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={SENTINEL}>Sin proveedor</SelectItem>
                      {proveedores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={debitNoteForm.control} name="invoiceId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Factura Relacionada</FormLabel>
                  <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-dn-invoice"><SelectValue placeholder="Sin factura" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={SENTINEL}>Sin factura</SelectItem>
                      {invoices.filter(i => i.status !== "anulada").map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} — {i.supplierName ?? "—"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={debitNoteForm.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-dn-reason"><SelectValue placeholder="Seleccionar motivo" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {DEBIT_NOTE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={debitNoteForm.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>Monto *</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-dn-amount" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={debitNoteForm.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-dn-currency"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="DOP">RD$ (DOP)</SelectItem>
                        <SelectItem value="USD">US$ (USD)</SelectItem>
                        <SelectItem value="EUR">€ (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={debitNoteForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-dn-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="aplicada">Aplicada</SelectItem>
                      <SelectItem value="anulada">Anulada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Líneas de nota */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Líneas (opcional)</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDebitNoteItems(prev => [...prev, { description: "", amount: 0 }])} data-testid="button-add-dn-item"><Plus className="h-3 w-3 mr-1" />Agregar</Button>
                </div>
                {debitNoteItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_36px] gap-2 items-center">
                    <Input placeholder="Descripción" value={item.description} onChange={e => setDebitNoteItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], description: e.target.value }; return n; })} data-testid={`input-dn-item-desc-${idx}`} />
                    <Input type="number" step="0.01" placeholder="Monto" value={item.amount} onChange={e => setDebitNoteItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], amount: parseFloat(e.target.value) || 0 }; return n; })} data-testid={`input-dn-item-amount-${idx}`} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDebitNoteItems(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-remove-dn-item-${idx}`}><X className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              <FormField control={debitNoteForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea {...field} rows={2} data-testid="textarea-dn-notes" /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setDebitNoteDialogOpen(false); setEditingDebitNote(null); setDebitNoteItems([]); }}>Cancelar</Button>
                <Button type="submit" disabled={createDebitNoteMutation.isPending || updateDebitNoteMutation.isPending} data-testid="button-submit-dn">
                  {editingDebitNote ? "Actualizar" : "Crear Nota"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ CONFIRMACIONES ═══════════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteInvoiceTarget} onOpenChange={open => { if (!open) setDeleteInvoiceTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará permanentemente la factura {deleteInvoiceTarget?.invoiceNumber}. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteInvoiceMutation.mutate(deleteInvoiceTarget!.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-invoice">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!anularInvoiceTarget} onOpenChange={open => { if (!open) setAnularInvoiceTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular factura?</AlertDialogTitle>
            <AlertDialogDescription>La factura {anularInvoiceTarget?.invoiceNumber} quedará marcada como anulada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => anularInvoiceMutation.mutate(anularInvoiceTarget!.id)} data-testid="button-confirm-anular-invoice">Anular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePaymentTarget} onOpenChange={open => { if (!open) setDeletePaymentTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>Se revertirá el pago de {deletePaymentTarget ? formatCurrency(parseFloat(deletePaymentTarget.amount)) : ""} y se ajustará el saldo bancario y de facturas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePaymentMutation.mutate(deletePaymentTarget!.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-payment">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteRecurringTarget} onOpenChange={open => { if (!open) setDeleteRecurringTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago recurrente?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará el pago recurrente "{deleteRecurringTarget?.description}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRecurringMutation.mutate(deleteRecurringTarget!.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-recurring">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pagarRecurringTarget} onOpenChange={open => { if (!open) setPagarRecurringTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar pago del ciclo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se registrará el pago de {pagarRecurringTarget ? formatCurrency(parseFloat(pagarRecurringTarget.amount)) : ""} para "{pagarRecurringTarget?.description}",
              se debitará de la cuenta bancaria configurada y se creará un registro en el historial de pagos. La próxima fecha se avanzará automáticamente según la frecuencia {pagarRecurringTarget?.frecuencia && FRECUENCIA_LABELS[pagarRecurringTarget.frecuencia]?.toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => registrarPagoRecurrenteMutation.mutate(pagarRecurringTarget!.id)} data-testid="button-confirm-pagar-recurring">Registrar Pago</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDebitNoteTarget} onOpenChange={open => { if (!open) setDeleteDebitNoteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar nota de débito?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará la nota {deleteDebitNoteTarget?.noteNumber} permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDebitNoteMutation.mutate(deleteDebitNoteTarget!.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-dn">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
