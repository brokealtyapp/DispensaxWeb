import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, Column } from "@/components/DataTable";
import { DataPagination } from "@/components/DataPagination";
import { StatsCard } from "@/components/StatsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import {
  Users,
  Clock,
  TrendingUp,
  UserPlus,
  Search,
  Calendar,
  Pencil,
  X,
  Filter,
  DollarSign,
  Palmtree,
  FileText,
  Plus,
  Check,
  XCircle,
  Eye,
  Star,
  Upload,
  Trash2,
} from "lucide-react";

interface Employee {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: string | number | null;
  status: string;
  notes: string | null;
  user?: { fullName: string; username: string };
}

interface PayrollRecord {
  id: string;
  userId: string;
  period: string;
  baseSalary: string | number;
  bonuses: string | number;
  deductions: string | number;
  netSalary: string | number;
  status: string;
  processedAt: string | null;
  user?: { fullName: string; username: string };
}

interface VacationRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  approvedBy: string | null;
  user?: { fullName: string; username: string };
  approver?: { fullName: string } | null;
}

interface PerformanceReview {
  id: string;
  userId: string;
  reviewerId: string;
  period: string;
  overallRating: string | number;
  productivity: string | number;
  quality: string | number;
  punctuality: string | number;
  teamwork: string | number;
  comments: string | null;
  user?: { fullName: string; username: string };
  reviewer?: { fullName: string };
}

interface EmployeeDocument {
  id: string;
  userId: string;
  type: string;
  name: string;
  url: string | null;
  expiresAt: string | null;
  user?: { fullName: string; username: string };
}

const employeeSchema = z.object({
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  role: z.string().min(1, "Selecciona un rol"),
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const editEmployeeSchema = z.object({
  fullName: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  role: z.string().min(1, "Selecciona un rol"),
  isActive: z.boolean().optional(),
});

const attendanceSchema = z.object({
  userId: z.string().min(1, "Selecciona un empleado"),
  date: z.string().min(1, "Fecha requerida"),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.string().min(1, "Selecciona un estado"),
  notes: z.string().optional(),
});

const payrollSchema = z.object({
  userId: z.string().min(1, "Selecciona un empleado"),
  period: z.string().min(1, "Periodo requerido"),
  baseSalary: z.coerce.number().min(0, "Salario inválido"),
  bonuses: z.coerce.number().min(0).default(0),
  deductions: z.coerce.number().min(0).default(0),
});

const vacationSchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().min(1, "Fecha de fin requerida"),
  reason: z.string().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, { message: "La fecha de fin debe ser posterior a la fecha de inicio", path: ["endDate"] });

const reviewSchema = z.object({
  userId: z.string().min(1, "Selecciona un empleado"),
  period: z.string().min(1, "Periodo requerido"),
  overallRating: z.coerce.number().min(1).max(5),
  productivity: z.coerce.number().min(1).max(5),
  quality: z.coerce.number().min(1).max(5),
  punctuality: z.coerce.number().min(1).max(5),
  teamwork: z.coerce.number().min(1).max(5),
  comments: z.string().optional(),
});

const documentSchema = z.object({
  userId: z.string().min(1, "Selecciona un empleado"),
  type: z.string().min(1, "Tipo requerido"),
  name: z.string().min(1, "Nombre requerido"),
  url: z.string().optional(),
  expiresAt: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;
type EditEmployeeFormData = z.infer<typeof editEmployeeSchema>;
type AttendanceFormData = z.infer<typeof attendanceSchema>;
type PayrollFormData = z.infer<typeof payrollSchema>;
type VacationFormData = z.infer<typeof vacationSchema>;
type ReviewFormData = z.infer<typeof reviewSchema>;
type DocumentFormData = z.infer<typeof documentSchema>;

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  abastecedor: "Abastecedor",
  almacen: "Almacén",
  contabilidad: "Contabilidad",
  rh: "Recursos Humanos",
};

const attendanceStatusLabels: Record<string, string> = {
  present: "Presente",
  presente: "Presente",
  absent: "Ausente",
  ausente: "Ausente",
  late: "Tardanza",
  tarde: "Tardanza",
  vacation: "Vacaciones",
  vacaciones: "Vacaciones",
  sick: "Enfermedad",
  enfermedad: "Enfermedad",
  permiso: "Permiso",
};

const payrollStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  processed: "Procesado",
  paid: "Pagado",
};

const vacationStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

const documentTypeLabels: Record<string, string> = {
  cedula: "Cédula",
  contrato: "Contrato",
  curriculum: "Currículum",
  certificado: "Certificado",
  licencia: "Licencia",
  otro: "Otro",
};

const ITEMS_PER_PAGE = 10;

export function HRPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeesPage, setEmployeesPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const [payrollPage, setPayrollPage] = useState(1);
  const [vacationsPage, setVacationsPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [documentsPage, setDocumentsPage] = useState(1);
  
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [isPayrollDialogOpen, setIsPayrollDialogOpen] = useState(false);
  const [isVacationDialogOpen, setIsVacationDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [editingReview, setEditingReview] = useState<PerformanceReview | null>(null);
  const [editingDocument, setEditingDocument] = useState<EmployeeDocument | null>(null);
  
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { fullName: "", email: "", phone: "", role: "", username: "", password: "" },
  });

  const editForm = useForm<EditEmployeeFormData>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: { fullName: "", email: "", phone: "", role: "", isActive: true },
  });

  const attendanceForm = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: { userId: "", date: "", checkIn: "", checkOut: "", status: "present", notes: "" },
  });

  const payrollForm = useForm<PayrollFormData>({
    resolver: zodResolver(payrollSchema),
    defaultValues: { userId: "", period: "", baseSalary: 0, bonuses: 0, deductions: 0 },
  });

  const vacationForm = useForm<VacationFormData>({
    resolver: zodResolver(vacationSchema),
    defaultValues: { userId: "", startDate: "", endDate: "", reason: "" },
  });

  const reviewForm = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { userId: "", period: "", overallRating: 3, productivity: 3, quality: 3, punctuality: 3, teamwork: 3, comments: "" },
  });

  const documentForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: { userId: "", type: "", name: "", url: "", expiresAt: "" },
  });

  const { data: employees, isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/hr/employees"],
  });

  const { data: attendanceRecords, isLoading: loadingAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/hr/attendance"],
  });

  const { data: payrollRecords, isLoading: loadingPayroll } = useQuery<PayrollRecord[]>({
    queryKey: ["/api/hr/payroll"],
  });

  const { data: vacationRequests, isLoading: loadingVacations } = useQuery<VacationRequest[]>({
    queryKey: ["/api/hr/vacations"],
  });

  const { data: performanceReviews, isLoading: loadingReviews } = useQuery<PerformanceReview[]>({
    queryKey: ["/api/hr/reviews"],
  });

  const { data: documents, isLoading: loadingDocuments } = useQuery<EmployeeDocument[]>({
    queryKey: ["/api/hr/documents"],
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => apiRequest("POST", "/api/hr/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      toast({ title: "Empleado creado correctamente" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => toast({ title: "Error al crear empleado", description: error.message, variant: "destructive" }),
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditEmployeeFormData }) => apiRequest("PATCH", `/api/hr/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      toast({ title: "Empleado actualizado correctamente" });
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
    },
    onError: (error: Error) => toast({ title: "Error al actualizar empleado", description: error.message, variant: "destructive" }),
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/hr/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/employees"] });
      toast({ title: "Empleado desactivado correctamente" });
      setDeletingEmployeeId(null);
    },
    onError: (error: Error) => toast({ title: "Error al desactivar empleado", description: error.message, variant: "destructive" }),
  });

  const createAttendanceMutation = useMutation({
    mutationFn: async (data: AttendanceFormData) => apiRequest("POST", "/api/hr/attendance", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance"] });
      toast({ title: "Registro de asistencia creado" });
      setIsAttendanceDialogOpen(false);
      attendanceForm.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AttendanceFormData> }) => apiRequest("PATCH", `/api/hr/attendance/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance"] });
      toast({ title: "Registro actualizado" });
      setIsAttendanceDialogOpen(false);
      setEditingAttendance(null);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/hr/attendance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/attendance"] });
      toast({ title: "Registro eliminado" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createPayrollMutation = useMutation({
    mutationFn: async (data: PayrollFormData) => apiRequest("POST", "/api/hr/payroll", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/payroll"] });
      toast({ title: "Nómina creada" });
      setIsPayrollDialogOpen(false);
      payrollForm.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updatePayrollMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PayrollFormData> }) => apiRequest("PATCH", `/api/hr/payroll/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/payroll"] });
      toast({ title: "Nómina actualizada" });
      setIsPayrollDialogOpen(false);
      setEditingPayroll(null);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const processPayrollMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/hr/payroll/${id}/process`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/payroll"] });
      toast({ title: "Nómina procesada" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createVacationMutation = useMutation({
    mutationFn: async (data: VacationFormData) => apiRequest("POST", "/api/hr/vacations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/vacations"] });
      toast({ title: "Solicitud de vacaciones creada" });
      setIsVacationDialogOpen(false);
      vacationForm.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const approveVacationMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/hr/vacations/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/vacations"] });
      toast({ title: "Vacaciones aprobadas" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const rejectVacationMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => apiRequest("POST", `/api/hr/vacations/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/vacations"] });
      toast({ title: "Vacaciones rechazadas" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createReviewMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => apiRequest("POST", "/api/hr/reviews", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reviews"] });
      toast({ title: "Evaluación creada" });
      setIsReviewDialogOpen(false);
      reviewForm.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateReviewMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReviewFormData> }) => apiRequest("PATCH", `/api/hr/reviews/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reviews"] });
      toast({ title: "Evaluación actualizada" });
      setIsReviewDialogOpen(false);
      setEditingReview(null);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/hr/reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/reviews"] });
      toast({ title: "Evaluación eliminada" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => apiRequest("POST", "/api/hr/documents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/documents"] });
      toast({ title: "Documento creado" });
      setIsDocumentDialogOpen(false);
      documentForm.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DocumentFormData> }) => apiRequest("PATCH", `/api/hr/documents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/documents"] });
      toast({ title: "Documento actualizado" });
      setIsDocumentDialogOpen(false);
      setEditingDocument(null);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/hr/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/documents"] });
      toast({ title: "Documento eliminado" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const openEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    editForm.reset({
      fullName: employee.fullName || "",
      email: employee.email || "",
      phone: employee.phone || "",
      role: employee.role,
      isActive: employee.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const openEditAttendance = (record: AttendanceRecord) => {
    setEditingAttendance(record);
    attendanceForm.reset({
      userId: record.userId,
      date: record.date,
      checkIn: record.checkIn || "",
      checkOut: record.checkOut || "",
      status: record.status,
      notes: record.notes || "",
    });
    setIsAttendanceDialogOpen(true);
  };

  const openEditPayroll = (record: PayrollRecord) => {
    setEditingPayroll(record);
    payrollForm.reset({
      userId: record.userId,
      period: record.period,
      baseSalary: Number(record.baseSalary) || 0,
      bonuses: Number(record.bonuses) || 0,
      deductions: Number(record.deductions) || 0,
    });
    setIsPayrollDialogOpen(true);
  };

  const openEditReview = (review: PerformanceReview) => {
    setEditingReview(review);
    reviewForm.reset({
      userId: review.userId,
      period: review.period,
      overallRating: Number(review.overallRating) || 3,
      productivity: Number(review.productivity) || 3,
      quality: Number(review.quality) || 3,
      punctuality: Number(review.punctuality) || 3,
      teamwork: Number(review.teamwork) || 3,
      comments: review.comments || "",
    });
    setIsReviewDialogOpen(true);
  };

  const openEditDocument = (doc: EmployeeDocument) => {
    setEditingDocument(doc);
    documentForm.reset({
      userId: doc.userId,
      type: doc.type,
      name: doc.name,
      url: doc.url || "",
      expiresAt: doc.expiresAt || "",
    });
    setIsDocumentDialogOpen(true);
  };

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter((emp) => {
      const matchesSearch = !searchQuery || 
        emp.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || emp.role === roleFilter;
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && emp.isActive) || 
        (statusFilter === "inactive" && !emp.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchQuery, roleFilter, statusFilter]);

  const paginatedEmployees = useMemo(() => {
    const start = (employeesPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEmployees, employeesPage]);

  const paginatedAttendance = useMemo(() => {
    const start = (attendancePage - 1) * ITEMS_PER_PAGE;
    return (attendanceRecords || []).slice(start, start + ITEMS_PER_PAGE);
  }, [attendanceRecords, attendancePage]);

  const paginatedPayroll = useMemo(() => {
    const start = (payrollPage - 1) * ITEMS_PER_PAGE;
    return (payrollRecords || []).slice(start, start + ITEMS_PER_PAGE);
  }, [payrollRecords, payrollPage]);

  const paginatedVacations = useMemo(() => {
    const start = (vacationsPage - 1) * ITEMS_PER_PAGE;
    return (vacationRequests || []).slice(start, start + ITEMS_PER_PAGE);
  }, [vacationRequests, vacationsPage]);

  const paginatedReviews = useMemo(() => {
    const start = (reviewsPage - 1) * ITEMS_PER_PAGE;
    return (performanceReviews || []).slice(start, start + ITEMS_PER_PAGE);
  }, [performanceReviews, reviewsPage]);

  const paginatedDocuments = useMemo(() => {
    const start = (documentsPage - 1) * ITEMS_PER_PAGE;
    return (documents || []).slice(start, start + ITEMS_PER_PAGE);
  }, [documents, documentsPage]);

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setEmployeesPage(1);
  };

  const hasActiveFilters = searchQuery || roleFilter !== "all" || statusFilter !== "all";

  const activeEmployees = (employees || []).filter((e) => e.isActive).length;
  const pendingVacations = (vacationRequests || []).filter((v) => v.status === "pending").length;
  const pendingPayroll = (payrollRecords || []).filter((p) => p.status === "pending").length;
  const avgRating = performanceReviews?.length
    ? (performanceReviews.reduce((acc, p) => acc + (Number(p.overallRating) || 0), 0) / performanceReviews.length).toFixed(1)
    : "0";

  const employeeColumns: Column<Employee>[] = [
    {
      key: "fullName",
      header: "Empleado",
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {(item.fullName || item.username).split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{item.fullName || item.username}</p>
            <p className="text-xs text-muted-foreground">{item.email || "-"}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Rol", render: (item) => <Badge variant="secondary">{roleLabels[item.role] || item.role}</Badge> },
    {
      key: "isActive",
      header: "Estado",
      render: (item) => (
        <Badge variant="secondary" className={item.isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}>
          {item.isActive ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    { key: "phone", header: "Teléfono", render: (item) => item.phone || "-" },
    {
      key: "id",
      header: "",
      render: (item) => {
        const showEdit = canEdit("employees");
        const showDelete = canDelete("employees") && item.isActive;
        if (!showEdit && !showDelete) return null;
        return (
          <div className="flex items-center gap-1">
            {showEdit && (
              <Button variant="ghost" size="icon" onClick={() => openEditEmployee(item)} data-testid={`button-edit-${item.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {showDelete && (
              <Button variant="ghost" size="icon" onClick={() => setDeletingEmployeeId(item.id)} className="text-destructive" data-testid={`button-delete-${item.id}`}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const attendanceColumns: Column<AttendanceRecord>[] = [
    { key: "date", header: "Fecha" },
    { key: "userId", header: "Empleado", render: (item) => item.user?.fullName || item.user?.username || "-" },
    { key: "checkIn", header: "Entrada", render: (item) => item.checkIn || "-" },
    { key: "checkOut", header: "Salida", render: (item) => item.checkOut || "-" },
    { key: "hoursWorked", header: "Horas", render: (item) => item.hoursWorked ? `${parseFloat(String(item.hoursWorked)).toFixed(1)}h` : "-" },
    {
      key: "status",
      header: "Estado",
      render: (item) => (
        <Badge variant="secondary" className={item.status === "present" ? "bg-emerald-500/10 text-emerald-500" : item.status === "absent" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}>
          {attendanceStatusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: "id",
      header: "",
      render: (item) => canEdit("attendance") ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditAttendance(item)} data-testid={`button-edit-attendance-${item.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          {canDelete("attendance") && (
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteAttendanceMutation.mutate(item.id)} data-testid={`button-delete-attendance-${item.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : null,
    },
  ];

  const payrollColumns: Column<PayrollRecord>[] = [
    { key: "period", header: "Periodo" },
    { key: "userId", header: "Empleado", render: (item) => item.user?.fullName || item.user?.username || "-" },
    { key: "baseSalary", header: "Salario Base", render: (item) => formatCurrency(item.baseSalary) },
    { key: "bonuses", header: "Bonos", render: (item) => formatCurrency(item.bonuses) },
    { key: "deductions", header: "Deducciones", render: (item) => formatCurrency(item.deductions) },
    { key: "netSalary", header: "Neto", render: (item) => <span className="font-semibold">{formatCurrency(item.netSalary)}</span> },
    {
      key: "status",
      header: "Estado",
      render: (item) => (
        <Badge variant="secondary" className={item.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : item.status === "processed" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"}>
          {payrollStatusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: "id",
      header: "",
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.status === "pending" && canEdit("payroll") && (
            <>
              <Button variant="ghost" size="icon" onClick={() => openEditPayroll(item)} data-testid={`button-edit-payroll-${item.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-emerald-500" onClick={() => processPayrollMutation.mutate(item.id)} data-testid={`button-process-payroll-${item.id}`}>
                <Check className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const vacationColumns: Column<VacationRequest>[] = [
    { key: "userId", header: "Empleado", render: (item) => item.user?.fullName || item.user?.username || "-" },
    { key: "startDate", header: "Inicio" },
    { key: "endDate", header: "Fin" },
    { key: "days", header: "Días" },
    { key: "reason", header: "Razón", render: (item) => item.reason || "-" },
    {
      key: "status",
      header: "Estado",
      render: (item) => (
        <Badge variant="secondary" className={item.status === "approved" ? "bg-emerald-500/10 text-emerald-500" : item.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}>
          {vacationStatusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: "id",
      header: "",
      render: (item) => item.status === "pending" && canEdit("vacations") ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-emerald-500" onClick={() => approveVacationMutation.mutate(item.id)} data-testid={`button-approve-vacation-${item.id}`}>
            <Check className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => rejectVacationMutation.mutate({ id: item.id, reason: "Solicitud rechazada" })} data-testid={`button-reject-vacation-${item.id}`}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ) : null,
    },
  ];

  const reviewColumns: Column<PerformanceReview>[] = [
    { key: "userId", header: "Empleado", render: (item) => item.user?.fullName || item.user?.username || "-" },
    { key: "period", header: "Periodo" },
    { key: "overallRating", header: "Calificación", render: (item) => (
      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
        <span>{item.overallRating}/5</span>
      </div>
    )},
    { key: "productivity", header: "Productividad", render: (item) => `${item.productivity}/5` },
    { key: "quality", header: "Calidad", render: (item) => `${item.quality}/5` },
    { key: "punctuality", header: "Puntualidad", render: (item) => `${item.punctuality}/5` },
    { key: "reviewerId", header: "Evaluador", render: (item) => item.reviewer?.fullName || "-" },
    {
      key: "id",
      header: "",
      render: (item) => canEdit("performance_reviews") ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditReview(item)} data-testid={`button-edit-review-${item.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          {canDelete("performance_reviews") && (
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteReviewMutation.mutate(item.id)} data-testid={`button-delete-review-${item.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : null,
    },
  ];

  const documentColumns: Column<EmployeeDocument>[] = [
    { key: "userId", header: "Empleado", render: (item) => item.user?.fullName || item.user?.username || "-" },
    { key: "type", header: "Tipo", render: (item) => <Badge variant="secondary">{documentTypeLabels[item.type] || item.type}</Badge> },
    { key: "name", header: "Nombre" },
    { key: "expiresAt", header: "Vence", render: (item) => item.expiresAt || "Sin vencimiento" },
    {
      key: "id",
      header: "",
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.url && (
            <Button variant="ghost" size="icon" asChild data-testid={`button-view-doc-${item.id}`}>
              <a href={item.url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a>
            </Button>
          )}
          {canEdit("employee_documents") && (
            <Button variant="ghost" size="icon" onClick={() => openEditDocument(item)} data-testid={`button-edit-doc-${item.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete("employee_documents") && (
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDocumentMutation.mutate(item.id)} data-testid={`button-delete-doc-${item.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Recursos Humanos</h1>
          <p className="text-muted-foreground">Gestión de personal, nómina, vacaciones y evaluaciones</p>
        </div>
        {canCreate("employees") && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-employee"><UserPlus className="h-4 w-4 mr-2" />Nuevo Empleado</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Empleado</DialogTitle>
                <DialogDescription>Ingresa los datos del nuevo empleado</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createEmployeeMutation.mutate(data))} className="space-y-4">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Ej: Juan Pérez" {...field} data-testid="input-fullname" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem><FormLabel>Usuario</FormLabel><FormControl><Input placeholder="jperez" {...field} data-testid="input-username" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="juan@dispensax.com" {...field} data-testid="input-email" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Teléfono (opcional)</FormLabel><FormControl><Input placeholder="555-1234" {...field} data-testid="input-phone" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" placeholder="••••••" {...field} data-testid="input-password" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-role"><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl>
                        <SelectContent>{Object.entries(roleLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}</SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createEmployeeMutation.isPending} data-testid="button-submit">{createEmployeeMutation.isPending ? "Agregando..." : "Agregar Empleado"}</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loadingEmployees ? (
          <>{[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-32" />))}</>
        ) : (
          <>
            <StatsCard title="Total Empleados" value={employees?.length || 0} subtitle={`${activeEmployees} activos`} icon={Users} iconColor="primary" />
            <StatsCard title="Nóminas Pendientes" value={pendingPayroll} subtitle="Por procesar" icon={DollarSign} iconColor="warning" />
            <StatsCard title="Vacaciones Pendientes" value={pendingVacations} subtitle="Por aprobar" icon={Palmtree} iconColor="purple" />
            <StatsCard title="Calificación Promedio" value={`${avgRating}/5`} subtitle="Evaluaciones" icon={TrendingUp} iconColor="success" />
          </>
        )}
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="personal" data-testid="tab-personal">Personal</TabsTrigger>
          <TabsTrigger value="asistencia" data-testid="tab-asistencia">Asistencia</TabsTrigger>
          <TabsTrigger value="nomina" data-testid="tab-nomina">Nómina</TabsTrigger>
          <TabsTrigger value="vacaciones" data-testid="tab-vacaciones">Vacaciones</TabsTrigger>
          <TabsTrigger value="evaluaciones" data-testid="tab-evaluaciones">Evaluaciones</TabsTrigger>
          <TabsTrigger value="documentos" data-testid="tab-documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar empleados..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-employees" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-role-filter"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Rol" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos los roles</SelectItem>{Object.entries(roleLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}</SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-status-filter"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem></SelectContent>
                </Select>
                {hasActiveFilters && (<Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters"><X className="h-4 w-4 mr-1" />Limpiar</Button>)}
              </div>
            </CardHeader>
            <CardContent>
              {loadingEmployees ? <Skeleton className="h-64 w-full" /> : (
                <>
                  <DataTable data={paginatedEmployees} columns={employeeColumns} searchPlaceholder="Buscar..." searchKeys={["fullName", "email", "username"]} />
                  <DataPagination currentPage={employeesPage} totalItems={filteredEmployees.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setEmployeesPage} className="mt-4" />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asistencia" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>Control de Asistencia</CardTitle>
              {canCreate("attendance") && (
                <Button onClick={() => { setEditingAttendance(null); attendanceForm.reset(); setIsAttendanceDialogOpen(true); }} data-testid="button-add-attendance">
                  <Plus className="h-4 w-4 mr-2" />Registrar Asistencia
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingAttendance ? <Skeleton className="h-64 w-full" /> : (
                <>
                  <DataTable data={paginatedAttendance} columns={attendanceColumns} searchPlaceholder="Buscar..." searchKeys={["date"]} />
                  <DataPagination currentPage={attendancePage} totalItems={(attendanceRecords || []).length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setAttendancePage} className="mt-4" />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nomina" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>Gestión de Nómina</CardTitle>
              {canCreate("payroll") && (
                <Button onClick={() => { setEditingPayroll(null); payrollForm.reset(); setIsPayrollDialogOpen(true); }} data-testid="button-add-payroll">
                  <Plus className="h-4 w-4 mr-2" />Nueva Nómina
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingPayroll ? <Skeleton className="h-64 w-full" /> : (
                <>
                  <DataTable data={paginatedPayroll} columns={payrollColumns} searchPlaceholder="Buscar..." searchKeys={["period"]} />
                  <DataPagination currentPage={payrollPage} totalItems={(payrollRecords || []).length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPayrollPage} className="mt-4" />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vacaciones" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>Solicitudes de Vacaciones</CardTitle>
              <Button onClick={() => { vacationForm.reset(); setIsVacationDialogOpen(true); }} data-testid="button-add-vacation">
                <Plus className="h-4 w-4 mr-2" />Solicitar Vacaciones
              </Button>
            </CardHeader>
            <CardContent>
              {loadingVacations ? <Skeleton className="h-64 w-full" /> : (
                <>
                  <DataTable data={paginatedVacations} columns={vacationColumns} searchPlaceholder="Buscar..." searchKeys={["reason"]} />
                  <DataPagination currentPage={vacationsPage} totalItems={(vacationRequests || []).length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setVacationsPage} className="mt-4" />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluaciones" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>Evaluaciones de Desempeño</CardTitle>
              {canCreate("performance_reviews") && (
                <Button onClick={() => { setEditingReview(null); reviewForm.reset(); setIsReviewDialogOpen(true); }} data-testid="button-add-review">
                  <Plus className="h-4 w-4 mr-2" />Nueva Evaluación
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingReviews ? <Skeleton className="h-64 w-full" /> : (
                <>
                  <DataTable data={paginatedReviews} columns={reviewColumns} searchPlaceholder="Buscar..." searchKeys={["period"]} />
                  <DataPagination currentPage={reviewsPage} totalItems={(performanceReviews || []).length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setReviewsPage} className="mt-4" />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>Documentos de Empleados</CardTitle>
              {canCreate("employee_documents") && (
                <Button onClick={() => { setEditingDocument(null); documentForm.reset(); setIsDocumentDialogOpen(true); }} data-testid="button-add-document">
                  <Upload className="h-4 w-4 mr-2" />Subir Documento
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingDocuments ? <Skeleton className="h-64 w-full" /> : (
                <>
                  <DataTable data={paginatedDocuments} columns={documentColumns} searchPlaceholder="Buscar..." searchKeys={["name", "type"]} />
                  <DataPagination currentPage={documentsPage} totalItems={(documents || []).length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setDocumentsPage} className="mt-4" />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Empleado</DialogTitle><DialogDescription>Modifica los datos del empleado</DialogDescription></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editingEmployee && updateEmployeeMutation.mutate({ id: editingEmployee.id, data }))} className="space-y-4">
              <FormField control={editForm.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} data-testid="input-edit-fullname" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} data-testid="input-edit-email" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} data-testid="input-edit-phone" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Rol</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(roleLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}</SelectContent></Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="isActive" render={({ field }) => (
                <FormItem><FormLabel>Estado</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "true")} value={field.value ? "true" : "false"}>
                    <FormControl><SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="true">Activo</SelectItem><SelectItem value="false">Inactivo</SelectItem></SelectContent></Select>
                <FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={updateEmployeeMutation.isPending} data-testid="button-save-edit">{updateEmployeeMutation.isPending ? "Guardando..." : "Guardar"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAttendance ? "Editar Asistencia" : "Registrar Asistencia"}</DialogTitle></DialogHeader>
          <Form {...attendanceForm}>
            <form onSubmit={attendanceForm.handleSubmit((data) => editingAttendance ? updateAttendanceMutation.mutate({ id: editingAttendance.id, data }) : createAttendanceMutation.mutate(data))} className="space-y-4">
              <FormField control={attendanceForm.control} name="userId" render={({ field }) => (
                <FormItem><FormLabel>Empleado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!editingAttendance}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger></FormControl>
                    <SelectContent>{(employees || []).filter(e => e.isActive).map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.fullName || emp.username}</SelectItem>))}</SelectContent></Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={attendanceForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Fecha</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={attendanceForm.control} name="checkIn" render={({ field }) => (<FormItem><FormLabel>Entrada</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={attendanceForm.control} name="checkOut" render={({ field }) => (<FormItem><FormLabel>Salida</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={attendanceForm.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(attendanceStatusLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}</SelectContent></Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={attendanceForm.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAttendanceDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createAttendanceMutation.isPending || updateAttendanceMutation.isPending}>{editingAttendance ? "Guardar" : "Registrar"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payroll Dialog */}
      <Dialog open={isPayrollDialogOpen} onOpenChange={setIsPayrollDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPayroll ? "Editar Nómina" : "Nueva Nómina"}</DialogTitle></DialogHeader>
          <Form {...payrollForm}>
            <form onSubmit={payrollForm.handleSubmit((data) => editingPayroll ? updatePayrollMutation.mutate({ id: editingPayroll.id, data }) : createPayrollMutation.mutate(data))} className="space-y-4">
              <FormField control={payrollForm.control} name="userId" render={({ field }) => (
                <FormItem><FormLabel>Empleado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!editingPayroll}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger></FormControl>
                    <SelectContent>{(employees || []).filter(e => e.isActive).map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.fullName || emp.username}</SelectItem>))}</SelectContent></Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={payrollForm.control} name="period" render={({ field }) => (<FormItem><FormLabel>Periodo</FormLabel><FormControl><Input placeholder="Ej: 2026-01" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={payrollForm.control} name="baseSalary" render={({ field }) => (<FormItem><FormLabel>Salario Base (RD$)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={payrollForm.control} name="bonuses" render={({ field }) => (<FormItem><FormLabel>Bonos (RD$)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={payrollForm.control} name="deductions" render={({ field }) => (<FormItem><FormLabel>Deducciones (RD$)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsPayrollDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createPayrollMutation.isPending || updatePayrollMutation.isPending}>{editingPayroll ? "Guardar" : "Crear"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Vacation Dialog */}
      <Dialog open={isVacationDialogOpen} onOpenChange={setIsVacationDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar Vacaciones</DialogTitle><DialogDescription>Completa los datos de la solicitud</DialogDescription></DialogHeader>
          <Form {...vacationForm}>
            <form onSubmit={vacationForm.handleSubmit((data) => createVacationMutation.mutate(data))} className="space-y-4">
              <FormField control={vacationForm.control} name="userId" render={({ field }) => (
                <FormItem><FormLabel>Empleado</FormLabel>
                  <div className="flex gap-2">
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger className="flex-1"><SelectValue placeholder="Para mí mismo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(employees || []).filter(e => e.isActive).map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.fullName || emp.username}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {field.value && (
                      <Button type="button" variant="outline" size="icon" onClick={() => field.onChange("")} data-testid="button-clear-employee">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                <FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={vacationForm.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Fecha Inicio</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={vacationForm.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>Fecha Fin</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={vacationForm.control} name="reason" render={({ field }) => (<FormItem><FormLabel>Razón (opcional)</FormLabel><FormControl><Textarea placeholder="Motivo de la solicitud" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsVacationDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createVacationMutation.isPending}>{createVacationMutation.isPending ? "Enviando..." : "Enviar Solicitud"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingReview ? "Editar Evaluación" : "Nueva Evaluación"}</DialogTitle></DialogHeader>
          <Form {...reviewForm}>
            <form onSubmit={reviewForm.handleSubmit((data) => editingReview ? updateReviewMutation.mutate({ id: editingReview.id, data }) : createReviewMutation.mutate(data))} className="space-y-4">
              <FormField control={reviewForm.control} name="userId" render={({ field }) => (
                <FormItem><FormLabel>Empleado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!editingReview}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger></FormControl>
                    <SelectContent>{(employees || []).filter(e => e.isActive).map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.fullName || emp.username}</SelectItem>))}</SelectContent></Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={reviewForm.control} name="period" render={({ field }) => (<FormItem><FormLabel>Periodo</FormLabel><FormControl><Input placeholder="Ej: Q4 2025" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={reviewForm.control} name="overallRating" render={({ field }) => (<FormItem><FormLabel>Calificación General (1-5)</FormLabel><FormControl><Input type="number" min={1} max={5} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={reviewForm.control} name="productivity" render={({ field }) => (<FormItem><FormLabel>Productividad (1-5)</FormLabel><FormControl><Input type="number" min={1} max={5} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={reviewForm.control} name="quality" render={({ field }) => (<FormItem><FormLabel>Calidad (1-5)</FormLabel><FormControl><Input type="number" min={1} max={5} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={reviewForm.control} name="punctuality" render={({ field }) => (<FormItem><FormLabel>Puntualidad (1-5)</FormLabel><FormControl><Input type="number" min={1} max={5} {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={reviewForm.control} name="teamwork" render={({ field }) => (<FormItem><FormLabel>Trabajo en Equipo (1-5)</FormLabel><FormControl><Input type="number" min={1} max={5} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={reviewForm.control} name="comments" render={({ field }) => (<FormItem><FormLabel>Comentarios</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsReviewDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createReviewMutation.isPending || updateReviewMutation.isPending}>{editingReview ? "Guardar" : "Crear"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Document Dialog */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDocument ? "Editar Documento" : "Subir Documento"}</DialogTitle></DialogHeader>
          <Form {...documentForm}>
            <form onSubmit={documentForm.handleSubmit((data) => editingDocument ? updateDocumentMutation.mutate({ id: editingDocument.id, data }) : createDocumentMutation.mutate(data))} className="space-y-4">
              <FormField control={documentForm.control} name="userId" render={({ field }) => (
                <FormItem><FormLabel>Empleado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!editingDocument}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger></FormControl>
                    <SelectContent>{(employees || []).filter(e => e.isActive).map((emp) => (<SelectItem key={emp.id} value={emp.id}>{emp.fullName || emp.username}</SelectItem>))}</SelectContent></Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={documentForm.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Tipo de Documento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(documentTypeLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}</SelectContent></Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={documentForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre del Documento</FormLabel><FormControl><Input placeholder="Ej: Cédula de identidad" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={documentForm.control} name="url" render={({ field }) => (<FormItem><FormLabel>URL del Documento (opcional)</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={documentForm.control} name="expiresAt" render={({ field }) => (<FormItem><FormLabel>Fecha de Vencimiento (opcional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending}>{editingDocument ? "Guardar" : "Subir"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingEmployeeId} onOpenChange={(open) => { if (!open) setDeletingEmployeeId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar empleado?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción desactivará al empleado. Podrás reactivarlo más tarde.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingEmployeeId && deleteEmployeeMutation.mutate(deletingEmployeeId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">Desactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
