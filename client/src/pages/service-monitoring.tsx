import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  Clock,
  Package,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  User,
  Navigation,
  Phone,
  RefreshCw,
  Eye,
  ChevronRight,
  Play,
  ClipboardCheck,
  PenTool,
  Timer,
  Calendar,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatTime, formatDate } from "@/lib/utils";

interface ActiveService {
  id: string;
  status: string;
  startTime: string;
  checklistData: string | null;
  machineId: string;
  userId: string;
  routeStopId: string | null;
  machineName: string | null;
  machineCode: string | null;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  routeId: string | null;
  routeDate: string | null;
  totalProductsLoaded: number;
  totalCashCollected: number;
  issuesReported: number;
  checklistProgress: number;
  duration: number;
}

interface ServiceFullStatus {
  id: string;
  status: string;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  checklistData: string | null;
  signature: string | null;
  responsibleName: string | null;
  machineId: string;
  userId: string;
  routeStopId: string | null;
  machineName: string | null;
  machineCode: string | null;
  userName: string | null;
  userEmail: string | null;
  loadedProducts: any[];
  cashCollected: any[];
  issues: any[];
  totalCashCollected: number;
  totalProductsLoaded: number;
  checklistItems: any[];
  checklistProgress: number;
  hasSignature: boolean;
  timeline: any[];
  duration: number;
}

export function ServiceMonitoringPage() {
  const [, navigate] = useLocation();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const { data: activeServicesData, isLoading, refetch, isRefetching } = useQuery<{
    activeCount: number;
    services: ActiveService[];
  }>({
    queryKey: ["/api/admin/active-services"],
    refetchInterval: 30000,
  });

  const { data: serviceDetail, isLoading: isLoadingDetail } = useQuery<ServiceFullStatus>({
    queryKey: ["/api/services", selectedServiceId, "full-status"],
    enabled: !!selectedServiceId && isDetailDialogOpen,
  });

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case "service_start":
        return <Play className="h-3 w-3 text-emerald-500" />;
      case "product_load":
        return <Package className="h-3 w-3 text-blue-500" />;
      case "cash_collection":
        return <DollarSign className="h-3 w-3 text-amber-500" />;
      case "issue_report":
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case "service_end":
        return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const openServiceDetail = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setIsDetailDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const activeServices = activeServicesData?.services || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Activity className="h-6 w-6 text-primary" />
            Monitoreo de Servicios Activos
          </h1>
          <p className="text-muted-foreground">
            Seguimiento en tiempo real de los servicios en progreso
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-2 py-2 px-4" data-testid="badge-active-count">
            <Activity className="h-4 w-4 text-emerald-500" />
            {activeServicesData?.activeCount || 0} servicios activos
          </Badge>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh"
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Actualizar
          </Button>
        </div>
      </div>

      {activeServices.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No hay servicios activos</h3>
            <p className="text-muted-foreground">
              Cuando los abastecedores inicien servicios en las máquinas, aparecerán aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeServices.map((service) => (
            <Card 
              key={service.id} 
              className="hover-elevate cursor-pointer transition-shadow"
              onClick={() => openServiceDetail(service.id)}
              data-testid={`card-service-${service.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-primary shrink-0" />
                      {service.machineName || "Máquina"}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <User className="h-3 w-3" />
                      {service.userName || "Abastecedor"}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-emerald-500 shrink-0">
                    <Timer className="h-3 w-3 mr-1" />
                    {formatDuration(service.duration)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Checklist</span>
                    <span className="font-medium">{service.checklistProgress}%</span>
                  </div>
                  <Progress value={service.checklistProgress} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Package className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                    <p className="text-sm font-bold">{service.totalProductsLoaded}</p>
                    <p className="text-[10px] text-muted-foreground">Productos</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <DollarSign className="h-4 w-4 mx-auto text-amber-500 mb-1" />
                    <p className="text-sm font-bold">{formatCurrency(service.totalCashCollected)}</p>
                    <p className="text-[10px] text-muted-foreground">Efectivo</p>
                  </div>
                  <div className={`p-2 rounded-lg ${service.issuesReported > 0 ? "bg-red-500/10" : "bg-muted/50"}`}>
                    <AlertTriangle className={`h-4 w-4 mx-auto mb-1 ${service.issuesReported > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                    <p className="text-sm font-bold">{service.issuesReported}</p>
                    <p className="text-[10px] text-muted-foreground">Incidencias</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Inicio: {service.startTime ? formatTime(service.startTime) : "--:--"}
                  </span>
                  <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-view-detail-${service.id}`}>
                    <Eye className="h-3 w-3" />
                    Ver detalle
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Detalle del Servicio
            </DialogTitle>
            <DialogDescription>
              Estado completo y cronología del servicio activo
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetail ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          ) : serviceDetail ? (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Máquina</p>
                    <p className="font-medium">{serviceDetail.machineName}</p>
                    <p className="text-xs text-muted-foreground">{serviceDetail.machineCode}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Abastecedor</p>
                    <p className="font-medium">{serviceDetail.userName}</p>
                    <p className="text-xs text-muted-foreground">{serviceDetail.userEmail}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                    <Timer className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                    <p className="text-lg font-bold">{formatDuration(serviceDetail.duration)}</p>
                    <p className="text-xs text-muted-foreground">Duración</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                    <Package className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-lg font-bold">{serviceDetail.totalProductsLoaded}</p>
                    <p className="text-xs text-muted-foreground">Productos</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                    <DollarSign className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                    <p className="text-lg font-bold">{formatCurrency(serviceDetail.totalCashCollected)}</p>
                    <p className="text-xs text-muted-foreground">Efectivo</p>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${serviceDetail.issues.length > 0 ? "bg-red-500/10" : "bg-muted/50"}`}>
                    <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${serviceDetail.issues.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                    <p className="text-lg font-bold">{serviceDetail.issues.length}</p>
                    <p className="text-xs text-muted-foreground">Incidencias</p>
                  </div>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Checklist ({serviceDetail.checklistProgress}%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={serviceDetail.checklistProgress} className="h-2 mb-3" />
                    <div className="grid grid-cols-2 gap-2">
                      {serviceDetail.checklistItems.map((item: any) => (
                        <div 
                          key={item.id} 
                          className={`flex items-center gap-2 text-sm p-2 rounded ${item.checked ? "bg-emerald-500/10" : "bg-muted/30"}`}
                        >
                          {item.checked ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 shrink-0" />
                          )}
                          <span className={item.checked ? "text-muted-foreground line-through" : ""}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Cronología de Eventos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {serviceDetail.timeline.map((event: any, index: number) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="mt-1 p-1.5 rounded-full bg-muted">
                            {getTimelineIcon(event.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{event.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(event.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {serviceDetail.loadedProducts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Productos Cargados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {serviceDetail.loadedProducts.map((product: any) => (
                          <div key={product.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                            <span className="text-sm">{product.productName}</span>
                            <Badge variant="secondary">+{product.quantity}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {serviceDetail.cashCollected.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Efectivo Recolectado
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {serviceDetail.cashCollected.map((cash: any) => (
                          <div key={cash.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10">
                            <span className="text-sm">{formatTime(cash.createdAt)}</span>
                            <span className="font-bold text-amber-600">{formatCurrency(parseFloat(cash.actualAmount || "0"))}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {serviceDetail.issues.length > 0 && (
                  <Card className="border-red-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-red-500">
                        <AlertTriangle className="h-4 w-4" />
                        Incidencias Reportadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {serviceDetail.issues.map((issue: any) => (
                          <div key={issue.id} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={issue.priority === "critica" || issue.priority === "alta" ? "destructive" : "secondary"}>
                                {issue.priority}
                              </Badge>
                              <Badge variant="outline">{issue.type}</Badge>
                            </div>
                            <p className="text-sm">{issue.description}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4" />
                    <span className="text-sm">Firma:</span>
                  </div>
                  {serviceDetail.hasSignature ? (
                    <Badge className="bg-emerald-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Firmado por {serviceDetail.responsibleName || "N/A"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pendiente</Badge>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
