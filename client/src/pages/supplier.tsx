import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouteCard } from "@/components/RouteCard";
import { ServiceTimer } from "@/components/ServiceTimer";
import { ProductCard } from "@/components/ProductCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Navigation,
  Clock,
  Package,
  DollarSign,
  AlertTriangle,
  Camera,
  CheckCircle2,
} from "lucide-react";

// todo: remove mock functionality - replace with actual API data
const mockRoutes = [
  {
    id: "1",
    orderNumber: 1,
    machineName: "Plaza Central",
    location: "Centro Comercial Norte",
    estimatedTime: "09:00 - 10:30",
    status: "completada" as const,
    distance: "2.5 km",
  },
  {
    id: "2",
    orderNumber: 2,
    machineName: "Edificio Corporativo",
    location: "Zona Industrial",
    estimatedTime: "11:00 - 12:00",
    status: "en_progreso" as const,
    distance: "5.2 km",
  },
  {
    id: "3",
    orderNumber: 3,
    machineName: "Universidad Tech",
    location: "Campus Sur",
    estimatedTime: "14:00 - 15:30",
    status: "pendiente" as const,
    distance: "8.1 km",
  },
  {
    id: "4",
    orderNumber: 4,
    machineName: "Hospital Central",
    location: "Zona Médica",
    estimatedTime: "16:00 - 17:00",
    status: "pendiente" as const,
    distance: "3.7 km",
  },
];

const mockProducts = [
  {
    id: "1",
    name: "Coca-Cola 600ml",
    quantity: 45,
    maxQuantity: 50,
    price: 18.5,
    expiryDate: "2025-03-15",
  },
  {
    id: "2",
    name: "Agua Mineral 500ml",
    quantity: 12,
    maxQuantity: 50,
    price: 12.0,
    expiryDate: "2025-01-10",
    isLowStock: true,
  },
  {
    id: "3",
    name: "Sprite 355ml",
    quantity: 8,
    maxQuantity: 40,
    price: 15.0,
    isLowStock: true,
  },
  {
    id: "4",
    name: "Jugo de Naranja 350ml",
    quantity: 30,
    maxQuantity: 35,
    price: 22.5,
    expiryDate: "2025-02-28",
  },
];

export function SupplierPage() {
  const [activeTab, setActiveTab] = useState("ruta");
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [currentMachine, setCurrentMachine] = useState<string | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const { toast } = useToast();

  const handleStartService = (machineId: string, machineName: string) => {
    setCurrentMachine(machineName);
    setIsServiceActive(true);
    setActiveTab("servicio");
    toast({
      title: "Servicio iniciado",
      description: `Has iniciado el servicio en ${machineName}`,
    });
  };

  const handleStopService = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    toast({
      title: "Servicio finalizado",
      description: `Tiempo total: ${minutes} minutos`,
    });
    setIsServiceActive(false);
    setCurrentMachine(null);
    setActiveTab("ruta");
  };

  const handleReportIssue = () => {
    setIsReportDialogOpen(false);
    toast({
      title: "Reporte enviado",
      description: "El supervisor ha sido notificado del problema",
    });
  };

  const handleCashCollection = () => {
    setIsCashDialogOpen(false);
    toast({
      title: "Efectivo registrado",
      description: `Se registraron $${cashAmount} MXN`,
    });
    setCashAmount("");
  };

  const completedRoutes = mockRoutes.filter((r) => r.status === "completada").length;
  const totalRoutes = mockRoutes.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Panel de Abastecedor</h1>
          <p className="text-muted-foreground">
            Gestiona tu ruta y operaciones del día
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {completedRoutes}/{totalRoutes} completadas
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <Navigation className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRoutes}</p>
              <p className="text-sm text-muted-foreground">Paradas hoy</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">4.5h</p>
              <p className="text-sm text-muted-foreground">Tiempo estimado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">156</p>
              <p className="text-sm text-muted-foreground">Productos a cargar</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">19.5km</p>
              <p className="text-sm text-muted-foreground">Distancia total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ruta">Mi Ruta</TabsTrigger>
          <TabsTrigger value="servicio" disabled={!isServiceActive}>
            Servicio Activo
          </TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
        </TabsList>

        <TabsContent value="ruta" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="h-5 w-5" />
                    Ruta del Día
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mockRoutes.map((route) => (
                    <RouteCard
                      key={route.id}
                      {...route}
                      onStartService={() =>
                        handleStartService(route.id, route.machineName)
                      }
                      onViewDetails={() => console.log("View details:", route.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-base">Mapa de Ruta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square bg-accent rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Mapa de ruta optimizada</p>
                      <p className="text-xs">Integración con Google Maps</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="servicio" className="mt-6">
          {isServiceActive && currentMachine && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ServiceTimer
                  machineName={currentMachine}
                  onStart={() => console.log("Timer started")}
                  onPause={() => console.log("Timer paused")}
                  onStop={handleStopService}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Productos en Máquina</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {mockProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          {...product}
                          onClick={() => console.log("Product clicked:", product.id)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Acciones de Servicio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full justify-start gap-2" variant="outline">
                      <Package className="h-4 w-4" />
                      Registrar Productos
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => setIsCashDialogOpen(true)}
                    >
                      <DollarSign className="h-4 w-4" />
                      Recolectar Efectivo
                    </Button>
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => setIsReportDialogOpen(true)}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Reportar Problema
                    </Button>
                    <Button className="w-full justify-start gap-2" variant="outline">
                      <Camera className="h-4 w-4" />
                      Tomar Foto
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventario" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventario del Vehículo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    {...product}
                    onClick={() => console.log("Product clicked:", product.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar Problema</DialogTitle>
            <DialogDescription>
              Describe el problema encontrado en la máquina
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de problema</Label>
              <Input placeholder="Ej: Falla en dispensador" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Describe el problema con detalle..."
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Foto (opcional)</Label>
              <Button variant="outline" className="w-full gap-2">
                <Camera className="h-4 w-4" />
                Tomar Foto
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReportIssue}>Enviar Reporte</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCashDialogOpen} onOpenChange={setIsCashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recolección de Efectivo</DialogTitle>
            <DialogDescription>
              Registra el monto recolectado de la máquina
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monto recolectado (MXN)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCashDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCashCollection} disabled={!cashAmount}>
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
