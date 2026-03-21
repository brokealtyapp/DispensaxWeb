import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataPagination } from "@/components/DataPagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Building2,
  Box,
  Percent,
  UserPlus,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateShort, formatCurrency } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

interface Machine {
  id: string;
  code: string;
  name: string;
  location: string;
}

interface MachineAssignment {
  id: string;
  machineId: string;
  commissionPercent: number;
  machine?: Machine;
}

interface EstablishmentViewer {
  id: string;
  userId: string;
  establishmentName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  defaultCommissionPercent: number | string;
  isActive: boolean;
  createdAt: string;
  assignments?: MachineAssignment[];
  user?: {
    id: string;
    fullName: string;
    email: string;
    username: string;
  };
}

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  establishmentName: z.string().min(2, "El nombre del establecimiento es requerido"),
  contactName: z.string().min(2, "El nombre de contacto es requerido"),
  phone: z.string().optional(),
  commissionPercent: z.coerce.number().min(0).max(100).default(5),
  machineIds: z.array(z.string()).min(1, "Selecciona al menos una máquina"),
});

const editSchema = z.object({
  establishmentName: z.string().min(2, "El nombre del establecimiento es requerido"),
  contactName: z.string().min(2, "El nombre de contacto es requerido"),
  contactPhone: z.string().optional(),
  defaultCommissionPercent: z.coerce.number().min(0).max(100),
  isActive: z.boolean(),
});

type InviteFormData = z.infer<typeof inviteSchema>;
type EditFormData = z.infer<typeof editSchema>;

export default function EstablishmentViewersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedViewer, setSelectedViewer] = useState<EstablishmentViewer | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);

  const { data: viewers = [], isLoading } = useQuery<EstablishmentViewer[]>({
    queryKey: ["/api/establishment-viewers"],
  });

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });

  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      establishmentName: "",
      contactName: "",
      phone: "",
      commissionPercent: 5,
      machineIds: [],
    },
  });

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      establishmentName: "",
      contactName: "",
      contactPhone: "",
      defaultCommissionPercent: 5,
      isActive: true,
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      return apiRequest("POST", "/api/viewer-invites", {
        email: data.email,
        establishmentName: data.establishmentName,
        contactName: data.contactName,
        phone: data.phone,
        machineIds: data.machineIds,
        commissionPercent: String(data.commissionPercent),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishment-viewers"] });
      setInviteOpen(false);
      inviteForm.reset();
      toast({ title: "Invitación enviada exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al enviar invitación", 
        description: error.message || "Intenta nuevamente",
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EditFormData> }) => {
      return apiRequest("PATCH", `/api/establishment-viewers/${id}`, {
        ...data,
        defaultCommissionPercent: data.defaultCommissionPercent !== undefined ? String(data.defaultCommissionPercent) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishment-viewers"] });
      setEditOpen(false);
      setSelectedViewer(null);
      toast({ title: "Visor actualizado exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al actualizar visor", 
        description: error.message || "Intenta nuevamente",
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/establishment-viewers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishment-viewers"] });
      setDeleteOpen(false);
      setSelectedViewer(null);
      toast({ title: "Visor eliminado exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al eliminar visor", 
        description: error.message || "Intenta nuevamente",
        variant: "destructive" 
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ viewerId, machineIds }: { viewerId: string; machineIds: string[] }) => {
      return apiRequest("POST", `/api/establishment-viewers/${viewerId}/assignments`, { machineIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishment-viewers"] });
      setAssignOpen(false);
      setSelectedMachines([]);
      toast({ title: "Máquinas asignadas exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al asignar máquinas", 
        description: error.message || "Intenta nuevamente",
        variant: "destructive" 
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async ({ viewerId, assignmentId }: { viewerId: string; assignmentId: string }) => {
      return apiRequest("DELETE", `/api/establishment-viewers/${viewerId}/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishment-viewers"] });
      toast({ title: "Máquina desasignada exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al desasignar máquina", 
        description: error.message || "Intenta nuevamente",
        variant: "destructive" 
      });
    },
  });

  const filteredViewers = useMemo(() => {
    let result = [...viewers];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(viewer =>
        viewer.establishmentName.toLowerCase().includes(query) ||
        (viewer.contactName || "").toLowerCase().includes(query) ||
        (viewer.user?.email || viewer.contactEmail || "").toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter(viewer => viewer.isActive === isActive);
    }
    
    return result;
  }, [viewers, searchQuery, statusFilter]);

  const paginatedViewers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredViewers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredViewers, currentPage]);

  const totalPages = Math.ceil(filteredViewers.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleOpenInvite = () => {
    inviteForm.reset();
    setInviteOpen(true);
  };

  const handleOpenEdit = (viewer: EstablishmentViewer) => {
    setSelectedViewer(viewer);
    editForm.reset({
      establishmentName: viewer.establishmentName,
      contactName: viewer.contactName || "",
      contactPhone: viewer.contactPhone || "",
      defaultCommissionPercent: parseFloat(String(viewer.defaultCommissionPercent || "5")),
      isActive: viewer.isActive,
    });
    setEditOpen(true);
  };

  const handleOpenDelete = (viewer: EstablishmentViewer) => {
    setSelectedViewer(viewer);
    setDeleteOpen(true);
  };

  const handleOpenAssign = (viewer: EstablishmentViewer) => {
    setSelectedViewer(viewer);
    setSelectedMachines([]);
    setAssignOpen(true);
  };

  const handleInviteSubmit = (data: InviteFormData) => {
    inviteMutation.mutate(data);
  };

  const handleEditSubmit = (data: EditFormData) => {
    if (selectedViewer) {
      updateMutation.mutate({ id: selectedViewer.id, data });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedViewer) {
      deleteMutation.mutate(selectedViewer.id);
    }
  };

  const handleAssignSubmit = () => {
    if (selectedViewer && selectedMachines.length > 0) {
      assignMutation.mutate({ viewerId: selectedViewer.id, machineIds: selectedMachines });
    }
  };

  const handleUnassign = (viewerId: string, assignmentId: string) => {
    unassignMutation.mutate({ viewerId, assignmentId });
  };

  const getAssignedMachineIds = (viewer: EstablishmentViewer): string[] => {
    return viewer.assignments?.map(a => a.machineId) || [];
  };

  const getAvailableMachines = (viewer: EstablishmentViewer) => {
    const assignedIds = getAssignedMachineIds(viewer);
    return machines.filter(m => !assignedIds.includes(m.id));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Visores de Establecimiento</h1>
          <p className="text-muted-foreground">Gestiona los usuarios externos que pueden ver las ventas de sus máquinas</p>
        </div>
        <Button onClick={handleOpenInvite} data-testid="button-invite-viewer">
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar Visor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por establecimiento, contacto o email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Establecimiento</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Máquinas</TableHead>
                  <TableHead className="text-center">Comisión %</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedViewers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery || statusFilter !== "all" 
                        ? "No se encontraron visores con los filtros aplicados"
                        : "No hay visores registrados. Invita al primero."
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedViewers.map((viewer) => (
                    <Collapsible key={viewer.id} asChild open={expandedRows.has(viewer.id)}>
                      <>
                        <TableRow 
                          className="cursor-pointer hover-elevate"
                          data-testid={`row-viewer-${viewer.id}`}
                        >
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleRow(viewer.id)}
                                data-testid={`button-expand-${viewer.id}`}
                              >
                                {expandedRows.has(viewer.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{viewer.establishmentName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{viewer.contactName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {viewer.user?.email || viewer.contactEmail || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              {viewer.assignments?.length || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Percent className="h-3 w-3 text-muted-foreground" />
                              {viewer.defaultCommissionPercent}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={viewer.isActive ? "default" : "secondary"}>
                              {viewer.isActive ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" /> Activo</>
                              ) : (
                                <><XCircle className="h-3 w-3 mr-1" /> Inactivo</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAssign(viewer);
                                }}
                                data-testid={`button-assign-${viewer.id}`}
                              >
                                <Box className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(viewer);
                                }}
                                data-testid={`button-edit-${viewer.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDelete(viewer);
                                }}
                                data-testid={`button-delete-${viewer.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">Máquinas Asignadas</h4>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenAssign(viewer)}
                                    data-testid={`button-add-machine-${viewer.id}`}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Agregar Máquina
                                  </Button>
                                </div>
                                {viewer.assignments && viewer.assignments.length > 0 ? (
                                  <div className="grid gap-2">
                                    {viewer.assignments.map((assignment) => (
                                      <div 
                                        key={assignment.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-background border"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Box className="h-4 w-4 text-primary" />
                                          <div>
                                            <p className="font-medium text-sm">
                                              {assignment.machine?.name || "Máquina"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {assignment.machine?.code} • {assignment.machine?.location}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Badge variant="outline">
                                            {assignment.commissionPercent}% comisión
                                          </Badge>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleUnassign(viewer.id, assignment.id)}
                                            data-testid={`button-unassign-${assignment.id}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground py-4 text-center">
                                    No hay máquinas asignadas a este visor
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredViewers.length > ITEMS_PER_PAGE && (
            <div className="mt-4">
              <DataPagination
                currentPage={currentPage}
                totalItems={filteredViewers.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invitar Visor de Establecimiento</DialogTitle>
            <DialogDescription>
              Envía una invitación para que un dueño de establecimiento pueda ver las ventas de sus máquinas
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit(handleInviteSubmit)} className="space-y-4">
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="correo@ejemplo.com" 
                        {...field} 
                        data-testid="input-invite-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="establishmentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Establecimiento</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Cafetería Central" 
                        {...field} 
                        data-testid="input-invite-establishment"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Contacto</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nombre completo" 
                        {...field} 
                        data-testid="input-invite-contact"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="809-555-0000" 
                        {...field} 
                        data-testid="input-invite-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="commissionPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comisión por Defecto (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        max={100} 
                        {...field} 
                        data-testid="input-invite-commission"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="machineIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máquinas a Asignar</FormLabel>
                    <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-2">
                      {machines.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No hay máquinas disponibles
                        </p>
                      ) : (
                        machines.map((machine) => (
                          <label
                            key={machine.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={field.value?.includes(machine.id)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, machine.id]);
                                } else {
                                  field.onChange(current.filter((id: string) => id !== machine.id));
                                }
                              }}
                              data-testid={`checkbox-machine-${machine.id}`}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{machine.name}</p>
                              <p className="text-xs text-muted-foreground">{machine.code} • {machine.location}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-submit-invite">
                  {inviteMutation.isPending ? "Enviando..." : "Enviar Invitación"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Visor</DialogTitle>
            <DialogDescription>
              Actualiza la información del visor de establecimiento
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="establishmentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Establecimiento</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-establishment" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Contacto</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-contact" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="defaultCommissionPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comisión por Defecto (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0} 
                        max={100} 
                        {...field} 
                        data-testid="input-edit-commission"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-edit-active"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Visor activo</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                  {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Máquinas</DialogTitle>
            <DialogDescription>
              Selecciona las máquinas que deseas asignar a {selectedViewer?.establishmentName}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-md max-h-64 overflow-y-auto p-2 space-y-2">
            {selectedViewer && getAvailableMachines(selectedViewer).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay máquinas disponibles para asignar
              </p>
            ) : (
              selectedViewer && getAvailableMachines(selectedViewer).map((machine) => (
                <label
                  key={machine.id}
                  className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                >
                  <Checkbox
                    checked={selectedMachines.includes(machine.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedMachines([...selectedMachines, machine.id]);
                      } else {
                        setSelectedMachines(selectedMachines.filter(id => id !== machine.id));
                      }
                    }}
                    data-testid={`checkbox-assign-${machine.id}`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{machine.name}</p>
                    <p className="text-xs text-muted-foreground">{machine.code} • {machine.location}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAssignSubmit} 
              disabled={selectedMachines.length === 0 || assignMutation.isPending}
              data-testid="button-submit-assign"
            >
              {assignMutation.isPending ? "Asignando..." : `Asignar (${selectedMachines.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar visor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a {selectedViewer?.establishmentName} y todas sus asignaciones de máquinas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { EstablishmentViewersPage };
