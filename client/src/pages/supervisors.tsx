import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateShort } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { DataPagination } from "@/components/DataPagination";
import {
  Users, Search, MapPin, Box, AlertTriangle, CheckCircle2, 
  TrendingUp, Eye, Edit, UserCheck, XCircle, Clock, Truck,
  ChevronRight, BarChart3, Activity
} from "lucide-react";

interface SupervisorMetrics {
  machinesCount: number;
  operativeMachines: number;
  operativityRate: number;
  abastecedoresCount: number;
  routesCount: number;
  pendingAlerts: number;
  criticalAlerts: number;
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
}

interface Supervisor {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  assignedZone: string | null;
  isActive: boolean;
  createdAt: string;
  metrics: SupervisorMetrics;
}

interface SupervisorDetail extends Supervisor {
  zone: string | null;
  machines: { id: string; name: string; code: string | null; status: string }[];
  abastecedores: { id: string; fullName: string | null; isActive: boolean }[];
  recentRoutes: { id: string; date: string; status: string; totalStops: number; completedStops: number }[];
  alerts: any[];
  tasks: any[];
}

const ZONES = [
  "Zona Norte",
  "Zona Sur", 
  "Zona Centro",
  "Zona Oriente",
  "Zona Poniente"
];

const ITEMS_PER_PAGE = 10;

export function SupervisorsPage() {
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSupervisor, setSelectedSupervisor] = useState<Supervisor | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignZoneOpen, setAssignZoneOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>("");

  const { data: supervisors = [], isLoading } = useQuery<Supervisor[]>({
    queryKey: ["/api/supervisors"],
  });

  const { data: supervisorDetail, isLoading: isLoadingDetail } = useQuery<SupervisorDetail>({
    queryKey: ["/api/supervisors", selectedSupervisor?.id],
    enabled: !!selectedSupervisor && detailOpen,
  });

  const assignZoneMutation = useMutation({
    mutationFn: async ({ id, zone }: { id: string; zone: string | null }) => {
      return apiRequest("PATCH", `/api/supervisors/${id}/zone`, { zone });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervisors"] });
      toast({
        title: variables.zone ? "Zona asignada" : "Zona desasignada",
        description: variables.zone
          ? "La zona se asignó correctamente al supervisor"
          : "Se eliminó la zona del supervisor correctamente",
      });
      setAssignZoneOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la zona",
        variant: "destructive",
      });
    },
  });

  const filteredSupervisors = useMemo(() => {
    return supervisors.filter((sup) => {
      const matchesSearch =
        sup.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sup.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sup.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesZone = zoneFilter === "all" || sup.assignedZone === zoneFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && sup.isActive) ||
        (statusFilter === "inactive" && !sup.isActive);
      return matchesSearch && matchesZone && matchesStatus;
    });
  }, [supervisors, searchQuery, zoneFilter, statusFilter]);

  const paginatedSupervisors = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSupervisors.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSupervisors, currentPage]);

  useEffect(() => {
    const totalPages = Math.ceil(filteredSupervisors.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredSupervisors.length, currentPage]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleZoneFilterChange = (value: string) => {
    setZoneFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleOpenDetail = (supervisor: Supervisor) => {
    setSelectedSupervisor(supervisor);
    setDetailOpen(true);
  };

  const handleOpenAssignZone = (supervisor: Supervisor) => {
    setSelectedSupervisor(supervisor);
    setSelectedZone(supervisor.assignedZone || "");
    setAssignZoneOpen(true);
  };

  const handleAssignZone = () => {
    if (selectedSupervisor) {
      const zone = selectedZone === "__none__" ? null : selectedZone || null;
      assignZoneMutation.mutate({ id: selectedSupervisor.id, zone });
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operando": return "bg-green-500";
      case "necesita_servicio": return "bg-yellow-500";
      case "fuera_de_linea": return "bg-red-500";
      case "vacia": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const stats = useMemo(() => {
    const total = supervisors.length;
    const active = supervisors.filter(s => s.isActive).length;
    const withZone = supervisors.filter(s => s.assignedZone).length;
    const avgOperativity = supervisors.length > 0
      ? Math.round(supervisors.reduce((acc, s) => acc + s.metrics.operativityRate, 0) / supervisors.length)
      : 0;
    return { total, active, withZone, avgOperativity };
  }, [supervisors]);

  const rankedSupervisors = useMemo(() => {
    return [...supervisors]
      .filter(s => s.isActive)
      .sort((a, b) => {
        const scoreA = a.metrics.operativityRate * 0.4 + a.metrics.completionRate * 0.3 + 
          (100 - Math.min(a.metrics.pendingAlerts * 10, 100)) * 0.3;
        const scoreB = b.metrics.operativityRate * 0.4 + b.metrics.completionRate * 0.3 + 
          (100 - Math.min(b.metrics.pendingAlerts * 10, 100)) * 0.3;
        return scoreB - scoreA;
      })
      .map((sup, index) => ({
        ...sup,
        rank: index + 1,
        score: Math.round(
          sup.metrics.operativityRate * 0.4 + 
          sup.metrics.completionRate * 0.3 + 
          (100 - Math.min(sup.metrics.pendingAlerts * 10, 100)) * 0.3
        )
      }));
  }, [supervisors]);

  const [viewMode, setViewMode] = useState<"list" | "compare">("list");

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Gestión de Supervisores</h1>
          <p className="text-muted-foreground">
            Administra y monitorea el rendimiento de tus supervisores
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-supervisors">
                  {stats.total}
                </p>
                <p className="text-sm text-muted-foreground">Total Supervisores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-supervisors">
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
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MapPin className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-with-zone">
                  {stats.withZone}
                </p>
                <p className="text-sm text-muted-foreground">Con Zona Asignada</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <BarChart3 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-avg-operativity">
                  {stats.avgOperativity}%
                </p>
                <p className="text-sm text-muted-foreground">Operatividad Promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "compare")} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-list">Lista de Supervisores</TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare">Comparativa</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, usuario o email..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
                data-testid="input-search-supervisors"
              />
            </div>
            <Select value={zoneFilter} onValueChange={handleZoneFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-zone-filter">
                <SelectValue placeholder="Zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las zonas</SelectItem>
                {ZONES.map(zone => (
                  <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead className="text-center">Máquinas</TableHead>
                  <TableHead className="text-center">Operatividad</TableHead>
                  <TableHead className="text-center">Abastecedores</TableHead>
                  <TableHead className="text-center">Alertas</TableHead>
                  <TableHead className="text-center">Tareas</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSupervisors.map((supervisor) => (
                  <TableRow key={supervisor.id} data-testid={`row-supervisor-${supervisor.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(supervisor.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{supervisor.fullName || supervisor.username}</p>
                          <p className="text-sm text-muted-foreground">{supervisor.email || "-"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {supervisor.assignedZone ? (
                        <Badge variant="outline" className="gap-1">
                          <MapPin className="h-3 w-3" />
                          {supervisor.assignedZone}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span>{supervisor.metrics.machinesCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress 
                          value={supervisor.metrics.operativityRate} 
                          className="w-16 h-2"
                        />
                        <span className="text-sm font-medium w-10">
                          {supervisor.metrics.operativityRate}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span>{supervisor.metrics.abastecedoresCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {supervisor.metrics.criticalAlerts > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {supervisor.metrics.pendingAlerts}
                        </Badge>
                      ) : supervisor.metrics.pendingAlerts > 0 ? (
                        <Badge variant="secondary" className="gap-1">
                          {supervisor.metrics.pendingAlerts}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm">
                        {supervisor.metrics.tasksCompleted}/{supervisor.metrics.tasksTotal}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {supervisor.isActive ? (
                        <Badge className="bg-green-500/10 text-green-600 no-default-hover-elevate">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDetail(supervisor)}
                          data-testid={`button-view-${supervisor.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit("users") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenAssignZone(supervisor)}
                            data-testid={`button-assign-zone-${supervisor.id}`}
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSupervisors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No hay supervisores que mostrar</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {filteredSupervisors.length > ITEMS_PER_PAGE && (
            <DataPagination
              currentPage={currentPage}
              totalItems={filteredSupervisors.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Ranking de Supervisores
              </CardTitle>
              <CardDescription>
                Puntuación basada en: Operatividad (40%), Tareas completadas (30%), Alertas resueltas (30%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rankedSupervisors.map((supervisor) => (
                  <div 
                    key={supervisor.id}
                    className="flex items-center gap-4 p-3 rounded-lg border hover-elevate"
                    data-testid={`ranking-supervisor-${supervisor.id}`}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
                      supervisor.rank === 1 ? "bg-yellow-500 text-white" :
                      supervisor.rank === 2 ? "bg-gray-300 text-gray-800" :
                      supervisor.rank === 3 ? "bg-orange-400 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {supervisor.rank}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(supervisor.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{supervisor.fullName || supervisor.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {supervisor.assignedZone || "Sin zona"}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-lg font-bold text-blue-600">{supervisor.metrics.operativityRate}%</p>
                        <p className="text-xs text-muted-foreground">Operatividad</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{supervisor.metrics.completionRate}%</p>
                        <p className="text-xs text-muted-foreground">Tareas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-600">{supervisor.metrics.pendingAlerts}</p>
                        <p className="text-xs text-muted-foreground">Alertas</p>
                      </div>
                    </div>
                    <div className="w-20 text-center">
                      <div className={`text-2xl font-bold ${
                        supervisor.score >= 80 ? "text-green-600" :
                        supervisor.score >= 60 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {supervisor.score}
                      </div>
                      <p className="text-xs text-muted-foreground">Puntuación</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDetail(supervisor)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {rankedSupervisors.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay supervisores activos para comparar</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(selectedSupervisor?.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p>{selectedSupervisor?.fullName || selectedSupervisor?.username}</p>
                <p className="text-sm font-normal text-muted-foreground">
                  {selectedSupervisor?.assignedZone || "Sin zona asignada"}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {isLoadingDetail ? (
            <div className="space-y-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-48" />
            </div>
          ) : supervisorDetail ? (
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Resumen</TabsTrigger>
                <TabsTrigger value="machines">Máquinas</TabsTrigger>
                <TabsTrigger value="team">Equipo</TabsTrigger>
                <TabsTrigger value="alerts">Alertas</TabsTrigger>
                <TabsTrigger value="tasks">Tareas</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {supervisorDetail.metrics.machinesCount}
                      </p>
                      <p className="text-sm text-muted-foreground">Máquinas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {supervisorDetail.metrics.operativityRate}%
                      </p>
                      <p className="text-sm text-muted-foreground">Operatividad</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {supervisorDetail.metrics.abastecedoresCount}
                      </p>
                      <p className="text-sm text-muted-foreground">Abastecedores</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {supervisorDetail.metrics.pendingAlerts}
                      </p>
                      <p className="text-sm text-muted-foreground">Alertas Pendientes</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Información de Contacto</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span>{supervisorDetail.email || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Teléfono:</span>
                      <span>{supervisorDetail.phone || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Usuario:</span>
                      <span>{supervisorDetail.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha de registro:</span>
                      <span>{formatDateShort(new Date(supervisorDetail.createdAt))}</span>
                    </div>
                  </CardContent>
                </Card>

                {supervisorDetail.recentRoutes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Rutas Recientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {supervisorDetail.recentRoutes.slice(0, 5).map((route) => (
                          <div key={route.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {formatDateShort(new Date(route.date))}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {route.completedStops}/{route.totalStops} paradas
                              </span>
                              <Badge variant={route.status === "completada" ? "default" : "secondary"}>
                                {route.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="machines" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    {supervisorDetail.machines.length === 0 ? (
                      <div className="text-center py-8">
                        <Box className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No hay máquinas asignadas a esta zona</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {supervisorDetail.machines.map((machine) => (
                          <div 
                            key={machine.id} 
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover-elevate"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${getStatusColor(machine.status)}`} />
                              <div>
                                <p className="font-medium">{machine.name}</p>
                                <p className="text-sm text-muted-foreground">{machine.code || "-"}</p>
                              </div>
                            </div>
                            <Badge variant="outline">{machine.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    {supervisorDetail.abastecedores.length === 0 ? (
                      <div className="text-center py-8">
                        <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No hay abastecedores asignados a esta zona</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {supervisorDetail.abastecedores.map((abastecedor) => (
                          <div 
                            key={abastecedor.id} 
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover-elevate"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials(abastecedor.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <p className="font-medium">{abastecedor.fullName || "Sin nombre"}</p>
                            </div>
                            {abastecedor.isActive ? (
                              <Badge className="bg-green-500/10 text-green-600 no-default-hover-elevate">Activo</Badge>
                            ) : (
                              <Badge variant="secondary">Inactivo</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="alerts" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    {supervisorDetail.alerts.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                        <p className="text-muted-foreground">No hay alertas pendientes</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {supervisorDetail.alerts.map((alert: any) => (
                          <div 
                            key={alert.id} 
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover-elevate"
                          >
                            <div className="flex items-center gap-3">
                              <AlertTriangle className={`h-4 w-4 ${
                                alert.priority === "critica" ? "text-red-500" : "text-yellow-500"
                              }`} />
                              <div>
                                <p className="font-medium text-sm">{alert.type}</p>
                                <p className="text-xs text-muted-foreground">{alert.message}</p>
                              </div>
                            </div>
                            <Badge variant={alert.priority === "critica" ? "destructive" : "secondary"}>
                              {alert.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    {supervisorDetail.tasks.length === 0 ? (
                      <div className="text-center py-8">
                        <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No hay tareas asignadas</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {supervisorDetail.tasks.map((task: any) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover-elevate"
                            data-testid={`task-item-${task.id}`}
                          >
                            <div className="flex items-center gap-3">
                              {task.status === "completada" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : task.status === "en_progreso" ? (
                                <Clock className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div>
                                <p className="font-medium text-sm">{task.title}</p>
                                {task.dueDate && (
                                  <p className="text-xs text-muted-foreground">
                                    Vence: {formatDateShort(new Date(task.dueDate))}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge variant={
                              task.status === "completada" ? "default" :
                              task.status === "en_progreso" ? "secondary" : "outline"
                            }>
                              {task.status === "completada" ? "Completada" :
                               task.status === "en_progreso" ? "En progreso" : "Pendiente"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={assignZoneOpen} onOpenChange={setAssignZoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Zona</DialogTitle>
            <DialogDescription>
              Asigna una zona de operación a {selectedSupervisor?.fullName || selectedSupervisor?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger data-testid="select-assign-zone">
                <SelectValue placeholder="Selecciona una zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin zona (Desasignar)</SelectItem>
                {ZONES.map(zone => (
                  <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignZoneOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAssignZone}
              disabled={!selectedZone || assignZoneMutation.isPending}
              data-testid="button-confirm-assign-zone"
            >
              {assignZoneMutation.isPending ? "Guardando..." : selectedZone === "__none__" ? "Desasignar Zona" : "Asignar Zona"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SupervisorsPage;
