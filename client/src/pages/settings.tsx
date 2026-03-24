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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Cpu,
  ArrowUp,
  ArrowDown,
  PowerOff,
  Power,
  type LucideIcon,
} from "lucide-react";
import type { Location, MachineTypeOption } from "@shared/schema";

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
  { value: "ubicaciones", label: "Ubicaciones", icon: MapPin, allowedRoles: ["admin"] },
  { value: "tipos_maquina", label: "Tipos de Máquina", icon: Cpu, allowedRoles: ["admin"] },
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

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || "",
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

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
  // Tab Ubicaciones
  // =====================
  const emptyLocationForm = {
    name: "",
    address: "",
    city: "",
    zone: "",
    contactName: "",
    contactPhone: "",
    notes: "",
  };

  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationEditing, setLocationEditing] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);

  const { data: locationsList = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
    enabled: isAdmin,
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: typeof emptyLocationForm) => {
      const res = await apiRequest("POST", "/api/locations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setLocationDialogOpen(false);
      setLocationForm(emptyLocationForm);
      toast({ title: "Ubicación creada", description: "Se agregó la ubicación correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la ubicación", variant: "destructive" });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof emptyLocationForm }) => {
      const res = await apiRequest("PATCH", `/api/locations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setLocationDialogOpen(false);
      setLocationEditing(null);
      setLocationForm(emptyLocationForm);
      toast({ title: "Ubicación actualizada", description: "Los cambios se guardaron correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la ubicación", variant: "destructive" });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setDeletingLocationId(null);
      toast({ title: "Ubicación eliminada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la ubicación", variant: "destructive" });
      setDeletingLocationId(null);
    },
  });

  const openCreateLocation = () => {
    setLocationEditing(null);
    setLocationForm(emptyLocationForm);
    setLocationDialogOpen(true);
  };

  const openEditLocation = (loc: Location) => {
    setLocationEditing(loc);
    setLocationForm({
      name: loc.name || "",
      address: loc.address || "",
      city: loc.city || "",
      zone: loc.zone || "",
      contactName: loc.contactName || "",
      contactPhone: loc.contactPhone || "",
      notes: loc.notes || "",
    });
    setLocationDialogOpen(true);
  };

  const handleSaveLocation = () => {
    if (!locationForm.name.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" });
      return;
    }
    if (locationEditing) {
      updateLocationMutation.mutate({ id: locationEditing.id, data: locationForm });
    } else {
      createLocationMutation.mutate(locationForm);
    }
  };

  // =====================
  // Tab Tipos de Máquina
  // =====================
  const slugify = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);

  const emptyMachineTypeForm = { name: "", value: "" };
  const [machineTypeDialogOpen, setMachineTypeDialogOpen] = useState(false);
  const [machineTypeEditing, setMachineTypeEditing] = useState<MachineTypeOption | null>(null);
  const [machineTypeForm, setMachineTypeForm] = useState(emptyMachineTypeForm);
  const [machineTypeValueEdited, setMachineTypeValueEdited] = useState(false);
  const [deletingMachineTypeId, setDeletingMachineTypeId] = useState<string | null>(null);

  const { data: machineTypesList = [], isLoading: machineTypesLoading } = useQuery<MachineTypeOption[]>({
    queryKey: ["/api/machine-types", { all: "true" }],
    enabled: isAdmin,
  });

  const createMachineTypeMutation = useMutation({
    mutationFn: async (data: { name: string; value: string }) => {
      const res = await apiRequest("POST", "/api/machine-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machine-types"] });
      setMachineTypeDialogOpen(false);
      setMachineTypeForm({ name: "", value: "" });
      setMachineTypeValueEdited(false);
      toast({ title: "Tipo creado", description: "Se agregó el tipo de máquina correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "No se pudo crear el tipo", variant: "destructive" });
    },
  });

  const updateMachineTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string } }) => {
      const res = await apiRequest("PATCH", `/api/machine-types/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machine-types"] });
      setMachineTypeDialogOpen(false);
      setMachineTypeEditing(null);
      setMachineTypeForm({ name: "", value: "" });
      setMachineTypeValueEdited(false);
      toast({ title: "Tipo actualizado", description: "Los cambios se guardaron correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el tipo", variant: "destructive" });
    },
  });

  const toggleMachineTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/machine-types/${id}/toggle`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machine-types"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderMachineTypeMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const res = await apiRequest("POST", `/api/machine-types/${id}/reorder`, { direction });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machine-types"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMachineTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/machine-types/${id}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Error al eliminar");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machine-types"] });
      setDeletingMachineTypeId(null);
      toast({ title: "Tipo eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setDeletingMachineTypeId(null);
    },
  });

  const openCreateMachineType = () => {
    setMachineTypeEditing(null);
    setMachineTypeForm(emptyMachineTypeForm);
    setMachineTypeValueEdited(false);
    setMachineTypeDialogOpen(true);
  };

  const openEditMachineType = (mt: MachineTypeOption) => {
    setMachineTypeEditing(mt);
    setMachineTypeForm({ name: mt.name, value: mt.value });
    setMachineTypeValueEdited(false);
    setMachineTypeDialogOpen(true);
  };

  const handleSaveMachineType = () => {
    if (!machineTypeForm.name.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" });
      return;
    }
    if (machineTypeEditing) {
      updateMachineTypeMutation.mutate({ id: machineTypeEditing.id, data: { name: machineTypeForm.name } });
    } else {
      if (!machineTypeForm.value.trim()) {
        toast({ title: "Error", description: "El identificador es requerido", variant: "destructive" });
        return;
      }
      if (!/^[a-z0-9_]+$/.test(machineTypeForm.value)) {
        toast({ title: "Error", description: "El identificador solo puede contener letras minúsculas, números y guión bajo", variant: "destructive" });
        return;
      }
      createMachineTypeMutation.mutate(machineTypeForm);
    }
  };

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

        {/* ===== TAB UBICACIONES ===== */}
        {isTabAllowed("ubicaciones") && (
          <TabsContent value="ubicaciones">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Ubicaciones</CardTitle>
                    <CardDescription>
                      Gestiona los establecimientos donde se instalan las máquinas
                    </CardDescription>
                  </div>
                  <Button onClick={openCreateLocation} className="gap-2" data-testid="button-add-location">
                    <Plus className="h-4 w-4" />
                    Nueva Ubicación
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {locationsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Cargando ubicaciones...</span>
                  </div>
                ) : locationsList.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <MapPin className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No hay ubicaciones registradas.</p>
                    <Button variant="outline" onClick={openCreateLocation} data-testid="button-add-location-empty">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar primera ubicación
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {locationsList.map((loc) => (
                      <div
                        key={loc.id}
                        className="flex flex-wrap items-start justify-between gap-3 py-4"
                        data-testid={`row-location-${loc.id}`}
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium" data-testid={`text-location-name-${loc.id}`}>{loc.name}</span>
                            {loc.zone && (
                              <Badge variant="secondary" className="text-xs">{loc.zone}</Badge>
                            )}
                          </div>
                          {(loc.address || loc.city) && (
                            <p className="text-sm text-muted-foreground">
                              {[loc.address, loc.city].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {(loc.contactName || loc.contactPhone) && (
                            <p className="text-xs text-muted-foreground">
                              Contacto: {[loc.contactName, loc.contactPhone].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditLocation(loc)}
                            data-testid={`button-edit-location-${loc.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setDeletingLocationId(loc.id);
                              deleteLocationMutation.mutate(loc.id);
                            }}
                            disabled={deletingLocationId === loc.id && deleteLocationMutation.isPending}
                            data-testid={`button-delete-location-${loc.id}`}
                          >
                            {deletingLocationId === loc.id && deleteLocationMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dialog crear/editar ubicación */}
            <Dialog open={locationDialogOpen} onOpenChange={(open) => {
              setLocationDialogOpen(open);
              if (!open) { setLocationEditing(null); setLocationForm(emptyLocationForm); }
            }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{locationEditing ? "Editar Ubicación" : "Nueva Ubicación"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="loc-name">Nombre *</Label>
                    <Input
                      id="loc-name"
                      value={locationForm.name}
                      onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                      placeholder="Ej: Plaza Central"
                      data-testid="input-location-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="loc-city">Ciudad</Label>
                      <Input
                        id="loc-city"
                        value={locationForm.city}
                        onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                        placeholder="Ej: Santo Domingo"
                        data-testid="input-location-city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loc-zone">Zona</Label>
                      <Input
                        id="loc-zone"
                        value={locationForm.zone}
                        onChange={(e) => setLocationForm({ ...locationForm, zone: e.target.value })}
                        placeholder="Ej: Zona Norte"
                        data-testid="input-location-zone"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loc-address">Dirección</Label>
                    <Input
                      id="loc-address"
                      value={locationForm.address}
                      onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                      placeholder="Calle, número, sector"
                      data-testid="input-location-address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="loc-contact-name">Contacto</Label>
                      <Input
                        id="loc-contact-name"
                        value={locationForm.contactName}
                        onChange={(e) => setLocationForm({ ...locationForm, contactName: e.target.value })}
                        placeholder="Nombre del contacto"
                        data-testid="input-location-contact-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loc-contact-phone">Teléfono</Label>
                      <Input
                        id="loc-contact-phone"
                        value={locationForm.contactPhone}
                        onChange={(e) => setLocationForm({ ...locationForm, contactPhone: e.target.value })}
                        placeholder="+1 (809) 000-0000"
                        data-testid="input-location-contact-phone"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loc-notes">Notas</Label>
                    <Textarea
                      id="loc-notes"
                      value={locationForm.notes}
                      onChange={(e) => setLocationForm({ ...locationForm, notes: e.target.value })}
                      placeholder="Información adicional..."
                      rows={3}
                      data-testid="input-location-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={handleSaveLocation}
                    disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
                    data-testid="button-save-location"
                  >
                    {(createLocationMutation.isPending || updateLocationMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {locationEditing ? "Guardar Cambios" : "Crear Ubicación"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {/* ===== TAB TIPOS DE MÁQUINA ===== */}
        {isTabAllowed("tipos_maquina") && (
          <TabsContent value="tipos_maquina">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Tipos de Máquina</CardTitle>
                    <CardDescription>
                      Gestiona los tipos de máquinas expendedoras disponibles
                    </CardDescription>
                  </div>
                  <Button onClick={openCreateMachineType} className="gap-2" data-testid="button-add-machine-type">
                    <Plus className="h-4 w-4" />
                    Nuevo Tipo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {machineTypesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Cargando tipos...</span>
                  </div>
                ) : machineTypesList.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Cpu className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No hay tipos de máquina registrados.</p>
                    <Button variant="outline" onClick={openCreateMachineType} data-testid="button-add-machine-type-empty">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar primer tipo
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {machineTypesList.map((mt, idx) => (
                      <div
                        key={mt.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-4"
                        data-testid={`row-machine-type-${mt.id}`}
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" data-testid={`text-machine-type-name-${mt.id}`}>{mt.name}</span>
                            <Badge
                              variant={mt.isActive ? "default" : "secondary"}
                              className="text-xs"
                              data-testid={`badge-machine-type-status-${mt.id}`}
                            >
                              {mt.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{mt.value}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => reorderMachineTypeMutation.mutate({ id: mt.id, direction: "up" })}
                            disabled={idx === 0 || reorderMachineTypeMutation.isPending}
                            title="Mover arriba"
                            data-testid={`button-move-up-machine-type-${mt.id}`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => reorderMachineTypeMutation.mutate({ id: mt.id, direction: "down" })}
                            disabled={idx === machineTypesList.length - 1 || reorderMachineTypeMutation.isPending}
                            title="Mover abajo"
                            data-testid={`button-move-down-machine-type-${mt.id}`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleMachineTypeMutation.mutate(mt.id)}
                            disabled={toggleMachineTypeMutation.isPending}
                            title={mt.isActive ? "Desactivar" : "Activar"}
                            data-testid={`button-toggle-machine-type-${mt.id}`}
                          >
                            {mt.isActive ? (
                              <PowerOff className="h-4 w-4 text-destructive" />
                            ) : (
                              <Power className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditMachineType(mt)}
                            data-testid={`button-edit-machine-type-${mt.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setDeletingMachineTypeId(mt.id);
                              deleteMachineTypeMutation.mutate(mt.id);
                            }}
                            disabled={deletingMachineTypeId === mt.id && deleteMachineTypeMutation.isPending}
                            data-testid={`button-delete-machine-type-${mt.id}`}
                          >
                            {deletingMachineTypeId === mt.id && deleteMachineTypeMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dialog crear/editar tipo de máquina */}
            <Dialog open={machineTypeDialogOpen} onOpenChange={(open) => {
              setMachineTypeDialogOpen(open);
              if (!open) {
                setMachineTypeEditing(null);
                setMachineTypeForm(emptyMachineTypeForm);
                setMachineTypeValueEdited(false);
              }
            }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{machineTypeEditing ? "Editar Tipo de Máquina" : "Nuevo Tipo de Máquina"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="mt-name">Nombre *</Label>
                    <Input
                      id="mt-name"
                      value={machineTypeForm.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setMachineTypeForm((prev) => ({
                          name: newName,
                          value: (!machineTypeEditing && !machineTypeValueEdited)
                            ? slugify(newName)
                            : prev.value,
                        }));
                      }}
                      placeholder="Ej: Bebidas Frías"
                      autoFocus
                      data-testid="input-machine-type-name"
                    />
                  </div>
                  {!machineTypeEditing && (
                    <div className="space-y-2">
                      <Label htmlFor="mt-value">
                        Identificador
                        {!machineTypeValueEdited && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">(generado automáticamente)</span>
                        )}
                      </Label>
                      <Input
                        id="mt-value"
                        value={machineTypeForm.value}
                        onChange={(e) => {
                          const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                          setMachineTypeValueEdited(true);
                          setMachineTypeForm((prev) => ({ ...prev, value: sanitized }));
                        }}
                        placeholder="bebidas_frias"
                        data-testid="input-machine-type-value"
                      />
                      <p className="text-xs text-muted-foreground">
                        Solo letras minúsculas, números y guión bajo. No se podrá cambiar una vez creado.
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMachineTypeDialogOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={handleSaveMachineType}
                    disabled={createMachineTypeMutation.isPending || updateMachineTypeMutation.isPending}
                    data-testid="button-save-machine-type"
                  >
                    {(createMachineTypeMutation.isPending || updateMachineTypeMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {machineTypeEditing ? "Guardar Cambios" : "Crear Tipo"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                    <Button variant="outline" disabled data-testid="button-setup-2fa">Configurar 2FA</Button>
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
