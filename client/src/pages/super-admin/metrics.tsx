import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Building2, Package, Users, TrendingUp, Activity, DollarSign, Cpu } from "lucide-react";

interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalMachines: number;
  totalUsers: number;
  totalRevenue: string;
  tenantsWithDetails?: TenantDetail[];
}

interface TenantDetail {
  id: string;
  name: string;
  userCount: string;
  machineCount: string;
  plan?: string;
  subscription?: {
    status: string;
  };
}

export function SuperAdminMetricsPage() {
  const { data: metrics, isLoading } = useQuery<PlatformMetrics>({
    queryKey: ["/api/super-admin/metrics"],
  });

  const tenantsWithDetails = metrics?.tenantsWithDetails || [];

  const totalMachinesByTenants = tenantsWithDetails.reduce((sum, t) => sum + parseInt(t.machineCount || "0"), 0);
  const totalUsersByTenants = tenantsWithDetails.reduce((sum, t) => sum + parseInt(t.userCount || "0"), 0);

  return (
    <div className="p-6 space-y-6" data-testid="super-admin-metrics-page">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <BarChart3 className="h-8 w-8 text-primary" />
          Métricas de la Plataforma
        </h1>
        <p className="text-muted-foreground">Analíticas detalladas y KPIs de la plataforma SaaS</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Totales</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.totalTenants || 0}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-green-600">
                    {metrics?.activeTenants || 0} activas
                  </Badge>
                  <Badge variant="outline" className="text-gray-500">
                    {(metrics?.totalTenants || 0) - (metrics?.activeTenants || 0)} inactivas
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Máquinas Desplegadas</CardTitle>
            <Cpu className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.totalMachines || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Promedio: {metrics?.totalTenants ? ((metrics.totalMachines || 0) / metrics.totalTenants).toFixed(1) : 0} por empresa
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Registrados</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Promedio: {metrics?.totalTenants ? ((metrics.totalUsers || 0) / metrics.totalTenants).toFixed(1) : 0} por empresa
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  RD$ {parseFloat(metrics?.totalRevenue || "0").toLocaleString("es-DO")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ingresos acumulados
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Distribución por Empresa
            </CardTitle>
            <CardDescription>Usuarios y máquinas por cada empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : tenantsWithDetails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay empresas registradas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tenantsWithDetails.map((tenant) => {
                  const userCount = parseInt(tenant.userCount || "0");
                  const machineCount = parseInt(tenant.machineCount || "0");
                  const maxUsers = Math.max(...tenantsWithDetails.map(t => parseInt(t.userCount || "0")), 1);
                  const maxMachines = Math.max(...tenantsWithDetails.map(t => parseInt(t.machineCount || "0")), 1);
                  
                  return (
                    <div key={tenant.id} className="space-y-2 p-3 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{tenant.name}</span>
                        </div>
                        <Badge variant="outline">{tenant.plan || "Sin plan"}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Usuarios</span>
                            <span className="font-medium">{userCount}</span>
                          </div>
                          <Progress value={(userCount / maxUsers) * 100} className="h-2" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Máquinas</span>
                            <span className="font-medium">{machineCount}</span>
                          </div>
                          <Progress value={(machineCount / maxMachines) * 100} className="h-2" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resumen de Crecimiento
            </CardTitle>
            <CardDescription>Indicadores clave de la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tasa de Activación</span>
                  <span className="text-sm font-bold text-green-600">
                    {metrics?.totalTenants ? ((metrics.activeTenants / metrics.totalTenants) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <Progress 
                  value={metrics?.totalTenants ? (metrics.activeTenants / metrics.totalTenants) * 100 : 0} 
                  className="h-3"
                />
                <p className="text-xs text-muted-foreground">
                  {metrics?.activeTenants || 0} de {metrics?.totalTenants || 0} empresas activas
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Usuarios por Empresa</span>
                  <span className="text-sm font-bold">
                    {metrics?.totalTenants ? ((metrics.totalUsers || 0) / metrics.totalTenants).toFixed(1) : 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {metrics?.totalUsers || 0} usuarios totales
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Máquinas por Empresa</span>
                  <span className="text-sm font-bold">
                    {metrics?.totalTenants ? ((metrics.totalMachines || 0) / metrics.totalTenants).toFixed(1) : 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {metrics?.totalMachines || 0} máquinas desplegadas
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Ingreso Promedio por Empresa</span>
                  <span className="text-lg font-bold text-green-600">
                    RD$ {metrics?.totalTenants ? (parseFloat(metrics.totalRevenue || "0") / metrics.totalTenants).toLocaleString("es-DO", { maximumFractionDigits: 0 }) : 0}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
