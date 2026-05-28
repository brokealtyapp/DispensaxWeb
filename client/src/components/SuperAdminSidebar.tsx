import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  Building2,
  CreditCard,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  LogOut,
  Shield,
  Users,
  TrendingUp,
} from "lucide-react";

interface MenuItem {
  icon: any;
  label: string;
  href: string;
}

const superAdminMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/super-admin" },
  { icon: Building2, label: "Empresas", href: "/super-admin/empresas" },
  { icon: CreditCard, label: "Planes", href: "/super-admin/planes" },
  { icon: Users, label: "Usuarios", href: "/super-admin/usuarios" },
  { icon: TrendingUp, label: "Métricas", href: "/super-admin/metricas" },
  { icon: Activity, label: "Auditoría", href: "/super-admin/auditoria" },
  { icon: Settings, label: "Configuración", href: "/super-admin/configuracion" },
];

export function SuperAdminSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLogout = () => {
    logout();
    setLocation("/auth");
  };

  const userInitials = user?.fullName
    ? user.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() || "SA";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between gap-2")}>
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-sidebar-foreground leading-tight">Dispensax</span>
                <span className="text-[10px] text-sidebar-foreground/55 leading-tight">Super Admin</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            data-testid="button-toggle-sidebar"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-medium text-sidebar-foreground/50 px-3 mb-1">
              Gestión Plataforma
            </SidebarGroupLabel>
          )}
          <SidebarMenu>
            {superAdminMenuItems.map((item) => {
              const isActive = location === item.href ||
                (item.href !== "/super-admin" && location.startsWith(item.href));
              const Icon = item.icon;

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={isCollapsed ? item.label : undefined}
                    className={cn(
                      "rounded-md transition-all duration-150 text-sm font-medium",
                      isCollapsed ? "h-9 px-0 justify-center" : "h-9 px-3",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <Link href={item.href} data-testid={`link-${item.label.toLowerCase().replace(/\s/g, "-")}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent"
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
                  {user?.fullName || user?.username}
                </p>
                <p className="text-[11px] text-sidebar-foreground/55 truncate leading-tight">Super Admin</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-destructive hover:bg-sidebar-accent"
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="text-xs">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
