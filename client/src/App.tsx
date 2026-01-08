import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth, canAccessRoute, getRoleDefaultRoute, UserRole } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AppSidebar } from "@/components/AppSidebar";
import { SearchBar } from "@/components/SearchBar";
import { NotificationBell } from "@/components/NotificationBell";
import { AuthPage } from "@/pages/auth";
import { DashboardPage } from "@/pages/dashboard";
import { MachinesPage } from "@/pages/machines";
import { MachineDetailPage } from "@/pages/machine-detail";
import { SupplierPage } from "@/pages/supplier";
import { WarehousePage } from "@/pages/warehouse";
import { AccountingPage } from "@/pages/accounting";
import { HRPage } from "@/pages/hr";
import { SettingsPage } from "@/pages/settings";
import { MoneyProductsPage } from "@/pages/money-products";
import { PettyCashPage } from "@/pages/petty-cash";
import PurchasesPage from "@/pages/purchases";
import { FuelPage } from "@/pages/fuel";
import { ReportsPage } from "@/pages/reports";
import { TasksPage } from "@/pages/tasks";
import { TasksTodayPage } from "@/pages/tasks-today";
import { MyTasksPage } from "@/pages/my-tasks";
import { CalendarPage } from "@/pages/calendar";
import { ResetPasswordPage } from "@/pages/reset-password";
import { SupervisorPage } from "@/pages/supervisor";
import { SupervisorsPage } from "@/pages/supervisors";
import UsersPage from "@/pages/users";
import { AlmacenPanelPage } from "@/pages/almacen-panel";
import { ContabilidadPanelPage } from "@/pages/contabilidad-panel";
import { ProductsPage } from "@/pages/products";
import RoutesPage from "@/pages/routes";
import { SuppliersManagementPage } from "@/pages/suppliers-management";
import { ServiceMonitoringPage } from "@/pages/service-monitoring";
import NotFound from "@/pages/not-found";
import { useState, useEffect, useMemo, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { formatTimeWithSeconds, formatFullDateWithWeekday } from "@/lib/utils";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  path: string;
}

function ProtectedRoute({ component: Component, path }: ProtectedRouteProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  
  if (!user) return null;
  
  const userRole = user.role as UserRole;
  const hasAccess = canAccessRoute(userRole, path);
  
  if (!hasAccess) {
    const defaultRoute = getRoleDefaultRoute(userRole);
    return <Redirect to={defaultRoute} />;
  }
  
  return <Component />;
}

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set());

  const { data: alertsData = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts", { resolved: false }],
    refetchInterval: 30000,
  });

  const { data: searchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: searchQuery.length > 0,
  });

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("PATCH", `/api/alerts/${alertId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const notifications = useMemo(() => {
    return alertsData.slice(0, 10).map((alert: any) => {
      const priorityTypes: Record<string, "warning" | "success" | "info"> = {
        critica: "warning",
        alta: "warning",
        media: "info",
        baja: "success",
      };
      return {
        id: alert.id,
        title: alert.type?.replace(/_/g, " ") || "Alerta",
        message: alert.message,
        time: alert.createdAt 
          ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: es })
          : "Hace un momento",
        read: readAlerts.has(alert.id),
        type: priorityTypes[alert.priority] || "info",
      };
    });
  }, [alertsData, readAlerts]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleResultClick = useCallback((result: any) => {
    if (result.href) {
      navigate(result.href);
    }
  }, [navigate]);

  const markAsRead = useCallback((id: string) => {
    setReadAlerts(prev => new Set(prev).add(id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadAlerts(new Set(notifications.map(n => n.id)));
  }, [notifications]);

  // Redirigir a auth cuando no está autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-muted/30">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-6 py-4 bg-background sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <SearchBar
                onSearch={handleSearch}
                results={searchResults}
                onResultClick={handleResultClick}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight" data-testid="text-current-time">
                  {formatTimeWithSeconds(currentTime)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground capitalize hidden sm:block">
                  {formatFullDateWithWeekday(currentTime)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="relative" data-testid="button-messages">
                  <MessageCircle className="h-5 w-5" />
                </Button>
                <NotificationBell
                  notifications={notifications}
                  onMarkAsRead={markAsRead}
                  onMarkAllAsRead={markAllAsRead}
                />
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/">{() => <ProtectedRoute path="/" component={DashboardPage} />}</Route>
              <Route path="/supervisor">{() => <ProtectedRoute path="/supervisor" component={SupervisorPage} />}</Route>
              <Route path="/almacen-panel">{() => <ProtectedRoute path="/almacen-panel" component={AlmacenPanelPage} />}</Route>
              <Route path="/contabilidad-panel">{() => <ProtectedRoute path="/contabilidad-panel" component={ContabilidadPanelPage} />}</Route>
              <Route path="/maquinas">{() => <ProtectedRoute path="/maquinas" component={MachinesPage} />}</Route>
              <Route path="/maquinas/:id">{() => <ProtectedRoute path="/maquinas" component={MachineDetailPage} />}</Route>
              <Route path="/tareas">{() => <ProtectedRoute path="/tareas" component={TasksTodayPage} />}</Route>
              <Route path="/todas-tareas">{() => <ProtectedRoute path="/todas-tareas" component={TasksPage} />}</Route>
              <Route path="/mis-tareas">{() => <ProtectedRoute path="/mis-tareas" component={MyTasksPage} />}</Route>
              <Route path="/calendario">{() => <ProtectedRoute path="/calendario" component={CalendarPage} />}</Route>
              <Route path="/abastecedor">{() => <ProtectedRoute path="/abastecedor" component={SupplierPage} />}</Route>
              <Route path="/almacen">{() => <ProtectedRoute path="/almacen" component={WarehousePage} />}</Route>
              <Route path="/productos">{() => <ProtectedRoute path="/productos" component={ProductsPage} />}</Route>
              <Route path="/dinero-productos">{() => <ProtectedRoute path="/dinero-productos" component={MoneyProductsPage} />}</Route>
              <Route path="/caja-chica">{() => <ProtectedRoute path="/caja-chica" component={PettyCashPage} />}</Route>
              <Route path="/combustible">{() => <ProtectedRoute path="/combustible" component={FuelPage} />}</Route>
              <Route path="/contabilidad">{() => <ProtectedRoute path="/contabilidad" component={AccountingPage} />}</Route>
              <Route path="/compras">{() => <ProtectedRoute path="/compras" component={PurchasesPage} />}</Route>
              <Route path="/rh">{() => <ProtectedRoute path="/rh" component={HRPage} />}</Route>
              <Route path="/reportes">{() => <ProtectedRoute path="/reportes" component={ReportsPage} />}</Route>
              <Route path="/supervisores">{() => <ProtectedRoute path="/supervisores" component={SupervisorsPage} />}</Route>
              <Route path="/monitoreo-servicios">{() => <ProtectedRoute path="/monitoreo-servicios" component={ServiceMonitoringPage} />}</Route>
              <Route path="/usuarios">{() => <ProtectedRoute path="/usuarios" component={UsersPage} />}</Route>
              <Route path="/rutas">{() => <ProtectedRoute path="/rutas" component={RoutesPage} />}</Route>
              <Route path="/abastecedores">{() => <ProtectedRoute path="/abastecedores" component={SuppliersManagementPage} />}</Route>
              <Route path="/configuracion">{() => <ProtectedRoute path="/configuracion" component={SettingsPage} />}</Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    const defaultRoute = getRoleDefaultRoute(user.role as UserRole);
    return <Redirect to={defaultRoute} />;
  }

  return <AuthPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthRoute} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route>
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
