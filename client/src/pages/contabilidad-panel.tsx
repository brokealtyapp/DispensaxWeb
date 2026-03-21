import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building2,
  Receipt,
  PiggyBank,
  ArrowRightCircle,
  Banknote,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { formatDateShort, formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import type { CashMovement, BankDeposit, PettyCashExpense, MachineSale } from "@shared/schema";

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  averagePerMachine: number;
  topMachines: Array<{ machineId: string; machineName: string; total: number }>;
}

interface CashStats {
  totalCollected: number;
  pendingDeposit: number;
  deposited: number;
  recentMovements: CashMovement[];
}

interface PettyCashStats {
  currentBalance: number;
  totalExpenses: number;
  pendingApproval: number;
  approvedExpenses: number;
}

export function ContabilidadPanelPage() {
  const { canView } = usePermissions();
  const currentMonth = {
    start: startOfMonth(new Date()).toISOString().split('T')[0],
    end: endOfMonth(new Date()).toISOString().split('T')[0],
  };

  const { data: salesStats, isLoading: salesLoading } = useQuery<SalesStats>({
    queryKey: ["/api/accounting/sales-summary", { startDate: currentMonth.start, endDate: currentMonth.end }],
  });

  const { data: cashStats, isLoading: cashLoading } = useQuery<CashStats>({
    queryKey: ["/api/accounting/cash-summary"],
  });

  const { data: pettyCashFund, isLoading: fundLoading } = useQuery<{ currentBalance: number } | null>({
    queryKey: ["/api/petty-cash/fund"],
  });

  const { data: allExpenses = [], isLoading: expensesLoading } = useQuery<PettyCashExpense[]>({
    queryKey: ["/api/petty-cash/expenses"],
  });

  const { data: monthExpenses = [], isLoading: monthExpensesLoading } = useQuery<PettyCashExpense[]>({
    queryKey: ["/api/petty-cash/expenses", { startDate: currentMonth.start, endDate: currentMonth.end }],
  });

  const pettyCashStats: PettyCashStats = {
    currentBalance: Number(pettyCashFund?.currentBalance ?? 0),
    totalExpenses: monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    pendingApproval: allExpenses.filter((e) => e.status === "pendiente").length,
    approvedExpenses: allExpenses.filter((e) => e.status === "aprobado")
      .reduce((sum, e) => sum + Number(e.amount), 0),
  };

  const pettyCashLoading = fundLoading || expensesLoading || monthExpensesLoading;

  const { data: recentDeposits = [] } = useQuery<BankDeposit[]>({
    queryKey: ["/api/bank-deposits", { limit: 5 }],
  });

  const { data: pendingExpenses = [] } = useQuery<PettyCashExpense[]>({
    queryKey: ["/api/petty-cash/expenses", { status: "pendiente" }],
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-contabilidad-title">Panel de Contabilidad</h1>
            <p className="text-muted-foreground">Resumen financiero del mes actual</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canView("accounting") && (
              <Link href="/contabilidad">
                <Button variant="outline" data-testid="button-goto-full-accounting">
                  <Receipt className="h-4 w-4 mr-2" />
                  Contabilidad Completa
                </Button>
              </Link>
            )}
            {canView("petty_cash") && (
              <Link href="/caja-chica">
                <Button data-testid="button-goto-petty-cash">
                  <PiggyBank className="h-4 w-4 mr-2" />
                  Caja Chica
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {salesLoading || cashLoading || pettyCashLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card data-testid="card-stat-revenue">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{formatCurrency(salesStats?.totalRevenue || 0)}</p>
                      <p className="text-sm text-muted-foreground">Ventas del mes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-collected">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Banknote className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{formatCurrency(cashStats?.totalCollected || 0)}</p>
                      <p className="text-sm text-muted-foreground">Efectivo recolectado</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-pending-deposit" className={cashStats?.pendingDeposit && cashStats.pendingDeposit > 0 ? "border-amber-500/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${cashStats?.pendingDeposit && cashStats.pendingDeposit > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
                      <Building2 className={`h-6 w-6 ${cashStats?.pendingDeposit && cashStats.pendingDeposit > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{formatCurrency(cashStats?.pendingDeposit || 0)}</p>
                      <p className="text-sm text-muted-foreground">Pendiente depósito</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-petty-cash">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <PiggyBank className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{formatCurrency(pettyCashStats?.currentBalance || 0)}</p>
                      <p className="text-sm text-muted-foreground">Saldo caja chica</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-top-machines">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Máquinas con Más Ventas
                </CardTitle>
                <Link href="/contabilidad">
                  <Button variant="ghost" size="sm">Ver todas</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !salesStats?.topMachines?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No hay ventas registradas este mes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {salesStats.topMachines.slice(0, 5).map((machine, idx) => (
                    <div
                      key={machine.machineId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      data-testid={`item-top-machine-${machine.machineId}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx === 0 ? "bg-amber-500 text-white" :
                        idx === 1 ? "bg-gray-400 text-white" :
                        idx === 2 ? "bg-amber-700 text-white" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{machine.machineName}</p>
                      </div>
                      <p className="font-semibold text-emerald-600">{formatCurrency(machine.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-pending-expenses">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Gastos Pendientes de Aprobación
                </CardTitle>
                <Badge variant={pendingExpenses.length > 0 ? "default" : "secondary"}>
                  {pendingExpenses.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {pettyCashLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : pendingExpenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No hay gastos pendientes de aprobación</p>
                </div>
              ) : (
                <ScrollArea className="h-[240px]">
                  <div className="space-y-3 pr-4">
                    {pendingExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="p-3 rounded-lg bg-muted/50"
                        data-testid={`item-pending-expense-${expense.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <p className="text-xs text-muted-foreground">{expense.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(Number(expense.amount))}</p>
                            <Badge variant="outline" className="text-xs">Pendiente</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              {pendingExpenses.length > 0 && (
                <Link href="/caja-chica">
                  <Button className="w-full mt-4" variant="outline">
                    Revisar y Aprobar
                    <ArrowRightCircle className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-recent-deposits">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Depósitos Recientes
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {recentDeposits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No hay depósitos recientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDeposits.map((deposit) => (
                    <div
                      key={deposit.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`item-deposit-${deposit.id}`}
                    >
                      <div>
                        <p className="font-medium">{deposit.bankName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(deposit.depositDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">
                          {formatCurrency(Number(deposit.amount))}
                        </p>
                        <Badge
                          variant={deposit.status === "conciliado" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {deposit.status === "conciliado" ? "Conciliado" : "Pendiente"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-financial-summary">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    <span>Ingresos del Mes</span>
                  </div>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(salesStats?.totalRevenue || 0)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    <span>Gastos del Mes</span>
                  </div>
                  <span className="font-bold text-destructive">
                    {formatCurrency(pettyCashStats?.totalExpenses || 0)}
                  </span>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="font-medium">Balance Neto</span>
                    </div>
                    <span className={`font-bold text-lg ${
                      (salesStats?.totalRevenue || 0) - (pettyCashStats?.totalExpenses || 0) >= 0 
                        ? "text-emerald-600" 
                        : "text-destructive"
                    }`}>
                      {formatCurrency((salesStats?.totalRevenue || 0) - (pettyCashStats?.totalExpenses || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
