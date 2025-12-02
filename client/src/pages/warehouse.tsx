import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, Column } from "@/components/DataTable";
import { ProductCard } from "@/components/ProductCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// todo: remove mock functionality - replace with actual API data
const mockInventory = [
  {
    id: "1",
    name: "Coca-Cola 600ml",
    sku: "CC-600",
    quantity: 450,
    minStock: 100,
    price: 18.5,
    category: "Bebidas",
    expiryDate: "2025-03-15",
  },
  {
    id: "2",
    name: "Agua Mineral 500ml",
    sku: "AM-500",
    quantity: 80,
    minStock: 150,
    price: 12.0,
    category: "Bebidas",
    expiryDate: "2025-01-10",
  },
  {
    id: "3",
    name: "Sprite 355ml",
    sku: "SP-355",
    quantity: 320,
    minStock: 80,
    price: 15.0,
    category: "Bebidas",
  },
  {
    id: "4",
    name: "Jugo de Naranja 350ml",
    sku: "JN-350",
    quantity: 45,
    minStock: 50,
    price: 22.5,
    category: "Jugos",
    expiryDate: "2025-02-28",
  },
  {
    id: "5",
    name: "Fanta 600ml",
    sku: "FA-600",
    quantity: 280,
    minStock: 100,
    price: 18.5,
    category: "Bebidas",
  },
];

const mockMovements = [
  {
    id: "1",
    product: "Coca-Cola 600ml",
    type: "entrada" as const,
    quantity: 200,
    date: "2024-12-25",
    user: "Carlos R.",
    reference: "OC-001234",
  },
  {
    id: "2",
    product: "Agua Mineral 500ml",
    type: "salida" as const,
    quantity: 50,
    date: "2024-12-25",
    user: "María G.",
    reference: "AB-Juan P.",
  },
  {
    id: "3",
    product: "Sprite 355ml",
    type: "entrada" as const,
    quantity: 100,
    date: "2024-12-24",
    user: "Carlos R.",
    reference: "OC-001233",
  },
  {
    id: "4",
    product: "Jugo de Naranja 350ml",
    type: "salida" as const,
    quantity: 30,
    date: "2024-12-24",
    user: "Ana L.",
    reference: "AB-Pedro S.",
  },
];

const productSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  sku: z.string().min(2, "El SKU es requerido"),
  quantity: z.number().min(0, "La cantidad debe ser mayor o igual a 0"),
  minStock: z.number().min(1, "El stock mínimo debe ser mayor a 0"),
  price: z.number().min(0.01, "El precio debe ser mayor a 0"),
  category: z.string().min(1, "La categoría es requerida"),
});

type ProductFormData = z.infer<typeof productSchema>;

export function WarehousePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      quantity: 0,
      minStock: 50,
      price: 0,
      category: "",
    },
  });

  const filteredInventory = mockInventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = mockInventory.filter((item) => item.quantity < item.minStock);
  const totalValue = mockInventory.reduce((acc, item) => acc + item.quantity * item.price, 0);

  const inventoryColumns: Column<(typeof mockInventory)[0]>[] = [
    { key: "sku", header: "SKU" },
    { key: "name", header: "Producto" },
    { key: "category", header: "Categoría" },
    {
      key: "quantity",
      header: "Cantidad",
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className={item.quantity < item.minStock ? "text-destructive font-medium" : ""}>
            {item.quantity}
          </span>
          {item.quantity < item.minStock && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      ),
    },
    { key: "minStock", header: "Stock Mínimo" },
    {
      key: "price",
      header: "Precio",
      render: (item) => `$${item.price.toFixed(2)}`,
    },
    { key: "expiryDate", header: "Vencimiento" },
  ];

  const movementColumns: Column<(typeof mockMovements)[0]>[] = [
    { key: "date", header: "Fecha" },
    { key: "product", header: "Producto" },
    {
      key: "type",
      header: "Tipo",
      render: (item) => (
        <Badge
          variant="secondary"
          className={
            item.type === "entrada"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-amber-500/10 text-amber-500"
          }
        >
          <span className="flex items-center gap-1">
            {item.type === "entrada" ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : (
              <ArrowUpRight className="h-3 w-3" />
            )}
            {item.type === "entrada" ? "Entrada" : "Salida"}
          </span>
        </Badge>
      ),
    },
    { key: "quantity", header: "Cantidad" },
    { key: "user", header: "Usuario" },
    { key: "reference", header: "Referencia" },
  ];

  const onSubmit = (data: ProductFormData) => {
    console.log("New product:", data);
    setIsAddDialogOpen(false);
    form.reset();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Almacén</h1>
          <p className="text-muted-foreground">Control de inventario y movimientos</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Producto</DialogTitle>
              <DialogDescription>
                Ingresa los datos del nuevo producto
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Coca-Cola 600ml" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: CC-600" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad Inicial</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Mínimo</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                        <FormControl>
                          <Input placeholder="Ej: Bebidas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Agregar Producto</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockInventory.length}</p>
              <p className="text-sm text-muted-foreground">Productos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                ${totalValue.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-muted-foreground">Valor Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lowStockItems.length}</p>
              <p className="text-sm text-muted-foreground">Stock Bajo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockMovements.length}</p>
              <p className="text-sm text-muted-foreground">Movimientos Hoy</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventario">
        <TabsList>
          <TabsTrigger value="inventario">Inventario General</TabsTrigger>
          <TabsTrigger value="movimientos">Kardex / Movimientos</TabsTrigger>
          <TabsTrigger value="alertas">Alertas de Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-inventory"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={filteredInventory}
                columns={inventoryColumns}
                searchPlaceholder="Buscar..."
                searchKeys={["name", "sku"]}
                onRowClick={(item) => console.log("Row clicked:", item)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={mockMovements}
                columns={movementColumns}
                searchPlaceholder="Buscar movimiento..."
                searchKeys={["product", "user"]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Productos con Stock Bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No hay productos con stock bajo
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStockItems.map((item) => (
                    <ProductCard
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      quantity={item.quantity}
                      maxQuantity={item.minStock * 2}
                      price={item.price}
                      expiryDate={item.expiryDate}
                      isLowStock
                      onClick={() => console.log("Product clicked:", item.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
