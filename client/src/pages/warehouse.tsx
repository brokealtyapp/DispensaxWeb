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
  Edit,
  Trash2,
  Eye,
  FileText,
  Building2,
  Download,
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
type AdjustmentFormData = z.infer<typeof adjustmentSchema>;
type SupplierFormData = z.infer<typeof supplierSchema>;

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

interface PurchaseHistoryItem {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  totalAmount: string;
  itemsCount: number;
}

export function WarehousePage() {
  const [activeTab, setActiveTab] = useState("inventario");
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<string>("all");
  const [supplierPage, setSupplierPage] = useState(1);
  const SUPPLIERS_PER_PAGE = 10;
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
  const [selectedMovementTypeFilter, setSelectedMovementTypeFilter] = useState<string>("all");
  const [movementsPage, setMovementsPage] = useState(1);
  const MOVEMENTS_PER_PAGE = 20;
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);

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

  const supplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      if (editingSupplier) {
        const response = await apiRequest("PATCH", `/api/suppliers/${editingSupplier.id}`, data);
        return response.json();
      }
      const response = await apiRequest("POST", "/api/suppliers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsSupplierDialogOpen(false);
      setEditingSupplier(null);
      supplierForm.reset();
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/suppliers/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setSupplierToDelete(null);
    },
  });

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    supplierForm.reset({
      name: supplier.name,
      code: supplier.code || "",
      contactName: supplier.contactName || "",
      contactEmail: supplier.contactEmail || "",
      contactPhone: supplier.contactPhone || "",
      address: supplier.address || "",
      city: supplier.city || "",
      taxId: supplier.taxId || "",
      paymentTerms: supplier.paymentTerms || "",
      notes: supplier.notes || "",
    });
    setIsSupplierDialogOpen(true);
  };

  const [isLoadingPurchaseHistory, setIsLoadingPurchaseHistory] = useState(false);

  const handleViewSupplier = async (supplier: Supplier) => {
    setPurchaseHistory([]);
    setIsLoadingPurchaseHistory(true);
    setViewingSupplier(supplier);
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}/purchase-history`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setPurchaseHistory(data);
      } else {
        setPurchaseHistory([]);
      }
    } catch {
      setPurchaseHistory([]);
    } finally {
      setIsLoadingPurchaseHistory(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesSearch = supplier.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
        supplier.code?.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
        supplier.contactName?.toLowerCase().includes(supplierSearchQuery.toLowerCase());
      const matchesStatus = supplierStatusFilter === "all" || 
        (supplierStatusFilter === "active" && supplier.isActive) ||
        (supplierStatusFilter === "inactive" && !supplier.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [suppliers, supplierSearchQuery, supplierStatusFilter]);

  const paginatedSuppliers = useMemo(() => {
    const startIndex = (supplierPage - 1) * SUPPLIERS_PER_PAGE;
    return filteredSuppliers.slice(startIndex, startIndex + SUPPLIERS_PER_PAGE);
  }, [filteredSuppliers, supplierPage]);

  useEffect(() => {
    const totalPages = Math.ceil(filteredSuppliers.length / SUPPLIERS_PER_PAGE);
    if (supplierPage > totalPages && totalPages > 0) {
      setSupplierPage(totalPages);
    }
  }, [filteredSuppliers.length, supplierPage]);

  const handleSupplierSearchChange = (value: string) => {
    setSupplierSearchQuery(value);
    setSupplierPage(1);
  };

  const handleSupplierFilterChange = (value: string) => {
    setSupplierStatusFilter(value);
    setSupplierPage(1);
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
                <Button
                  variant="outline"
                  onClick={() => setIsAdjustmentDialogOpen(true)}
                  data-testid="button-adjustment"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Ajuste
                </Button>
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
                        totalPages={totalMovementsPages}
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
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Proveedores
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar proveedor..."
                    value={supplierSearchQuery}
                    onChange={(e) => handleSupplierSearchChange(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-supplier"
                  />
                </div>
                <Select value={supplierStatusFilter} onValueChange={handleSupplierFilterChange}>
                  <SelectTrigger className="w-36" data-testid="select-supplier-status">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => {
                    setEditingSupplier(null);
                    supplierForm.reset({
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
                    });
                    setIsSupplierDialogOpen(true);
                  }} 
                  data-testid="button-add-supplier"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSuppliers.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {suppliers.length === 0 
                      ? "No hay proveedores registrados."
                      : "No se encontraron proveedores con los filtros aplicados."}
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
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {supplier.code || "-"}
                        </TableCell>
                        <TableCell>{supplier.contactName || "-"}</TableCell>
                        <TableCell>{supplier.contactPhone || "-"}</TableCell>
                        <TableCell>{supplier.city || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={supplier.isActive ? "default" : "secondary"}>
                            {supplier.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleViewSupplier(supplier)}
                              data-testid={`button-view-supplier-${supplier.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditSupplier(supplier)}
                              data-testid={`button-edit-supplier-${supplier.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setSupplierToDelete(supplier)}
                              data-testid={`button-delete-supplier-${supplier.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {filteredSuppliers.length > SUPPLIERS_PER_PAGE && (
                <DataPagination
                  currentPage={supplierPage}
                  totalItems={filteredSuppliers.length}
                  itemsPerPage={SUPPLIERS_PER_PAGE}
                  onPageChange={setSupplierPage}
                  className="mt-4"
                />
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

      <Dialog open={isSupplierDialogOpen} onOpenChange={(open) => {
        setIsSupplierDialogOpen(open);
        if (!open) setEditingSupplier(null);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
            <DialogDescription>
              {editingSupplier ? "Modifica los datos del proveedor" : "Agrega un nuevo proveedor al sistema"}
            </DialogDescription>
          </DialogHeader>
          <Form {...supplierForm}>
            <form onSubmit={supplierForm.handleSubmit((data) => supplierMutation.mutate(data))} className="space-y-4">
              <FormField
                control={supplierForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
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
                      <FormLabel>RNC/Cédula</FormLabel>
                      <FormControl>
                        <Input placeholder="RNC o Cédula" {...field} data-testid="input-supplier-tax" />
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
                    <FormLabel>Nombre de Contacto</FormLabel>
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
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="correo@ejemplo.com" {...field} data-testid="input-supplier-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="809-555-1234" {...field} data-testid="input-supplier-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={supplierForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input placeholder="Dirección completa" {...field} data-testid="input-supplier-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
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
                <FormField
                  control={supplierForm.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Términos de Pago</FormLabel>
                      <FormControl>
                        <Input placeholder="30 días, Contado, etc." {...field} data-testid="input-supplier-payment" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={supplierForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observaciones adicionales..." {...field} data-testid="input-supplier-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setIsSupplierDialogOpen(false);
                  setEditingSupplier(null);
                }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={supplierMutation.isPending} data-testid="button-submit-supplier">
                  {supplierMutation.isPending ? "Guardando..." : (editingSupplier ? "Actualizar" : "Guardar")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!supplierToDelete} onOpenChange={(open) => !open && setSupplierToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Proveedor</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a <strong>{supplierToDelete?.name}</strong>? 
              Esta acción no se puede deshacer y podría afectar órdenes de compra asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => supplierToDelete && deleteSupplierMutation.mutate(supplierToDelete.id)}
              data-testid="button-confirm-delete-supplier"
            >
              {deleteSupplierMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingSupplier} onOpenChange={(open) => !open && setViewingSupplier(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {viewingSupplier?.name}
            </DialogTitle>
            <DialogDescription>
              Información detallada del proveedor
            </DialogDescription>
          </DialogHeader>
          
          {viewingSupplier && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Código</p>
                  <p className="font-medium">{viewingSupplier.code || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RNC/Cédula</p>
                  <p className="font-medium">{viewingSupplier.taxId || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contacto</p>
                  <p className="font-medium">{viewingSupplier.contactName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{viewingSupplier.contactEmail || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{viewingSupplier.contactPhone || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ciudad</p>
                  <p className="font-medium">{viewingSupplier.city || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="font-medium">{viewingSupplier.address || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Términos de Pago</p>
                  <p className="font-medium">{viewingSupplier.paymentTerms || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge variant={viewingSupplier.isActive ? "default" : "secondary"}>
                    {viewingSupplier.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                {viewingSupplier.notes && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="font-medium">{viewingSupplier.notes}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4" />
                  Historial de Órdenes de Compra
                </h4>
                {isLoadingPurchaseHistory ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Cargando historial...</p>
                  </div>
                ) : purchaseHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No hay órdenes de compra registradas para este proveedor.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Orden</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseHistory.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
                          <TableCell>{formatDateShort(new Date(order.orderDate))}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{order.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{order.itemsCount}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${parseFloat(order.totalAmount).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
