import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Truck,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  Clock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, Supplier, WarehouseInventory, WarehouseMovement, ProductLot } from "@shared/schema";
import { formatDateShort, formatTime } from "@/lib/utils";

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
  quantity: z.string().min(1, "La cantidad es requerida"),
  unitCost: z.string().min(1, "El costo es requerido"),
  supplierId: z.string().optional(),
  lotNumber: z.string().min(1, "El número de lote es requerido"),
  expirationDate: z.string().optional(),
  notes: z.string().optional(),
});

const exitSchema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  quantity: z.string().min(1, "La cantidad es requerida"),
  destinationUserId: z.string().min(1, "Selecciona un abastecedor"),
  notes: z.string().optional(),
});

const supplierSchema = z.object({
  name: z.string().min(2, "El nombre es requerido"),
  code: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

type EntryFormData = z.infer<typeof entrySchema>;
type ExitFormData = z.infer<typeof exitSchema>;
type SupplierFormData = z.infer<typeof supplierSchema>;

const movementTypeLabels: Record<string, string> = {
  entrada_compra: "Entrada (Compra)",
  entrada_devolucion: "Entrada (Devolución)",
  salida_abastecedor: "Salida (Abastecedor)",
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
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");

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
    queryKey: ["/api/warehouse/lots/expiring", { days: 30 }],
    queryFn: async () => {
      const response = await fetch("/api/warehouse/lots/expiring?days=30", { credentials: "include" });
      if (!response.ok) throw new Error("Error loading expiring lots");
      return response.json();
    },
  });

  const { data: movements = [] } = useQuery<MovementItem[]>({
    queryKey: ["/api/warehouse/movements", selectedProductFilter],
    queryFn: async () => {
      const url = selectedProductFilter !== "all" 
        ? `/api/warehouse/movements?productId=${selectedProductFilter}&limit=100`
        : "/api/warehouse/movements?limit=100";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Error loading movements");
      return response.json();
    },
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const entryForm = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      productId: "",
      quantity: "",
      unitCost: "",
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
      quantity: "",
      destinationUserId: "",
      notes: "",
    },
  });

  const supplierForm = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      code: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      city: "",
      taxId: "",
      paymentTerms: "",
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

  const supplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const response = await apiRequest("POST", "/api/suppliers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsSupplierDialogOpen(false);
      supplierForm.reset();
    },
  });

  const filteredInventory = inventory.filter((item) =>
    item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.product.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMovements = movements.filter((mov) =>
    mov.product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Button
            onClick={() => setIsExitDialogOpen(true)}
            variant="outline"
            className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
            data-testid="button-new-exit"
          >
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            Salida
          </Button>
          <Button
            onClick={() => setIsSupplierDialogOpen(true)}
            variant="outline"
            data-testid="button-new-supplier"
          >
            <Truck className="w-4 h-4 mr-2" />
            Proveedor
          </Button>
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
          <TabsTrigger value="proveedores" data-testid="tab-suppliers">
            <Truck className="w-4 h-4 mr-2" />
            Proveedores
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Historial de Movimientos (Kardex)
              </CardTitle>
              <Select value={selectedProductFilter} onValueChange={setSelectedProductFilter}>
                <SelectTrigger className="w-64" data-testid="select-product-filter">
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
                    {filteredMovements.map((mov) => {
                      const isEntry = mov.movementType.startsWith("entrada");
                      
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
                            <span className={`font-mono font-medium ${isEntry ? "text-emerald-600" : "text-destructive"}`}>
                              {isEntry ? "+" : "-"}{mov.quantity}
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
                            ${parseFloat(lot.costPrice || "0").toFixed(2)}
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

        <TabsContent value="proveedores" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Proveedores
              </CardTitle>
              <Button onClick={() => setIsSupplierDialogOpen(true)} data-testid="button-add-supplier">
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </CardHeader>
            <CardContent>
              {suppliers.length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay proveedores registrados.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Ciudad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {supplier.code || "-"}
                        </TableCell>
                        <TableCell>{supplier.contactName || "-"}</TableCell>
                        <TableCell>{supplier.contactPhone || "-"}</TableCell>
                        <TableCell>{supplier.city || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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

      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
            <DialogDescription>
              Agrega un nuevo proveedor al sistema
            </DialogDescription>
          </DialogHeader>
          <Form {...supplierForm}>
            <form onSubmit={supplierForm.handleSubmit((data) => supplierMutation.mutate(data))} className="space-y-4">
              <FormField
                control={supplierForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del proveedor" {...field} data-testid="input-supplier-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input placeholder="PROV-001" {...field} data-testid="input-supplier-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RFC</FormLabel>
                      <FormControl>
                        <Input placeholder="RFC" {...field} data-testid="input-supplier-tax" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={supplierForm.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del contacto" {...field} data-testid="input-supplier-contact" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="55 1234 5678" {...field} data-testid="input-supplier-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciudad</FormLabel>
                      <FormControl>
                        <Input placeholder="Ciudad" {...field} data-testid="input-supplier-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsSupplierDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={supplierMutation.isPending} data-testid="button-submit-supplier">
                  {supplierMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
