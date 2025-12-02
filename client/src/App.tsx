import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
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
import { CalendarPage } from "@/pages/calendar";
import { ResetPasswordPage } from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import { useState, useEffect, useMemo, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
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
              <SidebarTrigger data-testid="button-sidebar-toggle" className="lg:hidden" />
              <SearchBar
                onSearch={handleSearch}
                results={searchResults}
                onResultClick={handleResultClick}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight" data-testid="text-current-time">
                  {format(currentTime, "HH:mm:ss")}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground capitalize hidden sm:block">
                  {format(currentTime, "EEEE, d MMMM", { locale: es })}
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
          <main className="flex-1 overflow-hidden">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/maquinas" component={MachinesPage} />
              <Route path="/maquinas/:id" component={MachineDetailPage} />
              <Route path="/tareas" component={TasksTodayPage} />
              <Route path="/todas-tareas" component={TasksPage} />
              <Route path="/calendario" component={CalendarPage} />
              <Route path="/abastecedor" component={SupplierPage} />
              <Route path="/almacen" component={WarehousePage} />
              <Route path="/dinero-productos" component={MoneyProductsPage} />
              <Route path="/caja-chica" component={PettyCashPage} />
              <Route path="/combustible" component={FuelPage} />
              <Route path="/contabilidad" component={AccountingPage} />
              <Route path="/compras" component={PurchasesPage} />
              <Route path="/rh" component={HRPage} />
              <Route path="/reportes" component={ReportsPage} />
              <Route path="/configuracion" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <AuthPage onSuccess={() => window.location.href = "/"} />;
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
