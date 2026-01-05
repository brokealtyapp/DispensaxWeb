import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataPagination } from "@/components/DataPagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  Plus,
  UserCog,
  Shield,
  Truck,
  Package,
  Calculator,
  UserCheck,
  Edit,
  Trash2,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateShort } from "@/lib/utils";
import type { User } from "@shared/schema";

const ITEMS_PER_PAGE = 10;

const ROLES = [
  { value: "admin", label: "Administrador", icon: Shield, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "supervisor", label: "Supervisor", icon: Eye, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "abastecedor", label: "Abastecedor", icon: Truck, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "almacen", label: "Almacén", icon: Package, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "contabilidad", label: "Contabilidad", icon: Calculator, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "rh", label: "Recursos Humanos", icon: UserCheck, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
];

const ZONES = ["Zona Norte", "Zona Sur", "Zona Este", "Zona Oeste", "Centro", "Industrial"];

const createUserSchema = z.object({
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  fullName: z.string().min(2, "El nombre es requerido"),
  email: z.string().email("Email inválido").or(z.literal("")),
  phone: z.string().optional(),
  role: z.string().min(1, "Selecciona un rol"),
  assignedZone: z.string().optional(),
  isActive: z.boolean().default(true),
});

const editUserSchema = z.object({
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional().or(z.literal("")),
  fullName: z.string().min(2, "El nombre es requerido"),
  email: z.string().email("Email inválido").or(z.literal("")),
  phone: z.string().optional(),
  role: z.string().min(1, "Selecciona un rol"),
  assignedZone: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleInfo(role: string) {
  return ROLES.find(r => r.value === role) || ROLES[0];
}

export default function UsersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      email: "",
      phone: "",
      role: "abastecedor",
      assignedZone: "",
      isActive: true,
    },
  });

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      email: "",
      phone: "",
      role: "abastecedor",
      assignedZone: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreateOpen(false);
      createForm.reset();
      toast({ title: "Usuario creado exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al crear usuario", 
        description: error.message || "Intenta nuevamente",
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EditUserFormData> }) => {
      const cleanData = { ...data };
      if (!cleanData.password) delete cleanData.password;
      return apiRequest("PATCH", `/api/admin/users/${id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditOpen(false);
      setSelectedUser(null);
      toast({ title: "Usuario actualizado exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al actualizar usuario", 
        description: error.message || "Intenta nuevamente",
        variant: "destructive" 
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteOpen(false);
      setSelectedUser(null);
      toast({ title: "Estado del usuario actualizado" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al cambiar estado", 
        description: error.message || "Intenta nuevamente",
        variant: "destructive" 
      });
    },
  });

  const filteredUsers = useMemo(() => {
    let result = [...users];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.username.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
      );
    }
    
    if (roleFilter !== "all") {
      result = result.filter(user => user.role === roleFilter);
    }
    
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter(user => user.isActive === isActive);
    }
    
    return result;
  }, [users, searchQuery, roleFilter, statusFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const stats = useMemo(() => {
    const byRole: Record<string, number> = {};
    ROLES.forEach(r => byRole[r.value] = 0);
    
    let active = 0;
    let inactive = 0;
    
    users.forEach(user => {
      if (user.role) byRole[user.role] = (byRole[user.role] || 0) + 1;
      if (user.isActive) active++; else inactive++;
    });
    
    return { byRole, active, inactive, total: users.length };
  }, [users]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleOpenCreate = () => {
    createForm.reset();
    setCreateOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    editForm.reset({
      username: user.username,
      password: "",
      fullName: user.fullName || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "abastecedor",
      assignedZone: user.assignedZone || "",
      isActive: user.isActive ?? true,
    });
    setEditOpen(true);
  };

  const handleOpenDelete = (user: User) => {
    setSelectedUser(user);
    setDeleteOpen(true);
  };

  const handleCreateSubmit = (data: CreateUserFormData) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: EditUserFormData) => {
    if (selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, data });
    }
  };

  const handleToggleStatus = () => {
    if (selectedUser) {
      toggleStatusMutation.mutate({ id: selectedUser.id, isActive: !selectedUser.isActive });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <UserCog className="h-7 w-7 text-primary" />
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra todos los usuarios del sistema
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2" data-testid="button-create-user">
          <Plus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {ROLES.map(role => {
          const Icon = role.icon;
          return (
            <Card key={role.value} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleRoleFilterChange(role.value)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${role.color.split(" ")[0]}`}>
                    <Icon className={`h-5 w-5 ${role.color.split(" ").slice(1).join(" ")}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid={`text-count-${role.value}`}>
                      {stats.byRole[role.value] || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">{role.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-users">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600" data-testid="text-active-users">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/10">
                <XCircle className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600" data-testid="text-inactive-users">{stats.inactive}</p>
                <p className="text-sm text-muted-foreground">Inactivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, usuario o email..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-role-filter">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {ROLES.map(role => (
              <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.map((user) => {
              const roleInfo = getRoleInfo(user.role || "abastecedor");
              const RoleIcon = roleInfo.icon;
              return (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(user.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.fullName || user.username}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`gap-1 ${roleInfo.color}`}>
                      <RoleIcon className="h-3 w-3" />
                      {roleInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.assignedZone ? (
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        {user.assignedZone}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {user.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{user.email}</span>
                        </div>
                      )}
                      {user.phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                      {!user.email && !user.phone && (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {user.isActive ? (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {user.createdAt ? formatDateShort(new Date(user.createdAt)) : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(user)}
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(user)}
                        data-testid={`button-toggle-status-${user.id}`}
                      >
                        {user.isActive ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay usuarios que mostrar</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {filteredUsers.length > ITEMS_PER_PAGE && (
        <DataPagination
          currentPage={currentPage}
          totalItems={filteredUsers.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Crea un nuevo usuario para el sistema
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez" {...field} data-testid="input-create-fullname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <FormControl>
                        <Input placeholder="jperez" {...field} data-testid="input-create-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} data-testid="input-create-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="juan@email.com" {...field} data-testid="input-create-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="809-555-1234" {...field} data-testid="input-create-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-create-role">
                            <SelectValue placeholder="Selecciona rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map(role => (
                            <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="assignedZone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zona</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-create-zone">
                            <SelectValue placeholder="Opcional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin zona</SelectItem>
                          {ZONES.map(zone => (
                            <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                  {createMutation.isPending ? "Creando..." : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica los datos de {selectedUser?.fullName || selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez" {...field} data-testid="input-edit-fullname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <FormControl>
                        <Input placeholder="jperez" {...field} data-testid="input-edit-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Dejar vacío para no cambiar" {...field} data-testid="input-edit-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="juan@email.com" {...field} data-testid="input-edit-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="809-555-1234" {...field} data-testid="input-edit-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-role">
                            <SelectValue placeholder="Selecciona rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map(role => (
                            <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="assignedZone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zona</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-zone">
                            <SelectValue placeholder="Opcional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin zona</SelectItem>
                          {ZONES.map(zone => (
                            <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedUser?.isActive ? "Desactivar Usuario" : "Activar Usuario"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.isActive
                ? `¿Estás seguro de desactivar a ${selectedUser?.fullName || selectedUser?.username}? El usuario no podrá acceder al sistema.`
                : `¿Estás seguro de reactivar a ${selectedUser?.fullName || selectedUser?.username}? El usuario podrá acceder al sistema nuevamente.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              className={selectedUser?.isActive ? "bg-destructive hover:bg-destructive/90" : "bg-green-600 hover:bg-green-700"}
              data-testid="button-confirm-toggle-status"
            >
              {toggleStatusMutation.isPending 
                ? "Procesando..." 
                : selectedUser?.isActive ? "Desactivar" : "Activar"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
