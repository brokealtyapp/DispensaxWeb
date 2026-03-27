import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/lib/auth-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  DollarSign, 
  Package, 
  TrendingDown, 
  ArrowDownUp, 
  CheckCircle2,
  AlertCircle,
  Clock,
  Banknote,
  Building2,
  Truck,
  ShoppingCart,
  Trash2,
  Plus,
  Coins,
  Loader2,
  Eye,
  Wallet,
  UserCheck
} from "lucide-react";
import { RD_DENOMINATIONS } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const cashMovementFormSchema = z.object({
  type: z.string().min(1, "Selecciona un tipo"),
  amount: z.string().min(1, "Ingresa el monto"),
  expectedAmount: z.string().optional(),
  userId: z.string().min(1, "Selecciona un usuario"),
  notes: z.string().optional(),
});

const shrinkageFormSchema = z.object({
  shrinkageType: z.string().min(1, "Selecciona un tipo"),
  productId: z.string().min(1, "Selecciona un producto"),
  quantity: z.string().min(1, "Ingresa la cantidad"),
  userId: z.string().min(1, "Selecciona quién reporta"),
  reason: z.string().optional(),
});

type CashMovementFormData = z.infer<typeof cashMovementFormSchema>;
type ShrinkageFormData = z.infer<typeof shrinkageFormSchema>;

export function MoneyProductsPage() {
  const { toast } = useToast();
  const { canCreate } = usePermissions();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("cash");
  const [isNewMovementOpen, setIsNewMovementOpen] = useState(false);
  const [isNewShrinkageOpen, setIsNewShrinkageOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [entregaDenomQtys, setEntregaDenomQtys] = useState<Record<number, number>>(
    () => Object.fromEntries(RD_DENOMINATIONS.map(d => [d.value, 0]))
  );
  const [isEntregaDialogOpen, setIsEntregaDialogOpen] = useState(false);

  const cashMovementForm = useForm<CashMovementFormData>({
    resolver: zodResolver(cashMovementFormSchema),
    defaultValues: {
      type: "",
      amount: "",
      expectedAmount: "",
      userId: "",
      notes: "",
    },
  });

  const shrinkageForm = useForm<ShrinkageFormData>({
    resolver: zodResolver(shrinkageFormSchema),
    defaultValues: {
      shrinkageType: "",
      productId: "",
      quantity: "",
      userId: "",
      reason: "",
    },
  });
  
  const { data: cashMovements, isLoading: cashLoading } = useQuery<any[]>({
    queryKey: ["/api/cash-movements"],
  });

  const { data: cashSummary } = useQuery<any>({
    queryKey: ["/api/cash-movements/summary"],
  });

  const { data: productTransfers, isLoading: transfersLoading } = useQuery<any[]>({
    queryKey: ["/api/product-transfers"],
  });

  const { data: shrinkageRecords, isLoading: shrinkageLoading } = useQuery<any[]>({
    queryKey: ["/api/shrinkage"],
  });

  const { data: shrinkageSummary } = useQuery<any>({
    queryKey: ["/api/shrinkage/summary"],
  });

  const { data: dailyReconciliation } = useQuery<any>({
    queryKey: ["/api/reconciliation/daily"],
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const createCashMovementMutation = useMutation({
    mutationFn: async (data: CashMovementFormData) => {
      return apiRequest("POST", "/api/cash-movements", {
        ...data,
        amount: parseFloat(data.amount),
        expectedAmount: data.expectedAmount ? parseFloat(data.expectedAmount) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cash-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-movements/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/daily"] });
      toast({ title: "Movimiento registrado", description: "El movimiento de efectivo se ha registrado correctamente" });
      setIsNewMovementOpen(false);
      cashMovementForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar el movimiento", variant: "destructive" });
    },
  });

  const createShrinkageMutation = useMutation({
    mutationFn: async (data: ShrinkageFormData) => {
      return apiRequest("POST", "/api/shrinkage", {
        ...data,
        quantity: parseInt(data.quantity),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shrinkage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shrinkage/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reconciliation/daily"] });
      toast({ title: "Merma registrada", description: "La merma se ha registrado correctamente" });
      setIsNewShrinkageOpen(false);
      shrinkageForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar la merma", variant: "destructive" });
    },
  });

  const { data: cashCollections, isLoading: collectionsLoading } = useQuery<any[]>({
    queryKey: ["/api/supplier/cash"],
  });

  const { data: selectedReconciliation, isLoading: reconciliationLoading } = useQuery<any>({
    queryKey: ["/api/supplier/cash", selectedCollectionId, "reconciliation"],
    enabled: !!selectedCollectionId,
  });

  const entregaTotal = RD_DENOMINATIONS.reduce((sum, d) => sum + d.value * (entregaDenomQtys[d.value] || 0), 0);

  const createEntregaDenominationsMutation = useMutation({
    mutationFn: async ({ collectionId, denominations }: { collectionId: string; denominations: any[] }) => {
      return apiRequest("POST", `/api/supplier/cash/${collectionId}/denominations`, {
        countType: "entrega",
        denominations,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier/cash"] });
      if (selectedCollectionId) {
        queryClient.invalidateQueries({ queryKey: ["/api/supplier/cash", selectedCollectionId, "reconciliation"] });
      }
      toast({ title: "Conteo de entrega registrado", description: "El cuadre de denominaciones se ha actualizado" });
      setIsEntregaDialogOpen(false);
      setEntregaDenomQtys(Object.fromEntries(RD_DENOMINATIONS.map(d => [d.value, 0])));
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar el conteo de entrega", variant: "destructive" });
    },
  });

  const handleSubmitEntrega = () => {
    if (!selectedCollectionId) return;
    const denomsToSend = RD_DENOMINATIONS
      .filter(d => (entregaDenomQtys[d.value] || 0) > 0)
      .map(d => ({
        denomination: d.value,
        quantity: entregaDenomQtys[d.value],
        denominationType: d.type,
      }));
    if (denomsToSend.length === 0) {
      toast({ title: "Sin datos", description: "Ingresa al menos una denominación", variant: "destructive" });
      return;
    }
    createEntregaDenominationsMutation.mutate({ collectionId: selectedCollectionId, denominations: denomsToSend });
  };

  const openEntregaDialog = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    setEntregaDenomQtys(Object.fromEntries(RD_DENOMINATIONS.map(d => [d.value, 0])));
    setIsEntregaDialogOpen(true);
  };

  const viewReconciliation = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    setActiveTab("denominations");
  };

  const [isChangeFundDialogOpen, setIsChangeFundDialogOpen] = useState(false);
  const [changeFundSupplierId, setChangeFundSupplierId] = useState("");
  const [changeFundNotes, setChangeFundNotes] = useState("");
  const [changeFundDenomQtys, setChangeFundDenomQtys] = useState<Record<number, number>>(
    () => Object.fromEntries(RD_DENOMINATIONS.map(d => [d.value, 0]))
  );

  const { data: changeFunds, isLoading: changeFundsLoading } = useQuery<any[]>({
    queryKey: ["/api/change-funds"],
  });

  const suppliers = (users || []).filter((u: any) => u.role === "abastecedor");

  const changeFundTotal = RD_DENOMINATIONS.reduce((sum, d) => sum + d.value * (changeFundDenomQtys[d.value] || 0), 0);

  const createChangeFundMutation = useMutation({
    mutationFn: async () => {
      const denominations = RD_DENOMINATIONS
        .filter(d => (changeFundDenomQtys[d.value] || 0) > 0)
        .map(d => ({
          denomination: d.value,
          quantity: changeFundDenomQtys[d.value],
          denominationType: d.type,
        }));
      return apiRequest("POST", "/api/change-funds", {
        supplierId: changeFundSupplierId,
        notes: changeFundNotes || undefined,
        denominations,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-funds"] });
      toast({ title: "Fondo de cambio creado", description: "El fondo de cambio ha sido asignado al abastecedor" });
      setIsChangeFundDialogOpen(false);
      setChangeFundSupplierId("");
      setChangeFundNotes("");
      setChangeFundDenomQtys(Object.fromEntries(RD_DENOMINATIONS.map(d => [d.value, 0])));
    },
    onError: async (error: any) => {
      let message = "No se pudo crear el fondo de cambio";
      try { const resp = await error?.response?.json?.(); if (resp?.error) message = resp.error; } catch {}
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const markFundReturnedMutation = useMutation({
    mutationFn: async (fundId: string) => {
      return apiRequest("PATCH", `/api/change-funds/${fundId}/status`, { status: "devuelto" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-funds"] });
      toast({ title: "Fondo devuelto", description: "El fondo de cambio ha sido marcado como devuelto" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el estado del fondo", variant: "destructive" });
    },
  });

  const getChangeFundStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      activo: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      usado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      devuelto: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    return <Badge className={styles[status] || ""} data-testid={`badge-fund-status-${status}`}>{status}</Badge>;
  };

  const onCashMovementSubmit = (data: CashMovementFormData) => {
    createCashMovementMutation.mutate(data);
  };

  const onShrinkageSubmit = (data: ShrinkageFormData) => {
    createShrinkageMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pendiente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      entregado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      depositado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      conciliado: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      aprobado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return <Badge className={styles[status] || ""} data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  const getMovementTypeIcon = (type: string) => {
    const icons: Record<string, JSX.Element> = {
      recoleccion_maquina: <ShoppingCart className="h-4 w-4" />,
      entrega_oficina: <Building2 className="h-4 w-4" />,
      deposito_bancario: <Banknote className="h-4 w-4" />,
      ajuste_positivo: <TrendingDown className="h-4 w-4 rotate-180" />,
      ajuste_negativo: <TrendingDown className="h-4 w-4" />,
    };
    return icons[type] || <DollarSign className="h-4 w-4" />;
  };

  const getShrinkageTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      caducidad: "Caducidad",
      danio: "Daño",
      robo: "Robo",
      perdida: "Pérdida",
      error_conteo: "Error de Conteo",
      otro: "Otro",
    };
    return labels[type] || type;
  };

  const getTransferTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      almacen_a_abastecedor: "Almacén → Abastecedor",
      abastecedor_a_maquina: "Abastecedor → Máquina",
      maquina_a_abastecedor: "Máquina → Abastecedor",
      abastecedor_a_almacen: "Abastecedor → Almacén",
      devolucion: "Devolución",
    };
    return labels[type] || type;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Productos y Dinero</h1>
            <p className="text-muted-foreground" data-testid="text-page-subtitle">Control transversal de efectivo, productos y mermas</p>
          </div>
          <div className="flex gap-2">
            {canCreate("warehouse_movements") && (
              <Button 
                variant="outline" 
                onClick={() => setIsNewShrinkageOpen(true)}
                data-testid="button-new-shrinkage"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Registrar Merma
              </Button>
            )}
            {canCreate("cash_collections") && (
              <Button 
                onClick={() => setIsNewMovementOpen(true)}
                data-testid="button-new-movement"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Movimiento
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-cash">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Efectivo Total Hoy</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-cash">{formatCurrency(cashSummary?.total || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {cashSummary?.pending > 0 && `${formatCurrency(cashSummary.pending)} pendiente`}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-deposited">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Depositado</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-deposited">{formatCurrency(cashSummary?.deposited || 0)}</div>
              <p className="text-xs text-muted-foreground">Depósitos bancarios</p>
            </CardContent>
          </Card>

          <Card data-testid="card-differences">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Diferencias</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(cashSummary?.differences || 0) < 0 ? 'text-red-600' : 'text-green-600'}`} data-testid="text-differences">
                {formatCurrency(Math.abs(cashSummary?.differences || 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                {(cashSummary?.differences || 0) < 0 ? 'Faltante' : 'Sobrante'}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-shrinkage">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Mermas del Mes</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-shrinkage">{formatCurrency(shrinkageSummary?.totalCost || 0)}</div>
              <p className="text-xs text-muted-foreground">{shrinkageSummary?.totalQuantity || 0} unidades</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6" data-testid="tabs-money-products">
            <TabsTrigger value="cash" data-testid="tab-trigger-cash">
              <DollarSign className="h-4 w-4 mr-2" />
              Efectivo
            </TabsTrigger>
            <TabsTrigger value="transfers" data-testid="tab-trigger-transfers">
              <ArrowDownUp className="h-4 w-4 mr-2" />
              Transferencias
            </TabsTrigger>
            <TabsTrigger value="shrinkage" data-testid="tab-trigger-shrinkage">
              <Trash2 className="h-4 w-4 mr-2" />
              Mermas
            </TabsTrigger>
            <TabsTrigger value="denominations" data-testid="tab-trigger-denominations">
              <Coins className="h-4 w-4 mr-2" />
              Denominaciones
            </TabsTrigger>
            <TabsTrigger value="changefund" data-testid="tab-trigger-changefund">
              <Wallet className="h-4 w-4 mr-2" />
              Fondo Cambio
            </TabsTrigger>
            <TabsTrigger value="reconciliation" data-testid="tab-trigger-reconciliation">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Conciliación
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cash" className="mt-4" data-testid="tab-content-cash">
            <Card>
              <CardHeader>
                <CardTitle>Movimientos de Efectivo</CardTitle>
                <CardDescription>Recolecciones, entregas y depósitos</CardDescription>
              </CardHeader>
              <CardContent>
                {cashLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : cashMovements?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-cash">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay movimientos de efectivo registrados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cashMovements?.map((movement) => (
                      <div 
                        key={movement.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`row-cash-movement-${movement.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-muted rounded-lg">
                            {getMovementTypeIcon(movement.type)}
                          </div>
                          <div>
                            <p className="font-medium capitalize" data-testid={`text-movement-type-${movement.id}`}>{movement.type.replace(/_/g, " ")}</p>
                            <p className="text-sm text-muted-foreground">
                              {movement.user?.fullName || movement.user?.username} · {formatDateTime(movement.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-lg" data-testid={`text-movement-amount-${movement.id}`}>{formatCurrency(movement.amount)}</p>
                            {movement.difference && parseFloat(movement.difference) !== 0 && (
                              <p className={`text-sm ${parseFloat(movement.difference) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {parseFloat(movement.difference) < 0 ? '-' : '+'}{formatCurrency(Math.abs(parseFloat(movement.difference)))}
                              </p>
                            )}
                          </div>
                          {getStatusBadge(movement.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transfers" className="mt-4" data-testid="tab-content-transfers">
            <Card>
              <CardHeader>
                <CardTitle>Transferencias de Productos</CardTitle>
                <CardDescription>Movimientos entre almacén, abastecedores y máquinas</CardDescription>
              </CardHeader>
              <CardContent>
                {transfersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : productTransfers?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-transfers">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay transferencias registradas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productTransfers?.map((transfer) => (
                      <div 
                        key={transfer.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`row-transfer-${transfer.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-muted rounded-lg">
                            <Truck className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-transfer-product-${transfer.id}`}>{transfer.product?.name || "Producto"}</p>
                            <p className="text-sm text-muted-foreground">{getTransferTypeLabel(transfer.transferType)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold" data-testid={`text-transfer-qty-${transfer.id}`}>{transfer.quantity} unidades</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(transfer.createdAt)}
                            </p>
                          </div>
                          {getStatusBadge(transfer.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shrinkage" className="mt-4" data-testid="tab-content-shrinkage">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Registro de Mermas</CardTitle>
                  <CardDescription>Productos caducos, dañados o perdidos</CardDescription>
                </div>
                {shrinkageSummary && (
                  <div className="flex gap-2">
                    {Object.entries(shrinkageSummary.byType || {}).map(([type, data]) => (
                      <Badge key={type} variant="outline" data-testid={`badge-shrinkage-type-${type}`}>
                        {getShrinkageTypeLabel(type)}: {(data as any).quantity || 0}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {shrinkageLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : shrinkageRecords?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-shrinkage">
                    <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay mermas registradas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shrinkageRecords?.map((record) => (
                      <div 
                        key={record.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`row-shrinkage-${record.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-shrinkage-product-${record.id}`}>{record.product?.name || "Producto"}</p>
                            <p className="text-sm text-muted-foreground">
                              {getShrinkageTypeLabel(record.shrinkageType)} · {record.user?.fullName || record.user?.username}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-red-600" data-testid={`text-shrinkage-qty-${record.id}`}>-{record.quantity} unidades</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(parseFloat(record.totalLoss || "0"))} pérdida
                            </p>
                          </div>
                          {getStatusBadge(record.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="denominations" className="mt-4" data-testid="tab-content-denominations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recolecciones para Cuadre</CardTitle>
                  <CardDescription>Selecciona una recolección para registrar conteo de entrega o ver cuadre</CardDescription>
                </CardHeader>
                <CardContent>
                  {collectionsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : !cashCollections || cashCollections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-denominations">
                      <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay recolecciones registradas</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {cashCollections.map((collection: any) => (
                        <div
                          key={collection.id}
                          className={`p-3 border rounded-md hover-elevate cursor-pointer ${selectedCollectionId === collection.id ? "border-primary bg-muted/50" : ""}`}
                          onClick={() => viewReconciliation(collection.id)}
                          data-testid={`collection-row-${collection.id}`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <p className="font-medium text-sm">{collection.machine?.name || "Máquina"}</p>
                              <p className="text-xs text-muted-foreground">
                                {collection.user?.fullName || collection.user?.username} · {formatDateTime(collection.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{formatCurrency(parseFloat(collection.actualAmount))}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); openEntregaDialog(collection.id); }}
                                data-testid={`button-entrega-${collection.id}`}
                              >
                                <Coins className="h-3 w-3 mr-1" />
                                Entrega
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); viewReconciliation(collection.id); }}
                                data-testid={`button-view-reconciliation-${collection.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cuadre de Denominaciones</CardTitle>
                  <CardDescription>
                    {selectedCollectionId ? "Comparación conteo máquina vs entrega almacén" : "Selecciona una recolección para ver el cuadre"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedCollectionId ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Selecciona una recolección de la lista</p>
                    </div>
                  ) : reconciliationLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : selectedReconciliation ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-muted rounded-lg text-center" data-testid="stat-total-maquina">
                          <p className="text-xs text-muted-foreground">Conteo Máquina</p>
                          <p className="text-lg font-bold">{formatCurrency(selectedReconciliation.totalMaquina || 0)}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center" data-testid="stat-total-fondo">
                          <p className="text-xs text-muted-foreground">Fondo Cambio</p>
                          <p className="text-lg font-bold text-orange-600">{formatCurrency(selectedReconciliation.totalFondoCambio || 0)}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center" data-testid="stat-total-entrega">
                          <p className="text-xs text-muted-foreground">Conteo Entrega</p>
                          <p className="text-lg font-bold">{formatCurrency(selectedReconciliation.totalEntrega || 0)}</p>
                        </div>
                        <div className={`p-3 rounded-lg text-center ${(selectedReconciliation.difference || 0) === 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`} data-testid="stat-denomination-difference">
                          <p className="text-xs text-muted-foreground">Diferencia</p>
                          <p className={`text-lg font-bold ${(selectedReconciliation.difference || 0) === 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(Math.abs(selectedReconciliation.difference || 0))}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Fórmula: Entrega - (Máquina + Fondo) = Diferencia
                      </p>

                      {(selectedReconciliation.maquina?.length > 0 || selectedReconciliation.entrega?.length > 0 || selectedReconciliation.fondoCambio?.length > 0) ? (
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted">
                                <th className="p-2 text-left">Denominación</th>
                                <th className="p-2 text-center">Máquina</th>
                                <th className="p-2 text-center">Fondo</th>
                                <th className="p-2 text-center">Entrega</th>
                                <th className="p-2 text-right">Diferencia</th>
                              </tr>
                            </thead>
                            <tbody>
                              {RD_DENOMINATIONS.map((d) => {
                                const maq = selectedReconciliation.maquina?.find((c: any) => parseFloat(c.denomination) === d.value);
                                const fondo = selectedReconciliation.fondoCambio?.find((c: any) => parseFloat(c.denomination) === d.value);
                                const ent = selectedReconciliation.entrega?.find((c: any) => parseFloat(c.denomination) === d.value);
                                const maqQty = maq?.quantity || 0;
                                const fondoQty = fondo?.quantity || 0;
                                const entQty = ent?.quantity || 0;
                                const diff = entQty - (maqQty + fondoQty);
                                if (maqQty === 0 && entQty === 0 && fondoQty === 0) return null;
                                return (
                                  <tr key={d.value} className="border-t" data-testid={`reconciliation-row-${d.value}`}>
                                    <td className="p-2">
                                      <Badge variant="outline" className="text-xs">{d.label}</Badge>
                                    </td>
                                    <td className="p-2 text-center">{maqQty}</td>
                                    <td className="p-2 text-center text-orange-600">{fondoQty}</td>
                                    <td className="p-2 text-center">{entQty}</td>
                                    <td className={`p-2 text-right font-medium ${diff === 0 ? "text-green-600" : "text-red-600"}`}>
                                      {diff === 0 ? "OK" : (diff > 0 ? `+${diff}` : diff)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          <p>No hay conteos registrados para esta recolección</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No hay datos de cuadre disponibles</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="changefund" className="mt-4" data-testid="tab-content-changefund">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle>Fondo de Cambio</CardTitle>
                  <CardDescription>Dinero en denominaciones que el abastecedor lleva desde almacén para dar cambio</CardDescription>
                </div>
                {(user?.role === "admin" || user?.role === "almacen") && (
                  <Button onClick={() => setIsChangeFundDialogOpen(true)} data-testid="button-new-change-fund">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Fondo
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {changeFundsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !changeFunds || changeFunds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-change-funds">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay fondos de cambio registrados</p>
                    <p className="text-sm mt-1">Crea un fondo para que el abastecedor lleve cambio</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {changeFunds.map((fund: any) => (
                      <div
                        key={fund.id}
                        className="p-4 border rounded-md"
                        data-testid={`change-fund-row-${fund.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                              <UserCheck className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-medium" data-testid={`text-fund-supplier-${fund.id}`}>
                                {fund.supplier?.fullName || fund.supplier?.username || "Abastecedor"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(fund.createdAt)}
                                {fund.notes && ` · ${fund.notes}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold" data-testid={`text-fund-amount-${fund.id}`}>
                              {formatCurrency(parseFloat(fund.totalAmount))}
                            </span>
                            {getChangeFundStatusBadge(fund.status)}
                            {fund.status === "activo" && (user?.role === "admin" || user?.role === "almacen") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markFundReturnedMutation.mutate(fund.id)}
                                disabled={markFundReturnedMutation.isPending}
                                data-testid={`button-return-fund-${fund.id}`}
                              >
                                Marcar Devuelto
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="mt-4" data-testid="tab-content-reconciliation">
            <Card>
              <CardHeader>
                <CardTitle>Conciliación Diaria</CardTitle>
                <CardDescription>Resumen de efectivo esperado vs recolectado</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyReconciliation ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-muted rounded-lg" data-testid="stat-collected">
                        <p className="text-sm text-muted-foreground">Recolectado</p>
                        <p className="text-2xl font-bold">{formatCurrency(dailyReconciliation.totalCollected || 0)}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg" data-testid="stat-expected">
                        <p className="text-sm text-muted-foreground">Esperado</p>
                        <p className="text-2xl font-bold">{formatCurrency(dailyReconciliation.totalExpected || 0)}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg" data-testid="stat-difference">
                        <p className="text-sm text-muted-foreground">Diferencia</p>
                        <p className={`text-2xl font-bold ${dailyReconciliation.totalDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(Math.abs(dailyReconciliation.totalDifference || 0))}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg" data-testid="stat-deposited">
                        <p className="text-sm text-muted-foreground">Depositado</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(dailyReconciliation.totalDeposited || 0)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="flex items-center gap-3 p-4 border rounded-lg" data-testid="stat-pending-movements">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Movimientos Pendientes</p>
                          <p className="font-bold">{dailyReconciliation.pendingMovements}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 border rounded-lg" data-testid="stat-collections">
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Recolecciones</p>
                          <p className="font-bold">{dailyReconciliation.collectionsCount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 border rounded-lg" data-testid="stat-deposits">
                        <Banknote className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Depósitos</p>
                          <p className="font-bold">{dailyReconciliation.depositsCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-reconciliation">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay datos de conciliación</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isNewMovementOpen} onOpenChange={setIsNewMovementOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Movimiento de Efectivo</DialogTitle>
              <DialogDescription>Registra una recolección, entrega o depósito</DialogDescription>
            </DialogHeader>
            <Form {...cashMovementForm}>
              <form onSubmit={cashMovementForm.handleSubmit(onCashMovementSubmit)} className="space-y-4">
                <FormField
                  control={cashMovementForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Movimiento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-type">
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="recoleccion_maquina" data-testid="option-recoleccion">Recolección de Máquina</SelectItem>
                          <SelectItem value="entrega_oficina" data-testid="option-entrega">Entrega a Oficina</SelectItem>
                          <SelectItem value="deposito_bancario" data-testid="option-deposito">Depósito Bancario</SelectItem>
                          <SelectItem value="ajuste_positivo" data-testid="option-ajuste-pos">Ajuste Positivo</SelectItem>
                          <SelectItem value="ajuste_negativo" data-testid="option-ajuste-neg">Ajuste Negativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={cashMovementForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto Real</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            type="number" 
                            step="0.01" 
                            data-testid="input-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={cashMovementForm.control}
                    name="expectedAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto Esperado (opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            type="number" 
                            step="0.01"
                            data-testid="input-expected-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={cashMovementForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user">
                            <SelectValue placeholder="Seleccionar usuario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id} data-testid={`option-user-${user.id}`}>
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
                  control={cashMovementForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas (opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="Observaciones adicionales..."
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewMovementOpen(false)} data-testid="button-cancel-movement">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createCashMovementMutation.isPending} data-testid="button-submit-movement">
                    {createCashMovementMutation.isPending ? "Registrando..." : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isNewShrinkageOpen} onOpenChange={setIsNewShrinkageOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Merma</DialogTitle>
              <DialogDescription>Registra productos caducos, dañados o perdidos</DialogDescription>
            </DialogHeader>
            <Form {...shrinkageForm}>
              <form onSubmit={shrinkageForm.handleSubmit(onShrinkageSubmit)} className="space-y-4">
                <FormField
                  control={shrinkageForm.control}
                  name="shrinkageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Merma</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-shrinkage-type">
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="caducidad" data-testid="option-caducidad">Caducidad</SelectItem>
                          <SelectItem value="danio" data-testid="option-danio">Daño</SelectItem>
                          <SelectItem value="robo" data-testid="option-robo">Robo</SelectItem>
                          <SelectItem value="perdida" data-testid="option-perdida">Pérdida</SelectItem>
                          <SelectItem value="error_conteo" data-testid="option-error">Error de Conteo</SelectItem>
                          <SelectItem value="otro" data-testid="option-otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={shrinkageForm.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Producto</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-product">
                            <SelectValue placeholder="Seleccionar producto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id} data-testid={`option-product-${product.id}`}>
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
                    control={shrinkageForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            type="number" 
                            min="1" 
                            data-testid="input-quantity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={shrinkageForm.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reportado por</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-reported-by">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users?.map((user) => (
                              <SelectItem key={user.id} value={user.id} data-testid={`option-reporter-${user.id}`}>
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
                  control={shrinkageForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          placeholder="Describe el motivo de la merma..."
                          data-testid="input-reason"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewShrinkageOpen(false)} data-testid="button-cancel-shrinkage">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createShrinkageMutation.isPending} data-testid="button-submit-shrinkage">
                    {createShrinkageMutation.isPending ? "Registrando..." : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEntregaDialogOpen} onOpenChange={setIsEntregaDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conteo de Entrega por Denominación</DialogTitle>
              <DialogDescription>Registra el conteo de dinero al momento de la entrega en almacén</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {RD_DENOMINATIONS.map((d) => (
                  <div key={d.value} className="flex items-center gap-2 p-2 border rounded-md" data-testid={`entrega-denomination-row-${d.value}`}>
                    <Badge variant="outline" className="min-w-[70px] justify-center text-xs">
                      {d.label}
                    </Badge>
                    <Input
                      type="number"
                      min="0"
                      className="h-8 w-16 text-center text-sm"
                      value={entregaDenomQtys[d.value] || ""}
                      onChange={(e) => setEntregaDenomQtys(prev => ({ ...prev, [d.value]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      placeholder="0"
                      data-testid={`input-entrega-denomination-${d.value}`}
                    />
                    <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                      {formatCurrency(d.value * (entregaDenomQtys[d.value] || 0))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total entrega:</span>
                  <span className="text-lg font-bold" data-testid="text-entrega-total">{formatCurrency(entregaTotal)}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEntregaDialogOpen(false)} data-testid="button-cancel-entrega">
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitEntrega}
                  disabled={entregaTotal <= 0 || createEntregaDenominationsMutation.isPending}
                  data-testid="button-submit-entrega"
                >
                  {createEntregaDenominationsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Registrar Entrega
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isChangeFundDialogOpen} onOpenChange={setIsChangeFundDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Fondo de Cambio</DialogTitle>
              <DialogDescription>Asigna un fondo en denominaciones a un abastecedor</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Abastecedor</label>
                <Select onValueChange={setChangeFundSupplierId} value={changeFundSupplierId}>
                  <SelectTrigger data-testid="select-change-fund-supplier">
                    <SelectValue placeholder="Seleccionar abastecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((u: any) => (
                      <SelectItem key={u.id} value={u.id} data-testid={`option-supplier-${u.id}`}>
                        {u.fullName || u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Denominaciones</label>
                <div className="grid grid-cols-2 gap-2">
                  {RD_DENOMINATIONS.map((d) => (
                    <div key={d.value} className="flex items-center gap-2 p-2 border rounded-md" data-testid={`fund-denomination-row-${d.value}`}>
                      <Badge variant="outline" className="min-w-[70px] justify-center text-xs">
                        {d.label}
                      </Badge>
                      <Input
                        type="number"
                        min="0"
                        className="h-8 w-16 text-center text-sm"
                        value={changeFundDenomQtys[d.value] || ""}
                        onChange={(e) => setChangeFundDenomQtys(prev => ({ ...prev, [d.value]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        placeholder="0"
                        data-testid={`input-fund-denomination-${d.value}`}
                      />
                      <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                        {formatCurrency(d.value * (changeFundDenomQtys[d.value] || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notas (opcional)</label>
                <Textarea
                  value={changeFundNotes}
                  onChange={(e) => setChangeFundNotes(e.target.value)}
                  placeholder="Notas sobre el fondo..."
                  data-testid="input-change-fund-notes"
                />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total fondo:</span>
                  <span className="text-lg font-bold text-orange-600" data-testid="text-fund-total">{formatCurrency(changeFundTotal)}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsChangeFundDialogOpen(false)} data-testid="button-cancel-change-fund">
                  Cancelar
                </Button>
                <Button
                  onClick={() => createChangeFundMutation.mutate()}
                  disabled={changeFundTotal <= 0 || !changeFundSupplierId || createChangeFundMutation.isPending}
                  data-testid="button-submit-change-fund"
                >
                  {createChangeFundMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Crear Fondo
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
