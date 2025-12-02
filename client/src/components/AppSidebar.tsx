import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import dispensaxLogo from "@assets/Logo_Dispensax_1764686241640.png";
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
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Box,
  ClipboardList,
  ListTodo,
  Calendar,
  Settings,
  ChevronLeft,
  Moon,
  Sun,
  Plus,
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
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Box, label: "Máquinas", href: "/maquinas" },
  { icon: ClipboardList, label: "Tareas Hoy", href: "/tareas" },
  { icon: ListTodo, label: "Todas las Tareas", href: "/todas-tareas" },
  { icon: Calendar, label: "Calendario", href: "/calendario" },
];

const operacionItems = [
  { icon: Package, label: "Almacén", href: "/almacen" },
  { icon: Truck, label: "Abastecedor", href: "/abastecedor" },
  { icon: ArrowDownUp, label: "Dinero y Productos", href: "/dinero-productos" },
  { icon: ShoppingCart, label: "Compras", href: "/compras" },
  { icon: Fuel, label: "Combustible", href: "/combustible" },
];

const finanzasItems = [
  { icon: Calculator, label: "Contabilidad", href: "/contabilidad" },
  { icon: Wallet, label: "Caja Chica", href: "/caja-chica" },
];

const adminItems = [
  { icon: Users, label: "Recursos Humanos", href: "/rh" },
  { icon: FileText, label: "Reportes", href: "/reportes" },
];


export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 pb-6 space-y-4">
        <div className="flex items-center justify-center py-3">
          <img 
            src={dispensaxLogo} 
            alt="Dispensax" 
            className="w-full max-w-[180px] h-auto"
            data-testid="img-logo"
          />
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary text-primary-foreground font-medium">
              {user?.fullName
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {user?.fullName || "Usuario"}
            </p>
            <p className="text-xs text-muted-foreground">
              {getGreeting()}, {user?.fullName?.split(" ")[0] || "Usuario"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            data-testid="button-collapse-sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
            MENÚ
          </SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => {
              const isActive = location === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-11 px-4 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-muted"
                    )}
                  >
                    <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
            OPERACIONES
          </SidebarGroupLabel>
          <SidebarMenu>
            {operacionItems.map((item) => {
              const isActive = location === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-10 px-4 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-muted"
                    )}
                  >
                    <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
            FINANZAS
          </SidebarGroupLabel>
          <SidebarMenu>
            {finanzasItems.map((item) => {
              const isActive = location === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-10 px-4 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-muted"
                    )}
                  >
                    <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
            ADMINISTRACIÓN
          </SidebarGroupLabel>
          <SidebarMenu>
            {adminItems.map((item) => {
              const isActive = location === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-10 px-4 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-muted"
                    )}
                  >
                    <Link href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-2">
            GENERAL
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={cn(
                  "h-11 px-4 rounded-xl transition-all duration-200",
                  location === "/configuracion"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "hover:bg-muted"
                )}
              >
                <Link href="/configuracion" data-testid="link-nav-configuracion">
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Configuración</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
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
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar Sesión</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
