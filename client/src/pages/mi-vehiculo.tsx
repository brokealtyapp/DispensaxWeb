import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { 
  Truck, 
  Package, 
  Calendar, 
  AlertTriangle,
  ClipboardList,
  ArrowDownCircle,
  ArrowUpCircle
} from "lucide-react";
import { formatDistanceToNow, format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface VehicleInventoryItem {
  id: string;
  vehicleId: string;
  productId: string;
  lotId: string | null;
  quantity: number;
  loadedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  lot: {
    id: string;
    lotNumber: string;
    expirationDate: string;
    costPerUnit: string;
  } | null;
}

interface InventoryTransfer {
  id: string;
  transferType: string;
  sourceType: string;
  sourceVehicleId: string | null;
  sourceWarehouseId: string | null;
  sourceMachineId: string | null;
  destinationType: string;
  destinationVehicleId: string | null;
  destinationMachineId: string | null;
  productId: string;
  lotId: string | null;
  quantity: number;
  createdAt: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
  };
}

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  isActive: boolean;
}

export default function MiVehiculoPage() {
  const { user } = useAuth();

  const { data: vehicleInventory = [], isLoading: isLoadingInventory } = useQuery<VehicleInventoryItem[]>({
    queryKey: ["/api/my-vehicle-inventory"],
    enabled: !!user,
  });

  const { data: transfers = [], isLoading: isLoadingTransfers } = useQuery<InventoryTransfer[]>({
    queryKey: ["/api/inventory-transfers"],
    enabled: !!user,
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    enabled: !!user,
  });

  const myVehicle = user?.assignedVehicleId 
    ? vehicles.find(v => v.id === user.assignedVehicleId)
    : null;

  const groupedInventory = vehicleInventory.reduce((acc, item) => {
    const existing = acc.find(g => g.productId === item.productId);
    if (existing) {
      existing.totalQuantity += item.quantity;
      existing.lots.push(item);
    } else {
      acc.push({
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        totalQuantity: item.quantity,
        lots: [item]
      });
    }
    return acc;
  }, [] as Array<{
    productId: string;
    productName: string;
    productSku: string;
    totalQuantity: number;
    lots: VehicleInventoryItem[];
  }>);

  const todayTransfers = transfers.filter(t => {
    const transferDate = parseISO(t.createdAt);
    const today = new Date();
    return transferDate.toDateString() === today.toDateString();
  });

  const incomingTransfers = todayTransfers.filter(t => 
    t.destinationType === "vehicle" && t.destinationVehicleId === user?.assignedVehicleId
  );
  const outgoingTransfers = todayTransfers.filter(t => 
    t.sourceType === "vehicle" && t.sourceVehicleId === user?.assignedVehicleId
  );

  const totalProducts = groupedInventory.length;
  const totalUnits = groupedInventory.reduce((sum, g) => sum + g.totalQuantity, 0);
  const expiringSoonCount = vehicleInventory.filter(item => {
    if (!item.lot?.expirationDate) return false;
    const daysUntilExpiry = differenceInDays(parseISO(item.lot.expirationDate), new Date());
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  }).length;

  if (isLoadingInventory) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!user?.assignedVehicleId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Sin Vehículo Asignado</h2>
              <p className="text-muted-foreground max-w-md">
                No tienes un vehículo asignado actualmente. Contacta a tu supervisor para que te asigne un vehículo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Mi Vehículo
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {myVehicle ? (
              <span>{myVehicle.plate} - {myVehicle.brand} {myVehicle.model}</span>
            ) : (
              <span>Vehículo #{user.assignedVehicleId}</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Productos</p>
                <p className="text-2xl font-bold" data-testid="text-total-products">
                  {totalProducts}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <ClipboardList className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unidades Totales</p>
                <p className="text-2xl font-bold" data-testid="text-total-units">
                  {totalUnits}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <ArrowDownCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cargas Hoy</p>
                <p className="text-2xl font-bold" data-testid="text-incoming-transfers">
                  {incomingTransfers.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${expiringSoonCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
                <AlertTriangle className={`w-6 h-6 ${expiringSoonCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Por Vencer (7 días)</p>
                <p className="text-2xl font-bold" data-testid="text-expiring-soon">
                  {expiringSoonCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Inventario del Vehículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupedInventory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No tienes productos cargados</p>
                <p className="text-sm">El almacén te despachará productos cuando sea necesario</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedInventory.map((group) => (
                  <div 
                    key={group.productId}
                    className="border rounded-lg p-4"
                    data-testid={`card-product-${group.productId}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{group.productName}</h4>
                        <p className="text-sm text-muted-foreground">SKU: {group.productSku}</p>
                      </div>
                      <Badge variant="secondary" className="text-lg px-4 py-1">
                        {group.totalQuantity} unid.
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {group.lots.map((lot) => {
                        const daysUntilExpiry = lot.lot?.expirationDate 
                          ? differenceInDays(parseISO(lot.lot.expirationDate), new Date())
                          : null;
                        const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
                        const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;

                        return (
                          <div 
                            key={lot.id}
                            className={`flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2 ${
                              isExpired ? 'bg-red-100 dark:bg-red-900/20' : 
                              isExpiringSoon ? 'bg-amber-100 dark:bg-amber-900/20' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs">
                                {lot.lot?.lotNumber || 'Sin lote'}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span>{lot.quantity} unid.</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {lot.lot?.expirationDate && (
                                <>
                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                  <span className={`text-xs ${
                                    isExpired ? 'text-red-600 font-medium' :
                                    isExpiringSoon ? 'text-amber-600 font-medium' : 'text-muted-foreground'
                                  }`}>
                                    {isExpired ? 'VENCIDO' : 
                                     isExpiringSoon ? `Vence en ${daysUntilExpiry} días` :
                                     format(parseISO(lot.lot.expirationDate), "dd/MM/yyyy")}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Movimientos de Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayTransfers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Sin movimientos hoy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayTransfers.slice(0, 10).map((transfer) => {
                  const isIncoming = transfer.destinationType === "vehicle" && transfer.destinationVehicleId === user.assignedVehicleId;
                  return (
                    <div
                      key={transfer.id}
                      className="flex items-start gap-3 text-sm"
                      data-testid={`transfer-${transfer.id}`}
                    >
                      <div className={`p-1.5 rounded-full mt-0.5 ${
                        isIncoming 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                          : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        {isIncoming ? (
                          <ArrowDownCircle className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <ArrowUpCircle className="w-3 h-3 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {transfer.product.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {isIncoming ? 'Recibido del almacén' : 'Entregado a máquina'} • {transfer.quantity} unid.
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDistanceToNow(parseISO(transfer.createdAt), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
