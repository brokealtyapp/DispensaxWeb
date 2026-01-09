import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataPagination } from "@/components/DataPagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  Clock,
  Edit,
  Download,
  Truck,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Supplier, Vehicle, WarehouseInventory, WarehouseMovement, ProductLot } from "@shared/schema";
import { formatDateShort, formatTime, formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

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
  supplier?: Supplier;
}

interface MovementItem extends WarehouseMovement {
  product: Product;
}

const entrySchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1"),
  unitCost: z.coerce.number().min(0, "El costo no puede ser negativo"),
  supplierId: z.string().optional(),
  lotNumber: z.string().min(1, "El número de lote es requerido"),
  expirationDate: z.string().optional(),
  notes: z.string().optional(),
});

const exitSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1"),
  destinationUserId: z.string().min(1, "Selecciona un abastecedor"),
  notes: z.string().optional(),
});

const adjustmentSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  physicalCount: z.coerce.number().min(0, "El conteo físico no puede ser negativo"),
  reason: z.string().min(1, "El motivo es requerido"),
  notes: z.string().optional(),
});

type EntryFormData = z.infer<typeof entrySchema>;
type ExitFormData = z.infer<typeof exitSchema>;
type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

const movementTypeLabels: Record<string, string> = {
  entrada_compra: "Entrada (Compra)",
  entrada_devolucion: "Entrada (Devolución)",
  salida_abastecedor: "Salida (Abastecedor)",
  salida_maquina: "Salida (Máquina)",
  salida_merma: "Salida (Merma)",
  salida_caducidad: "Salida (Caducidad)",
  salida_danio: "Salida (Daño)",
  ajuste_inventario: "Ajuste",
  transferencia: "Transferencia",
};

const movementTypeColors: Record<string, string> = {
  entrada_compra: "bg-emerald-500 text-white",
  entrada_devolucion: "bg-blue-500 text-white",
  salida_abastecedor: "bg-amber-500 text-white",
  salida_maquina: "bg-cyan-600 text-white",
  salida_merma: "bg-destructive text-destructive-foreground",
  salida_caducidad: "bg-orange-500 text-white",
  salida_danio: "bg-red-600 text-white",
  ajuste_inventario: "bg-muted text-muted-foreground",
  transferencia: "bg-purple-500 text-white",
};

export function WarehousePage() {
  const [activeTab, setActiveTab] = useState("inventario");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [isDispatchToVehicleDialogOpen, setIsDispatchToVehicleDialogOpen] = useState(false);
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
  const [dispatchVehicleId, setDispatchVehicleId] = useState<string>("");
  const [dispatchItems, setDispatchItems] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [tempProductId, setTempProductId] = useState("");
  const [tempQuantity, setTempQuantity] = useState("");

  const { toast } = useToast();
  const [selectedMovementTypeFilter, setSelectedMovementTypeFilter] = useState<string>("all");
  const [movementsPage, setMovementsPage] = useState(1);
  const MOVEMENTS_PER_PAGE = 20;

  const { canCreate, canEdit, canDelete } = usePermissions();

  const { data: stats, isLoading: statsLoading } = useQuery<WarehouseStats>({
    queryKey: ["/api/warehouse/stats"],
  });

  const { data: inventory = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/warehouse/inventory"],
  });

  const { data: lowStock = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/warehouse/low-stock"],
  });

  const { data: lots = [] } = useQuery<LotItem[]>({
    queryKey: ["/api/warehouse/lots"],
  });

  const { data: expiringLots = [] } = useQuery<LotItem[]>({
    queryKey: ["/api/warehouse/lots/expiring", { days: "30" }],
  });

  const { data: movements = [] } = useQuery<MovementItem[]>({
    queryKey: ["/api/warehouse/movements", { 
      productId: selectedProductFilter !== "all" ? selectedProductFilter : undefined,
      limit: "100"
    }],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const entryForm = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      productId: "",
      quantity: 0,
      unitCost: 0,
      supplierId: "",
      lotNumber: "",
      expirationDate: "",
      notes: "",
    },
  });

  const exitForm = useForm<ExitFormData>({
    resolver: zodResolver(exitSchema),
    defaultValues: {
      productId: "",
      quantity: 0,
      destinationUserId: "",
      notes: "",
    },
  });

  const adjustmentForm = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      productId: "",
      physicalCount: 0,
      reason: "",
      notes: "",
    },
  });

  const entryMutation = useMutation({
    mutationFn: async (data: EntryFormData) => {
      const response = await apiRequest("POST", "/api/warehouse/entry", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/lots"] });
      setIsEntryDialogOpen(false);
      entryForm.reset();
    },
  });

  const exitMutation = useMutation({
    mutationFn: async (data: ExitFormData) => {
      const response = await apiRequest("POST", "/api/warehouse/exit", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/lots"] });
      setIsExitDialogOpen(false);
      exitForm.reset();
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: async (data: AdjustmentFormData) => {
      const response = await apiRequest("POST", "/api/warehouse/adjustment", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/movements"] });
      setIsAdjustmentDialogOpen(false);
      adjustmentForm.reset();
    },
  });

  const dispatchToVehicleMutation = useMutation({
    mutationFn: async (data: { vehicleId: string; items: Array<{ productId: string; quantity: number }>; notes?: string }) => {
      const response = await apiRequest("POST", "/api/warehouse/dispatch-to-vehicle", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al despachar");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/lots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-transfers"] });
      setIsDispatchToVehicleDialogOpen(false);
      setDispatchVehicleId("");
      setDispatchItems([]);
      setDispatchNotes("");
      setTempProductId("");
      setTempQuantity("");
      toast({
        title: "Despacho exitoso",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al despachar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddDispatchItem = () => {
    if (!tempProductId || !tempQuantity || parseInt(tempQuantity) <= 0) {
      toast({
        title: "Error",
        description: "Selecciona un producto y cantidad válida",
        variant: "destructive",
      });
      return;
    }

    const existingIndex = dispatchItems.findIndex(i => i.productId === tempProductId);
    if (existingIndex >= 0) {
      const updated = [...dispatchItems];
      updated[existingIndex].quantity += parseInt(tempQuantity);
      setDispatchItems(updated);
    } else {
      setDispatchItems([...dispatchItems, { productId: tempProductId, quantity: parseInt(tempQuantity) }]);
    }
    setTempProductId("");
    setTempQuantity("");
  };

  const handleRemoveDispatchItem = (productId: string) => {
    setDispatchItems(dispatchItems.filter(i => i.productId !== productId));
  };

  const handleSubmitDispatch = () => {
    if (!dispatchVehicleId) {
      toast({
        title: "Error",
        description: "Selecciona un vehículo",
        variant: "destructive",
      });
      return;
    }
    if (dispatchItems.length === 0) {
      toast({
        title: "Error",
        description: "Agrega al menos un producto",
        variant: "destructive",
      });
      return;
    }
    dispatchToVehicleMutation.mutate({
      vehicleId: dispatchVehicleId,
      items: dispatchItems,
      notes: dispatchNotes || undefined,
    });
  };

  const filteredInventory = inventory.filter((item) =>
    item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.product.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMovements = useMemo(() => {
    let filtered = movements.filter((mov) =>
      mov.product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (selectedMovementTypeFilter !== "all") {
      filtered = filtered.filter((mov) => mov.movementType === selectedMovementTypeFilter);
    }
    
    return filtered;
  }, [movements, searchQuery, selectedMovementTypeFilter]);

  const paginatedMovements = useMemo(() => {
    const startIndex = (movementsPage - 1) * MOVEMENTS_PER_PAGE;
    return filteredMovements.slice(startIndex, startIndex + MOVEMENTS_PER_PAGE);
  }, [filteredMovements, movementsPage]);

  const totalMovementsPages = Math.ceil(filteredMovements.length / MOVEMENTS_PER_PAGE);

  const generateLotNumber = () => {
    const date = new Date();
    return `LOT-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  };

  if (statsLoading || inventoryLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Almacén
          </h1>
          <p className="text-muted-foreground">
            Gestión de inventario central, lotes y movimientos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate("warehouse_movements") && (
            <Button
              onClick={() => {
                entryForm.setValue("lotNumber", generateLotNumber());
                setIsEntryDialogOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-new-entry"
            >
              <ArrowDownCircle className="w-4 h-4 mr-2" />
              Entrada
            </Button>
          )}
          {canCreate("warehouse_movements") && (
            <Button
              onClick={() => setIsExitDialogOpen(true)}
              variant="outline"
              className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
              data-testid="button-new-exit"
            >
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Salida
            </Button>
          )}
          {canCreate("warehouse_movements") && (
            <Button
              onClick={() => setIsDispatchToVehicleDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-dispatch-vehicle"
            >
              <Truck className="w-4 h-4 mr-2" />
              Despachar a Vehículo
            </Button>
          )}
          <Select onValueChange={(type) => {
            const url = `/api/warehouse/export/${type}`;
            window.open(url, "_blank");
          }}>
            <SelectTrigger className="w-36" data-testid="select-export">
              <Download className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Exportar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inventory">Inventario</SelectItem>
              <SelectItem value="movements">Kardex</SelectItem>
              <SelectItem value="lots">Lotes</SelectItem>
            </SelectContent>
          </Select>
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
                  {stats?.totalProducts || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stock Total</p>
                <p className="text-2xl font-bold" data-testid="text-total-stock">
                  {stats?.totalStock?.toLocaleString() || 0} unidades
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stock Bajo</p>
                <p className="text-2xl font-bold" data-testid="text-low-stock">
                  {stats?.lowStockCount || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <Calendar className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Por Vencer</p>
                <p className="text-2xl font-bold" data-testid="text-expiring">
                  {stats?.expiringCount || 0} lotes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventario" data-testid="tab-inventory">
            <Package className="w-4 h-4 mr-2" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="movimientos" data-testid="tab-movements">
            <RotateCcw className="w-4 h-4 mr-2" />
            Kardex
          </TabsTrigger>
          <TabsTrigger value="lotes" data-testid="tab-lots">
            <Clock className="w-4 h-4 mr-2" />
            Lotes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Existencias Actuales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInventory.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay inventario registrado. Registra una entrada para comenzar.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Mín</TableHead>
                      <TableHead className="text-right">Máx</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item) => {
                      const percentage = item.maxStock 
                        ? Math.round(((item.currentStock || 0) / item.maxStock) * 100)
                        : 0;
                      const isLow = (item.currentStock || 0) <= (item.reorderPoint || 20);
                      
                      return (
                        <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                          <TableCell className="font-medium">
                            {item.product.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.product.code || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.currentStock?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.minStock || 10}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.maxStock || 100}
                          </TableCell>
                          <TableCell className="w-32">
                            <Progress 
                              value={percentage} 
                              className={`h-2 ${isLow ? "[&>div]:bg-destructive" : "[&>div]:bg-emerald-500"}`}
                            />
                          </TableCell>
                          <TableCell>
                            {isLow ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Bajo
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {lowStock.length > 0 && (
            <Card className="mt-6 border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                  Alertas de Stock Bajo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStock.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                      data-testid={`alert-low-stock-${item.id}`}
                    >
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Stock: {item.currentStock || 0} / Mín: {item.reorderPoint || 20}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="movimientos" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Historial de Movimientos (Kardex)
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedMovementTypeFilter} onValueChange={(v) => { setSelectedMovementTypeFilter(v); setMovementsPage(1); }}>
                  <SelectTrigger className="w-48" data-testid="select-movement-type-filter">
                    <SelectValue placeholder="Tipo de movimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {Object.entries(movementTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedProductFilter} onValueChange={(v) => { setSelectedProductFilter(v); setMovementsPage(1); }}>
                  <SelectTrigger className="w-56" data-testid="select-product-filter">
                    <SelectValue placeholder="Filtrar por producto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los productos</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canEdit("warehouse") && (
                  <Button
                    variant="outline"
                    onClick={() => setIsAdjustmentDialogOpen(true)}
                    data-testid="button-adjustment"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Ajuste
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredMovements.length === 0 ? (
                <div className="text-center py-12">
                  <RotateCcw className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay movimientos registrados aún.
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Stock Ant.</TableHead>
                        <TableHead className="text-right">Stock Nuevo</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMovements.map((mov) => {
                        const isEntry = mov.movementType.startsWith("entrada");
                        const isAdjustment = mov.movementType === "ajuste_inventario";
                        
                        return (
                          <TableRow key={mov.id} data-testid={`row-movement-${mov.id}`}>
                            <TableCell className="whitespace-nowrap">
                              <div>
                                <p className="font-medium">
                                  {mov.createdAt ? formatDateShort(mov.createdAt) : "-"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {mov.createdAt ? formatTime(mov.createdAt) : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={movementTypeColors[mov.movementType] || "bg-muted"}>
                                {movementTypeLabels[mov.movementType] || mov.movementType}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {mov.product.name}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-mono font-medium ${isAdjustment ? "text-muted-foreground" : isEntry ? "text-emerald-600" : "text-destructive"}`}>
                                {isAdjustment ? "±" : isEntry ? "+" : "-"}{mov.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {mov.previousStock}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {mov.newStock}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-xs truncate">
                              {mov.notes || "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {totalMovementsPages > 1 && (
                    <div className="mt-4">
                      <DataPagination
                        currentPage={movementsPage}
                        totalItems={filteredMovements.length}
                        itemsPerPage={MOVEMENTS_PER_PAGE}
                        onPageChange={setMovementsPage}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lotes" className="mt-6">
          <div className="space-y-6">
            {expiringLots.length > 0 && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Calendar className="w-5 h-5" />
                    Lotes Próximos a Vencer (30 días)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead className="text-right">Restante</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringLots.map((lot) => {
                        const daysUntilExpiry = lot.expirationDate
                          ? Math.ceil((new Date(lot.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;
                        const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;
                        
                        return (
                          <TableRow key={lot.id} data-testid={`row-expiring-lot-${lot.id}`}>
                            <TableCell className="font-medium">{lot.product.name}</TableCell>
                            <TableCell className="font-mono text-sm">{lot.lotNumber}</TableCell>
                            <TableCell className="text-right">{lot.remainingQuantity}</TableCell>
                            <TableCell>
                              {lot.expirationDate 
                                ? formatDateShort(new Date(lot.expirationDate))
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {isExpired ? (
                                <Badge variant="destructive">Vencido</Badge>
                              ) : daysUntilExpiry && daysUntilExpiry <= 7 ? (
                                <Badge className="bg-amber-500 text-white">
                                  {daysUntilExpiry} días
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  {daysUntilExpiry} días
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Todos los Lotes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lots.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No hay lotes registrados. Los lotes se crean automáticamente al registrar entradas.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Restante</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead>Compra</TableHead>
                        <TableHead>Vencimiento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lots.map((lot) => (
                        <TableRow key={lot.id} data-testid={`row-lot-${lot.id}`}>
                          <TableCell className="font-medium">{lot.product.name}</TableCell>
                          <TableCell className="font-mono text-sm">{lot.lotNumber}</TableCell>
                          <TableCell>{lot.supplier?.name || "-"}</TableCell>
                          <TableCell className="text-right">{lot.quantity}</TableCell>
                          <TableCell className="text-right font-medium">
                            {lot.remainingQuantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(lot.costPrice || 0)}
                          </TableCell>
                          <TableCell>
                            {lot.purchaseDate 
                              ? formatDateShort(new Date(lot.purchaseDate))
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {lot.expirationDate 
                              ? formatDateShort(new Date(lot.expirationDate))
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Entrada de Mercancía</DialogTitle>
            <DialogDescription>
              Registra la recepción de productos desde un proveedor
            </DialogDescription>
          </DialogHeader>
          <Form {...entryForm}>
            <form onSubmit={entryForm.handleSubmit((data) => entryMutation.mutate(data))} className="space-y-4">
              <FormField
                control={entryForm.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-entry-product">
                          <SelectValue placeholder="Selecciona un producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
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
                  control={entryForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} data-testid="input-entry-quantity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={entryForm.control}
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Unitario</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-entry-cost" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={entryForm.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-entry-supplier">
                          <SelectValue placeholder="Selecciona un proveedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entryForm.control}
                name="lotNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Lote</FormLabel>
                    <FormControl>
                      <Input placeholder="LOT-XXXXXX" {...field} data-testid="input-entry-lot" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entryForm.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Vencimiento (opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-entry-expiration" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={entryForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Observaciones..." {...field} data-testid="input-entry-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEntryDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={entryMutation.isPending} data-testid="button-submit-entry">
                  {entryMutation.isPending ? "Registrando..." : "Registrar Entrada"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Salida de Mercancía</DialogTitle>
            <DialogDescription>
              Entrega productos a un abastecedor para su ruta
            </DialogDescription>
          </DialogHeader>
          <Form {...exitForm}>
            <form onSubmit={exitForm.handleSubmit((data) => exitMutation.mutate(data))} className="space-y-4">
              <FormField
                control={exitForm.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-exit-product">
                          <SelectValue placeholder="Selecciona un producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inventory.map((item) => (
                          <SelectItem key={item.productId} value={item.productId}>
                            {item.product.name} (Stock: {item.currentStock || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exitForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} data-testid="input-exit-quantity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exitForm.control}
                name="destinationUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abastecedor</FormLabel>
                    <FormControl>
                      <Input placeholder="ID del abastecedor" {...field} data-testid="input-exit-user" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={exitForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Observaciones..." {...field} data-testid="input-exit-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsExitDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={exitMutation.isPending} data-testid="button-submit-exit">
                  {exitMutation.isPending ? "Registrando..." : "Registrar Salida"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste de Inventario</DialogTitle>
            <DialogDescription>
              Ajusta el stock de un producto basándote en el conteo físico
            </DialogDescription>
          </DialogHeader>
          <Form {...adjustmentForm}>
            <form onSubmit={adjustmentForm.handleSubmit((data) => adjustmentMutation.mutate(data))} className="space-y-4">
              <FormField
                control={adjustmentForm.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-adjustment-product">
                          <SelectValue placeholder="Selecciona un producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {inventory.map((item) => (
                          <SelectItem key={item.productId} value={item.productId}>
                            {item.product.name} (Stock actual: {item.currentStock || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={adjustmentForm.control}
                name="physicalCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conteo Físico</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="Cantidad real en almacén" {...field} data-testid="input-adjustment-count" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={adjustmentForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo del Ajuste</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-adjustment-reason">
                          <SelectValue placeholder="Selecciona un motivo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Conteo físico">Conteo físico</SelectItem>
                        <SelectItem value="Corrección de error">Corrección de error</SelectItem>
                        <SelectItem value="Inventario inicial">Inventario inicial</SelectItem>
                        <SelectItem value="Faltante detectado">Faltante detectado</SelectItem>
                        <SelectItem value="Sobrante detectado">Sobrante detectado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={adjustmentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observaciones adicionales..." {...field} data-testid="input-adjustment-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAdjustmentDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={adjustmentMutation.isPending} data-testid="button-submit-adjustment">
                  {adjustmentMutation.isPending ? "Ajustando..." : "Registrar Ajuste"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDispatchToVehicleDialogOpen} onOpenChange={setIsDispatchToVehicleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Despachar Productos a Vehículo</DialogTitle>
            <DialogDescription>
              Transfiere productos del almacén a un vehículo de abastecimiento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Vehículo</label>
              <Select value={dispatchVehicleId} onValueChange={setDispatchVehicleId}>
                <SelectTrigger data-testid="select-dispatch-vehicle">
                  <SelectValue placeholder="Selecciona un vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.filter(v => v.isActive !== false).map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate} - {vehicle.brand} {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <label className="text-sm font-medium">Agregar productos</label>
              <div className="flex gap-2">
                <Select value={tempProductId} onValueChange={setTempProductId}>
                  <SelectTrigger className="flex-1" data-testid="select-dispatch-product">
                    <SelectValue placeholder="Producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventory.filter(i => (i.currentStock || 0) > 0).map((item) => (
                      <SelectItem key={item.productId} value={item.productId}>
                        {item.product.name} (Stock: {item.currentStock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Cantidad"
                  className="w-24"
                  value={tempQuantity}
                  onChange={(e) => setTempQuantity(e.target.value)}
                  data-testid="input-dispatch-quantity"
                />
                <Button type="button" size="icon" onClick={handleAddDispatchItem} data-testid="button-add-dispatch-item">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {dispatchItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Productos a despachar:</p>
                  {dispatchItems.map((item) => {
                    const product = products.find(p => p.id === item.productId);
                    const invItem = inventory.find(i => i.productId === item.productId);
                    return (
                      <div key={item.productId} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                        <span className="text-sm">
                          {product?.name || item.productId} - <strong>{item.quantity} unidades</strong>
                          {invItem && item.quantity > (invItem.currentStock || 0) && (
                            <Badge variant="destructive" className="ml-2">Stock insuficiente</Badge>
                          )}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleRemoveDispatchItem(item.productId)}
                          data-testid={`button-remove-dispatch-item-${item.productId}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Textarea
                placeholder="Observaciones del despacho..."
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                data-testid="input-dispatch-notes"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDispatchToVehicleDialogOpen(false);
                  setDispatchVehicleId("");
                  setDispatchItems([]);
                  setDispatchNotes("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmitDispatch}
                disabled={dispatchToVehicleMutation.isPending || dispatchItems.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-submit-dispatch"
              >
                {dispatchToVehicleMutation.isPending ? "Despachando..." : `Despachar ${dispatchItems.length} producto(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
