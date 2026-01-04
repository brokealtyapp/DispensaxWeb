import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Package,
  AlertTriangle,
  Calendar,
  TrendingDown,
  ArrowRightCircle,
  Truck,
  Boxes,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateShort } from "@/lib/utils";
import type { Product, WarehouseInventory, WarehouseMovement, ProductLot, PurchaseReception } from "@shared/schema";

interface WarehouseStats {
  totalProducts: number;
  totalStock: number;
  totalValue: number;
  lowStockCount: number;
  expiringCount: number;
  recentMovements: (WarehouseMovement & { product: Product })[];
}

interface InventoryItem extends WarehouseInventory {
  product: Product;
}

interface LotItem extends ProductLot {
  product: Product;
}

interface PendingReception extends PurchaseReception {
  order?: {
    orderNumber: string;
    supplier: { name: string };
  };
}

export function AlmacenPanelPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<WarehouseStats>({
    queryKey: ["/api/warehouse/stats"],
  });

  const { data: lowStock = [], isLoading: lowStockLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/warehouse/low-stock"],
  });

  const { data: expiringLots = [], isLoading: expiringLoading } = useQuery<LotItem[]>({
    queryKey: ["/api/warehouse/lots/expiring", { days: 30 }],
    queryFn: async () => {
      const response = await fetch("/api/warehouse/lots/expiring?days=30", { credentials: "include" });
      if (!response.ok) throw new Error("Error loading expiring lots");
      return response.json();
    },
  });

  const { data: pendingReceptions = [], isLoading: receptionsLoading } = useQuery<PendingReception[]>({
    queryKey: ["/api/purchase-receptions"],
    queryFn: async () => {
      const response = await fetch("/api/purchase-receptions?status=pending", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: recentMovements = [] } = useQuery<(WarehouseMovement & { product: Product })[]>({
    queryKey: ["/api/warehouse/movements", { limit: 10 }],
    queryFn: async () => {
      const response = await fetch("/api/warehouse/movements?limit=10", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const getStockLevelColor = (current: number, min: number, max: number) => {
    const percentage = (current / max) * 100;
    if (current <= min) return "bg-destructive";
    if (percentage < 30) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getDaysUntilExpiry = (date: Date | string | null) => {
    if (!date) return null;
    return differenceInDays(new Date(date), new Date());
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-almacen-title">Panel de Almacén</h1>
            <p className="text-muted-foreground">Vista rápida del inventario y alertas</p>
          </div>
          <div className="flex gap-2">
            <Link href="/almacen">
              <Button variant="outline" data-testid="button-goto-full-warehouse">
                <Boxes className="h-4 w-4 mr-2" />
                Ver Almacén Completo
              </Button>
            </Link>
            <Link href="/compras">
              <Button data-testid="button-goto-purchases">
                <Truck className="h-4 w-4 mr-2" />
                Compras
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
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
              <Card data-testid="card-stat-products">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalProducts || 0}</p>
                      <p className="text-sm text-muted-foreground">Productos en almacén</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-stock">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Boxes className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalStock?.toLocaleString() || 0}</p>
                      <p className="text-sm text-muted-foreground">Unidades en stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-low-stock" className={lowStock.length > 0 ? "border-amber-500/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${lowStock.length > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
                      <TrendingDown className={`h-6 w-6 ${lowStock.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.lowStockCount || 0}</p>
                      <p className="text-sm text-muted-foreground">Productos bajo mínimo</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-expiring" className={expiringLots.length > 0 ? "border-destructive/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${expiringLots.length > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                      <Calendar className={`h-6 w-6 ${expiringLots.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.expiringCount || 0}</p>
                      <p className="text-sm text-muted-foreground">Lotes por vencer (30d)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-low-stock-list">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Stock Bajo
                </CardTitle>
                <Badge variant="secondary">{lowStock.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {lowStockLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : lowStock.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No hay productos con stock bajo</p>
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3 pr-4">
                    {lowStock.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-muted/50 space-y-2"
                        data-testid={`item-low-stock-${item.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{item.product?.name || "Producto"}</p>
                            <p className="text-xs text-muted-foreground">{item.product?.code}</p>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {item.currentStock ?? 0} / {item.minStock} min
                          </Badge>
                        </div>
                        <Progress
                          value={((item.currentStock ?? 0) / (item.maxStock || 100)) * 100}
                          className={`h-2 ${getStockLevelColor(item.currentStock ?? 0, item.minStock ?? 0, item.maxStock || 100)}`}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-expiring-lots">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-destructive" />
                  Lotes por Vencer
                </CardTitle>
                <Badge variant="secondary">{expiringLots.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {expiringLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : expiringLots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No hay lotes próximos a vencer</p>
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3 pr-4">
                    {expiringLots.slice(0, 10).map((lot) => {
                      const daysUntil = getDaysUntilExpiry(lot.expirationDate);
                      return (
                        <div
                          key={lot.id}
                          className="p-3 rounded-lg bg-muted/50 space-y-1"
                          data-testid={`item-expiring-lot-${lot.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{lot.product?.name || "Producto"}</p>
                              <p className="text-xs text-muted-foreground">Lote: {lot.lotNumber}</p>
                            </div>
                            <Badge
                              variant={daysUntil && daysUntil <= 7 ? "destructive" : "outline"}
                              className="text-xs"
                            >
                              {daysUntil !== null ? (
                                daysUntil <= 0 ? "¡Vencido!" : `${daysUntil} días`
                              ) : "Sin fecha"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{lot.quantity} unidades</span>
                            {lot.expirationDate && (
                              <span>{formatDateShort(lot.expirationDate)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-pending-receptions">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Recepciones Pendientes
                </CardTitle>
                <Badge variant="secondary">{pendingReceptions.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {receptionsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : pendingReceptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No hay recepciones pendientes</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3 pr-4">
                    {pendingReceptions.slice(0, 5).map((reception) => (
                      <div
                        key={reception.id}
                        className="p-3 rounded-lg bg-muted/50 flex items-center justify-between"
                        data-testid={`item-pending-reception-${reception.id}`}
                      >
                        <div>
                          <p className="font-medium">
                            {reception.order?.orderNumber || `Recepción #${reception.id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {reception.order?.supplier?.name || "Proveedor"}
                          </p>
                        </div>
                        <Link href="/compras">
                          <Button size="sm" variant="ghost">
                            <ArrowRightCircle className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-recent-movements">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Movimientos Recientes
                </CardTitle>
                <Link href="/almacen">
                  <Button variant="ghost" size="sm">Ver todos</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentMovements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No hay movimientos recientes</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2 pr-4">
                    {recentMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="p-2 rounded-lg bg-muted/30 flex items-center justify-between text-sm"
                        data-testid={`item-movement-${movement.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${movement.movementType.includes("entrada") ? "bg-emerald-500" : "bg-amber-500"}`} />
                          <div>
                            <p className="font-medium">{movement.product?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {movement.movementType.replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${movement.movementType.includes("entrada") ? "text-emerald-600" : "text-amber-600"}`}>
                            {movement.movementType.includes("entrada") ? "+" : "-"}{movement.quantity}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {movement.createdAt ? formatDistanceToNow(new Date(movement.createdAt), { addSuffix: true, locale: es }) : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
