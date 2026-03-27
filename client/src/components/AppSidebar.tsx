import { Link, useLocation } from "wouter";
import { cn, getCurrentHour } from "@/lib/utils";
import { useAuth, UserRole, getRoleDisplayName } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import dispensaxLogo from "@assets/LOGO-DISPENSAX_1764711476889.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Box,
  ClipboardList,
  ListTodo,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  LogOut,
  Truck,
  Package,
  Fuel,
  Calculator,
  Wallet,
  ShoppingCart,
  Users,
  FileText,
  ArrowDownUp,
  Eye,
  Navigation,
  Wrench,
  TrendingUp,
  Tag,
  UserCog,
  Activity,
  Shield,
  Building2,
  CreditCard,
} from "lucide-react";

interface MenuItem {
  icon: any;
  label: string;
  href: string;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", roles: ["admin"] },
  { icon: Eye, label: "Panel Supervisor", href: "/supervisor", roles: ["supervisor"] },
  { icon: Package, label: "Panel Almacén", href: "/almacen-panel", roles: ["admin", "almacen"] },
  { icon: Calculator, label: "Panel Contabilidad", href: "/contabilidad-panel", roles: ["admin", "contabilidad"] },
  { icon: Box, label: "Máquinas", href: "/maquinas", roles: ["admin", "supervisor"] },
  { icon: ClipboardList, label: "Tareas Hoy", href: "/tareas", roles: ["admin", "supervisor", "almacen", "contabilidad", "rh", "abastecedor"] },
  { icon: ListTodo, label: "Todas las Tareas", href: "/todas-tareas", roles: ["admin", "supervisor"] },
  { icon: ListTodo, label: "Mis Tareas", href: "/mis-tareas", roles: ["rh"] },
  { icon: Calendar, label: "Calendario", href: "/calendario", roles: ["admin", "supervisor", "almacen", "contabilidad", "rh", "abastecedor"] },
];

const operacionItems: MenuItem[] = [
  { icon: Package, label: "Almacén", href: "/almacen", roles: ["admin", "supervisor", "almacen"] },
  { icon: Tag, label: "Productos", href: "/productos", roles: ["admin", "supervisor", "almacen"] },
  { icon: Navigation, label: "Gestión Rutas", href: "/rutas", roles: ["admin", "supervisor"] },
  { icon: Truck, label: "Abastecedores", href: "/abastecedores", roles: ["admin", "supervisor"] },
  { icon: Activity, label: "Monitoreo Servicios", href: "/monitoreo-servicios", roles: ["admin", "supervisor"] },
  { icon: ArrowDownUp, label: "Dinero y Productos", href: "/dinero-productos", roles: ["admin", "supervisor", "contabilidad"] },
  { icon: ShoppingCart, label: "Compras", href: "/compras", roles: ["admin", "almacen"] },
  { icon: Fuel, label: "Combustible", href: "/combustible", roles: ["admin", "supervisor"] },
  { icon: Building2, label: "Establecimientos", href: "/establecimientos", roles: ["admin", "supervisor"] },
  { icon: Wrench, label: "Órdenes de Trabajo", href: "/ordenes-trabajo", roles: ["admin", "supervisor", "abastecedor"] },
];

// Items específicos para el rol de abastecedor (menú expandido)
const abastecedorItems: MenuItem[] = [
  { icon: Navigation, label: "Mi Ruta", href: "/abastecedor?tab=ruta", roles: ["abastecedor"] },
  { icon: Wrench, label: "Servicio Activo", href: "/abastecedor?tab=servicio", roles: ["abastecedor"] },
  { icon: Truck, label: "Mi Vehículo", href: "/mi-vehiculo", roles: ["abastecedor"] },
  { icon: TrendingUp, label: "Mi Rendimiento", href: "/abastecedor?tab=rendimiento", roles: ["abastecedor"] },
];

const finanzasItems: MenuItem[] = [
  { icon: Calculator, label: "Contabilidad", href: "/contabilidad", roles: ["admin", "contabilidad"] },
  { icon: Wallet, label: "Caja Chica", href: "/caja-chica", roles: ["admin", "contabilidad", "supervisor"] },
];

const integrationItems: MenuItem[] = [
  { icon: CreditCard, label: "Nayax", href: "/nayax", roles: ["admin"] },
];

const adminItems: MenuItem[] = [
  { icon: Users, label: "Gestión Usuarios", href: "/usuarios", roles: ["admin"] },
  { icon: UserCog, label: "Gestión Supervisores", href: "/supervisores", roles: ["admin"] },
  { icon: Building2, label: "Visores Establecimiento", href: "/visores", roles: ["admin"] },
  { icon: Users, label: "Recursos Humanos", href: "/rh", roles: ["admin", "rh"] },
  { icon: FileText, label: "Reportes", href: "/reportes", roles: ["admin"] },
];

const visorEstablecimientoItems: MenuItem[] = [
  { icon: TrendingUp, label: "Mis Ventas", href: "/mi-panel", roles: ["visor_establecimiento"] },
];

function filterByRole(items: MenuItem[], userRole: UserRole | undefined): MenuItem[] {
  if (!userRole) return [];
  return items.filter(item => item.roles.includes(userRole));
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLogout = () => {
    logout();
    setLocation("/auth");
  };

  const userRole = user?.role as UserRole | undefined;
  
  const visibleMenuItems = filterByRole(menuItems, userRole);
  const visibleOperacionItems = filterByRole(operacionItems, userRole);
  const visibleAbastecedorItems = filterByRole(abastecedorItems, userRole);
  const visibleFinanzasItems = filterByRole(finanzasItems, userRole);
  const visibleIntegrationItems = filterByRole(integrationItems, userRole);
  const visibleAdminItems = filterByRole(adminItems, userRole);
  const visibleVisorEstablecimientoItems = filterByRole(visorEstablecimientoItems, userRole);
  
  // Función para verificar si una ruta está activa (incluyendo parámetros de query)
  const isRouteActive = (href: string) => {
    const [path, queryString] = href.split("?");
    const currentPath = location.split("?")[0];
    
    if (queryString) {
      const currentSearch = window.location.search;
      return currentPath === path && currentSearch.includes(queryString);
    }
    return currentPath === path;
  };

  const getGreeting = () => {
    const hour = getCurrentHour();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  const getRoleBadgeColor = (role: UserRole | undefined) => {
    const colors: Record<UserRole, string> = {
      admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      supervisor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      abastecedor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      almacen: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      contabilidad: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      rh: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
      visor_establecimiento: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    };
    return role ? colors[role] : "";
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className={cn("p-4 space-y-4", isCollapsed ? "pb-2" : "pb-6")}>
        {!isCollapsed && (
          <div className="flex items-center justify-center py-3">
            <img 
              src={dispensaxLogo} 
              alt="Dispensax" 
              className="w-full max-w-[180px] h-auto"
              data-testid="img-logo"
            />
          </div>
        )}
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
          <Avatar className={cn("ring-2 ring-primary/20", isCollapsed ? "h-9 w-9" : "h-11 w-11")}>
            <AvatarFallback className="bg-primary text-primary-foreground font-medium">
              {user?.fullName
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {user?.fullName || "Usuario"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className={cn("text-[10px] px-2 py-0", getRoleBadgeColor(userRole))}
                  >
                    {userRole ? getRoleDisplayName(userRole) : "Sin rol"}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={toggleSidebar}
                data-testid="button-collapse-sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        {isCollapsed && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSidebar}
              data-testid="button-expand-sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className={cn("px-3", isCollapsed && "px-1")}>
        {visibleMenuItems.length > 0 && (
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
                MENÚ
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleMenuItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={cn(
                        "rounded-xl transition-all duration-200",
                        isCollapsed ? "h-10 px-0 justify-center" : "h-11 px-4",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-muted"
                      )}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!isCollapsed && <span className="font-medium">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleOperacionItems.length > 0 && (
          <SidebarGroup className={isCollapsed ? "mt-2" : "mt-4"}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
                OPERACIONES
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleOperacionItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={cn(
                        "rounded-xl transition-all duration-200",
                        isCollapsed ? "h-10 px-0 justify-center" : "h-10 px-4",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-muted"
                      )}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleAbastecedorItems.length > 0 && (
          <SidebarGroup className={isCollapsed ? "mt-2" : "mt-4"}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
                MI TRABAJO
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleAbastecedorItems.map((item) => {
                const isActive = isRouteActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={cn(
                        "rounded-xl transition-all duration-200",
                        isCollapsed ? "h-10 px-0 justify-center" : "h-10 px-4",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-muted"
                      )}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleVisorEstablecimientoItems.length > 0 && (
          <SidebarGroup className={isCollapsed ? "mt-2" : "mt-4"}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
                MI PANEL
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleVisorEstablecimientoItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={cn(
                        "rounded-xl transition-all duration-200",
                        isCollapsed ? "h-10 px-0 justify-center" : "h-10 px-4",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-muted"
                      )}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleFinanzasItems.length > 0 && (
          <SidebarGroup className={isCollapsed ? "mt-2" : "mt-4"}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
                FINANZAS
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleFinanzasItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={cn(
                        "rounded-xl transition-all duration-200",
                        isCollapsed ? "h-10 px-0 justify-center" : "h-10 px-4",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-muted"
                      )}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleIntegrationItems.length > 0 && (
          <SidebarGroup className={isCollapsed ? "mt-2" : "mt-4"}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
                INTEGRACIONES
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleIntegrationItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "mx-2 rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-[#E84545] text-white hover:bg-[#E84545]/90 font-medium"
                          : "hover:bg-muted/80"
                      )}
                      tooltip={item.label}
                    >
                      <Link href={item.href} data-testid={`link-${item.href.replace("/", "")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleAdminItems.length > 0 && (
          <SidebarGroup className={isCollapsed ? "mt-2" : "mt-4"}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
                ADMINISTRACIÓN
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleAdminItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={cn(
                        "rounded-xl transition-all duration-200",
                        isCollapsed ? "h-10 px-0 justify-center" : "h-10 px-4",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-muted"
                      )}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {user?.isSuperAdmin && (
          <SidebarGroup className={isCollapsed ? "mt-2" : "mt-4"}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-xs font-medium text-amber-600 dark:text-amber-400 px-3 mb-2">
                SUPER ADMIN
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed ? "Panel Super Admin" : undefined}
                  className={cn(
                    "rounded-xl transition-all duration-200",
                    isCollapsed ? "h-10 px-0 justify-center" : "h-10 px-4",
                    location === "/super-admin"
                      ? "bg-amber-500 text-white shadow-md"
                      : "hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  )}
                >
                  <Link href="/super-admin" data-testid="link-nav-super-admin">
                    <Shield className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span className="text-sm font-medium">Panel Super Admin</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className={isCollapsed ? "mt-2" : "mt-6"}>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
              GENERAL
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={isCollapsed ? "Configuración" : undefined}
                className={cn(
                  "rounded-xl transition-all duration-200",
                  isCollapsed ? "h-10 px-0 justify-center" : "h-11 px-4",
                  location === "/configuracion"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "hover:bg-muted"
                )}
              >
                <Link href="/configuracion" data-testid="link-nav-configuracion">
                  <Settings className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span className="font-medium">Configuración</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("p-4 space-y-3", isCollapsed && "p-2 space-y-2")}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full transition-all",
                theme === "dark" ? "bg-muted" : ""
              )}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-full">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex-1 h-9 rounded-full gap-2 transition-all",
                  theme === "dark" && "bg-background shadow-sm"
                )}
                onClick={() => setTheme("dark")}
                data-testid="button-theme-dark"
              >
                <Moon className="h-4 w-4" />
                <span className="text-sm">Oscuro</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex-1 h-9 rounded-full gap-2 transition-all",
                  theme === "light" && "bg-background shadow-sm"
                )}
                onClick={() => setTheme("light")}
                data-testid="button-theme-light"
              >
                <Sun className="h-4 w-4" />
                <span className="text-sm">Claro</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </Button>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
