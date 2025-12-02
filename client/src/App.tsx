import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchBar } from "@/components/SearchBar";
import { NotificationBell } from "@/components/NotificationBell";
import { AuthPage } from "@/pages/auth";
import { DashboardPage } from "@/pages/dashboard";
import { MachinesPage } from "@/pages/machines";
import { SupplierPage } from "@/pages/supplier";
import { WarehousePage } from "@/pages/warehouse";
import { AccountingPage } from "@/pages/accounting";
import { HRPage } from "@/pages/hr";
import { SettingsPage } from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { useState } from "react";

// todo: remove mock functionality - replace with actual API data
const mockNotifications = [
  {
    id: "1",
    title: "Máquina sin stock",
    message: "Plaza Central se ha quedado sin Coca-Cola 600ml",
    time: "Hace 5 min",
    read: false,
    type: "warning" as const,
  },
  {
    id: "2",
    title: "Ruta completada",
    message: "Carlos completó la ruta Norte exitosamente",
    time: "Hace 1 hora",
    read: false,
    type: "success" as const,
  },
  {
    id: "3",
    title: "Nuevo empleado",
    message: "Se ha registrado un nuevo abastecedor",
    time: "Hace 3 horas",
    read: true,
    type: "info" as const,
  },
];

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const [notifications, setNotifications] = useState(mockNotifications);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    // todo: remove mock functionality - replace with actual API search
    setSearchResults([
      { id: "1", type: "machine", title: "Plaza Central", subtitle: "Centro Comercial Norte" },
      { id: "2", type: "product", title: "Coca-Cola 600ml", subtitle: "Bebidas carbonatadas" },
      { id: "3", type: "employee", title: "Carlos Rodríguez", subtitle: "Abastecedor" },
    ]);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

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
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <SearchBar
                onSearch={handleSearch}
                results={searchResults}
                onResultClick={(result) => console.log("Search result clicked:", result)}
              />
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
              />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/maquinas" component={MachinesPage} />
              <Route path="/tareas" component={DashboardPage} />
              <Route path="/abastecedor" component={SupplierPage} />
              <Route path="/almacen" component={WarehousePage} />
              <Route path="/combustible" component={SupplierPage} />
              <Route path="/contabilidad" component={AccountingPage} />
              <Route path="/finanzas" component={AccountingPage} />
              <Route path="/caja-chica" component={AccountingPage} />
              <Route path="/compras" component={WarehousePage} />
              <Route path="/rh" component={HRPage} />
              <Route path="/reportes" component={AccountingPage} />
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
