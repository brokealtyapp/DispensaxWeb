import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDateShort } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { 
  Package, Building2, FileText, Truck, History, Plus, Search, Filter,
  Edit2, Trash2, Eye, Send, X, Check, AlertTriangle, DollarSign,
  Calendar, Clock, CheckCircle2, XCircle, PackageOpen, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const supplierFormSchema = z.object({
  name: z.string().min(2, "El nombre es requerido"),
  code: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierFormSchema>;

const orderFormSchema = z.object({
  supplierId: z.string().min(1, "Seleccione un proveedor"),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderFormSchema>;

const orderItemFormSchema = z.object({
  productId: z.string().min(1, "Seleccione un producto"),
  quantity: z.string().min(1, "La cantidad es requerida"),
  unitPrice: z.string().min(1, "El precio unitario es requerido"),
  notes: z.string().optional(),
});

type OrderItemFormData = z.infer<typeof orderItemFormSchema>;

const receptionItemSchema = z.object({
  orderItemId: z.string(),
  productId: z.string(),
  quantityReceived: z.number(),
  lotNumber: z.string().optional(),
  expirationDate: z.string().optional(),
  unitCost: z.string().optional(),
  notes: z.string().optional(),
});

export default function PurchasesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("suppliers");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [isReceiveOrderOpen, setIsReceiveOrderOpen] = useState(false);
  const [isSupplierHistoryOpen, setIsSupplierHistoryOpen] = useState(false);
  
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [receptionItems, setReceptionItems] = useState<any[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receptionNotes, setReceptionNotes] = useState("");

  const supplierForm = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
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

  const orderForm = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      supplierId: "",
      expectedDeliveryDate: "",
      notes: "",
    },
  });

  const orderItemForm = useForm<OrderItemFormData>({
    resolver: zodResolver(orderItemFormSchema),
    defaultValues: {
      productId: "",
      quantity: "",
      unitPrice: "",
      notes: "",
    },
  });

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/purchase-orders/stats"],
  });

  const { data: lowStockProducts } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders/low-stock"],
  });

  const { data: supplierHistory } = useQuery<any[]>({
    queryKey: ["/api/suppliers", selectedSupplier?.id, "purchase-history"],
    enabled: !!selectedSupplier?.id && isSupplierHistoryOpen,
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      return apiRequest("POST", "/api/suppliers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Proveedor creado", description: "El proveedor se ha creado correctamente" });
      setIsNewSupplierOpen(false);
      supplierForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el proveedor", variant: "destructive" });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      return apiRequest("PATCH", `/api/suppliers/${selectedSupplier?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Proveedor actualizado", description: "El proveedor se ha actualizado correctamente" });
      setIsEditSupplierOpen(false);
      setSelectedSupplier(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el proveedor", variant: "destructive" });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/suppliers/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Proveedor eliminado", description: "El proveedor se ha eliminado correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el proveedor", variant: "destructive" });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      return apiRequest("POST", "/api/purchase-orders", {
        ...data,
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders/stats"] });
      toast({ title: "Orden creada", description: "La orden de compra se ha creado correctamente" });
      setIsNewOrderOpen(false);
      orderForm.reset();
      setSelectedOrder(data);
      setIsAddItemOpen(true);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la orden", variant: "destructive" });
    },
  });

  const addOrderItemMutation = useMutation({
    mutationFn: async (data: OrderItemFormData) => {
      const quantity = parseInt(data.quantity);
      const unitPrice = parseFloat(data.unitPrice);
      const subtotal = quantity * unitPrice;
      
      return apiRequest("POST", `/api/purchase-orders/${selectedOrder?.id}/items`, {
        productId: data.productId,
        quantity,
        unitPrice: unitPrice.toFixed(2),
        subtotal: subtotal.toFixed(2),
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", selectedOrder?.id] });
      toast({ title: "Producto agregado", description: "El producto se ha agregado a la orden" });
      orderItemForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo agregar el producto", variant: "destructive" });
    },
  });

  const removeOrderItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("DELETE", `/api/purchase-order-items/${itemId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Producto eliminado", description: "El producto se ha eliminado de la orden" });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      return apiRequest("PATCH", `/api/purchase-orders/${id}/status`, { status, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders/stats"] });
      toast({ title: "Estado actualizado", description: "El estado de la orden se ha actualizado" });
      setIsOrderDetailOpen(false);
      setSelectedOrder(null);
    },
  });

  const createReceptionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/purchase-receptions", {
        reception: {
          orderId: selectedOrder?.id,
          invoiceNumber,
          notes: receptionNotes,
        },
        items: receptionItems.filter(item => item.quantityReceived > 0).map(item => ({
          orderItemId: item.orderItemId,
          productId: item.productId,
          quantityReceived: item.quantityReceived,
          lotNumber: item.lotNumber,
          expirationDate: item.expirationDate ? new Date(item.expirationDate) : undefined,
          unitCost: item.unitCost,
          notes: item.notes,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-receptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders/stats"] });
      toast({ title: "Recepción registrada", description: "La mercancía se ha registrado correctamente" });
      setIsReceiveOrderOpen(false);
      setReceptionItems([]);
      setInvoiceNumber("");
      setReceptionNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar la recepción", variant: "destructive" });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/purchase-orders/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders/stats"] });
      toast({ title: "Orden eliminada", description: "La orden se ha eliminado correctamente" });
      setIsOrderDetailOpen(false);
    },
  });

  const onSupplierSubmit = (data: SupplierFormData) => {
    if (isEditSupplierOpen) {
      updateSupplierMutation.mutate(data);
    } else {
      createSupplierMutation.mutate(data);
    }
  };

  const onOrderSubmit = (data: OrderFormData) => {
    createOrderMutation.mutate(data);
  };

  const onOrderItemSubmit = (data: OrderItemFormData) => {
    addOrderItemMutation.mutate(data);
  };

  const handleEditSupplier = (supplier: any) => {
    setSelectedSupplier(supplier);
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
    setIsEditSupplierOpen(true);
  };

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setIsOrderDetailOpen(true);
  };

  const handleReceiveOrder = (order: any) => {
    setSelectedOrder(order);
    setReceptionItems(order.items?.map((item: any) => ({
      orderItemId: item.id,
      productId: item.productId,
      productName: item.product?.name,
      quantityOrdered: item.quantity,
      quantityReceived: item.quantity - (item.receivedQuantity || 0),
      alreadyReceived: item.receivedQuantity || 0,
      lotNumber: "",
      expirationDate: "",
      unitCost: item.unitPrice,
      notes: "",
    })) || []);
    setIsReceiveOrderOpen(true);
  };

  const handleSupplierHistory = (supplier: any) => {
    setSelectedSupplier(supplier);
    setIsSupplierHistoryOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { class: string; label: string }> = {
      borrador: { class: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", label: "Borrador" },
      enviada: { class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Enviada" },
      parcialmente_recibida: { class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Parcial" },
      recibida: { class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Recibida" },
      cancelada: { class: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Cancelada" },
    };
    const style = styles[status] || styles.borrador;
    return <Badge className={style.class} data-testid={`badge-status-${status}`}>{style.label}</Badge>;
  };

  const filteredSuppliers = suppliers?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredOrders = orders?.filter(o => {
    const matchesSearch = o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Compras</h1>
          <p className="text-muted-foreground">Gestión de proveedores, órdenes de compra y recepción de mercancía</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Órdenes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-orders">{stats?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.pendingOrders || 0} pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-amount">
              ${(stats?.totalAmount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Este período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-suppliers">{suppliers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-low-stock">{lowStockProducts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Productos por reabastecer</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="tabs-purchases">
          <TabsTrigger value="suppliers" data-testid="tab-suppliers">
            <Building2 className="h-4 w-4 mr-2" />
            Proveedores
          </TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">
            <FileText className="h-4 w-4 mr-2" />
            Órdenes
          </TabsTrigger>
          <TabsTrigger value="reception" data-testid="tab-reception">
            <PackageOpen className="h-4 w-4 mr-2" />
            Recepción
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-supplier"
              />
            </div>
            <Button onClick={() => { supplierForm.reset(); setIsNewSupplierOpen(true); }} data-testid="button-new-supplier">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proveedor
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                    </TableRow>
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay proveedores registrados
                      </TableCell>
                    </TableRow>
                  ) : filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                      <TableCell className="font-mono text-sm">{supplier.code || "-"}</TableCell>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.contactName || "-"}</TableCell>
                      <TableCell>{supplier.contactPhone || "-"}</TableCell>
                      <TableCell>{supplier.city || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleSupplierHistory(supplier)} data-testid={`button-history-${supplier.id}`}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEditSupplier(supplier)} data-testid={`button-edit-${supplier.id}`}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteSupplierMutation.mutate(supplier.id)} data-testid={`button-delete-${supplier.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar orden..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-order"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="parcialmente_recibida">Parcial</SelectItem>
                  <SelectItem value="recibida">Recibida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { orderForm.reset(); setIsNewOrderOpen(true); }} data-testid="button-new-order">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Orden
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Orden</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay órdenes de compra
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                      <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.supplier?.name}</TableCell>
                      <TableCell>{formatDateShort(order.issueDate)}</TableCell>
                      <TableCell>{order.itemCount} productos</TableCell>
                      <TableCell className="font-medium">
                        ${parseFloat(order.total || "0").toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewOrder(order)} data-testid={`button-view-${order.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(order.status === "enviada" || order.status === "parcialmente_recibida") && (
                            <Button variant="ghost" size="icon" onClick={() => handleReceiveOrder(order)} data-testid={`button-receive-${order.id}`}>
                              <PackageOpen className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reception" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes Pendientes de Recibir</CardTitle>
              <CardDescription>Selecciona una orden para registrar la recepción de mercancía</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orders?.filter(o => o.status === "enviada" || o.status === "parcialmente_recibida").length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <PackageOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay órdenes pendientes de recibir</p>
                  </div>
                ) : orders?.filter(o => o.status === "enviada" || o.status === "parcialmente_recibida").map((order) => (
                  <Card key={order.id} className="hover-elevate cursor-pointer" onClick={() => handleReceiveOrder(order)} data-testid={`card-reception-${order.id}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Truck className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">{order.supplier?.name}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="font-medium">{order.itemCount} productos</p>
                          <p className="text-sm text-muted-foreground">
                            ${parseFloat(order.total || "0").toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        {getStatusBadge(order.status)}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {lowStockProducts && lowStockProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Productos con Stock Bajo
                </CardTitle>
                <CardDescription>Estos productos necesitan ser reabastecidos</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Stock Actual</TableHead>
                      <TableHead>Punto de Reorden</TableHead>
                      <TableHead>Stock Mínimo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.map((item) => (
                      <TableRow key={item.id} data-testid={`row-lowstock-${item.id}`}>
                        <TableCell className="font-medium">{item.product?.name}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{item.currentStock}</Badge>
                        </TableCell>
                        <TableCell>{item.reorderPoint}</TableCell>
                        <TableCell>{item.minStock}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Compras</CardTitle>
              <CardDescription>Resumen de todas las compras realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{orders?.filter(o => o.status === "recibida").length || 0}</div>
                      <p className="text-sm text-muted-foreground">Órdenes Completadas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        ${orders?.filter(o => o.status === "recibida").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0).toLocaleString("es-MX", { minimumFractionDigits: 2 }) || "0.00"}
                      </div>
                      <p className="text-sm text-muted-foreground">Total Comprado</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{stats?.topSuppliers?.length || 0}</div>
                      <p className="text-sm text-muted-foreground">Proveedores Activos</p>
                    </CardContent>
                  </Card>
                </div>

                {stats?.topSuppliers && stats.topSuppliers.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Top Proveedores</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Órdenes</TableHead>
                          <TableHead>Monto Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.topSuppliers.map((item: any, index: number) => (
                          <TableRow key={item.supplierId} data-testid={`row-top-supplier-${index}`}>
                            <TableCell className="font-medium">{item.supplier?.name}</TableCell>
                            <TableCell>{item.count}</TableCell>
                            <TableCell>${item.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isNewSupplierOpen || isEditSupplierOpen} onOpenChange={(open) => { 
        if (!open) { setIsNewSupplierOpen(false); setIsEditSupplierOpen(false); } 
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditSupplierOpen ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
            <DialogDescription>
              {isEditSupplierOpen ? "Modifica los datos del proveedor" : "Ingresa los datos del nuevo proveedor"}
            </DialogDescription>
          </DialogHeader>
          <Form {...supplierForm}>
            <form onSubmit={supplierForm.handleSubmit(onSupplierSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nombre del proveedor" data-testid="input-supplier-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Código interno" data-testid="input-supplier-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de Contacto</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nombre del contacto" data-testid="input-supplier-contact" />
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
                        <Input {...field} placeholder="Teléfono de contacto" data-testid="input-supplier-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={supplierForm.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="email@proveedor.com" data-testid="input-supplier-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Dirección" data-testid="input-supplier-address" />
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
                        <Input {...field} placeholder="Ciudad" data-testid="input-supplier-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={supplierForm.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RFC</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="RFC del proveedor" data-testid="input-supplier-taxid" />
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
                        <Input {...field} placeholder="Ej: 30 días" data-testid="input-supplier-payment" />
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
                      <Textarea {...field} placeholder="Notas adicionales" data-testid="input-supplier-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsNewSupplierOpen(false); setIsEditSupplierOpen(false); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending} data-testid="button-save-supplier">
                  {createSupplierMutation.isPending || updateSupplierMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Orden de Compra</DialogTitle>
            <DialogDescription>Selecciona el proveedor para crear una nueva orden</DialogDescription>
          </DialogHeader>
          <Form {...orderForm}>
            <form onSubmit={orderForm.handleSubmit(onOrderSubmit)} className="space-y-4">
              <FormField
                control={orderForm.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-order-supplier">
                          <SelectValue placeholder="Selecciona un proveedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orderForm.control}
                name="expectedDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Esperada de Entrega</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" data-testid="input-order-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orderForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Notas de la orden" data-testid="input-order-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewOrderOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createOrderMutation.isPending} data-testid="button-create-order">
                  {createOrderMutation.isPending ? "Creando..." : "Crear y Agregar Productos"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Agregar Productos a la Orden</DialogTitle>
            <DialogDescription>
              Orden: {selectedOrder?.orderNumber} - {selectedOrder?.supplier?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Form {...orderItemForm}>
              <form onSubmit={orderItemForm.handleSubmit(onOrderItemSubmit)} className="flex gap-2 items-end">
                <FormField
                  control={orderItemForm.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Producto</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-product">
                            <SelectValue placeholder="Selecciona un producto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={orderItemForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem className="w-24">
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="1" data-testid="input-item-quantity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={orderItemForm.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormLabel>Precio Unit.</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" min="0" data-testid="input-item-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={addOrderItemMutation.isPending} data-testid="button-add-item">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </Form>

            <Separator />

            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder?.items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product?.name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">${parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right">${parseFloat(item.subtotal).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeOrderItemMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedOrder?.items?.length || 0} productos
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Subtotal: ${parseFloat(selectedOrder?.subtotal || "0").toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">IVA 16%: ${parseFloat(selectedOrder?.taxAmount || "0").toFixed(2)}</p>
                <p className="text-lg font-bold">Total: ${parseFloat(selectedOrder?.total || "0").toFixed(2)}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>Cerrar</Button>
            {selectedOrder?.status === "borrador" && selectedOrder?.items?.length > 0 && (
              <Button onClick={() => {
                updateOrderStatusMutation.mutate({ id: selectedOrder.id, status: "enviada" });
                setIsAddItemOpen(false);
              }} data-testid="button-send-order">
                <Send className="h-4 w-4 mr-2" />
                Enviar Orden
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOrderDetailOpen} onOpenChange={setIsOrderDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Orden {selectedOrder?.orderNumber}
              {selectedOrder && getStatusBadge(selectedOrder.status)}
            </DialogTitle>
            <DialogDescription>{selectedOrder?.supplier?.name}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Fecha de Emisión</p>
                <p className="font-medium">{selectedOrder?.issueDate ? formatDateShort(selectedOrder.issueDate) : "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha Esperada</p>
                <p className="font-medium">{selectedOrder?.expectedDeliveryDate ? formatDateShort(selectedOrder.expectedDeliveryDate) : "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Creado por</p>
                <p className="font-medium">{selectedOrder?.createdByUser?.fullName || selectedOrder?.createdByUser?.username}</p>
              </div>
              {selectedOrder?.notes && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Notas</p>
                  <p className="font-medium">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            <Separator />

            <ScrollArea className="h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Recibido</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder?.items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product?.name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {item.receivedQuantity > 0 ? (
                          <Badge variant={item.receivedQuantity >= item.quantity ? "default" : "secondary"}>
                            {item.receivedQuantity}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">${parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell className="text-right">${parseFloat(item.subtotal).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Subtotal: ${parseFloat(selectedOrder?.subtotal || "0").toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">IVA 16%: ${parseFloat(selectedOrder?.taxAmount || "0").toFixed(2)}</p>
                <p className="text-lg font-bold">Total: ${parseFloat(selectedOrder?.total || "0").toFixed(2)}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsOrderDetailOpen(false)}>Cerrar</Button>
            {selectedOrder?.status === "borrador" && (
              <>
                <Button variant="destructive" onClick={() => deleteOrderMutation.mutate(selectedOrder.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
                <Button onClick={() => {
                  setIsOrderDetailOpen(false);
                  setIsAddItemOpen(true);
                }}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                {selectedOrder?.items?.length > 0 && (
                  <Button onClick={() => updateOrderStatusMutation.mutate({ id: selectedOrder.id, status: "enviada" })}>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </Button>
                )}
              </>
            )}
            {selectedOrder?.status === "enviada" && (
              <>
                <Button variant="destructive" onClick={() => updateOrderStatusMutation.mutate({ id: selectedOrder.id, status: "cancelada", reason: "Cancelada por usuario" })}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={() => { setIsOrderDetailOpen(false); handleReceiveOrder(selectedOrder); }}>
                  <PackageOpen className="h-4 w-4 mr-2" />
                  Recibir Mercancía
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiveOrderOpen} onOpenChange={setIsReceiveOrderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recepción de Mercancía</DialogTitle>
            <DialogDescription>
              Orden: {selectedOrder?.orderNumber} - {selectedOrder?.supplier?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Número de Factura</label>
                <Input 
                  value={invoiceNumber} 
                  onChange={(e) => setInvoiceNumber(e.target.value)} 
                  placeholder="Número de factura del proveedor"
                  data-testid="input-reception-invoice"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notas</label>
                <Input 
                  value={receptionNotes} 
                  onChange={(e) => setReceptionNotes(e.target.value)} 
                  placeholder="Observaciones"
                  data-testid="input-reception-notes"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Productos a Recibir</h4>
              {receptionItems.map((item, index) => (
                <Card key={item.orderItemId} className="p-4" data-testid={`card-reception-item-${index}`}>
                  <div className="grid grid-cols-6 gap-3 items-end">
                    <div className="col-span-2">
                      <label className="text-sm font-medium">{item.productName}</label>
                      <p className="text-xs text-muted-foreground">
                        Ordenado: {item.quantityOrdered} | Recibido antes: {item.alreadyReceived}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Cantidad</label>
                      <Input 
                        type="number" 
                        min="0"
                        max={item.quantityOrdered - item.alreadyReceived}
                        value={item.quantityReceived}
                        onChange={(e) => {
                          const newItems = [...receptionItems];
                          newItems[index].quantityReceived = parseInt(e.target.value) || 0;
                          setReceptionItems(newItems);
                        }}
                        data-testid={`input-reception-qty-${index}`}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Lote</label>
                      <Input 
                        value={item.lotNumber}
                        onChange={(e) => {
                          const newItems = [...receptionItems];
                          newItems[index].lotNumber = e.target.value;
                          setReceptionItems(newItems);
                        }}
                        placeholder="No. Lote"
                        data-testid={`input-reception-lot-${index}`}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Caducidad</label>
                      <Input 
                        type="date"
                        value={item.expirationDate}
                        onChange={(e) => {
                          const newItems = [...receptionItems];
                          newItems[index].expirationDate = e.target.value;
                          setReceptionItems(newItems);
                        }}
                        data-testid={`input-reception-expiry-${index}`}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Costo Unit.</label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => {
                          const newItems = [...receptionItems];
                          newItems[index].unitCost = e.target.value;
                          setReceptionItems(newItems);
                        }}
                        data-testid={`input-reception-cost-${index}`}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiveOrderOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => createReceptionMutation.mutate()} 
              disabled={createReceptionMutation.isPending || receptionItems.every(i => i.quantityReceived === 0)}
              data-testid="button-confirm-reception"
            >
              {createReceptionMutation.isPending ? "Registrando..." : "Confirmar Recepción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSupplierHistoryOpen} onOpenChange={setIsSupplierHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de Compras</DialogTitle>
            <DialogDescription>{selectedSupplier?.name}</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            {supplierHistory?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay historial de compras para este proveedor
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierHistory?.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">{order.orderNumber}</TableCell>
                      <TableCell>{formatDateShort(order.issueDate)}</TableCell>
                      <TableCell>{order.itemCount}</TableCell>
                      <TableCell>${parseFloat(order.total || "0").toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSupplierHistoryOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
