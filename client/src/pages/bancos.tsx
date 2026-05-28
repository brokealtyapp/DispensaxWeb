import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Landmark,
  CreditCard,
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { BankForm } from "@/components/bank-form";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const FMT = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number | string | null | undefined, currency = "DOP") => {
  const v = Number(n ?? 0);
  return `${currency === "USD" ? "$" : "RD$"} ${FMT.format(v)}`;
};

function typeIcon(type: string) {
  if (type === "tarjeta_credito") return <CreditCard className="h-4 w-4" />;
  if (type === "efectivo") return <Wallet className="h-4 w-4" />;
  return <Landmark className="h-4 w-4" />;
}

function typeLabel(type: string) {
  if (type === "tarjeta_credito") return "Tarjeta de crédito";
  if (type === "efectivo") return "Caja efectivo";
  return "Cuenta bancaria";
}

function statusBadge(status: string) {
  if (status === "reconciled") return <Badge variant="secondary">Conciliado</Badge>;
  if (status === "processed") return <Badge>Procesado</Badge>;
  return <Badge variant="outline">Pendiente</Badge>;
}

function txTypeBadge(type: string) {
  if (type === "entrada") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      <ArrowDownLeft className="h-3 w-3" /> Entrada
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <ArrowUpRight className="h-3 w-3" /> Salida
    </span>
  );
}

const transferSchema = z.object({
  fromAccountId: z.string().min(1, "Cuenta origen requerida"),
  toAccountId: z.string().min(1, "Cuenta destino requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  description: z.string().min(1, "Descripción requerida"),
  reference: z.string().optional(),
  date: z.string().optional(),
});

type TransferValues = z.infer<typeof transferSchema>;

const txSchema = z.object({
  bankAccountId: z.string().min(1, "Cuenta requerida"),
  type: z.enum(["entrada", "salida"]),
  amount: z.coerce.number().positive("Monto debe ser mayor a 0"),
  description: z.string().min(1, "Descripción requerida"),
  reference: z.string().optional(),
  date: z.string().optional(),
  category: z.string().optional(),
});

type TxValues = z.infer<typeof txSchema>;

export function BancosPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isReadOnly = user?.role === "contabilidad";

  const [activeTab, setActiveTab] = useState("resumen");
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [deletingAccount, setDeletingAccount] = useState<any>(null);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showTxForm, setShowTxForm] = useState(false);

  const [txFilter, setTxFilter] = useState({ accountId: "all", type: "all", status: "all", search: "" });
  const [recoFilter, setRecoFilter] = useState("all");
  const [recoSelected, setRecoSelected] = useState<Set<string>>(new Set());
  const [reconciling, setReconciling] = useState(false);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/bank-accounts/summary"],
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<any[]>({
    queryKey: ["/api/bank-transactions", txFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (txFilter.accountId !== "all") params.set("accountId", txFilter.accountId);
      if (txFilter.type !== "all") params.set("type", txFilter.type);
      if (txFilter.status !== "all") params.set("status", txFilter.status);
      if (txFilter.search) params.set("search", txFilter.search);
      const r = await fetch(`/api/bank-transactions?${params}`);
      if (!r.ok) throw new Error("Error cargando transacciones");
      return r.json();
    },
  });

  const { data: recoTxs = [], isLoading: recoLoading } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts/reconciliation", recoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (recoFilter !== "all") params.set("accountId", recoFilter);
      const r = await fetch(`/api/bank-accounts/reconciliation?${params}`);
      if (!r.ok) throw new Error("Error cargando conciliación");
      return r.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bank-accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts/summary"] });
      toast({ title: "Cuenta eliminada correctamente" });
      setDeletingAccount(null);
    },
    onError: (e: any) => toast({ title: "Error al eliminar", description: e.message, variant: "destructive" }),
  });

  const transferForm = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { fromAccountId: "", toAccountId: "", amount: 0, description: "", reference: "", date: "" },
  });

  const transferMutation = useMutation({
    mutationFn: (data: TransferValues) => apiRequest("POST", "/api/bank-accounts/transfer", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts/summary"] });
      toast({ title: "Transferencia realizada correctamente" });
      setShowTransferForm(false);
      transferForm.reset();
    },
    onError: (e: any) => toast({ title: "Error en transferencia", description: e.message, variant: "destructive" }),
  });

  const txForm = useForm<TxValues>({
    resolver: zodResolver(txSchema),
    defaultValues: { bankAccountId: "", type: "entrada", amount: 0, description: "", reference: "", date: "", category: "" },
  });

  const txMutation = useMutation({
    mutationFn: (data: TxValues) => apiRequest("POST", "/api/bank-transactions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts/summary"] });
      toast({ title: "Transacción registrada correctamente" });
      setShowTxForm(false);
      txForm.reset();
    },
    onError: (e: any) => toast({ title: "Error al registrar", description: e.message, variant: "destructive" }),
  });

  async function handleReconcile() {
    if (recoSelected.size === 0) return;
    setReconciling(true);
    try {
      await apiRequest("POST", "/api/bank-accounts/reconciliation/reconcile", {
        transactionIds: Array.from(recoSelected),
      });
      qc.invalidateQueries({ queryKey: ["/api/bank-accounts/reconciliation"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: `${recoSelected.size} transacción(es) conciliada(s)` });
      setRecoSelected(new Set());
    } catch (e: any) {
      toast({ title: "Error al conciliar", description: e.message, variant: "destructive" });
    } finally {
      setReconciling(false);
    }
  }

  const toggleReco = (id: string) => {
    setRecoSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllReco = () => {
    if (recoSelected.size === recoTxs.length) {
      setRecoSelected(new Set());
    } else {
      setRecoSelected(new Set(recoTxs.map((t: any) => t.id)));
    }
  };

  const activeAccounts = accounts.filter((a: any) => a.isActive);
  const totalDOP = activeAccounts
    .filter((a: any) => a.currency === "DOP")
    .reduce((s: number, a: any) => s + Number(a.balance ?? 0), 0);
  const totalUSD = activeAccounts
    .filter((a: any) => a.currency === "USD")
    .reduce((s: number, a: any) => s + Number(a.balance ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-bancos">Bancos</h1>
          <p className="text-sm text-muted-foreground">Gestión de cuentas bancarias, tarjetas y efectivo</p>
        </div>
        {!isReadOnly && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="default" onClick={() => setShowTxForm(true)} data-testid="button-new-transaction">
              <Plus className="h-4 w-4 mr-2" /> Nueva transacción
            </Button>
            <Button size="default" onClick={() => { setEditingAccount(null); setShowBankForm(true); }} data-testid="button-new-account">
              <Plus className="h-4 w-4 mr-2" /> Nueva cuenta
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="transacciones">Transacciones</TabsTrigger>
          <TabsTrigger value="transferencias">Transferencias</TabsTrigger>
          <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
        </TabsList>

        {/* ── RESUMEN ── */}
        <TabsContent value="resumen" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-total-dop">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total DOP</CardTitle>
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-foreground">{fmt(totalDOP, "DOP")}</p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-usd">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total USD</CardTitle>
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-foreground">{fmt(totalUSD, "USD")}</p>
              </CardContent>
            </Card>

            <Card data-testid="card-entradas-mes">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Entradas del mes</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-foreground">{fmt(summary?.monthIncome ?? 0)}</p>
              </CardContent>
            </Card>

            <Card data-testid="card-salidas-mes">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Salidas del mes</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-foreground">{fmt(summary?.monthExpense ?? 0)}</p>
              </CardContent>
            </Card>
          </div>

          {(summary?.cashFlow ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Flujo de caja — últimos 30 días</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.cashFlow} margin={{ left: 0, right: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="entradas" name="Entradas" fill="#E84545" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="salidas" name="Salidas" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {accountsLoading ? (
            <div className="text-muted-foreground text-sm">Cargando cuentas...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeAccounts.map((account: any) => {
                const balance = Number(account.balance ?? 0);
                const isLow = account.alertThreshold && balance < Number(account.alertThreshold);
                return (
                  <Card key={account.id} data-testid={`card-account-${account.id}`}>
                    <CardContent className="pt-5 pb-4 px-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {typeIcon(account.accountType)}
                          <div>
                            <p className="font-semibold text-sm text-foreground leading-tight">{account.name}</p>
                            {account.bankName && (
                              <p className="text-xs text-muted-foreground">{account.bankName}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isLow && <AlertCircle className="h-4 w-4 text-destructive" />}
                          {!isReadOnly && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingAccount(account); setShowBankForm(true); }}
                                data-testid={`button-edit-account-${account.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingAccount(account)}
                                data-testid={`button-delete-account-${account.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">{typeLabel(account.accountType)}{account.accountSubtype ? ` · ${account.accountSubtype}` : ""}</p>
                        {account.maskedNumber && (
                          <p className="text-xs text-muted-foreground font-mono">{account.maskedNumber}</p>
                        )}
                      </div>

                      <div className="pt-1 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-0.5">Saldo</p>
                        <p className={`text-lg font-bold ${isLow ? "text-destructive" : "text-foreground"}`}>
                          {fmt(balance, account.currency)}
                        </p>
                        {account.accountType === "tarjeta_credito" && account.creditLimit && (
                          <p className="text-xs text-muted-foreground">
                            Límite: {fmt(account.creditLimit, account.currency)} · Disponible: {fmt(Number(account.creditLimit) + balance, account.currency)}
                          </p>
                        )}
                      </div>

                      {account.accountType === "tarjeta_credito" && account.statementClosingDay && (
                        <p className="text-xs text-muted-foreground">
                          Corte: día {account.statementClosingDay} · Pago: día {account.paymentDueDay ?? "—"}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {activeAccounts.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Sin cuentas bancarias</p>
                  {!isReadOnly && <p className="text-sm mt-1">Crea tu primera cuenta usando el botón "Nueva cuenta"</p>}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TRANSACCIONES ── */}
        <TabsContent value="transacciones" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-3">
                <Select
                  value={txFilter.accountId}
                  onValueChange={(v) => setTxFilter((p) => ({ ...p, accountId: v }))}
                >
                  <SelectTrigger className="w-48" data-testid="filter-account">
                    <SelectValue placeholder="Todas las cuentas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las cuentas</SelectItem>
                    {accounts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={txFilter.type}
                  onValueChange={(v) => setTxFilter((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger className="w-36" data-testid="filter-type">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="entrada">Entradas</SelectItem>
                    <SelectItem value="salida">Salidas</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={txFilter.status}
                  onValueChange={(v) => setTxFilter((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger className="w-36" data-testid="filter-status">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="processed">Procesado</SelectItem>
                    <SelectItem value="reconciled">Conciliado</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Buscar descripción..."
                  className="w-52"
                  value={txFilter.search}
                  onChange={(e) => setTxFilter((p) => ({ ...p, search: e.target.value }))}
                  data-testid="input-search-transactions"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                  ) : transactions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin transacciones</TableCell></TableRow>
                  ) : transactions.map((tx: any) => (
                    <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {tx.date ? format(new Date(tx.date), "dd/MM/yyyy", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{tx.accountName ?? "—"}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {tx.description}
                        {tx.reference && <span className="text-muted-foreground ml-1">#{tx.reference}</span>}
                      </TableCell>
                      <TableCell>{txTypeBadge(tx.type)}</TableCell>
                      <TableCell className={`text-right font-mono font-medium text-sm ${tx.type === "entrada" ? "text-primary" : "text-foreground"}`}>
                        {tx.type === "entrada" ? "+" : "-"}{fmt(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell>{statusBadge(tx.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TRANSFERENCIAS ── */}
        <TabsContent value="transferencias" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {!isReadOnly && (
              <Button onClick={() => setShowTransferForm(true)} data-testid="button-new-transfer">
                <ArrowLeftRight className="h-4 w-4 mr-2" /> Nueva transferencia
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter((t: any) => t.source === "transfer" && t.type === "salida").length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin transferencias</TableCell></TableRow>
                  ) : transactions.filter((t: any) => t.source === "transfer" && t.type === "salida").map((tx: any) => (
                    <TableRow key={tx.id} data-testid={`row-transfer-${tx.id}`}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {tx.date ? format(new Date(tx.date), "dd/MM/yyyy", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{tx.description}</TableCell>
                      <TableCell className="text-sm">{tx.accountName ?? "—"}</TableCell>
                      <TableCell className="text-sm">{tx.transferAccountName ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(tx.amount, tx.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONCILIACIÓN ── */}
        <TabsContent value="conciliacion" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={recoFilter} onValueChange={setRecoFilter}>
              <SelectTrigger className="w-56" data-testid="filter-reco-account">
                <SelectValue placeholder="Todas las cuentas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {accounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!isReadOnly && (
              <Button
                onClick={handleReconcile}
                disabled={recoSelected.size === 0 || reconciling}
                data-testid="button-reconcile"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {reconciling ? "Conciliando..." : `Conciliar (${recoSelected.size})`}
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={recoTxs.length > 0 && recoSelected.size === recoTxs.length}
                        onCheckedChange={toggleAllReco}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recoLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                  ) : recoTxs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground text-sm">No hay transacciones pendientes de conciliar</p>
                      </TableCell>
                    </TableRow>
                  ) : recoTxs.map((tx: any) => (
                    <TableRow key={tx.id} data-testid={`row-reco-${tx.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={recoSelected.has(tx.id)}
                          onCheckedChange={() => toggleReco(tx.id)}
                          data-testid={`checkbox-reco-${tx.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {tx.date ? format(new Date(tx.date), "dd/MM/yyyy", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{tx.accountName ?? "—"}</TableCell>
                      <TableCell className="text-sm">{tx.description}</TableCell>
                      <TableCell>{txTypeBadge(tx.type)}</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${tx.type === "entrada" ? "text-primary" : ""}`}>
                        {tx.type === "entrada" ? "+" : "-"}{fmt(tx.amount, tx.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {!isReadOnly && recoTxs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              La conciliación es irreversible. Una vez marcadas las transacciones como conciliadas, no podrán modificarse.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Modales */}
      <BankForm
        open={showBankForm}
        onOpenChange={(o) => { setShowBankForm(o); if (!o) setEditingAccount(null); }}
        editingAccount={editingAccount}
      />

      <AlertDialog open={!!deletingAccount} onOpenChange={(o) => !o && setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta bancaria?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará la cuenta "{deletingAccount?.name}". Esta acción puede revertirse desde la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAccount && deleteMutation.mutate(deletingAccount.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Formulario de transferencia */}
      <Dialog open={showTransferForm} onOpenChange={setShowTransferForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva transferencia</DialogTitle>
          </DialogHeader>
          <Form {...transferForm}>
            <form onSubmit={transferForm.handleSubmit((d) => transferMutation.mutate(d))} className="space-y-4">
              <FormField control={transferForm.control} name="fromAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta origen</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-from-account"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({fmt(a.balance, a.currency)})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={transferForm.control} name="toAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta destino</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-to-account"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({fmt(a.balance, a.currency)})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={transferForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" data-testid="input-transfer-amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={transferForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Motivo de la transferencia" data-testid="input-transfer-description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={transferForm.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: REF-001" data-testid="input-transfer-reference" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={transferForm.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" data-testid="input-transfer-date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTransferForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={transferMutation.isPending} data-testid="button-submit-transfer">
                  {transferMutation.isPending ? "Transfiriendo..." : "Transferir"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Formulario de transacción manual */}
      <Dialog open={showTxForm} onOpenChange={setShowTxForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva transacción</DialogTitle>
          </DialogHeader>
          <Form {...txForm}>
            <form onSubmit={txForm.handleSubmit((d) => txMutation.mutate(d))} className="space-y-4">
              <FormField control={txForm.control} name="bankAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tx-account"><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={txForm.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="salida">Salida</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={txForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" data-testid="input-tx-amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={txForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Descripción de la transacción" data-testid="input-tx-description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={txForm.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: CHQ-001" data-testid="input-tx-reference" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={txForm.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" data-testid="input-tx-date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTxForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={txMutation.isPending} data-testid="button-submit-tx">
                  {txMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
