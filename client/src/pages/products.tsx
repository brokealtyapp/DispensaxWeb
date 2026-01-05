import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Grid3X3,
  List,
  DollarSign,
  Tag,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";

const productSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  code: z.string().optional(),
  category: z.string().min(1, "Selecciona una categoría"),
  salePrice: z.string().min(1, "El precio de venta es requerido"),
  costPrice: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productSchema>;

const categoryLabels: Record<string, string> = {
  bebidas_frias: "Bebidas Frías",
  bebidas_calientes: "Bebidas Calientes",
  snacks: "Snacks",
  dulces: "Dulces",
  otros: "Otros",
};

const categoryColors: Record<string, string> = {
  bebidas_frias: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  bebidas_calientes: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  snacks: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  dulces: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  otros: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export function ProductsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      code: "",
      category: "bebidas_frias",
      salePrice: "",
      costPrice: "",
      imageUrl: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return apiRequest("POST", "/api/products", {
        ...data,
        salePrice: data.salePrice,
        costPrice: data.costPrice || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Producto creado", description: "El producto se ha creado correctamente" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo crear el producto", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductFormData> }) => {
      return apiRequest("PATCH", `/api/products/${id}`, {
        ...data,
        salePrice: data.salePrice,
        costPrice: data.costPrice || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Producto actualizado", description: "El producto se ha actualizado correctamente" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el producto", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Producto eliminado", description: "El producto se ha eliminado correctamente" });
      setDeletingProduct(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "No se pudo eliminar el producto", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    form.reset({
      name: "",
      code: "",
      category: "bebidas_frias",
      salePrice: "",
      costPrice: "",
      imageUrl: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      code: product.code || "",
      category: product.category || "bebidas_frias",
      salePrice: product.salePrice?.toString() || "",
      costPrice: product.costPrice?.toString() || "",
      imageUrl: product.imageUrl || "",
      isActive: product.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    form.reset();
  };

  const onSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deletingProduct) {
      deleteMutation.mutate(deletingProduct.id);
    }
  };

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return "RD$ 0.00";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
    }).format(num);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && product.isActive) ||
      (statusFilter === "inactive" && !product.isActive);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: products.length,
    active: products.filter((p) => p.isActive).length,
    inactive: products.filter((p) => !p.isActive).length,
    categories: Array.from(new Set(products.map((p) => p.category))).length,
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Productos
          </h1>
          <p className="text-muted-foreground">
            Gestiona el catálogo de productos disponibles
          </p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-add-product">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-products">
                  {stats.total}
                </p>
                <p className="text-sm text-muted-foreground">Total productos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-products">
                  {stats.active}
                </p>
                <p className="text-sm text-muted-foreground">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-inactive-products">
                  {stats.inactive}
                </p>
                <p className="text-sm text-muted-foreground">Inactivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Tag className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-categories-count">
                  {stats.categories}
                </p>
                <p className="text-sm text-muted-foreground">Categorías</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-products"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-category-filter">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            <SelectItem value="bebidas_frias">Bebidas Frías</SelectItem>
            <SelectItem value="bebidas_calientes">Bebidas Calientes</SelectItem>
            <SelectItem value="snacks">Snacks</SelectItem>
            <SelectItem value="dulces">Dulces</SelectItem>
            <SelectItem value="otros">Otros</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            data-testid="button-view-grid"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={`hover-elevate cursor-pointer ${!product.isActive ? "opacity-60" : ""}`}
              data-testid={`card-product-${product.id}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate" data-testid={`text-product-name-${product.id}`}>
                      {product.name}
                    </h3>
                    {product.code && (
                      <p className="text-sm text-muted-foreground">{product.code}</p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={categoryColors[product.category || "otros"]}
                  >
                    {categoryLabels[product.category || "otros"] || product.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold text-lg" data-testid={`text-product-price-${product.id}`}>
                    {formatCurrency(product.salePrice)}
                  </span>
                </div>
                {product.costPrice && (
                  <p className="text-sm text-muted-foreground">
                    Costo: {formatCurrency(product.costPrice)}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Badge variant={product.isActive ? "default" : "secondary"}>
                    {product.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(product);
                      }}
                      data-testid={`button-edit-product-${product.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingProduct(product);
                      }}
                      data-testid={`button-delete-product-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || categoryFilter !== "all" || statusFilter !== "all"
                  ? "No se encontraron productos con los filtros aplicados"
                  : "No hay productos registrados"}
              </p>
              {!searchQuery && categoryFilter === "all" && statusFilter === "all" && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleOpenCreate}
                  data-testid="button-add-first-product"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar primer producto
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio Venta</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.code || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={categoryColors[product.category || "otros"]}
                    >
                      {categoryLabels[product.category || "otros"] || product.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(product.salePrice)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {product.costPrice ? formatCurrency(product.costPrice) : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? "default" : "secondary"}>
                      {product.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(product)}
                        data-testid={`button-edit-product-list-${product.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingProduct(product)}
                        data-testid={`button-delete-product-list-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay productos que mostrar</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Modifica los datos del producto"
                : "Ingresa los datos del nuevo producto"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Coca-Cola 500ml"
                        {...field}
                        data-testid="input-product-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: SKU-001"
                        {...field}
                        data-testid="input-product-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-category">
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bebidas_frias">Bebidas Frías</SelectItem>
                        <SelectItem value="bebidas_calientes">Bebidas Calientes</SelectItem>
                        <SelectItem value="snacks">Snacks</SelectItem>
                        <SelectItem value="dulces">Dulces</SelectItem>
                        <SelectItem value="otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="salePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de Venta</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-product-sale-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-product-cost-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Producto activo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Los productos inactivos no aparecen en las selecciones
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-product-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  data-testid="button-cancel-product"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-product"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Guardando..."
                    : editingProduct
                    ? "Guardar Cambios"
                    : "Crear Producto"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Producto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar "{deletingProduct?.name}"? Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
