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
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-foreground">Dispensax</span>
              <span className="text-xs text-muted-foreground">Super Admin</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {!isCollapsed && "Gestión Plataforma"}
          </SidebarGroupLabel>
          <SidebarMenu>
            {superAdminMenuItems.map((item) => {
              const isActive = location === item.href || 
                (item.href !== "/super-admin" && location.startsWith(item.href));
              const Icon = item.icon;
              
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={isCollapsed ? item.label : undefined}
                  >
                    <Link href={item.href} data-testid={`link-${item.label.toLowerCase().replace(/\s/g, "-")}`}>
                      <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                      {!isCollapsed && (
                        <span className={cn("ml-3", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9"
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-9 w-9"
            data-testid="button-toggle-sidebar"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
          <Avatar className="h-9 w-9 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.fullName || user?.username}
              </p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
          )}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
