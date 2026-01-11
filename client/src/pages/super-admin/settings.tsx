import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Shield, Bell, Mail, Database, Globe } from "lucide-react";

export function SuperAdminSettingsPage() {
  return (
    <div className="p-6 space-y-6" data-testid="super-admin-settings-page">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Settings className="h-8 w-8 text-primary" />
          Configuración de la Plataforma
        </h1>
        <p className="text-muted-foreground">Ajustes globales del sistema SaaS Dispensax</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Configuración General
            </CardTitle>
            <CardDescription>Ajustes generales de la plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform-name">Nombre de la Plataforma</Label>
              <Input id="platform-name" defaultValue="Dispensax" data-testid="input-platform-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-email">Email de Soporte</Label>
              <Input id="support-email" type="email" defaultValue="soporte@dispensax.com" data-testid="input-support-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-timezone">Zona Horaria por Defecto</Label>
              <Input id="default-timezone" defaultValue="America/Santo_Domingo" disabled data-testid="input-timezone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-currency">Moneda por Defecto</Label>
              <Input id="default-currency" defaultValue="DOP (Peso Dominicano)" disabled data-testid="input-currency" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
            </CardTitle>
            <CardDescription>Configuración de seguridad de la plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Autenticación de Dos Factores</Label>
                <p className="text-sm text-muted-foreground">Requerir 2FA para super administradores</p>
              </div>
              <Switch data-testid="switch-2fa" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Registro de Auditoría</Label>
                <p className="text-sm text-muted-foreground">Registrar todas las acciones administrativas</p>
              </div>
              <Switch defaultChecked data-testid="switch-audit" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Bloqueo por Intentos Fallidos</Label>
                <p className="text-sm text-muted-foreground">Bloquear cuenta después de 5 intentos fallidos</p>
              </div>
              <Switch defaultChecked data-testid="switch-lockout" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <CardDescription>Configuración de alertas y notificaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alertas de Nueva Empresa</Label>
                <p className="text-sm text-muted-foreground">Notificar cuando se registre una nueva empresa</p>
              </div>
              <Switch defaultChecked data-testid="switch-new-tenant-alert" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alertas de Suscripción</Label>
                <p className="text-sm text-muted-foreground">Notificar sobre vencimientos de suscripciones</p>
              </div>
              <Switch defaultChecked data-testid="switch-subscription-alert" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Reportes Semanales</Label>
                <p className="text-sm text-muted-foreground">Enviar resumen semanal de métricas</p>
              </div>
              <Switch data-testid="switch-weekly-report" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configuración de Email
            </CardTitle>
            <CardDescription>Ajustes del servidor de correo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">Servidor SMTP</Label>
              <Input id="smtp-host" defaultValue="Configurado" disabled data-testid="input-smtp-host" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-from">Email Remitente</Label>
              <Input id="smtp-from" defaultValue="noreply@dispensax.com" disabled data-testid="input-smtp-from" />
            </div>
            <div className="pt-2">
              <Button variant="outline" className="w-full" data-testid="button-test-email">
                Enviar Email de Prueba
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Mantenimiento
            </CardTitle>
            <CardDescription>Herramientas de mantenimiento del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-medium">Limpiar Cache</h4>
                <p className="text-sm text-muted-foreground">Limpiar la cache del sistema para liberar memoria</p>
                <Button variant="outline" size="sm" data-testid="button-clear-cache">
                  Limpiar Cache
                </Button>
              </div>
              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-medium">Respaldar Base de Datos</h4>
                <p className="text-sm text-muted-foreground">Crear un respaldo completo de la base de datos</p>
                <Button variant="outline" size="sm" data-testid="button-backup-db">
                  Crear Respaldo
                </Button>
              </div>
              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-medium">Logs del Sistema</h4>
                <p className="text-sm text-muted-foreground">Descargar logs de los últimos 30 días</p>
                <Button variant="outline" size="sm" data-testid="button-download-logs">
                  Descargar Logs
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
