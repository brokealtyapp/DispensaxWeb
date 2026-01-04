import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDate, formatTime, formatDateTime } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Wallet,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  History,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Fuel,
  Wrench,
  Coffee,
  FileText,
  Truck,
  Package
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const fundFormSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  maxAmount: z.string().min(1, "Monto máximo requerido"),
  initialBalance: z.string().min(1, "Saldo inicial requerido"),
  replenishThreshold: z.string().optional(),
});

const expenseFormSchema = z.object({
  category: z.string().min(1, "Categoría requerida"),
  description: z.string().min(1, "Descripción requerida"),
  amount: z.string().min(1, "Monto requerido"),
  userId: z.string().min(1, "Solicitante requerido"),
  machineId: z.string().optional(),
  receiptNumber: z.string().optional(),
  reason: z.string().optional(),
});

const replenishFormSchema = z.object({
  amount: z.string().min(1, "Monto requerido"),
  userId: z.string().min(1, "Autorizado por requerido"),
});

type FundFormData = z.infer<typeof fundFormSchema>;
type ExpenseFormData = z.infer<typeof expenseFormSchema>;
type ReplenishFormData = z.infer<typeof replenishFormSchema>;

export function PettyCashPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("expenses");
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [isReplenishOpen, setIsReplenishOpen] = useState(false);
  const [isInitFundOpen, setIsInitFundOpen] = useState(false);

  const fundForm = useForm<FundFormData>({
    resolver: zodResolver(fundFormSchema),
    defaultValues: {
      name: "Caja Chica Principal",
      maxAmount: "5000",
      initialBalance: "5000",
      replenishThreshold: "1000",
    },
  });

  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category: "",
      description: "",
      amount: "",
      userId: "",
      machineId: "",
      receiptNumber: "",
      reason: "",
    },
  });

  const replenishForm = useForm<ReplenishFormData>({
    resolver: zodResolver(replenishFormSchema),
    defaultValues: {
      amount: "",
      userId: "",
    },
  });
  
  const { data: fund, isLoading: fundLoading } = useQuery<any>({
    queryKey: ["/api/petty-cash/fund"],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<any[]>({
    queryKey: ["/api/petty-cash/expenses"],
  });

  const { data: transactions } = useQuery<any[]>({
    queryKey: ["/api/petty-cash/transactions"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/petty-cash/stats"],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: machines } = useQuery<any[]>({
    queryKey: ["/api/machines"],
  });

  const initFundMutation = useMutation({
    mutationFn: async (data: FundFormData) => {
      return apiRequest("POST", "/api/petty-cash/fund", {
        name: data.name,
        maxAmount: parseFloat(data.maxAmount),
        currentBalance: parseFloat(data.initialBalance),
        replenishThreshold: data.replenishThreshold ? parseFloat(data.replenishThreshold) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/fund"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/transactions"] });
      toast({ title: "Fondo inicializado", description: "El fondo de caja chica se ha configurado correctamente" });
      setIsInitFundOpen(false);
      fundForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo inicializar el fondo", variant: "destructive" });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      return apiRequest("POST", "/api/petty-cash/expenses", {
        ...data,
        amount: parseFloat(data.amount),
        machineId: data.machineId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/fund"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/transactions"] });
      toast({ title: "Gasto registrado", description: "El gasto se ha registrado y está pendiente de aprobación" });
      setIsNewExpenseOpen(false);
      expenseForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar el gasto", variant: "destructive" });
    },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      return apiRequest("POST", `/api/petty-cash/expenses/${id}/approve`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/fund"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/transactions"] });
      toast({ title: "Gasto aprobado", description: "El gasto ha sido aprobado" });
    },
  });

  const payExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/petty-cash/expenses/${id}/pay`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/fund"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/transactions"] });
      toast({ title: "Pago realizado", description: "El gasto ha sido pagado" });
    },
  });

  const replenishMutation = useMutation({
    mutationFn: async (data: ReplenishFormData) => {
      return apiRequest("POST", "/api/petty-cash/fund/replenish", {
        amount: parseFloat(data.amount),
        userId: data.userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/fund"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash/transactions"] });
      toast({ title: "Fondo repuesto", description: "El fondo de caja chica ha sido repuesto" });
      setIsReplenishOpen(false);
      replenishForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo reponer el fondo", variant: "destructive" });
    },
  });

  const onFundSubmit = (data: FundFormData) => {
    initFundMutation.mutate(data);
  };

  const onExpenseSubmit = (data: ExpenseFormData) => {
    createExpenseMutation.mutate(data);
  };

  const onReplenishSubmit = (data: ReplenishFormData) => {
    replenishMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { class: string; icon: JSX.Element }> = {
      pendiente: { class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: <Clock className="h-3 w-3 mr-1" /> },
      aprobado: { class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
      rechazado: { class: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: <XCircle className="h-3 w-3 mr-1" /> },
      pagado: { class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
    };
    const style = styles[status] || { class: "", icon: null };
    return (
      <Badge className={`${style.class} flex items-center`} data-testid={`badge-status-${status}`}>
        {style.icon}
        {status}
      </Badge>
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, JSX.Element> = {
      combustible: <Fuel className="h-4 w-4" />,
      mantenimiento: <Wrench className="h-4 w-4" />,
      suministros: <Package className="h-4 w-4" />,
      alimentos: <Coffee className="h-4 w-4" />,
      transporte: <Truck className="h-4 w-4" />,
      papeleria: <FileText className="h-4 w-4" />,
      otro: <Receipt className="h-4 w-4" />,
    };
    return icons[category] || <Receipt className="h-4 w-4" />;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      combustible: "Combustible",
      mantenimiento: "Mantenimiento",
      suministros: "Suministros",
      alimentos: "Alimentos",
      transporte: "Transporte",
      papeleria: "Papelería",
      otro: "Otro",
    };
    return labels[category] || category;
  };

  const fundBalance = fund?.currentBalance ? parseFloat(fund.currentBalance) : 0;
  const fundLimit = fund?.maxAmount ? parseFloat(fund.maxAmount) : 0;
  const balancePercentage = fundLimit > 0 ? (fundBalance / fundLimit) * 100 : 0;
  const needsReplenish = fund?.replenishThreshold && fundBalance <= parseFloat(fund.replenishThreshold);

  if (!fund?.initialized && !fundLoading && (!fund || !fund.id)) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="max-w-md w-full" data-testid="card-init-fund">
          <CardHeader className="text-center">
            <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Configurar Caja Chica</CardTitle>
            <CardDescription>
              El fondo de caja chica aún no ha sido configurado. 
              Inicializa el fondo para comenzar a registrar gastos menores.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => setIsInitFundOpen(true)} data-testid="button-init-fund">
              <Plus className="h-4 w-4 mr-2" />
              Inicializar Fondo
            </Button>
          </CardContent>
        </Card>

        <Dialog open={isInitFundOpen} onOpenChange={setIsInitFundOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inicializar Fondo de Caja Chica</DialogTitle>
              <DialogDescription>Configura los parámetros del fondo de caja chica</DialogDescription>
            </DialogHeader>
            <Form {...fundForm}>
              <form onSubmit={fundForm.handleSubmit(onFundSubmit)} className="space-y-4">
                <FormField
                  control={fundForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Fondo</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-fund-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={fundForm.control}
                    name="maxAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto Máximo</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" data-testid="input-max-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={fundForm.control}
                    name="initialBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saldo Inicial</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" data-testid="input-initial-balance" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={fundForm.control}
                  name="replenishThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Umbral de Reposición</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" data-testid="input-replenish-threshold" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Se notificará cuando el saldo esté por debajo de este monto</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsInitFundOpen(false)} data-testid="button-cancel-fund">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={initFundMutation.isPending} data-testid="button-submit-fund">
                    {initFundMutation.isPending ? "Inicializando..." : "Inicializar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Caja Chica</h1>
            <p className="text-muted-foreground" data-testid="text-page-subtitle">Gestión de gastos menores y fondo de caja chica</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                const suggestedAmount = (fundLimit - fundBalance).toFixed(2);
                replenishForm.setValue("amount", suggestedAmount);
                setIsReplenishOpen(true);
              }}
              data-testid="button-replenish"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reponer Fondo
            </Button>
            <Button 
              onClick={() => setIsNewExpenseOpen(true)}
              data-testid="button-new-expense"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Gasto
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-fund-balance">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Disponible</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${needsReplenish ? 'text-orange-600' : ''}`} data-testid="text-fund-balance">
                ${fundBalance.toLocaleString()}
              </div>
              <Progress value={balancePercentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {balancePercentage.toFixed(0)}% del fondo máximo
              </p>
              {needsReplenish && (
                <div className="flex items-center gap-1 mt-2 text-orange-600 text-xs" data-testid="alert-replenish">
                  <AlertCircle className="h-3 w-3" />
                  Requiere reposición
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-today-expenses">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Gastos de Hoy</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-today-expenses">${(stats?.todayExpenses || 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Gastado hoy</p>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-approvals">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Por Aprobar</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-approvals">{stats?.pendingApprovals || 0}</div>
              <p className="text-xs text-muted-foreground">Solicitudes pendientes</p>
            </CardContent>
          </Card>

          <Card data-testid="card-monthly-expenses">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Gastos del Mes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-monthly-expenses">${(stats?.monthlyExpenses || 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total mensual</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-petty-cash">
            <TabsTrigger value="expenses" data-testid="tab-trigger-expenses">
              <Receipt className="h-4 w-4 mr-2" />
              Gastos
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-trigger-pending">
              <Clock className="h-4 w-4 mr-2" />
              Pendientes
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-trigger-history">
              <History className="h-4 w-4 mr-2" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-4" data-testid="tab-content-expenses">
            <Card>
              <CardHeader>
                <CardTitle>Todos los Gastos</CardTitle>
                <CardDescription>Registro completo de gastos de caja chica</CardDescription>
              </CardHeader>
              <CardContent>
                {expensesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : expenses?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-expenses">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay gastos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses?.map((expense) => (
                      <div 
                        key={expense.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`row-expense-${expense.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-muted rounded-lg">
                            {getCategoryIcon(expense.category)}
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-expense-desc-${expense.id}`}>{expense.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {getCategoryLabel(expense.category)} · {expense.user?.fullName || expense.user?.username}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-lg" data-testid={`text-expense-amount-${expense.id}`}>${parseFloat(expense.amount).toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(expense.createdAt)}
                            </p>
                          </div>
                          {getStatusBadge(expense.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-4" data-testid="tab-content-pending">
            <Card>
              <CardHeader>
                <CardTitle>Gastos Pendientes de Aprobación</CardTitle>
                <CardDescription>Revisa y aprueba las solicitudes de gasto</CardDescription>
              </CardHeader>
              <CardContent>
                {expensesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  (() => {
                    const pendingExpenses = expenses?.filter(e => e.status === "pendiente" || e.status === "aprobado");
                    if (!pendingExpenses?.length) {
                      return (
                        <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-pending">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No hay gastos pendientes</p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-3">
                        {pendingExpenses.map((expense) => (
                          <div 
                            key={expense.id} 
                            className="p-4 border rounded-lg"
                            data-testid={`row-pending-${expense.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-muted rounded-lg">
                                  {getCategoryIcon(expense.category)}
                                </div>
                                <div>
                                  <p className="font-medium" data-testid={`text-pending-desc-${expense.id}`}>{expense.description}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {getCategoryLabel(expense.category)} · {expense.user?.fullName || expense.user?.username}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="font-bold text-lg" data-testid={`text-pending-amount-${expense.id}`}>${parseFloat(expense.amount).toLocaleString()}</p>
                                </div>
                                {getStatusBadge(expense.status)}
                              </div>
                            </div>
                            {expense.reason && (
                              <p className="text-sm text-muted-foreground mt-2 pl-14">{expense.reason}</p>
                            )}
                            <div className="flex gap-2 mt-3 pl-14">
                              {expense.status === "pendiente" && (
                                <>
                                  <Button 
                                    size="sm" 
                                    onClick={() => approveExpenseMutation.mutate({ 
                                      id: expense.id, 
                                      userId: users?.[0]?.id || "" 
                                    })}
                                    disabled={approveExpenseMutation.isPending}
                                    data-testid={`button-approve-${expense.id}`}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Aprobar
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    data-testid={`button-reject-${expense.id}`}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Rechazar
                                  </Button>
                                </>
                              )}
                              {expense.status === "aprobado" && (
                                <Button 
                                  size="sm"
                                  onClick={() => payExpenseMutation.mutate(expense.id)}
                                  disabled={payExpenseMutation.isPending}
                                  data-testid={`button-pay-${expense.id}`}
                                >
                                  <Wallet className="h-4 w-4 mr-1" />
                                  Pagar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4" data-testid="tab-content-history">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Transacciones</CardTitle>
                <CardDescription>Movimientos del fondo de caja chica</CardDescription>
              </CardHeader>
              <CardContent>
                {!transactions?.length ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-history">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay transacciones registradas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions?.map((transaction) => (
                      <div 
                        key={transaction.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`row-transaction-${transaction.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${transaction.type === "reposicion" ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                            {transaction.type === "reposicion" ? (
                              <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium capitalize" data-testid={`text-transaction-type-${transaction.id}`}>
                              {transaction.type === "reposicion" ? "Reposición" : "Gasto"}
                            </p>
                            <p className="text-sm text-muted-foreground">{transaction.reference || "-"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`font-bold text-lg ${transaction.type === "reposicion" ? 'text-green-600' : 'text-red-600'}`} data-testid={`text-transaction-amount-${transaction.id}`}>
                              {transaction.type === "reposicion" ? '+' : '-'}${parseFloat(transaction.amount).toLocaleString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Saldo: ${parseFloat(transaction.newBalance).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(transaction.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isNewExpenseOpen} onOpenChange={setIsNewExpenseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Gasto</DialogTitle>
              <DialogDescription>Registra un nuevo gasto de caja chica</DialogDescription>
            </DialogHeader>
            <Form {...expenseForm}>
              <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={expenseForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="combustible" data-testid="option-combustible">Combustible</SelectItem>
                            <SelectItem value="mantenimiento" data-testid="option-mantenimiento">Mantenimiento</SelectItem>
                            <SelectItem value="suministros" data-testid="option-suministros">Suministros</SelectItem>
                            <SelectItem value="alimentos" data-testid="option-alimentos">Alimentos</SelectItem>
                            <SelectItem value="transporte" data-testid="option-transporte">Transporte</SelectItem>
                            <SelectItem value="papeleria" data-testid="option-papeleria">Papelería</SelectItem>
                            <SelectItem value="otro" data-testid="option-otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={expenseForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" data-testid="input-expense-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={expenseForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Describe el gasto..." data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={expenseForm.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Solicitante</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-expense-user">
                              <SelectValue placeholder="Seleccionar" />
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
                    control={expenseForm.control}
                    name="machineId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Máquina (opcional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-machine">
                              <SelectValue placeholder="Ninguna" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {machines?.map((machine) => (
                              <SelectItem key={machine.id} value={machine.id} data-testid={`option-machine-${machine.id}`}>
                                {machine.name}
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
                  control={expenseForm.control}
                  name="receiptNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. de Recibo (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-receipt" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Justificación</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Explica el motivo del gasto..." data-testid="input-expense-reason" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewExpenseOpen(false)} data-testid="button-cancel-expense">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createExpenseMutation.isPending} data-testid="button-submit-expense">
                    {createExpenseMutation.isPending ? "Registrando..." : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isReplenishOpen} onOpenChange={setIsReplenishOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reponer Fondo</DialogTitle>
              <DialogDescription>Agrega dinero al fondo de caja chica</DialogDescription>
            </DialogHeader>
            <Form {...replenishForm}>
              <form onSubmit={replenishForm.handleSubmit(onReplenishSubmit)} className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Saldo actual:</span>
                    <span className="font-bold" data-testid="text-current-balance">${fundBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground">Monto máximo:</span>
                    <span className="font-bold" data-testid="text-max-amount">${fundLimit.toLocaleString()}</span>
                  </div>
                </div>
                <FormField
                  control={replenishForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto a Reponer</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" data-testid="input-replenish-amount" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Sugerido: ${(fundLimit - fundBalance).toLocaleString()} para completar el fondo
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={replenishForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Autorizado por</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-replenish-user">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id} data-testid={`option-auth-${user.id}`}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsReplenishOpen(false)} data-testid="button-cancel-replenish">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={replenishMutation.isPending} data-testid="button-submit-replenish">
                    {replenishMutation.isPending ? "Reponiendo..." : "Reponer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
