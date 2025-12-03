import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Bell,
  Shield,
  Palette,
  Building,
  Globe,
  Save,
  type LucideIcon,
} from "lucide-react";

interface TabConfig {
  value: string;
  label: string;
  icon: LucideIcon;
  allowedRoles: string[];
}

const tabsConfig: TabConfig[] = [
  { value: "perfil", label: "Perfil", icon: User, allowedRoles: ["admin", "supervisor", "abastecedor", "contador", "almacenista", "rrhh"] },
  { value: "notificaciones", label: "Notificaciones", icon: Bell, allowedRoles: ["admin", "supervisor", "abastecedor", "contador", "almacenista", "rrhh"] },
  { value: "apariencia", label: "Apariencia", icon: Palette, allowedRoles: ["admin", "supervisor", "abastecedor", "contador", "almacenista", "rrhh"] },
  { value: "empresa", label: "Empresa", icon: Building, allowedRoles: ["admin"] },
  { value: "seguridad", label: "Seguridad", icon: Shield, allowedRoles: ["admin"] },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    lowStock: true,
    machineAlerts: true,
    reports: false,
  });

  const userRole = user?.role || "abastecedor";
  
  const allowedTabs = useMemo(() => {
    return tabsConfig.filter(tab => tab.allowedRoles.includes(userRole));
  }, [userRole]);

  const defaultTab = allowedTabs[0]?.value || "perfil";

  const handleSave = () => {
    toast({
      title: "Configuración guardada",
      description: "Los cambios se han guardado correctamente",
    });
  };

  const isTabAllowed = (tabValue: string) => {
    return allowedTabs.some(tab => tab.value === tabValue);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Configuración</h1>
        <p className="text-muted-foreground">
          Administra las preferencias del sistema
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          {allowedTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2" data-testid={`tab-${tab.value}`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {isTabAllowed("perfil") && (
          <TabsContent value="perfil">
            <Card>
              <CardHeader>
                <CardTitle>Información del Perfil</CardTitle>
                <CardDescription>
                  Actualiza tu información personal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {user?.fullName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Button variant="outline" data-testid="button-change-photo">Cambiar Foto</Button>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG o GIF. Máximo 2MB.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nombre Completo</Label>
                    <Input
                      id="fullName"
                      defaultValue={user?.fullName || ""}
                      placeholder="Tu nombre"
                      data-testid="input-full-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuario</Label>
                    <Input
                      id="username"
                      defaultValue={user?.username || ""}
                      placeholder="Tu usuario"
                      data-testid="input-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue={user?.email || ""}
                      placeholder="tu@email.com"
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      placeholder="+52 555 123 4567"
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} className="gap-2" data-testid="button-save-profile">
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isTabAllowed("notificaciones") && (
          <TabsContent value="notificaciones">
            <Card>
              <CardHeader>
                <CardTitle>Preferencias de Notificaciones</CardTitle>
                <CardDescription>
                  Configura cómo y cuándo recibes notificaciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones por Email</Label>
                      <p className="text-sm text-muted-foreground">
                        Recibe un resumen diario por correo
                      </p>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, email: checked })
                      }
                      data-testid="switch-email-notifications"
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificaciones Push</Label>
                      <p className="text-sm text-muted-foreground">
                        Recibe alertas en tiempo real
                      </p>
                    </div>
                    <Switch
                      checked={notifications.push}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, push: checked })
                      }
                      data-testid="switch-push-notifications"
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Alertas de Stock Bajo</Label>
                      <p className="text-sm text-muted-foreground">
                        Cuando un producto está por agotarse
                      </p>
                    </div>
                    <Switch
                      checked={notifications.lowStock}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, lowStock: checked })
                      }
                      data-testid="switch-low-stock-alerts"
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Alertas de Máquinas</Label>
                      <p className="text-sm text-muted-foreground">
                        Fallas, mantenimiento y estado
                      </p>
                    </div>
                    <Switch
                      checked={notifications.machineAlerts}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, machineAlerts: checked })
                      }
                      data-testid="switch-machine-alerts"
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Reportes Semanales</Label>
                      <p className="text-sm text-muted-foreground">
                        Resumen semanal de operaciones
                      </p>
                    </div>
                    <Switch
                      checked={notifications.reports}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, reports: checked })
                      }
                      data-testid="switch-weekly-reports"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} className="gap-2" data-testid="button-save-notifications">
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isTabAllowed("apariencia") && (
          <TabsContent value="apariencia">
            <Card>
              <CardHeader>
                <CardTitle>Apariencia</CardTitle>
                <CardDescription>
                  Personaliza la apariencia de la aplicación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tema</Label>
                    <Select value={theme} onValueChange={(value: "light" | "dark") => setTheme(value)}>
                      <SelectTrigger className="w-[200px]" data-testid="select-theme">
                        <SelectValue placeholder="Selecciona un tema" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Oscuro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select defaultValue="es">
                      <SelectTrigger className="w-[200px]" data-testid="select-language">
                        <Globe className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Selecciona idioma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} className="gap-2" data-testid="button-save-appearance">
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isTabAllowed("empresa") && (
          <TabsContent value="empresa">
            <Card>
              <CardHeader>
                <CardTitle>Información de la Empresa</CardTitle>
                <CardDescription>
                  Datos generales de la empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nombre de la Empresa</Label>
                    <Input id="companyName" defaultValue="Dispensax S.A. de C.V." data-testid="input-company-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfc">RFC</Label>
                    <Input id="rfc" defaultValue="DIS230101XXX" data-testid="input-rfc" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      defaultValue="Av. Principal #123, Col. Centro"
                      data-testid="input-address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ciudad</Label>
                    <Input id="city" defaultValue="Ciudad de México" data-testid="input-city" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">País</Label>
                    <Input id="country" defaultValue="México" data-testid="input-country" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} className="gap-2" data-testid="button-save-company">
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isTabAllowed("seguridad") && (
          <TabsContent value="seguridad">
            <Card>
              <CardHeader>
                <CardTitle>Seguridad</CardTitle>
                <CardDescription>
                  Gestiona la seguridad de tu cuenta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cambiar Contraseña</Label>
                    <div className="space-y-2">
                      <Input type="password" placeholder="Contraseña actual" data-testid="input-current-password" />
                      <Input type="password" placeholder="Nueva contraseña" data-testid="input-new-password" />
                      <Input type="password" placeholder="Confirmar nueva contraseña" data-testid="input-confirm-password" />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Autenticación de Dos Factores</Label>
                      <p className="text-sm text-muted-foreground">
                        Añade una capa extra de seguridad
                      </p>
                    </div>
                    <Button variant="outline" data-testid="button-setup-2fa">Configurar</Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Sesiones Activas</Label>
                      <p className="text-sm text-muted-foreground">
                        Gestiona los dispositivos conectados
                      </p>
                    </div>
                    <Button variant="outline" data-testid="button-view-sessions">Ver Sesiones</Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} className="gap-2" data-testid="button-save-security">
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
