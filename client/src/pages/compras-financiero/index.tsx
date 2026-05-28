import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Supplier { id: string; name: string; }
interface BankAccount { id: string; name: string; currency: string; }
interface Invoice {
  id: string; invoiceNumber: string; description: string; supplierId: string | null;
  supplierName: string | null; subtotal: string; taxAmount: string; totalAmount: string;
  paidAmount: string; currency: string; issueDate: string; dueDate: string | null;
  status: string; notes: string | null; createdAt: string; items?: InvoiceItem[]; payments?: Payment[];
}
interface InvoiceItem { id: string; description: string; quantity: string; unitPrice: string; amount: string; }
interface Payment {
  id: string; invoiceId: string; invoiceNumber?: string; supplierName?: string;
  bankAccountId: string | null; bankAccountName?: string; amount: string; currency: string;
  paymentDate: string; reference: string | null; notes: string | null; createdAt: string;
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
  date: string; status: string; notes: string | null;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
const SENTINEL = "__none__";
const clean = (v: string | null | undefined): string | null =>
  !v || v === SENTINEL ? null : v;

const invoiceFormSchema = z.object({
  supplierId: z.string().optional(),
  invoiceNumber: z.string().min(1, "Número de factura requerido"),
  description: z.string().min(1, "Descripción requerida"),
  subtotal: z.coerce.number().min(0),
  taxAmount: z.coerce.number().min(0).default(0),
  totalAmount: z.coerce.number().min(0.01, "Monto total requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  issueDate: z.string().min(1, "Fecha requerida"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});
type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

const paymentFormSchema = z.object({
  invoiceId: z.string().min(1, "Factura requerida"),
  bankAccountId: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Monto requerido"),
  currency: z.enum(["DOP", "USD", "EUR"]).default("DOP"),
  paymentDate: z.string().min(1, "Fecha requerida"),
  reference: z.string().optional(),
  notes: z.string().optional(),
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

const debitNoteFormSchema = z.object({
  invoiceId: z.string().optional(),
  supplierId: z.string().optional(),
  noteNumber: z.string().min(1, "Número de nota requerido"),
  reason: z.string().min(1, "Motivo requerido"),
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function ComprasFinancieroPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [tab, setTab] = useState("facturas");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/compras-fin/facturas"],
    queryFn: () => apiRequest("GET", "/api/compras-fin/facturas").then(r => r.json()),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/compras-fin/facturas/stats"],
    queryFn: () => apiRequest("GET", "/api/compras-fin/facturas/stats").then(r => r.json()),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/compras-fin/pagos"],
    queryFn: () => apiRequest("GET", "/api/compras-fin/pagos").then(r => r.json()),
  });

  const { data: recurrentes = [], isLoading: recurrentesLoading } = useQuery<RecurringPayment[]>({
    queryKey: ["/api/compras-fin/recurrentes"],
    queryFn: () => apiRequest("GET", "/api/compras-fin/recurrentes").then(r => r.json()),
  });

  const { data: debitNotes = [], isLoading: debitNotesLoading } = useQuery<DebitNote[]>({
    queryKey: ["/api/compras-fin/notas-debito"],
    queryFn: () => apiRequest("GET", "/api/compras-fin/notas-debito").then(r => r.json()),
  });

  const { data: proveedores = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/compras-fin/proveedores"],
    queryFn: () => apiRequest("GET", "/api/compras-fin/proveedores").then(r => r.json()),
  });

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
    queryFn: () => apiRequest("GET", "/api/bank-accounts").then(r => r.json()),
  });

  const { data: invoiceDetail } = useQuery<Invoice>({
    queryKey: ["/api/compras-fin/facturas", viewingInvoice?.id],
    queryFn: () => apiRequest("GET", `/api/compras-fin/facturas/${viewingInvoice!.id}`).then(r => r.json()),
    enabled: !!viewingInvoice?.id,
  });

  // ─── Invoice form ────────────────────────────────────────────────────────────
  const invoiceForm = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      supplierId: SENTINEL, invoiceNumber: "", description: "", subtotal: 0,
      taxAmount: 0, totalAmount: 0, currency: "DOP", issueDate: today(), dueDate: "", notes: "",
    },
  });

  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      invoiceId: "", bankAccountId: SENTINEL, amount: 0, currency: "DOP",
      paymentDate: today(), reference: "", notes: "",
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
      invoiceId: SENTINEL, supplierId: SENTINEL, noteNumber: "", reason: "",
      amount: 0, currency: "DOP", date: today(), status: "pendiente", notes: "",
    },
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) =>
      apiRequest("POST", "/api/compras-fin/facturas", {
        ...data,
        supplierId: clean(data.supplierId),
        dueDate: data.dueDate || null,
        items: invoiceItems,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/facturas"] });
      toast({ title: "Factura creada" });
      setInvoiceDialogOpen(false);
      invoiceForm.reset();
      setInvoiceItems([]);
    },
    onError: () => toast({ title: "Error", description: "No se pudo crear la factura", variant: "destructive" }),
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) =>
      apiRequest("PATCH", `/api/compras-fin/facturas/${editingInvoice!.id}`, {
        ...data,
        supplierId: clean(data.supplierId),
        dueDate: data.dueDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/facturas"] });
      toast({ title: "Factura actualizada" });
      setInvoiceDialogOpen(false);
      setEditingInvoice(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar la factura", variant: "destructive" }),
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/compras-fin/facturas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/facturas"] });
      toast({ title: "Factura eliminada" });
      setDeleteInvoiceTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo eliminar", variant: "destructive" }),
  });

  const anularInvoiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/compras-fin/facturas/${id}/anular`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/facturas"] });
      toast({ title: "Factura anulada" });
      setAnularInvoiceTarget(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo anular", variant: "destructive" }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) =>
      apiRequest("POST", "/api/compras-fin/pagos", {
        ...data,
        bankAccountId: clean(data.bankAccountId),
        reference: data.reference || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/pagos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/facturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/facturas/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Pago registrado" });
      setPaymentDialogOpen(false);
      paymentForm.reset();
    },
    onError: () => toast({ title: "Error", description: "No se pudo registrar el pago", variant: "destructive" }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/compras-fin/pagos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/pagos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/facturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/facturas/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Pago eliminado" });
      setDeletePaymentTarget(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar el pago", variant: "destructive" }),
  });

  const createRecurringMutation = useMutation({
    mutationFn: async (data: RecurringFormData) =>
      apiRequest("POST", "/api/compras-fin/recurrentes", {
        ...data,
        supplierId: clean(data.supplierId),
        bankAccountId: clean(data.bankAccountId),
        proximaFecha: data.proximaFecha || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/recurrentes"] });
      toast({ title: "Pago recurrente creado" });
      setRecurringDialogOpen(false);
      recurringForm.reset();
    },
    onError: () => toast({ title: "Error", description: "No se pudo crear", variant: "destructive" }),
  });

  const updateRecurringMutation = useMutation({
    mutationFn: async (data: RecurringFormData) =>
      apiRequest("PATCH", `/api/compras-fin/recurrentes/${editingRecurring!.id}`, {
        ...data,
        supplierId: clean(data.supplierId),
        bankAccountId: clean(data.bankAccountId),
        proximaFecha: data.proximaFecha || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/recurrentes"] });
      toast({ title: "Pago recurrente actualizado" });
      setRecurringDialogOpen(false);
      setEditingRecurring(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" }),
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/compras-fin/recurrentes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/recurrentes"] });
      toast({ title: "Pago recurrente eliminado" });
      setDeleteRecurringTarget(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" }),
  });

  const registrarPagoRecurrenteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("POST", `/api/compras-fin/recurrentes/${id}/registrar-pago`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/recurrentes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Pago recurrente registrado" });
      setPagarRecurringTarget(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo registrar el pago", variant: "destructive" }),
  });

  const createDebitNoteMutation = useMutation({
    mutationFn: async (data: DebitNoteFormData) =>
      apiRequest("POST", "/api/compras-fin/notas-debito", {
        ...data,
        invoiceId: clean(data.invoiceId),
        supplierId: clean(data.supplierId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/notas-debito"] });
      toast({ title: "Nota de débito creada" });
      setDebitNoteDialogOpen(false);
      debitNoteForm.reset();
    },
    onError: () => toast({ title: "Error", description: "No se pudo crear la nota", variant: "destructive" }),
  });

  const updateDebitNoteMutation = useMutation({
    mutationFn: async (data: DebitNoteFormData) =>
      apiRequest("PATCH", `/api/compras-fin/notas-debito/${editingDebitNote!.id}`, {
        ...data,
        invoiceId: clean(data.invoiceId),
        supplierId: clean(data.supplierId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/notas-debito"] });
      toast({ title: "Nota actualizada" });
      setDebitNoteDialogOpen(false);
      setEditingDebitNote(null);
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" }),
  });

  const deleteDebitNoteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/compras-fin/notas-debito/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras-fin/notas-debito"] });
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
      supplierId: SENTINEL, invoiceNumber: "", description: "", subtotal: 0,
      taxAmount: 0, totalAmount: 0, currency: "DOP", issueDate: today(), dueDate: "", notes: "",
    });
    setInvoiceDialogOpen(true);
  };

  const openEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    invoiceForm.reset({
      supplierId: inv.supplierId ?? SENTINEL,
      invoiceNumber: inv.invoiceNumber,
      description: inv.description,
      subtotal: parseFloat(inv.subtotal),
      taxAmount: parseFloat(inv.taxAmount),
      totalAmount: parseFloat(inv.totalAmount),
      currency: inv.currency as any,
      issueDate: inv.issueDate ? inv.issueDate.split("T")[0] : today(),
      dueDate: inv.dueDate ? inv.dueDate.split("T")[0] : "",
      notes: inv.notes ?? "",
    });
    setInvoiceDialogOpen(true);
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
    debitNoteForm.reset({
      invoiceId: SENTINEL, supplierId: SENTINEL, noteNumber: "", reason: "",
      amount: 0, currency: "DOP", date: today(), status: "pendiente", notes: "",
    });
    setDebitNoteDialogOpen(true);
  };

  const openEditDebitNote = (n: DebitNote) => {
    setEditingDebitNote(n);
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

  // Filtered data
  const filteredInvoices = invoices.filter(inv => {
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchSearch = !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.description.toLowerCase().includes(search.toLowerCase()) ||
      (inv.supplierName ?? "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredPayments = payments.filter(p =>
    !search ||
    (p.invoiceNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.supplierName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.reference ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredRecurrentes = recurrentes.filter(r =>
    !search ||
    r.description.toLowerCase().includes(search.toLowerCase()) ||
    (r.supplierName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredDebitNotes = debitNotes.filter(n =>
    !search ||
    n.noteNumber.toLowerCase().includes(search.toLowerCase()) ||
    n.reason.toLowerCase().includes(search.toLowerCase()) ||
    (n.supplierName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Compras Financiero</h1>
          <p className="text-muted-foreground">Facturas de proveedores, pagos, pagos recurrentes y notas de débito</p>
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
            <p className="text-xs text-muted-foreground">{stats?.porStatus?.pendiente ?? 0} pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-monto">{formatCurrency(stats?.totalMonto ?? 0)}</div>
            <p className="text-xs text-muted-foreground">En facturas registradas</p>
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
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
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
                <Input className="pl-9 w-64" placeholder="Buscar facturas..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-facturas" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-facturas"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pagada">Pagada</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                  <SelectItem value="anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
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
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pagado</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicesLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay facturas</TableCell></TableRow>
                ) : filteredInvoices.map(inv => (
                  <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.supplierName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{inv.description}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(inv.totalAmount))}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(inv.paidAmount))}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── PAGOS ────────────────────────────────────────────────────────────── */}
        <TabsContent value="pagos" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 w-64" placeholder="Buscar pagos..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-pagos" />
            </div>
            {canCreate && (
              <Button onClick={() => { paymentForm.reset({ invoiceId: "", bankAccountId: SENTINEL, amount: 0, currency: "DOP", paymentDate: today(), reference: "", notes: "" }); setPaymentDialogOpen(true); }} data-testid="button-new-pago">
                <Plus className="h-4 w-4 mr-2" />Registrar Pago
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
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
                    <TableCell className="font-medium">{p.invoiceNumber ?? "—"}</TableCell>
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
                          <Button variant="ghost" size="icon" onClick={() => setPagarRecurringTarget(r)} title="Registrar pago" data-testid={`button-pagar-recurring-${r.id}`}><Check className="h-4 w-4 text-primary" /></Button>
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 w-64" placeholder="Buscar notas..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-notas" />
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
                      <Badge className={n.status === "aplicada" ? "bg-primary/10 text-primary" : n.status === "anulada" ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"}>
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
              <FormField control={invoiceForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl><Input {...field} placeholder="Descripción de la factura" data-testid="input-invoice-desc" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={invoiceForm.control} name="subtotal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtotal</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invoice-subtotal" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="taxAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ITBIS / Impuesto</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invoice-tax" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={invoiceForm.control} name="totalAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invoice-total" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
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

              {/* Líneas de factura */}
              {!editingInvoice && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>Líneas de factura (opcional)</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={addInvoiceItem} data-testid="button-add-item"><Plus className="h-3 w-3 mr-1" />Agregar línea</Button>
                  </div>
                  {invoiceItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_90px_90px_36px] gap-2 items-center">
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
            <DialogDescription>{invoiceDetail?.supplierName ?? "Sin proveedor"}</DialogDescription>
          </DialogHeader>
          {invoiceDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Descripción:</span> <span>{invoiceDetail.description}</span></div>
                <div><span className="text-muted-foreground">Estado:</span> <InvoiceStatusBadge status={invoiceDetail.status} /></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-semibold">{formatCurrency(parseFloat(invoiceDetail.totalAmount))}</span></div>
                <div><span className="text-muted-foreground">Pagado:</span> <span className="font-semibold">{formatCurrency(parseFloat(invoiceDetail.paidAmount))}</span></div>
                <div><span className="text-muted-foreground">Emisión:</span> <span>{formatDate(invoiceDetail.issueDate)}</span></div>
                <div><span className="text-muted-foreground">Vence:</span> <span>{formatDate(invoiceDetail.dueDate)}</span></div>
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
                          <TableHead>Cantidad</TableHead>
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
                    <h4 className="text-sm font-semibold mb-2">Pagos Registrados</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cuenta</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Referencia</TableHead>
                        </TableRow>
                      </TableHeader>
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ DIÁLOGO PAGO ═════════════════════════════════════════════════════════ */}
      <Dialog open={paymentDialogOpen} onOpenChange={open => { setPaymentDialogOpen(open); if (!open) paymentForm.reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Pago a Proveedor</DialogTitle></DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(d => createPaymentMutation.mutate(d))} className="space-y-4">
              <FormField control={paymentForm.control} name="invoiceId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Factura *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-payment-invoice"><SelectValue placeholder="Seleccionar factura" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {invoices.filter(i => i.status !== "pagada" && i.status !== "anulada").map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} — {i.supplierName ?? "Sin proveedor"} ({formatCurrency(parseFloat(i.totalAmount) - parseFloat(i.paidAmount))} por pagar)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={paymentForm.control} name="bankAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Bancaria</FormLabel>
                  <Select value={field.value ?? SENTINEL} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-payment-bank"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={SENTINEL}>Sin cuenta</SelectItem>
                      {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto *</FormLabel>
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
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl><Input {...field} placeholder="Ej: Renta de local Prov. X" data-testid="input-recurring-desc" /></FormControl>
                  <FormMessage />
                </FormItem>
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
                  <FormItem>
                    <FormLabel>Monto *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-recurring-amount" /></FormControl>
                    <FormMessage />
                  </FormItem>
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
                      <SelectContent>
                        {Object.entries(FRECUENCIA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={recurringForm.control} name="alertDiasPrevios" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días de Alerta</FormLabel>
                    <FormControl><Input type="number" min={0} max={60} {...field} data-testid="input-recurring-alert-days" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={recurringForm.control} name="proximaFecha" render={({ field }) => (
                <FormItem>
                  <FormLabel>Próxima Fecha</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-recurring-next-date" /></FormControl>
                  <FormMessage />
                </FormItem>
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
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea {...field} rows={2} data-testid="textarea-recurring-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
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
      <Dialog open={debitNoteDialogOpen} onOpenChange={open => { setDebitNoteDialogOpen(open); if (!open) setEditingDebitNote(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingDebitNote ? "Editar Nota de Débito" : "Nueva Nota de Débito"}</DialogTitle></DialogHeader>
          <Form {...debitNoteForm}>
            <form onSubmit={debitNoteForm.handleSubmit(d => editingDebitNote ? updateDebitNoteMutation.mutate(d) : createDebitNoteMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={debitNoteForm.control} name="noteNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Nota *</FormLabel>
                    <FormControl><Input {...field} placeholder="ND-001" data-testid="input-dn-number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={debitNoteForm.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha *</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-dn-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
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
                  <FormControl><Textarea {...field} rows={2} placeholder="Motivo de la nota de débito..." data-testid="textarea-dn-reason" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={debitNoteForm.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} data-testid="input-dn-amount" /></FormControl>
                    <FormMessage />
                  </FormItem>
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
              <FormField control={debitNoteForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea {...field} rows={2} data-testid="textarea-dn-notes" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setDebitNoteDialogOpen(false); setEditingDebitNote(null); }}>Cancelar</Button>
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
            <AlertDialogDescription>La factura {anularInvoiceTarget?.invoiceNumber} quedará marcada como anulada. Esta acción no se puede deshacer.</AlertDialogDescription>
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
            <AlertDialogDescription>Se revertirá el pago de {deletePaymentTarget ? formatCurrency(parseFloat(deletePaymentTarget.amount)) : ""} y se ajustará el saldo bancario.</AlertDialogDescription>
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
            <AlertDialogTitle>¿Registrar pago recurrente?</AlertDialogTitle>
            <AlertDialogDescription>Se registrará el pago de {pagarRecurringTarget ? formatCurrency(parseFloat(pagarRecurringTarget.amount)) : ""} para "{pagarRecurringTarget?.description}" y se debitará de la cuenta bancaria configurada. La próxima fecha se avanzará automáticamente.</AlertDialogDescription>
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
            <AlertDialogDescription>Se eliminará la nota {deleteDebitNoteTarget?.noteNumber}.</AlertDialogDescription>
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
