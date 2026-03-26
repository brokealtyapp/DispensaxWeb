import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  User,
  ArrowRight,
  FileText,
  MessageSquare,
  Upload,
  Download,
  Trash2,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  X,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const establishmentFormSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  businessType: z.string().default("otro"),
  status: z.string().default("activo"),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Email inválido").or(z.literal("")).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zone: z.string().optional(),
  gpsCoordinates: z.string().optional(),
  priority: z.string().default("media"),
  estimatedMachines: z.coerce.number().min(1).default(1),
  monthlyEstimatedSales: z.string().optional(),
  commissionPercent: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDate: z.string().optional(),
  notes: z.string().optional(),
  stageId: z.string().optional(),
  assignedUserId: z.string().optional(),
});

type EstablishmentFormValues = z.infer<typeof establishmentFormSchema>;

const followupFormSchema = z.object({
  type: z.string().default("nota"),
  content: z.string().min(1, "Contenido requerido"),
  nextAction: z.string().optional(),
  nextFollowupDate: z.string().optional(),
});

type FollowupFormValues = z.infer<typeof followupFormSchema>;

interface EstablishmentStageInfo {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number | null;
  isDefault: boolean | null;
  isConversionReady: boolean | null;
  isFinalStage: boolean | null;
  isActive: boolean | null;
}

interface EstablishmentWithRelations {
  id: string;
  tenantId: string;
  name: string;
  businessType: string | null;
  status: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  city: string | null;
  zone: string | null;
  gpsCoordinates: string | null;
  priority: string | null;
  estimatedMachines: number | null;
  monthlyEstimatedSales: string | null;
  commissionPercent: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  notes: string | null;
  stageId: string | null;
  assignedUserId: string | null;
  convertedToLocationId: string | null;
  convertedAt: string | null;
  isActive: boolean | null;
  createdAt: string | null;
  stage: EstablishmentStageInfo | null;
  assignedUser: { id: string; fullName: string | null } | null;
}

interface EstablishmentDocument {
  id: string;
  fileName: string;
  originalName: string | null;
  fileKey: string;
  fileSize: number | null;
  mimeType: string | null;
  documentType: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string | null;
  uploadedBy?: { fullName: string | null };
}

interface EstablishmentFollowup {
  id: string;
  type: string | null;
  content: string;
  nextAction: string | null;
  nextFollowupDate: string | null;
  createdAt: string | null;
  user?: { fullName: string | null };
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; className: string }> = {
    alta: { label: "Alta", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    media: { label: "Media", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    baja: { label: "Baja", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  };
  const c = config[priority] || config.media;
  return <Badge variant="secondary" className={c.className}>{c.label}</Badge>;
}

function StageBadge({ stage }: { stage: EstablishmentStageInfo | null }) {
  if (!stage) return null;
  return (
    <Badge
      variant="secondary"
      className="border"
      style={{ borderColor: stage.color, color: stage.color }}
    >
      {stage.name}
    </Badge>
  );
}

function DocumentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pendiente: { label: "Pendiente", className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
    enviado: { label: "Enviado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    recibido: { label: "Recibido", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    firmado: { label: "Firmado", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    rechazado: { label: "Rechazado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };
  const c = config[status] || config.pendiente;
  return <Badge variant="secondary" className={`text-xs ${c.className}`}>{c.label}</Badge>;
}

function EstablishmentDetail({
  establishment,
  stages,
  onClose,
  onStageChange,
  canEdit,
  canCreate,
  canApprove,
}: {
  establishment: EstablishmentWithRelations;
  stages: EstablishmentStageInfo[];
  onClose: () => void;
  onStageChange: () => void;
  canEdit: boolean;
  canCreate: boolean;
  canApprove: boolean;
}) {
  const { toast } = useToast();
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("contrato");

  const { data: followups = [], isLoading: loadingFollowups } = useQuery<EstablishmentFollowup[]>({
    queryKey: ["/api/establishments", establishment.id, "followups"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/establishments/${establishment.id}/followups`);
      return res.json();
    },
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery<EstablishmentDocument[]>({
    queryKey: ["/api/establishments", establishment.id, "documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/establishments/${establishment.id}/documents`);
      return res.json();
    },
  });

  const followupForm = useForm<FollowupFormValues>({
    resolver: zodResolver(followupFormSchema),
    defaultValues: { type: "nota", content: "", nextFollowupDate: "" },
  });

  const createFollowupMutation = useMutation({
    mutationFn: async (data: FollowupFormValues) => {
      return apiRequest("POST", `/api/establishments/${establishment.id}/followups`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "followups"] });
      followupForm.reset();
      setShowFollowupForm(false);
      toast({ title: "Seguimiento agregado" });
    },
    onError: () => toast({ title: "Error al crear seguimiento", variant: "destructive" }),
  });

  const stageMoveMutation = useMutation({
    mutationFn: async (stageId: string) => {
      return apiRequest("PATCH", `/api/establishments/${establishment.id}/stage`, { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments"] });
      onStageChange();
      toast({ title: "Etapa actualizada" });
    },
    onError: () => toast({ title: "Error al cambiar etapa", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/establishments/${establishment.id}/convert`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments"] });
      onStageChange();
      toast({ title: "Establecimiento convertido a ubicación activa" });
    },
    onError: () => toast({ title: "Error al convertir", variant: "destructive" }),
  });

  const updateDocStatusMutation = useMutation({
    mutationFn: async ({ docId, status }: { docId: string; status: string }) => {
      return apiRequest("PATCH", `/api/establishments/${establishment.id}/documents/${docId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "documents"] });
      toast({ title: "Estado del documento actualizado" });
    },
    onError: () => toast({ title: "Error al actualizar estado", variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest("DELETE", `/api/establishments/${establishment.id}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "documents"] });
      toast({ title: "Documento eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar documento", variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", selectedDocType);
      const res = await fetch(`/api/establishments/${establishment.id}/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "documents"] });
      toast({ title: "Documento subido" });
    } catch {
      toast({ title: "Error al subir archivo", variant: "destructive" });
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (doc: EstablishmentDocument) => {
    try {
      const res = await apiRequest("GET", `/api/establishments/${establishment.id}/documents/${doc.id}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error al descargar", variant: "destructive" });
    }
  };

  const currentStageIndex = stages.findIndex(s => s.id === establishment.stageId);
  const nextStage = currentStageIndex >= 0 && currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1] : null;
  const isConverted = !!establishment.convertedToLocationId;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">{establishment.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StageBadge stage={establishment.stage} />
            <PriorityBadge priority={establishment.priority || "media"} />
            {isConverted && <Badge className="bg-green-600 text-white">Convertido</Badge>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && nextStage && !isConverted && (
            <Button
              size="sm"
              onClick={() => stageMoveMutation.mutate(nextStage.id)}
              disabled={stageMoveMutation.isPending}
              data-testid="button-advance-stage"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Avanzar a {nextStage.name}
            </Button>
          )}
          {canApprove && !isConverted && establishment.stage?.isConversionReady && (
            <Button
              size="sm"
              variant="default"
              className="bg-green-600"
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
              data-testid="button-convert-establishment"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Convertir a Activo
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-detail">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((s, i) => {
          const isCurrent = s.id === establishment.stageId;
          const isPast = i < currentStageIndex;
          return (
            <div key={s.id} className="flex items-center">
              <button
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isCurrent
                    ? "text-white"
                    : isPast
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/50 text-muted-foreground/60"
                }`}
                style={isCurrent ? { backgroundColor: s.color } : undefined}
                onClick={() => canEdit && !isConverted && stageMoveMutation.mutate(s.id)}
                disabled={!canEdit || isConverted || stageMoveMutation.isPending}
                data-testid={`button-stage-${s.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {s.name}
              </button>
              {i < stages.length - 1 && <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground/40" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Información de Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {establishment.contactName && (
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{establishment.contactName}</div>
            )}
            {establishment.contactPhone && (
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{establishment.contactPhone}</div>
            )}
            {establishment.contactEmail && (
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{establishment.contactEmail}</div>
            )}
            {establishment.address && (
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{establishment.address}{establishment.city ? `, ${establishment.city}` : ""}</div>
            )}
            {establishment.zone && (
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />Zona: {establishment.zone}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Datos Comerciales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Máquinas estimadas: {establishment.estimatedMachines || 1}
            </div>
            {establishment.monthlyEstimatedSales && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Ventas mensuales est.: RD$ {Number(establishment.monthlyEstimatedSales).toLocaleString()}
              </div>
            )}
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Comisión: {establishment.commissionPercent || "5.00"}%
            </div>
            {establishment.nextAction && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Próxima acción: {establishment.nextAction}
                {establishment.nextActionDate && (
                  <span className="text-muted-foreground">
                    ({new Date(establishment.nextActionDate).toLocaleDateString("es-DO")})
                  </span>
                )}
              </div>
            )}
            {establishment.assignedUser && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Asignado a: {establishment.assignedUser.fullName}
              </div>
            )}
            {establishment.notes && (
              <div className="pt-2 border-t text-muted-foreground">{establishment.notes}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="followups">
        <TabsList>
          <TabsTrigger value="followups" data-testid="tab-followups">
            <MessageSquare className="h-4 w-4 mr-1" /> Seguimientos ({followups.length})
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-1" /> Documentos ({documents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="followups" className="space-y-3">
          {canCreate && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowFollowupForm(!showFollowupForm)} data-testid="button-add-followup">
                <Plus className="h-4 w-4 mr-1" /> Agregar Seguimiento
              </Button>
            </div>
          )}

          {showFollowupForm && (
            <Card>
              <CardContent className="pt-4">
                <Form {...followupForm}>
                  <form onSubmit={followupForm.handleSubmit((data) => createFollowupMutation.mutate(data))} className="space-y-3">
                    <FormField control={followupForm.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger data-testid="select-followup-type"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="nota">Nota</SelectItem>
                            <SelectItem value="llamada">Llamada</SelectItem>
                            <SelectItem value="visita">Visita</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="reunion">Reunión</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={followupForm.control} name="content" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contenido</FormLabel>
                        <FormControl><Textarea {...field} data-testid="input-followup-content" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={followupForm.control} name="nextAction" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Próxima Acción</FormLabel>
                        <FormControl><Input {...field} placeholder="Ej: Enviar propuesta, llamar para confirmar..." data-testid="input-followup-next-action" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={followupForm.control} name="nextFollowupDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Próxima Gestión</FormLabel>
                        <FormControl><Input type="date" {...field} data-testid="input-followup-date" /></FormControl>
                      </FormItem>
                    )} />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={createFollowupMutation.isPending} data-testid="button-save-followup">Guardar</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowFollowupForm(false)}>Cancelar</Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {loadingFollowups && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {followups.map((f: EstablishmentFollowup) => (
            <Card key={f.id}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{f.type}</Badge>
                    <span className="text-xs text-muted-foreground">{f.user?.fullName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {f.createdAt ? format(new Date(f.createdAt), "dd MMM yyyy HH:mm", { locale: es }) : ""}
                  </span>
                </div>
                <p className="mt-2 text-sm">{f.content}</p>
                {f.nextAction && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowRight className="h-3 w-3" /> Próxima acción: {f.nextAction}
                  </div>
                )}
                {f.nextFollowupDate && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Fecha próxima gestión: {format(new Date(f.nextFollowupDate), "dd MMM yyyy", { locale: es })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!loadingFollowups && followups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin seguimientos aún</p>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-3">
          {canCreate && (
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                <SelectTrigger className="w-[180px]" data-testid="select-doc-type">
                  <SelectValue placeholder="Tipo de documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="acuerdo">Acuerdo</SelectItem>
                  <SelectItem value="permiso">Permiso</SelectItem>
                  <SelectItem value="identificacion">Identificación</SelectItem>
                  <SelectItem value="factura">Factura</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
              <label>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} data-testid="input-file-upload" />
                <Button size="sm" asChild className="cursor-pointer" disabled={uploadingFile}>
                  <span><Upload className="h-4 w-4 mr-1" /> {uploadingFile ? "Subiendo..." : "Subir Documento"}</span>
                </Button>
              </label>
            </div>
          )}

          {loadingDocs && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {documents.map((doc: EstablishmentDocument) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 p-3 rounded-md border">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {doc.documentType && (
                      <Badge variant="outline" className="text-xs">{doc.documentType}</Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {doc.uploadedBy?.fullName} - {doc.createdAt ? format(new Date(doc.createdAt), "dd MMM yyyy", { locale: es }) : ""}
                      {doc.fileSize ? ` - ${(doc.fileSize / 1024).toFixed(0)} KB` : ""}
                    </p>
                    <DocumentStatusBadge status={doc.status || "pendiente"} />
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0 items-center">
                {canEdit && (
                  <Select
                    value={doc.status || "pendiente"}
                    onValueChange={(val) => updateDocStatusMutation.mutate({ docId: doc.id, status: val })}
                  >
                    <SelectTrigger className="w-[110px] h-7 text-xs" data-testid={`select-doc-status-${doc.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="recibido">Recibido</SelectItem>
                      <SelectItem value="firmado">Firmado</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} data-testid={`button-download-doc-${doc.id}`}>
                  <Download className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button variant="ghost" size="icon" onClick={() => deleteDocMutation.mutate(doc.id)} disabled={deleteDocMutation.isPending} data-testid={`button-delete-doc-${doc.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!loadingDocs && documents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin documentos aún</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function EstablishmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canCreate = can("establishments", "create");
  const canEdit = can("establishments", "edit");
  const canDelete = can("establishments", "delete");
  const canApprove = can("establishments", "approve");
  const [mainTab, setMainTab] = useState("en-proceso");
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterAssigned, setFilterAssigned] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentWithRelations | null>(null);
  const [editingEstablishment, setEditingEstablishment] = useState<EstablishmentWithRelations | null>(null);

  const { data: stages = [] } = useQuery<EstablishmentStageInfo[]>({
    queryKey: ["/api/establishment-stages"],
  });

  const { data: establishmentsResponse, isLoading } = useQuery<{ data: EstablishmentWithRelations[]; total: number; page: number; pageSize: number }>({
    queryKey: ["/api/establishments", { stageId: filterStage, priority: filterPriority, search, assignedUserId: filterAssigned }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStage && filterStage !== "__all__") params.set("stageId", filterStage);
      if (filterPriority && filterPriority !== "__all__") params.set("priority", filterPriority);
      if (filterAssigned && filterAssigned !== "__all__") params.set("assignedUserId", filterAssigned);
      if (search) params.set("search", search);
      const res = await apiRequest("GET", `/api/establishments?${params.toString()}`);
      return res.json();
    },
  });
  const establishments = establishmentsResponse?.data || [];

  const { data: stats } = useQuery<{ total: number; byStage: Record<string, number>; byPriority: Record<string, number>; converted: number }>({
    queryKey: ["/api/establishments/stats"],
  });

  const { data: adminUsers = [] } = useQuery<Array<{ id: string; fullName: string | null; isActive: boolean; role: string }>>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      return res.json();
    },
  });

  const createForm = useForm<EstablishmentFormValues>({
    resolver: zodResolver(establishmentFormSchema),
    defaultValues: {
      name: "", contactName: "", contactPhone: "", contactEmail: "", address: "",
      city: "", zone: "", gpsCoordinates: "", priority: "media", estimatedMachines: 1,
      monthlyEstimatedSales: "", commissionPercent: "5.00", nextAction: "", nextActionDate: "",
      notes: "", stageId: "", assignedUserId: "",
    },
  });

  const editForm = useForm<EstablishmentFormValues>({
    resolver: zodResolver(establishmentFormSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: EstablishmentFormValues) => {
      const payload: Record<string, string | number | undefined> = { ...data };
      if (!payload.contactEmail) delete payload.contactEmail;
      if (!payload.stageId) delete payload.stageId;
      if (!payload.assignedUserId || payload.assignedUserId === "__none__") delete payload.assignedUserId;
      if (!payload.monthlyEstimatedSales) delete payload.monthlyEstimatedSales;
      return apiRequest("POST", "/api/establishments", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/stats"] });
      setShowCreateDialog(false);
      createForm.reset();
      toast({ title: "Establecimiento creado" });
    },
    onError: () => toast({ title: "Error al crear establecimiento", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EstablishmentFormValues }) => {
      const payload: Record<string, string | number | undefined> = { ...data };
      if (!payload.contactEmail) delete payload.contactEmail;
      if (!payload.assignedUserId || payload.assignedUserId === "__none__") delete payload.assignedUserId;
      return apiRequest("PATCH", `/api/establishments/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/stats"] });
      setEditingEstablishment(null);
      toast({ title: "Establecimiento actualizado" });
    },
    onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/establishments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/stats"] });
      setSelectedEstablishment(null);
      toast({ title: "Establecimiento eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
  });

  const openEditDialog = (est: EstablishmentWithRelations) => {
    editForm.reset({
      name: est.name,
      businessType: est.businessType || "otro",
      status: est.status || "activo",
      contactName: est.contactName || "",
      contactPhone: est.contactPhone || "",
      contactEmail: est.contactEmail || "",
      address: est.address || "",
      city: est.city || "",
      zone: est.zone || "",
      gpsCoordinates: est.gpsCoordinates || "",
      priority: est.priority || "media",
      estimatedMachines: est.estimatedMachines || 1,
      monthlyEstimatedSales: est.monthlyEstimatedSales || "",
      commissionPercent: est.commissionPercent || "5.00",
      nextAction: est.nextAction || "",
      nextActionDate: est.nextActionDate ? est.nextActionDate.split("T")[0] : "",
      notes: est.notes || "",
      stageId: est.stageId || "",
      assignedUserId: est.assignedUserId || "",
    });
    setEditingEstablishment(est);
  };

  const EstablishmentFormFields = ({ form, isEdit = false }: { form: UseFormReturn<EstablishmentFormValues>; isEdit?: boolean }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem className="md:col-span-2">
          <FormLabel>Nombre del Establecimiento *</FormLabel>
          <FormControl><Input {...field} data-testid="input-establishment-name" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="businessType" render={({ field }) => (
        <FormItem>
          <FormLabel>Tipo de Negocio</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value || "otro"}>
            <FormControl><SelectTrigger data-testid="select-business-type"><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="restaurante">Restaurante</SelectItem>
              <SelectItem value="hotel">Hotel</SelectItem>
              <SelectItem value="oficina">Oficina</SelectItem>
              <SelectItem value="universidad">Universidad</SelectItem>
              <SelectItem value="hospital">Hospital</SelectItem>
              <SelectItem value="gimnasio">Gimnasio</SelectItem>
              <SelectItem value="centro_comercial">Centro Comercial</SelectItem>
              <SelectItem value="gasolinera">Gasolinera</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="contactName" render={({ field }) => (
        <FormItem>
          <FormLabel>Persona de Contacto</FormLabel>
          <FormControl><Input {...field} data-testid="input-contact-name" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="contactPhone" render={({ field }) => (
        <FormItem>
          <FormLabel>Teléfono</FormLabel>
          <FormControl><Input {...field} data-testid="input-contact-phone" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="contactEmail" render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl><Input type="email" {...field} data-testid="input-contact-email" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="address" render={({ field }) => (
        <FormItem>
          <FormLabel>Dirección</FormLabel>
          <FormControl><Input {...field} data-testid="input-address" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="city" render={({ field }) => (
        <FormItem>
          <FormLabel>Ciudad</FormLabel>
          <FormControl><Input {...field} data-testid="input-city" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="zone" render={({ field }) => (
        <FormItem>
          <FormLabel>Zona</FormLabel>
          <FormControl><Input {...field} data-testid="input-zone" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="priority" render={({ field }) => (
        <FormItem>
          <FormLabel>Prioridad</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl><SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="estimatedMachines" render={({ field }) => (
        <FormItem>
          <FormLabel>Máquinas Estimadas</FormLabel>
          <FormControl><Input type="number" min={1} {...field} data-testid="input-estimated-machines" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="monthlyEstimatedSales" render={({ field }) => (
        <FormItem>
          <FormLabel>Ventas Mensuales Est. (RD$)</FormLabel>
          <FormControl><Input type="number" step="0.01" {...field} data-testid="input-monthly-sales" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="commissionPercent" render={({ field }) => (
        <FormItem>
          <FormLabel>Comisión (%)</FormLabel>
          <FormControl><Input type="number" step="0.01" {...field} data-testid="input-commission" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="nextAction" render={({ field }) => (
        <FormItem>
          <FormLabel>Próxima acción</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
            <FormControl><SelectTrigger data-testid="select-next-action"><SelectValue placeholder="Seleccionar próxima acción" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="llamar">Llamar</SelectItem>
              <SelectItem value="visitar">Visitar</SelectItem>
              <SelectItem value="enviar_propuesta">Enviar propuesta</SelectItem>
              <SelectItem value="seguimiento">Seguimiento</SelectItem>
              <SelectItem value="negociar">Negociar</SelectItem>
              <SelectItem value="cerrar">Cerrar</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="nextActionDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Fecha próxima gestión</FormLabel>
          <FormControl><Input type="date" {...field} data-testid="input-next-action-date" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="stageId" render={({ field }) => (
        <FormItem>
          <FormLabel>Etapa</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl><SelectTrigger data-testid="select-stage"><SelectValue placeholder="Seleccionar etapa" /></SelectTrigger></FormControl>
            <SelectContent>
              {stages.map((s: EstablishmentStageInfo) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="assignedUserId" render={({ field }) => (
        <FormItem>
          <FormLabel>Asignar a</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl><SelectTrigger data-testid="select-assigned-user"><SelectValue placeholder="Sin asignar" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="__none__">Sin asignar</SelectItem>
              {adminUsers.filter((u) => u.isActive && (u.role === "admin" || u.role === "supervisor")).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="notes" render={({ field }) => (
        <FormItem className="md:col-span-2">
          <FormLabel>Notas</FormLabel>
          <FormControl><Textarea {...field} data-testid="input-notes" /></FormControl>
        </FormItem>
      )} />
    </div>
  );

  if (selectedEstablishment) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <EstablishmentDetail
          establishment={selectedEstablishment}
          stages={stages}
          onClose={() => setSelectedEstablishment(null)}
          canEdit={canEdit}
          canCreate={canCreate}
          canApprove={canApprove}
          onStageChange={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/establishments"] }).then(() => {
              const updated = establishments.find((e) => e.id === selectedEstablishment.id);
              if (updated) setSelectedEstablishment(updated);
              else setSelectedEstablishment(null);
            });
          }}
        />
      </div>
    );
  }

  const groupedByStage = stages.map((stage) => ({
    stage,
    items: establishments.filter((e) => e.stageId === stage.id),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Establecimientos</h1>
          <p className="text-sm text-muted-foreground">Pipeline CRM de prospectos y establecimientos en proceso</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-establishment">
            <Plus className="h-4 w-4 mr-1" /> Nuevo Establecimiento
          </Button>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold" data-testid="text-stat-total">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Prospectos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-green-600" data-testid="text-stat-converted">{stats.converted}</p>
              <p className="text-xs text-muted-foreground">Convertidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-red-600" data-testid="text-stat-high-priority">{stats.byPriority?.alta || 0}</p>
              <p className="text-xs text-muted-foreground">Prioridad Alta</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-blue-600" data-testid="text-stat-in-pipeline">{(stats.total || 0) - (stats.converted || 0)}</p>
              <p className="text-xs text-muted-foreground">En Pipeline</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, contacto o dirección..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-stage">
            <SelectValue placeholder="Todas las etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las etapas</SelectItem>
            {stages.map((s: EstablishmentStageInfo) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-priority">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAssigned} onValueChange={setFilterAssigned}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-assigned">
            <SelectValue placeholder="Responsable" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {adminUsers.filter((u) => u.isActive && (u.role === "admin" || u.role === "supervisor")).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.fullName || u.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="en-proceso" data-testid="tab-en-proceso">En Proceso</TabsTrigger>
          <TabsTrigger value="activos" data-testid="tab-activos">Activos</TabsTrigger>
        </TabsList>

        <TabsContent value="en-proceso">
          <Tabs defaultValue="pipeline">
            <TabsList className="mb-4">
              <TabsTrigger value="pipeline" data-testid="tab-pipeline">Vista Pipeline</TabsTrigger>
              <TabsTrigger value="list" data-testid="tab-list">Vista Lista</TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline">
              <div className="flex gap-4 overflow-x-auto pb-4">
                {groupedByStage.map(({ stage, items }) => (
                  <div key={stage.id} className="min-w-[280px] max-w-[320px] flex-shrink-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        <h3 className="text-sm font-semibold">{stage.name}</h3>
                      </div>
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {items.map((est: EstablishmentWithRelations) => (
                        <Card
                          key={est.id}
                          className="cursor-pointer hover-elevate"
                          onClick={() => setSelectedEstablishment(est)}
                          data-testid={`card-establishment-${est.id}`}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm leading-tight">{est.name}</p>
                              <PriorityBadge priority={est.priority || "media"} />
                            </div>
                            {est.contactName && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" /> {est.contactName}
                              </p>
                            )}
                            {est.address && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {est.address}
                              </p>
                            )}
                            {est.nextAction && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {est.nextAction}
                                {est.nextActionDate && ` (${new Date(est.nextActionDate).toLocaleDateString("es-DO")})`}
                              </p>
                            )}
                            {est.assignedUser && (
                              <p className="text-xs text-muted-foreground">
                                Asignado: {est.assignedUser.fullName}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      {items.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">Sin establecimientos</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="list">
              {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
              <div className="space-y-2">
                {establishments.map((est: EstablishmentWithRelations) => (
                  <Card
                    key={est.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedEstablishment(est)}
                    data-testid={`card-list-establishment-${est.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{est.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[est.contactName, est.address, est.city].filter(Boolean).join(" - ")}
                            </p>
                            {est.nextAction && (
                              <p className="text-xs text-muted-foreground truncate">
                                Próxima: {est.nextAction}
                                {est.nextActionDate && ` (${new Date(est.nextActionDate).toLocaleDateString("es-DO")})`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StageBadge stage={est.stage} />
                          <PriorityBadge priority={est.priority || "media"} />
                          {est.convertedToLocationId && <Badge className="bg-green-600 text-white text-xs">Convertido</Badge>}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); openEditDialog(est); }}
                              data-testid={`button-edit-${est.id}`}
                            >
                              Editar
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(est.id); }}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${est.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!isLoading && establishments.length === 0 && (
                  <div className="text-center py-12">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay establecimientos</p>
                    {canCreate && (
                      <Button className="mt-4" onClick={() => setShowCreateDialog(true)} data-testid="button-create-empty">
                        <Plus className="h-4 w-4 mr-1" /> Crear Primer Establecimiento
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="activos">
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Establecimientos Activos</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Esta sección mostrará los establecimientos que han sido convertidos a ubicaciones activas con contratos y máquinas instaladas.
            </p>
            <p className="text-xs text-muted-foreground mt-2">Próximamente en una actualización futura.</p>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Establecimiento</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))}>
              <EstablishmentFormFields form={createForm} />
              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                  {createMutation.isPending ? "Creando..." : "Crear Establecimiento"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEstablishment} onOpenChange={(open) => !open && setEditingEstablishment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Establecimiento</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate({ id: editingEstablishment?.id, data }))}>
              <EstablishmentFormFields form={editForm} isEdit />
              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setEditingEstablishment(null)}>Cancelar</Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                  {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
