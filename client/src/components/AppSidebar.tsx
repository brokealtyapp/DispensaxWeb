import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useAuth, UserRole } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Box,
  Truck,
  Warehouse,
  Calculator,
  TrendingUp,
  Users,
  Wallet,
  ShoppingCart,
  Fuel,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  roles?: UserRole[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "Menu",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Máquinas", url: "/maquinas", icon: Box },
      { title: "Tareas del Día", url: "/tareas", icon: FileText },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { title: "Abastecedor", url: "/abastecedor", icon: Truck },
      { title: "Almacén", url: "/almacen", icon: Warehouse },
      { title: "Combustible", url: "/combustible", icon: Fuel },
    ],
    roles: ["admin", "supervisor", "abastecedor", "almacen"],
  },
  {
    label: "Finanzas",
    items: [
      { title: "Contabilidad", url: "/contabilidad", icon: Calculator },
      { title: "Finanzas", url: "/finanzas", icon: TrendingUp },
      { title: "Caja Chica", url: "/caja-chica", icon: Wallet },
      { title: "Compras", url: "/compras", icon: ShoppingCart },
    ],
    roles: ["admin", "contabilidad"],
  },
  {
    label: "Administración",
    items: [
      { title: "Recursos Humanos", url: "/rh", icon: Users },
      { title: "Reportes", url: "/reportes", icon: FileText },
      { title: "Configuración", url: "/configuracion", icon: Settings },
    ],
    roles: ["admin", "rh"],
  },
];

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  abastecedor: "Abastecedor",
  almacen: "Almacén",
  contabilidad: "Contabilidad",
  rh: "Recursos Humanos",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [openGroups, setOpenGroups] = useState<string[]>(["Menu", "Operaciones"]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const filteredGroups = navigationGroups.filter((group) => {
    if (!group.roles) return true;
    return user && group.roles.includes(user.role);
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" data-testid="link-logo">
          <Logo size="md" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {filteredGroups.map((group) => (
          <Collapsible
            key={group.label}
            open={openGroups.includes(group.label)}
            onOpenChange={() => toggleGroup(group.label)}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer flex items-center justify-between w-full">
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      openGroups.includes(group.label) ? "rotate-180" : ""
                    }`}
                  />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                        >
                          <Link
                            href={item.url}
                            data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-4">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.fullName}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[user.role]}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              data-testid="button-logout"
              className="shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
