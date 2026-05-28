import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth, UserRole, getRoleDisplayName } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  LayoutGrid,
  Landmark,
  TrendingDown,
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
  { icon: LayoutGrid, label: "Planogramas", href: "/planogramas", roles: ["admin", "supervisor"] },
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
  { icon: FileText, label: "Compras Financiero", href: "/compras-financiero", roles: ["admin", "contabilidad"] },
  { icon: Fuel, label: "Combustible", href: "/combustible", roles: ["admin", "supervisor"] },
  { icon: Building2, label: "Establecimientos", href: "/establecimientos", roles: ["admin", "supervisor"] },
  { icon: Wrench, label: "Órdenes de Trabajo", href: "/ordenes-trabajo", roles: ["admin", "supervisor", "abastecedor"] },
];

const abastecedorItems: MenuItem[] = [
  { icon: Navigation, label: "Mi Ruta", href: "/abastecedor?tab=ruta", roles: ["abastecedor"] },
  { icon: Wrench, label: "Servicio Activo", href: "/abastecedor?tab=servicio", roles: ["abastecedor"] },
  { icon: Truck, label: "Mi Vehículo", href: "/mi-vehiculo", roles: ["abastecedor"] },
  { icon: TrendingUp, label: "Mi Rendimiento", href: "/abastecedor?tab=rendimiento", roles: ["abastecedor"] },
];

const finanzasItems: MenuItem[] = [
  { icon: Landmark, label: "Bancos", href: "/bancos", roles: ["admin", "contabilidad"] },
  { icon: TrendingUp, label: "Ingresos", href: "/ingresos", roles: ["admin", "contabilidad"] },
  { icon: TrendingDown, label: "Egresos", href: "/egresos", roles: ["admin", "contabilidad"] },
  { icon: Calculator, label: "Contabilidad", href: "/contabilidad", roles: ["admin", "contabilidad"] },
  { icon: Wallet, label: "Caja Chica", href: "/caja-chica", roles: ["admin", "contabilidad", "supervisor"] },
];

const integrationItems: MenuItem[] = [
  { icon: CreditCard, label: "Nayax", href: "/nayax", roles: ["admin"] },
];

const adminItems: MenuItem[] = [
  { icon: Users, label: "Gestión Usuarios", href: "/usuarios", roles: ["admin"] },
  { icon: UserCog, label: "Gestión Supervisores", href: "/supervisores", roles: ["admin"] },
  { icon: Building2, label: "Directorio de Visores", href: "/visores", roles: ["admin"] },
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

const navItemClass = (isActive: boolean, isCollapsed: boolean) =>
  cn(
    "rounded-md transition-all duration-150 text-sm font-medium",
    isCollapsed ? "h-9 px-0 justify-center" : "h-9 px-3",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
  );

const groupLabelClass = "text-[10px] uppercase tracking-wider font-medium text-sidebar-foreground/50 px-3 mb-1";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLogout = () => {
    logout();
    window.location.href = "/auth";
  };

  const userRole = user?.role as UserRole | undefined;

  const visibleMenuItems = filterByRole(menuItems, userRole);
  const visibleOperacionItems = filterByRole(operacionItems, userRole);
  const visibleAbastecedorItems = filterByRole(abastecedorItems, userRole);
  const visibleFinanzasItems = filterByRole(finanzasItems, userRole);
  const visibleIntegrationItems = filterByRole(integrationItems, userRole);
  const visibleAdminItems = filterByRole(adminItems, userRole);
  const visibleVisorEstablecimientoItems = filterByRole(visorEstablecimientoItems, userRole);

  const isRouteActive = (href: string) => {
    const [path, queryString] = href.split("?");
    const currentPath = location.split("?")[0];
    if (queryString) {
      const currentSearch = window.location.search;
      return currentPath === path && currentSearch.includes(queryString);
    }
    return currentPath === path;
  };

  const userInitials = user?.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between gap-2")}>
          {!isCollapsed && (
            <img
              src={dispensaxLogo}
              alt="Dispensax"
              className="h-7 w-auto max-w-[140px] object-contain"
              data-testid="img-logo"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={toggleSidebar}
            data-testid={isCollapsed ? "button-expand-sidebar" : "button-collapse-sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("px-2 py-2", isCollapsed && "px-1")}>
        {visibleMenuItems.length > 0 && (
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelClass}>MENÚ</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleMenuItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={navItemClass(isActive, isCollapsed)}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleOperacionItems.length > 0 && (
          <SidebarGroup className="mt-3">
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelClass}>OPERACIONES</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleOperacionItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={navItemClass(isActive, isCollapsed)}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleAbastecedorItems.length > 0 && (
          <SidebarGroup className="mt-3">
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelClass}>MI TRABAJO</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleAbastecedorItems.map((item) => {
                const isActive = isRouteActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={navItemClass(isActive, isCollapsed)}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleVisorEstablecimientoItems.length > 0 && (
          <SidebarGroup className="mt-3">
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelClass}>MI PANEL</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleVisorEstablecimientoItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={navItemClass(isActive, isCollapsed)}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleFinanzasItems.length > 0 && (
          <SidebarGroup className="mt-3">
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelClass}>FINANZAS</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleFinanzasItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={navItemClass(isActive, isCollapsed)}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleIntegrationItems.length > 0 && (
          <SidebarGroup className="mt-3">
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelClass}>INTEGRACIONES</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleIntegrationItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={navItemClass(isActive, isCollapsed)}
                    >
                      <Link href={item.href} data-testid={`link-${item.href.replace("/", "")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleAdminItems.length > 0 && (
          <SidebarGroup className="mt-3">
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelClass}>ADMINISTRACIÓN</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {visibleAdminItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed ? item.label : undefined}
                      className={navItemClass(isActive, isCollapsed)}
                    >
                      <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {user?.isSuperAdmin && (
          <SidebarGroup className="mt-3">
            {!isCollapsed && (
              <SidebarGroupLabel className={groupLabelClass}>SUPER ADMIN</SidebarGroupLabel>
            )}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed ? "Panel Super Admin" : undefined}
                  className={navItemClass(location === "/super-admin", isCollapsed)}
                >
                  <Link href="/super-admin" data-testid="link-nav-super-admin">
                    <Shield className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span>Panel Super Admin</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-3">
          {!isCollapsed && (
            <SidebarGroupLabel className={groupLabelClass}>GENERAL</SidebarGroupLabel>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={isCollapsed ? "Configuración" : undefined}
                className={navItemClass(location === "/configuracion", isCollapsed)}
              >
                <Link href="/configuracion" data-testid="link-nav-configuracion">
                  <Settings className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>Configuración</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/25 text-sidebar-foreground text-xs font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-sidebar-foreground leading-tight">
                  {user?.fullName || "Usuario"}
                </p>
                <p className="text-[11px] text-sidebar-foreground/55 truncate leading-tight">
                  {userRole ? getRoleDisplayName(userRole) : "Sin rol"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-destructive hover:bg-sidebar-accent"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-full bg-sidebar-accent">
              <button
                className={cn(
                  "flex-1 h-7 rounded-full flex items-center justify-center gap-1.5 text-xs transition-all",
                  theme === "dark"
                    ? "bg-sidebar-border text-sidebar-foreground shadow-sm"
                    : "text-sidebar-foreground/60"
                )}
                onClick={() => setTheme("dark")}
                data-testid="button-theme-dark"
              >
                <Moon className="h-3 w-3" />
                <span>Oscuro</span>
              </button>
              <button
                className={cn(
                  "flex-1 h-7 rounded-full flex items-center justify-center gap-1.5 text-xs transition-all",
                  theme === "light"
                    ? "bg-sidebar-border text-sidebar-foreground shadow-sm"
                    : "text-sidebar-foreground/60"
                )}
                onClick={() => setTheme("light")}
                data-testid="button-theme-light"
              >
                <Sun className="h-3 w-3" />
                <span>Claro</span>
              </button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
