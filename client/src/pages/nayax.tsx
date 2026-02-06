import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Wifi,
  WifiOff,
  Link2,
  Unlink,
  Settings,
  RefreshCw,
  CreditCard,
  Monitor,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  DollarSign,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface NayaxMachine {
  MachineID: number;
  MachineName: string;
  MachineNumber: string;
  MachineStatusBit: number;
  SerialNumber: string;
  DeviceSerialNumber: string;
  GeoCity: string;
  GeoAddress: string;
  GeoLatitude: number;
  GeoLongitude: number;
  LastUpdated: string;
}

interface NayaxSale {
  TransactionID: number;
  MachineName: string;
  MachineNumber: string;
  AuthorizationValue: number;
  SettlementValue: number;
  CurrencyCode: string;
  PaymentMethod: string;
  CardBrand: string;
  ProductName: string;
  Quantity: number;
  AuthorizationDateTimeGMT: string;
}

interface DispensaxMachine {
  id: string;
  name: string;
  code: string | null;
  status: string;
  zone: string | null;
  nayaxMachineId: number | null;
  nayaxDeviceSerial: string | null;
  nayaxLinkedAt: string | null;
}

interface NayaxConfigResponse {
  configured: boolean;
  isEnabled: boolean;
  hasToken?: boolean;
  syncIntervalMinutes?: number;
  autoSyncSales?: boolean;
  autoSyncMachines?: boolean;
  lastSyncAt?: string;
}

export function NayaxPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [apiToken, setApiToken] = useState("");
  const [selectedNayaxMachine, setSelectedNayaxMachine] = useState<number | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedDispensaxMachine, setSelectedDispensaxMachine] = useState<string>("");
  const [selectedNayaxForLink, setSelectedNayaxForLink] = useState<NayaxMachine | null>(null);

  const { data: config, isLoading: configLoading } = useQuery<NayaxConfigResponse>({
    queryKey: ["/api/nayax/config"],
  });

  const { data: nayaxMachines = [], isLoading: machinesLoading, refetch: refetchMachines } = useQuery<NayaxMachine[]>({
    queryKey: ["/api/nayax/machines"],
    enabled: config?.configured && config?.isEnabled && config?.hasToken === true,
  });

  const { data: linkedMachines = [] } = useQuery<DispensaxMachine[]>({
    queryKey: ["/api/nayax/linked-machines"],
    enabled: config?.configured === true,
  });

  const { data: allDispensaxMachines = [] } = useQuery<DispensaxMachine[]>({
    queryKey: ["/api/machines"],
  });

  const { data: salesData = [], isLoading: salesLoading } = useQuery<NayaxSale[]>({
    queryKey: [`/api/nayax/machines/${selectedNayaxMachine}/sales`],
    enabled: !!selectedNayaxMachine,
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/nayax/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nayax/config"] });
      toast({ title: "Configuración guardada", description: "La configuración de Nayax ha sido actualizada" });
      setShowConfigDialog(false);
      setApiToken("");
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (token?: string) => {
      const res = await apiRequest("POST", "/api/nayax/test-connection", token ? { apiToken: token } : {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Conexión exitosa", description: `Se encontraron ${data.machineCount || 0} máquinas en Nayax` });
      } else {
        toast({ title: "Error de conexión", description: data.error || "No se pudo conectar", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo probar la conexión", variant: "destructive" });
    },
  });

  const linkMachineMutation = useMutation({
    mutationFn: async (data: { dispensaxMachineId: string; nayaxMachineId: number; nayaxDeviceSerial?: string }) => {
      await apiRequest("POST", "/api/nayax/link-machine", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nayax/linked-machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      toast({ title: "Vinculación exitosa", description: "Máquina vinculada con Nayax" });
      setLinkDialogOpen(false);
      setSelectedDispensaxMachine("");
      setSelectedNayaxForLink(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo vincular la máquina", variant: "destructive" });
    },
  });

  const unlinkMachineMutation = useMutation({
    mutationFn: async (dispensaxMachineId: string) => {
      await apiRequest("POST", "/api/nayax/unlink-machine", { dispensaxMachineId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nayax/linked-machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      toast({ title: "Desvinculación exitosa", description: "Máquina desvinculada de Nayax" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo desvincular la máquina", variant: "destructive" });
    },
  });

  const unlinkedDispensaxMachines = allDispensaxMachines.filter(
    (m: any) => !m.nayaxMachineId
  );

  const linkedNayaxIds = new Set(linkedMachines.map(m => m.nayaxMachineId));

  const isConfigured = config?.configured && config?.hasToken && config?.isEnabled;

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-nayax-title">Integración Nayax</h1>
          <p className="text-muted-foreground text-sm">
            Conecta tus dispositivos de pago Nayax para sincronizar ventas cashless y monitorear el estado de los terminales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <Badge variant="default" className="bg-emerald-600 text-white" data-testid="badge-nayax-status">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="secondary" data-testid="badge-nayax-status">
              <XCircle className="w-3 h-3 mr-1" />
              No configurado
            </Badge>
          )}
          <Button variant="outline" onClick={() => setShowConfigDialog(true)} data-testid="button-nayax-config">
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      {!isConfigured ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-muted p-4">
              <CreditCard className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Configura tu integración Nayax</h3>
            <p className="text-muted-foreground text-center max-w-md text-sm">
              Conecta tu cuenta de Nayax para sincronizar automáticamente las ventas con tarjeta/cashless, 
              monitorear el estado de los terminales de pago y ver las transacciones en tiempo real.
            </p>
            <Button onClick={() => setShowConfigDialog(true)} data-testid="button-setup-nayax">
              <Zap className="w-4 h-4 mr-2" />
              Configurar Nayax
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-blue-500/10 p-2">
                    <Monitor className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Máquinas Nayax</p>
                    <p className="text-2xl font-bold" data-testid="text-nayax-machine-count">
                      {Array.isArray(nayaxMachines) ? nayaxMachines.length : 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-emerald-500/10 p-2">
                    <Link2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vinculadas</p>
                    <p className="text-2xl font-bold" data-testid="text-linked-count">{linkedMachines.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-amber-500/10 p-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sin Vincular</p>
                    <p className="text-2xl font-bold" data-testid="text-unlinked-count">
                      {Array.isArray(nayaxMachines) ? nayaxMachines.filter(nm => !linkedNayaxIds.has(nm.MachineID)).length : 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-purple-500/10 p-2">
                    <DollarSign className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas Cashless</p>
                    <p className="text-2xl font-bold" data-testid="text-sales-count">
                      {salesData.length > 0 ? salesData.length : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList data-testid="tabs-nayax">
              <TabsTrigger value="overview" data-testid="tab-overview">Máquinas Nayax</TabsTrigger>
              <TabsTrigger value="linked" data-testid="tab-linked">Vinculaciones</TabsTrigger>
              <TabsTrigger value="sales" data-testid="tab-sales">Ventas Cashless</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h3 className="text-lg font-semibold">Máquinas en Nayax</h3>
                <Button variant="outline" onClick={() => refetchMachines()} disabled={machinesLoading} data-testid="button-refresh-machines">
                  <RefreshCw className={`w-4 h-4 mr-2 ${machinesLoading ? "animate-spin" : ""}`} />
                  Actualizar
                </Button>
              </div>

              {machinesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !Array.isArray(nayaxMachines) || nayaxMachines.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
                    <Monitor className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">No se encontraron máquinas en Nayax</p>
                    <p className="text-muted-foreground text-xs">Verifica tu token de API o que tengas máquinas registradas en Nayax Core</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Serial</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Vinculada</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nayaxMachines.map((machine) => {
                        const isLinked = linkedNayaxIds.has(machine.MachineID);
                        return (
                          <TableRow key={machine.MachineID} data-testid={`row-nayax-machine-${machine.MachineID}`}>
                            <TableCell className="font-mono text-xs">{machine.MachineID}</TableCell>
                            <TableCell className="font-medium">{machine.MachineName}</TableCell>
                            <TableCell>{machine.MachineNumber}</TableCell>
                            <TableCell className="font-mono text-xs">{machine.DeviceSerialNumber || "—"}</TableCell>
                            <TableCell className="text-sm">
                              {machine.GeoCity || machine.GeoAddress || "—"}
                            </TableCell>
                            <TableCell>
                              {machine.MachineStatusBit === 1 ? (
                                <Badge variant="default" className="bg-emerald-600 text-white">
                                  <Wifi className="w-3 h-3 mr-1" />
                                  Activa
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <WifiOff className="w-3 h-3 mr-1" />
                                  Inactiva
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isLinked ? (
                                <Badge variant="default" className="bg-emerald-600 text-white">
                                  <Link2 className="w-3 h-3 mr-1" />
                                  Vinculada
                                </Badge>
                              ) : (
                                <Badge variant="outline">Sin vincular</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {!isLinked && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedNayaxForLink(machine);
                                      setLinkDialogOpen(true);
                                    }}
                                    data-testid={`button-link-${machine.MachineID}`}
                                  >
                                    <Link2 className="w-3 h-3 mr-1" />
                                    Vincular
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedNayaxMachine(machine.MachineID);
                                    setActiveTab("sales");
                                  }}
                                  data-testid={`button-view-sales-${machine.MachineID}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="linked" className="space-y-4">
              <h3 className="text-lg font-semibold">Máquinas Vinculadas (Dispensax ↔ Nayax)</h3>
              {linkedMachines.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
                    <Link2 className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">No hay máquinas vinculadas</p>
                    <p className="text-muted-foreground text-xs">Ve a la pestaña "Máquinas Nayax" para vincular tus máquinas</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Máquina Dispensax</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Nayax Machine ID</TableHead>
                        <TableHead>Device Serial</TableHead>
                        <TableHead>Vinculada Desde</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedMachines.map((machine) => (
                        <TableRow key={machine.id} data-testid={`row-linked-${machine.id}`}>
                          <TableCell className="font-medium">{machine.name}</TableCell>
                          <TableCell>{machine.code || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={machine.status === "operando" ? "default" : "secondary"}>
                              {machine.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{machine.nayaxMachineId}</TableCell>
                          <TableCell className="font-mono text-xs">{machine.nayaxDeviceSerial || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {machine.nayaxLinkedAt ? new Date(machine.nayaxLinkedAt).toLocaleDateString("es-DO") : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (machine.nayaxMachineId) {
                                    setSelectedNayaxMachine(machine.nayaxMachineId);
                                    setActiveTab("sales");
                                  }
                                }}
                                data-testid={`button-view-linked-sales-${machine.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("¿Desvincular esta máquina de Nayax?")) {
                                    unlinkMachineMutation.mutate(machine.id);
                                  }
                                }}
                                data-testid={`button-unlink-${machine.id}`}
                              >
                                <Unlink className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sales" className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h3 className="text-lg font-semibold">Ventas Cashless</h3>
                {selectedNayaxMachine && (
                  <Badge variant="outline">
                    Máquina Nayax ID: {selectedNayaxMachine}
                  </Badge>
                )}
              </div>

              {!selectedNayaxMachine ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">Selecciona una máquina para ver sus ventas cashless</p>
                    <p className="text-muted-foreground text-xs">
                      Usa el botón de "ojo" en las tablas de máquinas para ver las ventas
                    </p>
                  </CardContent>
                </Card>
              ) : salesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : salesData.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">No se encontraron ventas recientes para esta máquina</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Transacción</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Método Pago</TableHead>
                        <TableHead>Tarjeta</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesData.map((sale) => (
                        <TableRow key={sale.TransactionID} data-testid={`row-sale-${sale.TransactionID}`}>
                          <TableCell className="font-mono text-xs">{sale.TransactionID}</TableCell>
                          <TableCell className="text-sm">
                            {new Date(sale.AuthorizationDateTimeGMT).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" })}
                          </TableCell>
                          <TableCell className="font-medium">{sale.ProductName || "—"}</TableCell>
                          <TableCell>{sale.Quantity || 1}</TableCell>
                          <TableCell>{sale.PaymentMethod || "—"}</TableCell>
                          <TableCell>{sale.CardBrand || "—"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {sale.CurrencyCode === "DOP" ? "RD$" : sale.CurrencyCode || ""} {sale.SettlementValue?.toFixed(2) || sale.AuthorizationValue?.toFixed(2) || "0.00"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configuración de Nayax</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nayax-token">Token de API (Bearer Token)</Label>
              <Input
                id="nayax-token"
                type="password"
                placeholder="Pega tu token de Nayax Core aquí..."
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                data-testid="input-nayax-token"
              />
              <p className="text-xs text-muted-foreground">
                Obtén tu token en Nayax Core → Account Settings → Security and Login → User Tokens
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Habilitar integración</Label>
                <p className="text-xs text-muted-foreground">Activa la sincronización con Nayax</p>
              </div>
              <Switch
                checked={config?.isEnabled || false}
                onCheckedChange={(checked) => {
                  saveConfigMutation.mutate({
                    isEnabled: checked,
                    ...(apiToken ? { apiToken } : {}),
                  });
                }}
                data-testid="switch-nayax-enabled"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => testConnectionMutation.mutate(apiToken || undefined)}
                disabled={testConnectionMutation.isPending}
                data-testid="button-test-connection"
              >
                {testConnectionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4 mr-2" />
                )}
                Probar Conexión
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  saveConfigMutation.mutate({
                    apiToken: apiToken || undefined,
                    isEnabled: true,
                  });
                }}
                disabled={saveConfigMutation.isPending || !apiToken}
                data-testid="button-save-config"
              >
                {saveConfigMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular Máquina</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedNayaxForLink && (
              <div className="p-3 rounded-md bg-muted space-y-1">
                <p className="text-sm font-medium">Máquina Nayax</p>
                <p className="text-sm">{selectedNayaxForLink.MachineName} ({selectedNayaxForLink.MachineNumber})</p>
                <p className="text-xs text-muted-foreground font-mono">ID: {selectedNayaxForLink.MachineID}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Seleccionar Máquina Dispensax</Label>
              <Select value={selectedDispensaxMachine} onValueChange={setSelectedDispensaxMachine}>
                <SelectTrigger data-testid="select-dispensax-machine">
                  <SelectValue placeholder="Elige una máquina..." />
                </SelectTrigger>
                <SelectContent>
                  {unlinkedDispensaxMachines.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.code ? `(${m.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {unlinkedDispensaxMachines.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todas las máquinas ya están vinculadas. Crea una nueva máquina en Dispensax primero.
                </p>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!selectedDispensaxMachine || linkMachineMutation.isPending}
              onClick={() => {
                if (selectedNayaxForLink && selectedDispensaxMachine) {
                  linkMachineMutation.mutate({
                    dispensaxMachineId: selectedDispensaxMachine,
                    nayaxMachineId: selectedNayaxForLink.MachineID,
                    nayaxDeviceSerial: selectedNayaxForLink.DeviceSerialNumber,
                  });
                }
              }}
              data-testid="button-confirm-link"
            >
              {linkMachineMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Vincular Máquinas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
