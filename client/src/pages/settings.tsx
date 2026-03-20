import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  User,
  Bell,
  Shield,
  Palette,
  Building,
  Globe,
  Save,
  Loader2,
  Eye,
  EyeOff,
  type LucideIcon,
} from "lucide-react";

interface TabConfig {
  value: string;
  label: string;
  icon: LucideIcon;
  allowedRoles: string[];
}

const tabsConfig: TabConfig[] = [
  { value: "perfil", label: "Perfil", icon: User, allowedRoles: ["admin", "supervisor", "abastecedor", "contabilidad", "almacen", "rh"] },
  { value: "notificaciones", label: "Notificaciones", icon: Bell, allowedRoles: ["admin", "supervisor", "abastecedor", "contabilidad", "almacen", "rh"] },
  { value: "apariencia", label: "Apariencia", icon: Palette, allowedRoles: ["admin", "supervisor", "abastecedor", "contabilidad", "almacen", "rh"] },
  { value: "empresa", label: "Empresa", icon: Building, allowedRoles: ["admin"] },
  { value: "seguridad", label: "Seguridad", icon: Shield, allowedRoles: ["admin", "supervisor", "abastecedor", "contabilidad", "almacen", "rh"] },
];

export function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || "",
    username: user?.username || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [language, setLanguage] = useState<string>(
    () => localStorage.getItem("dispensax_language") || "es"
  );

  const userRole = user?.role || "abastecedor";
  const isAdmin = userRole === "admin";

  const allowedTabs = useMemo(() => {
    return tabsConfig.filter(tab => tab.allowedRoles.includes(userRole));
  }, [userRole]);

  const defaultTab = allowedTabs[0]?.value || "perfil";

  // =====================
  // Tab Empresa: load tenant data
  // =====================
  const { data: companyData, isLoading: companyLoading } = useQuery<{
    name: string;
    email: string;
    phone: string;
    address: string;
    taxId: string;
    country: string;
  }>({
    queryKey: ["/api/settings/company"],
    enabled: isAdmin,
  });

  const [companyForm, setCompanyForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    country: "",
  });

  useEffect(() => {
    if (companyData) {
      setCompanyForm({
        name: companyData.name,
        email: companyData.email,
        phone: companyData.phone,
        address: companyData.address,
        taxId: companyData.taxId,
        country: companyData.country,
      });
    }
  }, [companyData]);

  // =====================
  // Tab Notificaciones: load settings for admin, localStorage for others
  // =====================
  const { data: notifData, isLoading: notifLoading } = useQuery<{
    notifyLowStock: boolean;
    notifyMaintenanceDue: boolean;
    lowStockThreshold: number;
  }>({
    queryKey: ["/api/settings/notifications"],
    enabled: isAdmin,
  });

  const [notifications, setNotifications] = useState({
    email: localStorage.getItem("notif_email") !== "false",
    push: localStorage.getItem("notif_push") !== "false",
    lowStock: localStorage.getItem("notif_low_stock") !== "false",
    machineAlerts: localStorage.getItem("notif_machine_alerts") !== "false",
    reports: localStorage.getItem("notif_reports") === "true",
  });

  useEffect(() => {
    if (notifData && isAdmin) {
      setNotifications(prev => ({
        ...prev,
        lowStock: notifData.notifyLowStock,
        machineAlerts: notifData.notifyMaintenanceDue,
      }));
    }
  }, [notifData, isAdmin]);

  // =====================
  // Mutations
  // =====================
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      const res = await apiRequest("PATCH", "/api/users/me", data);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      updateUser({
        fullName: updatedUser.fullName,
        username: updatedUser.username,
        email: updatedUser.email,
        phone: updatedUser.phone,
      });
      toast({
        title: "Perfil actualizado",
        description: "Los cambios se han guardado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el perfil",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada correctamente",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar la contraseña",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof companyForm) => {
      const res = await apiRequest("PATCH", "/api/settings/company", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/company"] });
      toast({
        title: "Empresa actualizada",
        description: "Los datos de la empresa se han guardado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar los datos de la empresa",
        variant: "destructive",
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: { notifyLowStock: boolean; notifyMaintenanceDue: boolean }) => {
      const res = await apiRequest("PATCH", "/api/settings/notifications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/notifications"] });
      toast({
        title: "Notificaciones guardadas",
        description: "Las preferencias se han guardado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar las preferencias",
        variant: "destructive",
      });
    },
  });

  // =====================
  // Handlers
  // =====================
  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleChangePassword = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La nueva contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const handleSaveNotifications = () => {
    if (isAdmin) {
      updateNotificationsMutation.mutate({
        notifyLowStock: notifications.lowStock,
        notifyMaintenanceDue: notifications.machineAlerts,
      });
    } else {
      // Persist to localStorage for non-admin users
      localStorage.setItem("notif_email", String(notifications.email));
      localStorage.setItem("notif_push", String(notifications.push));
      localStorage.setItem("notif_low_stock", String(notifications.lowStock));
      localStorage.setItem("notif_machine_alerts", String(notifications.machineAlerts));
      localStorage.setItem("notif_reports", String(notifications.reports));
      toast({
        title: "Notificaciones guardadas",
        description: "Las preferencias se han guardado correctamente",
      });
    }
  };

  const handleSaveAppearance = () => {
    localStorage.setItem("dispensax_language", language);
    toast({
      title: "Apariencia guardada",
      description: "Tus preferencias de apariencia han sido guardadas",
    });
  };

  const handleSaveCompany = () => {
    updateCompanyMutation.mutate(companyForm);
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

        {/* ===== TAB PERFIL ===== */}
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
                      {profileData.fullName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Button variant="outline" disabled data-testid="button-change-photo">Cambiar Foto</Button>
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
                      value={profileData.fullName}
                      onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                      placeholder="Tu nombre"
                      data-testid="input-full-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuario</Label>
                    <Input
                      id="username"
                      value={profileData.username}
                      onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                      placeholder="Tu usuario"
                      data-testid="input-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      placeholder="tu@email.com"
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+1 (809) 000-0000"
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    className="gap-2"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== TAB NOTIFICACIONES ===== */}
        {isTabAllowed("notificaciones") && (
          <TabsContent value="notificaciones">
            <Card>
              <CardHeader>
                <CardTitle>Preferencias de Notificaciones</CardTitle>
                <CardDescription>
                  {isAdmin
                    ? "Configura las alertas del sistema para toda la empresa"
                    : "Configura tus preferencias personales de notificación"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {notifLoading && isAdmin ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Cargando preferencias...</span>
                  </div>
                ) : (
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
                          {isAdmin
                            ? "Alerta del sistema cuando un producto está por agotarse"
                            : "Cuando un producto está por agotarse"}
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
                          {isAdmin
                            ? "Alerta del sistema por fallas, mantenimiento y estado"
                            : "Fallas, mantenimiento y estado"}
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
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveNotifications}
                    className="gap-2"
                    disabled={updateNotificationsMutation.isPending}
                    data-testid="button-save-notifications"
                  >
                    {updateNotificationsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== TAB APARIENCIA ===== */}
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
                    <p className="text-xs text-muted-foreground">El tema se guarda automáticamente.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Idioma</Label>
                      <Badge variant="secondary" className="text-xs">Próximamente multiidioma</Badge>
                    </div>
                    <Select
                      value={language}
                      onValueChange={(value) => {
                        setLanguage(value);
                        localStorage.setItem("dispensax_language", value);
                      }}
                    >
                      <SelectTrigger className="w-[200px]" data-testid="select-language">
                        <Globe className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Selecciona idioma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      La aplicación actualmente está en español. El soporte multi-idioma estará disponible próximamente.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveAppearance} className="gap-2" data-testid="button-save-appearance">
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== TAB EMPRESA ===== */}
        {isTabAllowed("empresa") && (
          <TabsContent value="empresa">
            <Card>
              <CardHeader>
                <CardTitle>Información de la Empresa</CardTitle>
                <CardDescription>
                  Datos generales de tu empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {companyLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Cargando datos de la empresa...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Nombre de la Empresa</Label>
                      <Input
                        id="companyName"
                        value={companyForm.name}
                        onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                        placeholder="Nombre de tu empresa"
                        data-testid="input-company-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rnc">RNC</Label>
                      <Input
                        id="rnc"
                        value={companyForm.taxId}
                        onChange={(e) => setCompanyForm({ ...companyForm, taxId: e.target.value })}
                        placeholder="Registro Nacional del Contribuyente"
                        data-testid="input-rnc"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="companyAddress">Dirección</Label>
                      <Input
                        id="companyAddress"
                        value={companyForm.address}
                        onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                        placeholder="Calle, número, sector"
                        data-testid="input-address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Teléfono</Label>
                      <Input
                        id="companyPhone"
                        value={companyForm.phone}
                        onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                        placeholder="+1 (809) 000-0000"
                        data-testid="input-company-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Email</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        value={companyForm.email}
                        onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                        placeholder="empresa@correo.com"
                        data-testid="input-company-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyCountry">País</Label>
                      <Input
                        id="companyCountry"
                        value={companyForm.country}
                        onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                        placeholder="República Dominicana"
                        data-testid="input-country"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveCompany}
                    className="gap-2"
                    disabled={updateCompanyMutation.isPending || companyLoading}
                    data-testid="button-save-company"
                  >
                    {updateCompanyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== TAB SEGURIDAD ===== */}
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
                    <div className="space-y-3">
                      <div className="relative">
                        <Input
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Contraseña actual"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="pr-10"
                          data-testid="input-current-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Nueva contraseña"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="pr-10"
                          data-testid="input-new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Input
                        type="password"
                        placeholder="Confirmar nueva contraseña"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        data-testid="input-confirm-password"
                      />
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePasswordMutation.isPending || !passwordData.currentPassword || !passwordData.newPassword}
                      className="mt-3"
                      data-testid="button-change-password"
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Cambiar Contraseña
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Label>Autenticación de Dos Factores</Label>
                        <Badge variant="secondary" className="text-xs">Próximamente</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Añade una capa extra de seguridad a tu cuenta
                      </p>
                    </div>
                    <Button variant="outline" disabled data-testid="button-setup-2fa">Configurar</Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Label>Sesiones Activas</Label>
                        <Badge variant="secondary" className="text-xs">Próximamente</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Gestiona los dispositivos conectados a tu cuenta
                      </p>
                    </div>
                    <Button variant="outline" disabled data-testid="button-view-sessions">Ver Sesiones</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
