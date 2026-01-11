import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  login: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  logout: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function SuperAdminAuditPage() {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterResource, setFilterResource] = useState<string>("all");

  const { data: auditLogs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/super-admin/audit-logs"],
  });

  const uniqueActions = Array.from(new Set(auditLogs.map(log => log.action)));
  const uniqueResources = Array.from(new Set(auditLogs.map(log => log.resourceType)));

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(search.toLowerCase()) ||
      log.resourceId?.toLowerCase().includes(search.toLowerCase()) ||
      log.ipAddress?.toLowerCase().includes(search.toLowerCase());
    
    const matchesAction = filterAction === "all" || log.action === filterAction;
    const matchesResource = filterResource === "all" || log.resourceType === filterResource;
    
    return matchesSearch && matchesAction && matchesResource;
  });

  const getActionBadgeClass = (action: string) => {
    const baseAction = action.split("_")[0].toLowerCase();
    return actionColors[baseAction] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  return (
    <div className="p-6 space-y-6" data-testid="super-admin-audit-page">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Activity className="h-8 w-8 text-primary" />
          Log de Auditoría
        </h1>
        <p className="text-muted-foreground">Historial de todas las acciones realizadas en la plataforma</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Registros de Auditoría</CardTitle>
              <CardDescription>{filteredLogs.length} registros encontrados</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                  data-testid="input-search-audit"
                />
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-40" data-testid="select-filter-action">
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterResource} onValueChange={setFilterResource}>
                <SelectTrigger className="w-40" data-testid="select-filter-resource">
                  <SelectValue placeholder="Recurso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los recursos</SelectItem>
                  {uniqueResources.map(resource => (
                    <SelectItem key={resource} value={resource}>
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>ID Recurso</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay registros de auditoría</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionBadgeClass(log.action)} variant="secondary">
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.resourceType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.resourceId ? log.resourceId.substring(0, 8) + "..." : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ipAddress || "-"}
                      </TableCell>
                      <TableCell>
                        {log.details ? (
                          <span className="text-xs text-muted-foreground">
                            {JSON.stringify(log.details).substring(0, 50)}...
                          </span>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
