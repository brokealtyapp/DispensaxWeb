import { useState, useEffect, useCallback, useRef } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  User,
  ArrowRight,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileType,
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
  Wrench,
  AlertTriangle,
  RefreshCw,
  Eye,
  ClipboardList,
  Pencil,
  ExternalLink,
  UserPlus,
  Send,
  Copy,
  Link2,
  Loader2,
} from "lucide-react";
import { Link, useSearch, useLocation } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import {
  uploadFileWithProgress,
  describeUploadError,
  isAllowedDocumentMime,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/uploadFile";

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
  updatedAt: string | null;
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

const NEUTRAL_STAGE_COLOR = "hsl(var(--muted-foreground))";

function StageBadge({ stage }: { stage: EstablishmentStageInfo | null }) {
  if (!stage) return null;
  const color = stage.color ?? NEUTRAL_STAGE_COLOR;
  return (
    <Badge
      variant="secondary"
      className="border"
      style={{ borderColor: color, color }}
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

function getDocumentIcon(mimeType: string | null | undefined) {
  if (!mimeType) return FileText;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf") return FileType;
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  ) {
    return FileSpreadsheet;
  }
  return FileText;
}

function isViewableMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDownloadErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message.match(/^(\d+):\s*([\s\S]*)$/);
    if (m) {
      const code = parseInt(m[1], 10);
      if (code === 404) return "El archivo ya no existe en el almacenamiento";
      if (code === 401 || code === 403) return "No tienes permiso para acceder a este archivo";
      if (code >= 500) return "Error del servidor, intenta de nuevo en unos segundos";
      try {
        const body = JSON.parse(m[2]);
        if (body && typeof body.error === "string") return body.error;
      } catch { /* not json */ }
      return `Error ${code}`;
    }
    return "Sin conexión o el servidor no respondió";
  }
  return "Error desconocido";
}

function EstablishmentDocumentsSection({
  establishmentId,
  canCreate,
  canEdit,
  canDelete,
}: {
  establishmentId: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { toast } = useToast();
  const [selectedDocType, setSelectedDocType] = useState("contrato");
  const [uploadingMeta, setUploadingMeta] = useState<{ name: string; size: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [pendingDeleteDocId, setPendingDeleteDocId] = useState<string | null>(null);
  const [busyDocIds, setBusyDocIds] = useState<Set<string>>(() => new Set());
  const isMountedRef = useRef(true);

  const setDocBusy = (id: string, busy: boolean) => {
    setBusyDocIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const { data: documents = [], isLoading: loadingDocs } = useQuery<EstablishmentDocument[]>({
    queryKey: ["/api/establishments", establishmentId, "documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/establishments/${establishmentId}/documents`);
      return res.json();
    },
  });

  const updateDocStatusMutation = useMutation({
    mutationFn: async ({ docId, status }: { docId: string; status: string }) => {
      return apiRequest("PATCH", `/api/establishments/${establishmentId}/documents/${docId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishmentId, "documents"] });
      toast({ title: "Estado del documento actualizado" });
    },
    onError: () => toast({ title: "Error al actualizar estado", variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest("DELETE", `/api/establishments/${establishmentId}/documents/${docId}`);
    },
    onMutate: (docId: string) => {
      setPendingDeleteDocId(docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishmentId, "documents"] });
      toast({ title: "Documento eliminado" });
      setConfirmDeleteDocId(null);
    },
    onError: () => {
      toast({ title: "Error al eliminar documento", variant: "destructive" });
      setConfirmDeleteDocId(null);
    },
    onSettled: () => {
      setPendingDeleteDocId(null);
    },
  });

  const startUpload = async (file: File) => {
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast({
        title: "El archivo supera 10 MB",
        description: `Tamaño actual: ${formatFileSize(file.size)}`,
        variant: "destructive",
      });
      return;
    }
    if (file.type && !isAllowedDocumentMime(file.type)) {
      toast({
        title: "Tipo de archivo no permitido",
        description: "Usa PDF, JPG, PNG, WEBP, Word, Excel, TXT o CSV.",
        variant: "destructive",
      });
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setUploadingMeta({ name: file.name, size: file.size });
    setUploadProgress(0);
    try {
      await uploadFileWithProgress({
        url: `/api/establishments/${establishmentId}/documents`,
        file,
        fields: { documentType: selectedDocType },
        onProgress: (p) => {
          if (isMountedRef.current) setUploadProgress(p);
        },
        signal: ctrl.signal,
      });
      if (!isMountedRef.current) return;
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishmentId, "documents"] });
      toast({ title: "Documento subido" });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (!isMountedRef.current) return;
      toast({
        title: "Error al subir documento",
        description: describeUploadError(err),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setUploadingMeta(null);
        setUploadProgress(0);
      }
      if (abortRef.current === ctrl) {
        abortRef.current = null;
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void startUpload(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    if (!canCreate || uploadingMeta) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void startUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canCreate || uploadingMeta) return;
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleCancelUpload = () => {
    abortRef.current?.abort();
  };

  const handleDownload = async (doc: EstablishmentDocument, inline = false) => {
    if (busyDocIds.has(doc.id)) return;

    let popup: Window | null = null;
    if (inline) {
      // Open the tab synchronously inside the user gesture so the browser
      // doesn't block it as an unsolicited popup.
      popup = window.open("", "_blank");
      if (!popup) {
        toast({
          title: "El navegador bloqueó la pestaña",
          description: "Permite ventanas emergentes para este sitio o usa el botón Descargar.",
          variant: "destructive",
        });
        return;
      }
      try {
        popup.document.write(
          '<!doctype html><html><head><meta charset="utf-8"><title>Cargando documento...</title></head>' +
            '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666;background:#f7f7f7">' +
            "Cargando documento..." +
            "</body></html>",
        );
        popup.document.close();
      } catch {
        /* ignore: some browsers restrict document.write on about:blank */
      }
    }

    setDocBusy(doc.id, true);
    try {
      const res = await apiRequest(
        "GET",
        `/api/establishments/${establishmentId}/documents/${doc.id}/download${inline ? "?inline=1" : ""}`,
      );
      const blob = await res.blob();
      if (inline) {
        if (popup && !popup.closed) {
          // Render the file inside a controlled HTML wrapper instead of
          // navigating to the blob URL directly. Chrome's native blob
          // viewer can mis-render small images and behaves
          // inconsistently inside Replit preview iframes.
          //
          // CRITICAL: blob URLs are scoped to the document that creates
          // them. If we used window.URL.createObjectURL(blob) here, the
          // popup's <img> would fail to load it (the popup is a separate
          // document). We create the URL via popup.URL so it's resolvable
          // inside the popup's document.
          //
          // We also build the page shell with document.write first, then
          // attach the media element via DOM APIs — never inject the blob
          // URL or filename into an inline event handler string.
          const escapeHtml = (s: string) =>
            s.replace(/[&<>"']/g, (c) => (
              { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
            ));
          const safeName = escapeHtml(doc.fileName || "Documento");
          const fileName = doc.fileName || "Documento";
          const mime = (doc.mimeType || "").toLowerCase();
          // popup.URL exists in all evergreen browsers; fall back to the
          // parent window's URL only as a defensive measure (will likely
          // hit onerror if it actually triggers, but better than crashing).
          const popupURL: typeof URL = (popup as any).URL || window.URL;
          const url = popupURL.createObjectURL(blob);
          let revoked = false;
          const revoke = () => {
            if (revoked) return;
            revoked = true;
            try { popupURL.revokeObjectURL(url); } catch { /* noop */ }
          };
          // Auto-revoke when the popup is closed/navigated away (the URL
          // becomes invalid anyway, but releasing the handle is tidy).
          try {
            popup.addEventListener("pagehide", revoke, { once: true });
            popup.addEventListener("beforeunload", revoke, { once: true });
          } catch { /* noop: cross-origin popup edge case */ }
          // Belt-and-suspenders: revoke after 5 minutes even if
          // load/unload never fire (e.g., user leaves the tab open).
          const revokeTimer = window.setTimeout(revoke, 5 * 60_000);
          try {
            popup.document.open();
            popup.document.write(
              `<!doctype html><html><head><meta charset="utf-8">` +
                `<title>${safeName}</title>` +
                `<style>` +
                `html,body{margin:0;padding:0;height:100%;background:#1a1a1a;color:#eee;` +
                `font-family:system-ui,-apple-system,sans-serif}` +
                `body{display:flex;align-items:center;justify-content:center}` +
                `img{max-width:100vw;max-height:100vh;object-fit:contain;display:block}` +
                `iframe{width:100vw;height:100vh;border:0;background:#fff}` +
                `.fb{text-align:center;padding:24px;line-height:1.6}` +
                `.fb a{color:#7ab7ff}` +
                `</style></head><body></body></html>`,
            );
            popup.document.close();
            const pdoc = popup.document;
            const renderFallback = () => {
              const div = pdoc.createElement("div");
              div.className = "fb";
              div.appendChild(pdoc.createTextNode("No se pudo mostrar el documento. "));
              div.appendChild(pdoc.createElement("br"));
              const link = pdoc.createElement("a");
              link.href = url;
              link.download = fileName;
              link.appendChild(pdoc.createTextNode("Descargar archivo"));
              div.appendChild(link);
              pdoc.body.replaceChildren(div);
            };
            if (mime.startsWith("image/")) {
              const img = pdoc.createElement("img");
              img.alt = fileName;
              img.onload = () => {
                window.clearTimeout(revokeTimer);
                // Image is fully decoded; safe to revoke shortly after.
                window.setTimeout(revoke, 60_000);
              };
              img.onerror = renderFallback;
              img.src = url;
              pdoc.body.appendChild(img);
            } else if (mime === "application/pdf") {
              const iframe = pdoc.createElement("iframe");
              iframe.title = fileName;
              iframe.onload = () => {
                window.clearTimeout(revokeTimer);
                window.setTimeout(revoke, 5 * 60_000);
              };
              iframe.src = url;
              pdoc.body.appendChild(iframe);
            } else {
              const div = pdoc.createElement("div");
              div.className = "fb";
              div.appendChild(pdoc.createTextNode("No se puede previsualizar este tipo de archivo. "));
              div.appendChild(pdoc.createElement("br"));
              const link = pdoc.createElement("a");
              link.href = url;
              link.download = fileName;
              link.appendChild(pdoc.createTextNode("Descargar archivo"));
              div.appendChild(link);
              pdoc.body.appendChild(div);
            }
          } catch {
            // Last-resort fallback: navigate to the raw blob URL.
            try { popup.location.replace(url); } catch { /* noop */ }
          }
        } else {
          // Popup didn't survive — nothing to render into.
        }
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      }
    } catch (err) {
      if (popup && !popup.closed) {
        try { popup.close(); } catch { /* noop */ }
      }
      toast({
        title: "Error al descargar",
        description: getDownloadErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setDocBusy(doc.id, false);
    }
  };

  const acceptAttr = ALLOWED_DOCUMENT_MIME_TYPES.join(",");

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
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
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onClick={() => {
              if (!uploadingMeta) fileInputRef.current?.click();
            }}
            className={`rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover-elevate"
            } ${uploadingMeta ? "pointer-events-none opacity-80" : ""}`}
            data-testid="dropzone-document"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !uploadingMeta) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={acceptAttr}
              onChange={handleFileInputChange}
              data-testid="input-file-upload"
            />
            {uploadingMeta ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="font-medium truncate max-w-[260px]" data-testid="text-uploading-name">
                    {uploadingMeta.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({formatFileSize(uploadingMeta.size)})
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-2" data-testid="progress-upload" />
                <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  <span data-testid="text-upload-progress">{uploadProgress}%</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelUpload();
                    }}
                    data-testid="button-cancel-upload"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Arrastra un archivo aquí o haz clic para seleccionar</p>
                <p className="text-xs text-muted-foreground">
                  PDF, JPG, PNG, WEBP, Word, Excel, TXT o CSV (máx. 10 MB)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {loadingDocs && <p className="text-sm text-muted-foreground">Cargando...</p>}
      {documents.map((doc: EstablishmentDocument) => {
        const Icon = getDocumentIcon(doc.mimeType);
        return (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-2 p-3 rounded-md border"
            data-testid={`row-document-${doc.id}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" data-testid={`text-doc-name-${doc.id}`}>
                  {doc.fileName}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {doc.documentType && (
                    <Badge variant="outline" className="text-xs">
                      {doc.documentType}
                    </Badge>
                  )}
                  <DocumentStatusBadge status={doc.status || "pendiente"} />
                  <span
                    className="text-xs text-muted-foreground"
                    title={doc.createdAt ? format(new Date(doc.createdAt), "dd MMM yyyy HH:mm", { locale: es }) : ""}
                  >
                    {doc.uploadedBy?.fullName || ""}
                    {doc.createdAt ? ` · ${format(new Date(doc.createdAt), "dd MMM yyyy", { locale: es })}` : ""}
                    {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 items-center">
              {canEdit && (
                <Select
                  value={doc.status || "pendiente"}
                  onValueChange={(val) => updateDocStatusMutation.mutate({ docId: doc.id, status: val })}
                >
                  <SelectTrigger className="w-[110px] h-8 text-xs" data-testid={`select-doc-status-${doc.id}`}>
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
              {isViewableMime(doc.mimeType) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(doc, true)}
                  disabled={busyDocIds.has(doc.id)}
                  aria-label="Ver"
                  data-testid={`button-view-doc-${doc.id}`}
                >
                  {busyDocIds.has(doc.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(doc)}
                disabled={busyDocIds.has(doc.id)}
                aria-label="Descargar"
                data-testid={`button-download-doc-${doc.id}`}
              >
                {busyDocIds.has(doc.id) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDeleteDocId(doc.id)}
                  disabled={pendingDeleteDocId !== null}
                  aria-label="Eliminar"
                  data-testid={`button-delete-doc-${doc.id}`}
                >
                  {pendingDeleteDocId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {!loadingDocs && documents.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Sin documentos aún</p>
      )}

      <AlertDialog
        open={confirmDeleteDocId !== null}
        onOpenChange={(open) => {
          // Block dismissals (Escape, click outside) while the deletion is in flight
          if (!open && pendingDeleteDocId === null) setConfirmDeleteDocId(null);
        }}
      >
        <AlertDialogContent data-testid="alert-confirm-delete-doc">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borra el archivo del almacenamiento y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={pendingDeleteDocId !== null}
              data-testid="button-cancel-delete-doc"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Prevent Radix from auto-closing the dialog; we close it from onSuccess/onError.
                e.preventDefault();
                if (confirmDeleteDocId && pendingDeleteDocId === null) {
                  deleteDocMutation.mutate(confirmDeleteDocId);
                }
              }}
              disabled={pendingDeleteDocId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-doc"
            >
              {pendingDeleteDocId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EstablishmentDetail({
  establishment,
  stages,
  onClose,
  onStageChange,
  onEditContact,
  onEditCommercial,
  onDelete,
  canEdit,
  canCreate,
  canApprove,
  canDelete,
}: {
  establishment: EstablishmentWithRelations;
  stages: EstablishmentStageInfo[];
  onClose: () => void;
  onStageChange: () => void;
  onEditContact: () => void;
  onEditCommercial: () => void;
  onDelete?: () => void;
  canEdit: boolean;
  canCreate: boolean;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const { toast } = useToast();
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [editingFollowupId, setEditingFollowupId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [followupToDelete, setFollowupToDelete] = useState<string | null>(null);

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
      const payload: Record<string, string | null | undefined> = { ...data };
      if (!payload.nextFollowupDate) payload.nextFollowupDate = null;
      if (!payload.nextAction) payload.nextAction = null;
      return apiRequest("POST", `/api/establishments/${establishment.id}/followups`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "followups"] });
      followupForm.reset({ type: "nota", content: "", nextAction: "", nextFollowupDate: "" });
      setShowFollowupForm(false);
      toast({ title: "Seguimiento agregado" });
    },
    onError: () => toast({ title: "Error al crear seguimiento", variant: "destructive" }),
  });

  const updateFollowupMutation = useMutation({
    mutationFn: async ({ followupId, data }: { followupId: string; data: FollowupFormValues }) => {
      const payload: Record<string, string | null | undefined> = { ...data };
      if (!payload.nextFollowupDate) payload.nextFollowupDate = null;
      if (!payload.nextAction) payload.nextAction = null;
      return apiRequest("PATCH", `/api/establishments/${establishment.id}/followups/${followupId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "followups"] });
      followupForm.reset({ type: "nota", content: "", nextAction: "", nextFollowupDate: "" });
      setEditingFollowupId(null);
      setShowFollowupForm(false);
      toast({ title: "Seguimiento actualizado" });
    },
    onError: () => toast({ title: "Error al actualizar seguimiento", variant: "destructive" }),
  });

  const deleteFollowupMutation = useMutation({
    mutationFn: async (followupId: string) => {
      return apiRequest("DELETE", `/api/establishments/${establishment.id}/followups/${followupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "followups"] });
      toast({ title: "Seguimiento eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar seguimiento", variant: "destructive" }),
  });

  const startEditFollowup = (f: EstablishmentFollowup) => {
    setEditingFollowupId(f.id);
    setShowFollowupForm(true);
    followupForm.reset({
      type: f.type || "nota",
      content: f.content || "",
      nextAction: f.nextAction || "",
      nextFollowupDate: f.nextFollowupDate ? new Date(f.nextFollowupDate).toISOString().split("T")[0] : "",
    });
  };

  const cancelFollowupForm = () => {
    setShowFollowupForm(false);
    setEditingFollowupId(null);
    followupForm.reset({ type: "nota", content: "", nextAction: "", nextFollowupDate: "" });
  };

  const handleFollowupSubmit = (data: FollowupFormValues) => {
    if (editingFollowupId) {
      updateFollowupMutation.mutate({ followupId: editingFollowupId, data });
    } else {
      createFollowupMutation.mutate(data);
    }
  };

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
      if (establishment.contactEmail && canCreate) {
        setTimeout(() => {
          if (confirm(`Establecimiento convertido.\n\n¿Enviar invitación de visor a ${establishment.contactEmail} ahora?\n(Podrás ajustar las máquinas asignadas en el siguiente paso.)`)) {
            window.location.href = `/establecimientos?tab=activos&establishmentId=${establishment.id}&inviteViewer=1`;
          }
        }, 300);
      }
    },
    onError: () => toast({ title: "Error al convertir", variant: "destructive" }),
  });

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
          {canDelete && onDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(true)}
              data-testid="button-delete-establishment"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
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
                style={isCurrent ? { backgroundColor: s.color ?? NEUTRAL_STAGE_COLOR } : undefined}
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
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm font-medium">Información de Contacto</CardTitle>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onEditContact}
                data-testid="button-edit-contact-info"
              >
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
            )}
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
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm font-medium">Datos Comerciales</CardTitle>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onEditCommercial}
                data-testid="button-edit-business-data"
              >
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
            )}
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
          {canCreate && !showFollowupForm && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setEditingFollowupId(null); followupForm.reset({ type: "nota", content: "", nextAction: "", nextFollowupDate: "" }); setShowFollowupForm(true); }} data-testid="button-add-followup">
                <Plus className="h-4 w-4 mr-1" /> Agregar Seguimiento
              </Button>
            </div>
          )}

          {showFollowupForm && (
            <Card>
              <CardContent className="pt-4">
                <Form {...followupForm}>
                  <form onSubmit={followupForm.handleSubmit(handleFollowupSubmit)} className="space-y-3">
                    <FormField control={followupForm.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                      <Button type="submit" size="sm" disabled={createFollowupMutation.isPending || updateFollowupMutation.isPending} data-testid="button-save-followup">
                        {editingFollowupId ? "Actualizar" : "Guardar"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={cancelFollowupForm} data-testid="button-cancel-followup">Cancelar</Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {loadingFollowups && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {followups.map((f: EstablishmentFollowup) => (
            <Card key={f.id} data-testid={`card-followup-${f.id}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{f.type}</Badge>
                    <span className="text-xs text-muted-foreground">{f.user?.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {f.createdAt ? format(new Date(f.createdAt), "dd MMM yyyy HH:mm", { locale: es }) : ""}
                    </span>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditFollowup(f)}
                        aria-label="Editar seguimiento"
                        data-testid={`button-edit-followup-${f.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setFollowupToDelete(f.id)}
                        disabled={deleteFollowupMutation.isPending}
                        aria-label="Eliminar seguimiento"
                        data-testid={`button-delete-followup-${f.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
          <EstablishmentDocumentsSection
            establishmentId={establishment.id}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent data-testid="alert-confirm-delete-establishment">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este establecimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará "{establishment.name}" y no se puede deshacer. Se perderán seguimientos y documentos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-establishment">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDeleteOpen(false);
                onDelete?.();
              }}
              data-testid="button-confirm-delete-establishment"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!followupToDelete} onOpenChange={(open) => !open && setFollowupToDelete(null)}>
        <AlertDialogContent data-testid="alert-confirm-delete-followup">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la nota de seguimiento y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-followup">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (followupToDelete) {
                  deleteFollowupMutation.mutate(followupToDelete);
                  setFollowupToDelete(null);
                }
              }}
              data-testid="button-confirm-delete-followup"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface EstablishmentContract {
  id: string;
  establishmentId: string;
  tenantId: string;
  contractDate: string | null;
  agreementType: string | null;
  commissionTerms: string | null;
  conditions: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  notes: string | null;
  previousContractId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ActiveEstablishment extends EstablishmentWithRelations {
  machineCount: number;
  activeContract: EstablishmentContract | null;
}

const contractFormSchema = z.object({
  agreementType: z.string().default("comision"),
  contractDate: z.string().optional(),
  commissionTerms: z.string().optional(),
  conditions: z.string().optional(),
  status: z.string().default("activo"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  renewalDate: z.string().optional(),
  notes: z.string().optional(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

function ContractStatusBadge({ status, endDate }: { status: string; endDate?: string | Date | null }) {
  let effectiveStatus = status;
  if (status === "activo" && endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
      effectiveStatus = "por_vencer";
    } else if (daysUntilExpiry <= 0) {
      effectiveStatus = "vencido";
    }
  }
  const config: Record<string, { label: string; className: string }> = {
    activo: { label: "Activo", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    por_vencer: { label: "Por Vencer", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    vencido: { label: "Vencido", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    renovado: { label: "Renovado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    cancelado: { label: "Cancelado", className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
  };
  const c = config[effectiveStatus] || config.activo;
  return <Badge variant="secondary" className={c.className}>{c.label}</Badge>;
}

function ActiveEstablishmentDetail({
  establishment,
  onClose,
  canEdit,
  canCreate,
  canDelete,
  onInviteRequested,
  scrollToViewerToken,
}: {
  establishment: ActiveEstablishment;
  onClose: () => void;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onInviteRequested: (est: ActiveEstablishment) => void;
  scrollToViewerToken?: number;
}) {
  const viewerSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollToViewerToken && viewerSectionRef.current) {
      viewerSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollToViewerToken]);
  const { toast } = useToast();
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<EstablishmentContract | null>(null);
  const [renewingContract, setRenewingContract] = useState<EstablishmentContract | null>(null);

  const { data: machinesData = [] } = useQuery<any[]>({
    queryKey: ["/api/establishments", establishment.id, "machines"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/establishments/${establishment.id}/machines`);
      return res.json();
    },
  });

  const { data: viewerForEst, isFetched: viewerForEstFetched } = useQuery<{ id: string } | null>({
    queryKey: ["/api/establishments", establishment.id, "viewer"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/establishments/${establishment.id}/viewer`);
      return res.json();
    },
  });

  const sendContractEmailMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return apiRequest("POST", `/api/establishments/${establishment.id}/contracts/${contractId}/send-email`);
    },
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({
        title: "Correo enviado",
        description: data?.includedViewerLink
          ? "Se incluyó el enlace de acceso al panel del propietario."
          : "El contrato fue notificado al contacto.",
      });
    },
    onError: (err: any) => {
      let msg = err?.message || "Intenta nuevamente";
      const match = typeof msg === "string" ? msg.match(/^\d+:\s*(.+)$/) : null;
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed?.error) msg = parsed.error;
        } catch {
          msg = match[1];
        }
      }
      toast({ title: "Error al enviar correo", description: msg, variant: "destructive" });
    },
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery<EstablishmentContract[]>({
    queryKey: ["/api/establishments", establishment.id, "contracts"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/establishments/${establishment.id}/contracts`);
      return res.json();
    },
  });

  const { data: activeDocuments = [] } = useQuery<EstablishmentDocument[]>({
    queryKey: ["/api/establishments", establishment.id, "documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/establishments/${establishment.id}/documents`);
      return res.json();
    },
  });

  const { data: history, isLoading: loadingHistory } = useQuery<{
    machineVisits: any[];
    serviceRecords: any[];
    machineAlerts: any[];
    totalSales: number;
  }>({
    queryKey: ["/api/establishments", establishment.id, "operational-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/establishments/${establishment.id}/operational-history`);
      return res.json();
    },
  });

  const contractForm = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      agreementType: "comision",
      contractDate: new Date().toISOString().split("T")[0],
      commissionTerms: "",
      conditions: "",
      status: "activo",
      startDate: "",
      endDate: "",
      renewalDate: "",
      notes: "",
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: ContractFormValues) => {
      return apiRequest("POST", `/api/establishments/${establishment.id}/contracts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/active"] });
      contractForm.reset();
      setShowContractForm(false);
      toast({ title: "Contrato creado" });
      if (viewerForEstFetched && viewerForEst === null && establishment.contactEmail && canCreate) {
        setTimeout(() => {
          if (confirm(`Este establecimiento aún no tiene visor.\n\n¿Enviar invitación de visor a ${establishment.contactEmail} ahora?`)) {
            onInviteRequested(establishment);
          }
        }, 300);
      }
    },
    onError: () => toast({ title: "Error al crear contrato", variant: "destructive" }),
  });

  const renewContractMutation = useMutation({
    mutationFn: async ({ contractId, data }: { contractId: string; data: ContractFormValues }) => {
      return apiRequest("POST", `/api/establishments/${establishment.id}/contracts/${contractId}/renew`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/active"] });
      contractForm.reset();
      setRenewingContract(null);
      toast({ title: "Contrato renovado" });
    },
    onError: () => toast({ title: "Error al renovar contrato", variant: "destructive" }),
  });

  const editContractMutation = useMutation({
    mutationFn: async ({ contractId, data }: { contractId: string; data: ContractFormValues }) => {
      return apiRequest("PATCH", `/api/establishments/${establishment.id}/contracts/${contractId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/active"] });
      contractForm.reset();
      setEditingContract(null);
      setShowContractForm(false);
      toast({ title: "Contrato actualizado" });
    },
    onError: () => toast({ title: "Error al actualizar contrato", variant: "destructive" }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return apiRequest("DELETE", `/api/establishments/${establishment.id}/contracts/${contractId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/active"] });
      toast({ title: "Contrato eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar contrato", variant: "destructive" }),
  });

  const updateContractStatusMutation = useMutation({
    mutationFn: async ({ contractId, status }: { contractId: string; status: string }) => {
      return apiRequest("PATCH", `/api/establishments/${establishment.id}/contracts/${contractId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/establishments/active"] });
      toast({ title: "Estado del contrato actualizado" });
    },
    onError: () => toast({ title: "Error al actualizar contrato", variant: "destructive" }),
  });

  const ContractFormFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField control={contractForm.control} name="agreementType" render={({ field }) => (
        <FormItem>
          <FormLabel>Tipo de Acuerdo</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl><SelectTrigger data-testid="select-agreement-type"><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="comision">Comisión</SelectItem>
              <SelectItem value="renta_fija">Renta Fija</SelectItem>
              <SelectItem value="comodato">Comodato</SelectItem>
              <SelectItem value="mixto">Mixto</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={contractForm.control} name="contractDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Fecha de Contrato</FormLabel>
          <FormControl><Input type="date" {...field} data-testid="input-contract-date" /></FormControl>
        </FormItem>
      )} />
      <FormField control={contractForm.control} name="status" render={({ field }) => (
        <FormItem>
          <FormLabel>Estado</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl><SelectTrigger data-testid="select-contract-status"><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="renovado">Renovado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={contractForm.control} name="startDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Fecha Inicio</FormLabel>
          <FormControl><Input type="date" {...field} data-testid="input-contract-start" /></FormControl>
        </FormItem>
      )} />
      <FormField control={contractForm.control} name="endDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Fecha Fin</FormLabel>
          <FormControl><Input type="date" {...field} data-testid="input-contract-end" /></FormControl>
        </FormItem>
      )} />
      <FormField control={contractForm.control} name="renewalDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Fecha de Renovación</FormLabel>
          <FormControl><Input type="date" {...field} data-testid="input-contract-renewal" /></FormControl>
        </FormItem>
      )} />
      <FormField control={contractForm.control} name="commissionTerms" render={({ field }) => (
        <FormItem className="md:col-span-2">
          <FormLabel>Términos de Comisión</FormLabel>
          <FormControl><Textarea {...field} placeholder="Ej: 5% sobre ventas brutas mensuales..." data-testid="input-commission-terms" /></FormControl>
        </FormItem>
      )} />
      <FormField control={contractForm.control} name="conditions" render={({ field }) => (
        <FormItem className="md:col-span-2">
          <FormLabel>Condiciones</FormLabel>
          <FormControl><Textarea {...field} placeholder="Condiciones especiales del contrato..." data-testid="input-conditions" /></FormControl>
        </FormItem>
      )} />
      <FormField control={contractForm.control} name="notes" render={({ field }) => (
        <FormItem className="md:col-span-2">
          <FormLabel>Notas</FormLabel>
          <FormControl><Textarea {...field} data-testid="input-contract-notes" /></FormControl>
        </FormItem>
      )} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">{establishment.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className="bg-green-600 text-white">Activo</Badge>
            {establishment.businessType && (
              <Badge variant="outline" className="text-xs">{establishment.businessType}</Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-active-detail">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-machine-count">{machinesData.length}</p>
            <p className="text-xs text-muted-foreground">Máquinas Instaladas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-contract-count">{contracts.length}</p>
            <p className="text-xs text-muted-foreground">Contratos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-visits-count">
              {(history?.machineVisits?.length || 0) + (history?.serviceRecords?.length || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Visitas / Servicios</p>
          </CardContent>
        </Card>
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Datos Comerciales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Comisión: {establishment.commissionPercent || "5.00"}%
            </div>
            {establishment.convertedAt && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Convertido: {format(new Date(establishment.convertedAt), "dd MMM yyyy", { locale: es })}
              </div>
            )}
            {establishment.assignedUser && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Responsable: {establishment.assignedUser.fullName}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div ref={viewerSectionRef}>
        <LinkedViewerSection
          establishment={establishment}
          establishmentMachines={machinesData}
          canEdit={canEdit}
          canCreate={canCreate}
          canDelete={canDelete}
          onInviteRequested={onInviteRequested}
        />
      </div>

      <Tabs defaultValue="machines">
        <TabsList>
          <TabsTrigger value="machines" data-testid="tab-active-machines">
            <Building2 className="h-4 w-4 mr-1" /> Máquinas ({machinesData.length})
          </TabsTrigger>
          <TabsTrigger value="contracts" data-testid="tab-active-contracts">
            <ClipboardList className="h-4 w-4 mr-1" /> Contratos ({contracts.length})
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-active-documents">
            <FileText className="h-4 w-4 mr-1" /> Documentos ({activeDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-active-history">
            <Clock className="h-4 w-4 mr-1" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="machines" className="space-y-3">
          {machinesData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay máquinas instaladas en este establecimiento</p>
          ) : (
            <div className="space-y-2">
              {machinesData.map((machine: any) => (
                <Card key={machine.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate" data-testid={`text-machine-name-${machine.id}`}>{machine.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {machine.serialNumber || "Sin serial"} - {machine.machineType || "Sin tipo"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={
                          machine.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          machine.status === "maintenance" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        }>
                          {machine.status === "active" ? "Activa" : machine.status === "maintenance" ? "Mantenimiento" : machine.status || "N/A"}
                        </Badge>
                        <Link href={`/maquinas/${machine.id}`}>
                          <Button variant="ghost" size="icon" data-testid={`button-view-machine-${machine.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contracts" className="space-y-3">
          {canCreate && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { contractForm.reset(); setShowContractForm(true); }} data-testid="button-add-contract">
                <Plus className="h-4 w-4 mr-1" /> Nuevo Contrato
              </Button>
            </div>
          )}

          {(showContractForm || renewingContract || editingContract) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {editingContract ? "Editar Contrato" : renewingContract ? "Renovar Contrato" : "Nuevo Contrato"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...contractForm}>
                  <form onSubmit={contractForm.handleSubmit((data) => {
                    if (editingContract) {
                      editContractMutation.mutate({ contractId: editingContract.id, data });
                    } else if (renewingContract) {
                      renewContractMutation.mutate({ contractId: renewingContract.id, data });
                    } else {
                      createContractMutation.mutate(data);
                    }
                  })} className="space-y-4">
                    <ContractFormFields />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={createContractMutation.isPending || renewContractMutation.isPending || editContractMutation.isPending} data-testid="button-save-contract">
                        {editingContract ? "Guardar Cambios" : renewingContract ? "Renovar" : "Crear Contrato"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setShowContractForm(false); setRenewingContract(null); setEditingContract(null); }}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {loadingContracts && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {contract.agreementType === "comision" ? "Comisión" :
                       contract.agreementType === "renta_fija" ? "Renta Fija" :
                       contract.agreementType === "comodato" ? "Comodato" :
                       contract.agreementType === "mixto" ? "Mixto" : contract.agreementType}
                    </span>
                    <ContractStatusBadge status={contract.status || "activo"} endDate={contract.endDate} />
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => {
                        contractForm.reset({
                          agreementType: contract.agreementType || "comision",
                          contractDate: contract.contractDate ? new Date(contract.contractDate).toISOString().split("T")[0] : "",
                          commissionTerms: contract.commissionTerms || "",
                          conditions: contract.conditions || "",
                          status: contract.status || "activo",
                          startDate: contract.startDate ? new Date(contract.startDate).toISOString().split("T")[0] : "",
                          endDate: contract.endDate ? new Date(contract.endDate).toISOString().split("T")[0] : "",
                          renewalDate: contract.renewalDate ? new Date(contract.renewalDate).toISOString().split("T")[0] : "",
                          notes: contract.notes || "",
                        });
                        setEditingContract(contract);
                        setRenewingContract(null);
                        setShowContractForm(false);
                      }} data-testid={`button-edit-contract-${contract.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && establishment.contactEmail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendContractEmailMutation.mutate(contract.id)}
                        disabled={sendContractEmailMutation.isPending}
                        data-testid={`button-send-contract-email-${contract.id}`}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Enviar correo
                      </Button>
                    )}
                    {canEdit && contract.status === "activo" && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        contractForm.reset({
                          agreementType: contract.agreementType || "comision",
                          contractDate: new Date().toISOString().split("T")[0],
                          commissionTerms: contract.commissionTerms || "",
                          conditions: contract.conditions || "",
                          status: "activo",
                          startDate: "",
                          endDate: "",
                          renewalDate: "",
                          notes: "",
                        });
                        setRenewingContract(contract);
                        setEditingContract(null);
                        setShowContractForm(false);
                      }} data-testid={`button-renew-${contract.id}`}>
                        <RefreshCw className="h-4 w-4 mr-1" /> Renovar
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                        if (confirm("¿Eliminar este contrato?")) {
                          deleteContractMutation.mutate(contract.id);
                        }
                      }} data-testid={`button-delete-contract-${contract.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  {contract.startDate && (
                    <span>Inicio: {format(new Date(contract.startDate), "dd MMM yyyy", { locale: es })}</span>
                  )}
                  {contract.endDate && (
                    <span>Fin: {format(new Date(contract.endDate), "dd MMM yyyy", { locale: es })}</span>
                  )}
                  {contract.renewalDate && (
                    <span>Renovación: {format(new Date(contract.renewalDate), "dd MMM yyyy", { locale: es })}</span>
                  )}
                </div>
                {contract.commissionTerms && (
                  <p className="text-sm">{contract.commissionTerms}</p>
                )}
                {contract.conditions && (
                  <p className="text-xs text-muted-foreground">{contract.conditions}</p>
                )}
                {contract.notes && (
                  <p className="text-xs text-muted-foreground italic">{contract.notes}</p>
                )}
                {contract.createdAt && (
                  <p className="text-xs text-muted-foreground">
                    Creado: {format(new Date(contract.createdAt), "dd MMM yyyy", { locale: es })}
                    {contract.previousContractId && " (Renovación)"}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {!loadingContracts && contracts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin contratos registrados</p>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-3">
          <EstablishmentDocumentsSection
            establishmentId={establishment.id}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loadingHistory && <p className="text-sm text-muted-foreground">Cargando historial...</p>}

          {history && (
            <>
              {history.totalSales > 0 && (
                <Card>
                  <CardContent className="p-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-sm">Ventas Totales</span>
                    </div>
                    <span className="font-bold text-lg" data-testid="text-total-sales">
                      RD$ {history.totalSales.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                    </span>
                  </CardContent>
                </Card>
              )}

              {history.serviceRecords.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4" /> Registros de Servicio ({history.serviceRecords.length})
                  </h4>
                  <div className="space-y-2">
                    {history.serviceRecords.slice(0, 10).map((sr: any) => (
                      <div key={sr.id} className="flex items-center justify-between gap-2 p-3 rounded-md border text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{sr.machineName}</p>
                          <p className="text-xs text-muted-foreground">
                            {sr.user?.fullName} - {sr.serviceType || "Servicio"}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {sr.startTime ? format(new Date(sr.startTime), "dd MMM yyyy HH:mm", { locale: es }) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.machineVisits.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Visitas ({history.machineVisits.length})
                  </h4>
                  <div className="space-y-2">
                    {history.machineVisits.slice(0, 10).map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between gap-2 p-3 rounded-md border text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{v.machineName}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.user?.fullName} - {v.visitType || "Visita"}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {v.startTime ? format(new Date(v.startTime), "dd MMM yyyy HH:mm", { locale: es }) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.machineAlerts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Alertas ({history.machineAlerts.length})
                  </h4>
                  <div className="space-y-2">
                    {history.machineAlerts.slice(0, 10).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-md border text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{a.machineName}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.alertType || "Alerta"} - {a.severity || "N/A"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className={a.resolved ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}>
                            {a.resolved ? "Resuelta" : "Pendiente"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {a.createdAt ? format(new Date(a.createdAt), "dd MMM", { locale: es }) : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.serviceRecords.length === 0 && history.machineVisits.length === 0 && history.machineAlerts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Sin historial operativo registrado</p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ViewerSummary = {
  id: string;
  establishmentId: string | null;
  establishmentName: string;
  isActive: boolean;
  user?: { id: string; username: string; email?: string | null; fullName?: string | null } | null;
};

function ActiveEstablishmentsTab({ canEdit, canCreate, canDelete }: { canEdit: boolean; canCreate: boolean; canDelete: boolean }) {
  const { toast } = useToast();
  const [searchActive, setSearchActive] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState<string>("");
  const [selectedActive, setSelectedActive] = useState<ActiveEstablishment | null>(null);
  const [inviteEstablishment, setInviteEstablishment] = useState<ActiveEstablishment | null>(null);
  const [inviteResult, setInviteResult] = useState<{ url: string; email: string; emailSent: boolean } | null>(null);
  const [scrollViewerToken, setScrollViewerToken] = useState<number | undefined>(undefined);
  const [withoutViewerOnly, setWithoutViewerOnly] = useState(false);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const targetEstablishmentId = new URLSearchParams(search).get("establishmentId");
  const inviteViewerOnLoad = new URLSearchParams(search).get("inviteViewer") === "1";
  const inviteViewerConsumedRef = useRef(false);

  const { data: activeEstablishments = [], isLoading } = useQuery<ActiveEstablishment[]>({
    queryKey: ["/api/establishments/active", { search: searchActive, contractStatus: contractStatusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchActive) params.set("search", searchActive);
      if (contractStatusFilter && contractStatusFilter !== "__all__") params.set("contractStatus", contractStatusFilter);
      const res = await apiRequest("GET", `/api/establishments/active?${params.toString()}`);
      return res.json();
    },
  });

  const { data: viewers = [] } = useQuery<ViewerSummary[]>({
    queryKey: ["/api/establishment-viewers"],
  });

  const viewerByEstablishment = new Map<string, ViewerSummary>();
  viewers.forEach(v => {
    if (v.establishmentId && v.isActive) viewerByEstablishment.set(v.establishmentId, v);
  });

  const { data: machines = [] } = useQuery<Array<{ id: string; code: string; name: string; location: string; locationId?: string | null }>>({
    queryKey: ["/api/machines"],
    enabled: !!inviteEstablishment,
  });

  const inviteForm = useForm<{ email: string; contactName: string; phone: string; commissionPercent: string; machineIds: string[] }>({
    defaultValues: { email: "", contactName: "", phone: "", commissionPercent: "5.00", machineIds: [] },
  });

  useEffect(() => {
    if (inviteEstablishment) {
      const preselected = machines
        .filter(m => m.locationId && m.locationId === inviteEstablishment.convertedToLocationId)
        .map(m => m.id);
      inviteForm.reset({
        email: inviteEstablishment.contactEmail || "",
        contactName: inviteEstablishment.contactName || "",
        phone: inviteEstablishment.contactPhone || "",
        commissionPercent: inviteEstablishment.commissionPercent || "5.00",
        machineIds: preselected,
      });
    }
  }, [inviteEstablishment, machines]);

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; contactName: string; phone: string; commissionPercent: string; machineIds: string[] }) => {
      if (!inviteEstablishment) throw new Error("No establishment");
      const res = await apiRequest("POST", "/api/viewer-invites", {
        email: data.email,
        establishmentName: inviteEstablishment.name,
        contactName: data.contactName,
        phone: data.phone,
        commissionPercent: data.commissionPercent,
        machineIds: data.machineIds,
        establishmentId: inviteEstablishment.id,
      });
      return await res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/establishment-viewers"] });
      if (inviteEstablishment) {
        queryClient.invalidateQueries({ queryKey: ["/api/establishments", inviteEstablishment.id, "viewer-invite"] });
        queryClient.invalidateQueries({ queryKey: ["/api/establishments", inviteEstablishment.id, "viewer"] });
      }
      const fullUrl = `${window.location.origin}${result.inviteUrl}`;
      const emailSent = !!result.emailSent;
      setInviteEstablishment(null);
      if (emailSent) {
        toast({ title: "Invitación enviada por correo", description: `Se envió a ${result.email}` });
      } else {
        setInviteResult({ url: fullUrl, email: result.email, emailSent: false });
      }
    },
    onError: (err: any) => {
      let msg = err?.message || "Intenta nuevamente";
      const match = typeof msg === "string" ? msg.match(/^\d+:\s*(.+)$/) : null;
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed?.error) msg = parsed.error;
        } catch {
          msg = match[1];
        }
      }
      toast({ title: "Error al invitar visor", description: msg, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (targetEstablishmentId && activeEstablishments.length > 0 && !selectedActive) {
      const found = activeEstablishments.find(e => e.id === targetEstablishmentId);
      if (found) setSelectedActive(found);
    }
  }, [targetEstablishmentId, activeEstablishments]);

  useEffect(() => {
    if (
      inviteViewerOnLoad &&
      !inviteViewerConsumedRef.current &&
      targetEstablishmentId &&
      activeEstablishments.length > 0
    ) {
      const found = activeEstablishments.find(e => e.id === targetEstablishmentId);
      if (found && !viewerByEstablishment.get(found.id)) {
        inviteViewerConsumedRef.current = true;
        setInviteEstablishment(found);
        const params = new URLSearchParams(search);
        params.delete("inviteViewer");
        const qs = params.toString();
        setLocation(`/establecimientos${qs ? `?${qs}` : ""}`, { replace: true });
      }
    }
  }, [inviteViewerOnLoad, targetEstablishmentId, activeEstablishments, search, setLocation]);

  const machinesForEstablishment = inviteEstablishment ? machines : [];
  const preselectedMachineIds = new Set(
    inviteEstablishment?.convertedToLocationId
      ? machines.filter(m => m.locationId === inviteEstablishment.convertedToLocationId).map(m => m.id)
      : []
  );

  const inviteModal = (
    <SimpleModal
      open={!!inviteEstablishment}
      onClose={() => setInviteEstablishment(null)}
      title={`Invitar Visor: ${inviteEstablishment?.name || ""}`}
      description="Crea una invitación para que el dueño del establecimiento pueda ver sus máquinas y comisiones."
    >
      <Form {...inviteForm}>
        <form
          onSubmit={inviteForm.handleSubmit((data) => {
            if (!data.email) {
              toast({ title: "Email requerido", variant: "destructive" });
              return;
            }
            if (data.machineIds.length === 0) {
              toast({ title: "Selecciona al menos una máquina", variant: "destructive" });
              return;
            }
            inviteMutation.mutate(data);
          })}
          className="flex flex-col min-h-0 flex-1"
          data-testid="modal-invite-viewer"
        >
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            <FormField control={inviteForm.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email del Visor *</FormLabel>
                <FormControl><Input type="email" {...field} data-testid="input-invite-email" /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={inviteForm.control} name="contactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de Contacto</FormLabel>
                  <FormControl><Input {...field} data-testid="input-invite-contact-name" /></FormControl>
                </FormItem>
              )} />
              <FormField control={inviteForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl><Input {...field} data-testid="input-invite-phone" /></FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={inviteForm.control} name="commissionPercent" render={({ field }) => (
              <FormItem>
                <FormLabel>Comisión (%)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} data-testid="input-invite-commission" /></FormControl>
              </FormItem>
            )} />
            <div>
              <p className="text-sm font-medium mb-2">Máquinas a Asignar *</p>
              {preselectedMachineIds.size > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  Las máquinas instaladas en este establecimiento están pre-seleccionadas.
                </p>
              )}
              {machinesForEstablishment.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-md p-3">
                  No hay máquinas disponibles en el sistema.
                </p>
              ) : (
                <div className="space-y-2 border rounded-md p-3 max-h-60 overflow-y-auto">
                  <FormField control={inviteForm.control} name="machineIds" render={({ field }) => (
                    <>
                      {machinesForEstablishment.map((m) => {
                        const checked = field.value?.includes(m.id);
                        const isPreselected = preselectedMachineIds.has(m.id);
                        return (
                          <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...(field.value || []), m.id]
                                  : (field.value || []).filter((id: string) => id !== m.id);
                                field.onChange(next);
                              }}
                              data-testid={`checkbox-invite-machine-${m.id}`}
                            />
                            <span className="font-medium">{m.code}</span>
                            <span className="text-muted-foreground">— {m.name}</span>
                            {isPreselected && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                                En este establecimiento
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </>
                  )} />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4 flex-shrink-0">
            <Button type="button" variant="ghost" onClick={() => setInviteEstablishment(null)}>Cancelar</Button>
            <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-submit-invite-viewer">
              {inviteMutation.isPending ? "Enviando..." : "Enviar invitación"}
            </Button>
          </div>
        </form>
      </Form>
    </SimpleModal>
  );

  const inviteLinkModal = (
    <SimpleModal
      open={!!inviteResult}
      onClose={() => setInviteResult(null)}
      title="Invitación creada"
      description="El correo automático no se envió (SMTP no configurado o falló). Comparte este enlace manualmente con el visor."
    >
      <div className="space-y-3 text-sm" data-testid="modal-invite-link">
        {inviteResult && (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>Destinatario: <span className="font-medium text-foreground">{inviteResult.email}</span></span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Enlace de invitación</p>
              <div className="flex items-center gap-2">
                <Input value={inviteResult.url} readOnly onFocus={(e) => e.currentTarget.select()} data-testid="input-invite-link" />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteResult.url);
                      toast({ title: "Enlace copiado" });
                    } catch {
                      toast({ title: "No se pudo copiar", variant: "destructive" });
                    }
                  }}
                  data-testid="button-copy-invite-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">El enlace es válido por 7 días.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setInviteResult(null)} data-testid="button-close-invite-link">Cerrar</Button>
            </div>
          </>
        )}
      </div>
    </SimpleModal>
  );

  if (selectedActive) {
    return (
      <>
        <div className="max-w-4xl mx-auto">
          <ActiveEstablishmentDetail
            establishment={selectedActive}
            onClose={() => { setSelectedActive(null); setScrollViewerToken(undefined); }}
            canEdit={canEdit}
            canCreate={canCreate}
            canDelete={canDelete}
            onInviteRequested={(est) => setInviteEstablishment(est)}
            scrollToViewerToken={scrollViewerToken}
          />
        </div>
        {inviteModal}
        {inviteLinkModal}
      </>
    );
  }

  const totalActive = activeEstablishments.length;
  const withViewerCount = activeEstablishments.filter(e => viewerByEstablishment.has(e.id)).length;
  const withoutViewerCount = totalActive - withViewerCount;
  const visibleEstablishments = withoutViewerOnly
    ? activeEstablishments.filter(e => !viewerByEstablishment.has(e.id))
    : activeEstablishments;

  return (
    <div className="space-y-4">
      {totalActive > 0 && (
        <Card data-testid="card-viewer-coverage">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Eye className="h-5 w-5 text-purple-700 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium" data-testid="text-viewer-coverage">
                  {withViewerCount} de {totalActive} establecimientos activos tienen visor asignado
                </p>
                <p className="text-xs text-muted-foreground">
                  {withoutViewerCount > 0
                    ? `${withoutViewerCount} pendiente${withoutViewerCount !== 1 ? "s" : ""} de invitación`
                    : "Cobertura completa"}
                </p>
              </div>
            </div>
            {withoutViewerCount > 0 && (
              <Button
                size="sm"
                variant={withoutViewerOnly ? "default" : "outline"}
                onClick={() => setWithoutViewerOnly(v => !v)}
                data-testid="button-toggle-without-viewer"
              >
                {withoutViewerOnly ? "Ver todos" : "Sin visor asignado"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar establecimiento activo..."
            className="pl-9"
            value={searchActive}
            onChange={(e) => setSearchActive(e.target.value)}
            data-testid="input-search-active"
          />
        </div>
        <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-contract-filter">
            <SelectValue placeholder="Estado contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="activo">Con contrato activo</SelectItem>
            <SelectItem value="vencido">Contrato vencido</SelectItem>
            <SelectItem value="cancelado">Contrato cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

      {withoutViewerOnly && visibleEstablishments.length === 0 && totalActive > 0 && (
        <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-pending">
          Todos los establecimientos activos ya tienen un visor asignado.
        </p>
      )}

      <div className="space-y-2">
        {visibleEstablishments.map((est) => (
          <Card
            key={est.id}
            className="cursor-pointer hover-elevate"
            onClick={() => setSelectedActive(est)}
            data-testid={`card-active-establishment-${est.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{est.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[est.contactName, est.address, est.city].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {est.machineCount} máquina{est.machineCount !== 1 ? "s" : ""}
                  </Badge>
                  {est.activeContract ? (
                    <ContractStatusBadge status={est.activeContract.status || "activo"} />
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">Sin contrato</Badge>
                  )}
                  {viewerByEstablishment.has(est.id) ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedActive(est); setScrollViewerToken(Date.now()); }}
                      data-testid={`link-viewer-${est.id}`}
                      className="appearance-none p-0 bg-transparent border-0"
                    >
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 cursor-pointer hover-elevate">
                        <Eye className="h-3 w-3 mr-1" /> Visor: {viewerByEstablishment.get(est.id)?.user?.username || "asignado"}
                      </Badge>
                    </button>
                  ) : canCreate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); setInviteEstablishment(est); }}
                      data-testid={`button-invite-viewer-${est.id}`}
                    >
                      <UserPlus className="h-3 w-3 mr-1" /> Invitar Visor
                    </Button>
                  )}
                  {est.convertedAt && (
                    <span className="text-xs text-muted-foreground">
                      Desde: {format(new Date(est.convertedAt), "dd MMM yyyy", { locale: es })}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && activeEstablishments.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay establecimientos activos</p>
          <p className="text-xs text-muted-foreground mt-1">
            Convierte prospectos desde el Pipeline para verlos aquí.
          </p>
        </div>
      )}

      {inviteModal}
        {inviteLinkModal}
    </div>
  );
}

type AdminUserInfo = { id: string; fullName: string | null; isActive: boolean; role: string };

type EstablishmentFormSection = "all" | "contact" | "commercial";

function EstablishmentFormFields({ form, isEdit = false, stages, adminUsers, section = "all" }: { form: UseFormReturn<EstablishmentFormValues>; isEdit?: boolean; stages: EstablishmentStageInfo[]; adminUsers: AdminUserInfo[]; section?: EstablishmentFormSection }) {
  const showAll = section === "all";
  const showContact = section === "contact" || showAll;
  const showCommercial = section === "commercial" || showAll;
  return (
    <div className="space-y-5 pr-1">
      {(showAll || showCommercial) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showAll && (
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Nombre del Establecimiento *</FormLabel>
                <FormControl><Input {...field} data-testid="input-establishment-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
          {showCommercial && (
            <>
              <FormField control={form.control} name="businessType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Negocio</FormLabel>
                  <FormControl>
                    <select {...field} value={field.value || "otro"} data-testid="select-business-type" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="colmado">Colmado</option>
                      <option value="supermercado">Supermercado</option>
                      <option value="restaurante">Restaurante</option>
                      <option value="hotel">Hotel</option>
                      <option value="oficina">Oficina</option>
                      <option value="universidad">Universidad</option>
                      <option value="hospital">Hospital</option>
                      <option value="farmacia">Farmacia</option>
                      <option value="gimnasio">Gimnasio</option>
                      <option value="plaza_comercial">Plaza Comercial</option>
                      <option value="estacion_servicio">Estación de Servicio</option>
                      <option value="tienda">Tienda</option>
                      <option value="bar">Bar</option>
                      <option value="club">Club</option>
                      <option value="fabrica">Fábrica</option>
                      <option value="gasolinera">Gasolinera</option>
                      <option value="centro_comercial">Centro Comercial</option>
                      <option value="otro">Otro</option>
                    </select>
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridad</FormLabel>
                  <FormControl>
                    <select {...field} value={field.value || "media"} data-testid="select-priority" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  </FormControl>
                </FormItem>
              )} />
            </>
          )}
        </div>
      )}

      {showContact && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Contacto</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <FormItem className="md:col-span-2">
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} data-testid="input-contact-email" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>
      )}

      {showContact && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Ubicación</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem className="md:col-span-2">
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
          </div>
        </div>
      )}

      {showCommercial && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Datos Comerciales</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="estimatedMachines" render={({ field }) => (
              <FormItem>
                <FormLabel>Máquinas Estimadas</FormLabel>
                <FormControl><Input type="number" min={1} {...field} data-testid="input-estimated-machines" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="monthlyEstimatedSales" render={({ field }) => (
              <FormItem>
                <FormLabel>Ventas Mensuales (RD$)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} data-testid="input-monthly-sales" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="commissionPercent" render={({ field }) => (
              <FormItem>
                <FormLabel>Comisión (%)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} data-testid="input-commission" /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>
      )}

      {(showCommercial || showAll) && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Seguimiento</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showCommercial && (
              <>
                <FormField control={form.control} name="nextAction" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Próxima acción</FormLabel>
                    <FormControl>
                      <select {...field} value={field.value || ""} data-testid="select-next-action" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value="">Sin acción</option>
                        <option value="llamar">Llamar</option>
                        <option value="visitar">Visitar</option>
                        <option value="enviar_propuesta">Enviar propuesta</option>
                        <option value="seguimiento">Seguimiento</option>
                        <option value="negociar">Negociar</option>
                        <option value="cerrar">Cerrar</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="nextActionDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha próxima gestión</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-next-action-date" /></FormControl>
                  </FormItem>
                )} />
              </>
            )}
            {showAll && (
              <>
                <FormField control={form.control} name="stageId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Etapa</FormLabel>
                    <FormControl>
                      <select {...field} value={field.value || ""} data-testid="select-stage" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value="">Seleccionar etapa</option>
                        {stages.map((s: EstablishmentStageInfo) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="assignedUserId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asignar a</FormLabel>
                    <FormControl>
                      <select {...field} value={field.value || ""} data-testid="select-assigned-user" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value="">Sin asignar</option>
                        {adminUsers.filter((u) => u.isActive && (u.role === "admin" || u.role === "supervisor")).map((u) => (
                          <option key={u.id} value={u.id}>{u.fullName}</option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
              </>
            )}
            {showCommercial && (
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Notas</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-notes" /></FormControl>
                </FormItem>
              )} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type LinkedViewerData = {
  id: string;
  defaultCommissionPercent: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  user: { id: string; username: string; email?: string | null; fullName?: string | null } | null;
  assignments: Array<{
    id: string;
    machineId: string;
    commissionPercent: string | null;
    isActive: boolean;
    machine: { id: string; code: string; name: string } | null;
  }>;
};

type PendingViewerInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  metadata: {
    establishmentName?: string;
    contactName?: string;
    phone?: string;
    machineIds?: string[];
    commissionPercent?: string;
  } | null;
};

function parseApiError(err: any, fallback: string): string {
  let msg: string = err?.message || fallback;
  const match = typeof msg === "string" ? msg.match(/^\d+:\s*(.+)$/) : null;
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed?.error) return parsed.error;
    } catch {
      return match[1];
    }
  }
  return msg;
}

function LinkedViewerSection({
  establishment,
  establishmentMachines,
  canEdit,
  canCreate,
  canDelete,
  onInviteRequested,
}: {
  establishment: ActiveEstablishment;
  establishmentMachines: Array<{ id: string; code: string; name: string; locationId?: string | null }>;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onInviteRequested: (est: ActiveEstablishment) => void;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({ contactName: "", contactPhone: "", defaultCommissionPercent: "5.00" });
  const [machinesToAdd, setMachinesToAdd] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resendResult, setResendResult] = useState<{ url: string; email: string } | null>(null);

  const { data: linkedViewer } = useQuery<LinkedViewerData | null>({
    queryKey: ["/api/establishments", establishment.id, "viewer"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/establishments/${establishment.id}/viewer`);
        return await res.json();
      } catch {
        return null;
      }
    },
  });

  const { data: pendingInvite } = useQuery<PendingViewerInvite | null>({
    queryKey: ["/api/establishments", establishment.id, "viewer-invite"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/establishments/${establishment.id}/viewer-invite`);
        return await res.json();
      } catch {
        return null;
      }
    },
    enabled: !linkedViewer,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "viewer"] });
    queryClient.invalidateQueries({ queryKey: ["/api/establishments", establishment.id, "viewer-invite"] });
    queryClient.invalidateQueries({ queryKey: ["/api/establishment-viewers"] });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: { contactName?: string; contactPhone?: string; defaultCommissionPercent?: string; isActive?: boolean }) => {
      if (!linkedViewer) throw new Error("Sin visor");
      return apiRequest("PATCH", `/api/establishment-viewers/${linkedViewer.id}`, data);
    },
    onSuccess: () => {
      invalidateAll();
      setIsEditing(false);
      toast({ title: "Visor actualizado" });
    },
    onError: (err: any) => toast({ title: "Error al actualizar", description: parseApiError(err, "Intenta nuevamente"), variant: "destructive" }),
  });

  const addAssignmentsMutation = useMutation({
    mutationFn: async (machineIds: string[]) => {
      if (!linkedViewer) throw new Error("Sin visor");
      return apiRequest("POST", `/api/establishment-viewers/${linkedViewer.id}/assignments`, { machineIds });
    },
    onSuccess: () => {
      invalidateAll();
      setMachinesToAdd([]);
      toast({ title: "Máquinas asignadas" });
    },
    onError: (err: any) => toast({ title: "Error al asignar máquinas", description: parseApiError(err, "Intenta nuevamente"), variant: "destructive" }),
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!linkedViewer) throw new Error("Sin visor");
      return apiRequest("DELETE", `/api/establishment-viewers/${linkedViewer.id}/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Máquina desasignada" });
    },
    onError: (err: any) => toast({ title: "Error al desasignar", description: parseApiError(err, "Intenta nuevamente"), variant: "destructive" }),
  });

  const deleteViewerMutation = useMutation({
    mutationFn: async () => {
      if (!linkedViewer) throw new Error("Sin visor");
      return apiRequest("DELETE", `/api/establishment-viewers/${linkedViewer.id}`);
    },
    onSuccess: () => {
      invalidateAll();
      setConfirmDelete(false);
      toast({ title: "Visor eliminado" });
    },
    onError: (err: any) => toast({ title: "Error al eliminar visor", description: parseApiError(err, "Intenta nuevamente"), variant: "destructive" }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async () => {
      if (!pendingInvite) throw new Error("Sin invitación");
      const meta = pendingInvite.metadata || {};
      const res = await apiRequest("POST", "/api/viewer-invites", {
        email: pendingInvite.email,
        establishmentName: meta.establishmentName || establishment.name,
        contactName: meta.contactName || "",
        phone: meta.phone || "",
        commissionPercent: meta.commissionPercent || "5.00",
        machineIds: meta.machineIds || [],
        establishmentId: establishment.id,
      });
      return await res.json();
    },
    onSuccess: (result: any) => {
      invalidateAll();
      const fullUrl = `${window.location.origin}${result.inviteUrl}`;
      if (result.emailSent) {
        toast({ title: "Invitación reenviada por correo", description: `Enviada a ${result.email}` });
      } else {
        setResendResult({ url: fullUrl, email: result.email });
      }
    },
    onError: (err: any) => toast({ title: "Error al reenviar", description: parseApiError(err, "Intenta nuevamente"), variant: "destructive" }),
  });

  const startEditing = () => {
    if (!linkedViewer) return;
    setEditValues({
      contactName: linkedViewer.contactName || "",
      contactPhone: linkedViewer.contactPhone || "",
      defaultCommissionPercent: linkedViewer.defaultCommissionPercent || "5.00",
    });
    setIsEditing(true);
  };

  const assignedMachineIds = new Set((linkedViewer?.assignments || []).map(a => a.machineId));
  const eligibleMachines = establishmentMachines.filter(m => !assignedMachineIds.has(m.id));

  const renderHeader = (right?: React.ReactNode) => (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4" /> Visor del Establecimiento
        </CardTitle>
        {right}
      </div>
    </CardHeader>
  );

  if (linkedViewer) {
    return (
      <Card>
        {renderHeader(
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={linkedViewer.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"}>
              {linkedViewer.isActive ? "Activo" : "Inactivo"}
            </Badge>
            {canEdit && !isEditing && (
              <Button size="sm" variant="outline" onClick={startEditing} data-testid="button-edit-viewer">
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
            )}
          </div>
        )}
        <CardContent className="space-y-4 text-sm" data-testid="section-linked-viewer">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium" data-testid="text-viewer-username">{linkedViewer.user?.username}</span>
              {linkedViewer.user?.email && <span className="text-muted-foreground">— {linkedViewer.user.email}</span>}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3 border rounded-md p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nombre de contacto</label>
                  <Input value={editValues.contactName} onChange={(e) => setEditValues(v => ({ ...v, contactName: e.target.value }))} data-testid="input-edit-viewer-contact" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Teléfono</label>
                  <Input value={editValues.contactPhone} onChange={(e) => setEditValues(v => ({ ...v, contactPhone: e.target.value }))} data-testid="input-edit-viewer-phone" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Comisión por defecto (%)</label>
                  <Input type="number" step="0.01" value={editValues.defaultCommissionPercent} onChange={(e) => setEditValues(v => ({ ...v, defaultCommissionPercent: e.target.value }))} data-testid="input-edit-viewer-commission" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button size="sm" onClick={() => updateMutation.mutate(editValues)} disabled={updateMutation.isPending} data-testid="button-save-viewer">
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-muted-foreground">
              {linkedViewer.contactName && (
                <div className="flex items-center gap-2"><User className="h-4 w-4" /> Contacto: {linkedViewer.contactName}</div>
              )}
              {linkedViewer.contactPhone && (
                <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {linkedViewer.contactPhone}</div>
              )}
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Comisión por defecto: {linkedViewer.defaultCommissionPercent || "5.00"}%
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Máquinas asignadas: {linkedViewer.assignments?.length || 0}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-medium">Máquinas asignadas</p>
            {linkedViewer.assignments.length === 0 ? (
              <p className="text-muted-foreground text-xs">Aún no hay máquinas asignadas.</p>
            ) : (
              <div className="border rounded-md divide-y">
                {linkedViewer.assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 p-2" data-testid={`row-viewer-assignment-${a.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{a.machine?.code || "—"}</span>
                      <span className="text-muted-foreground truncate">{a.machine?.name || ""}</span>
                      {a.commissionPercent && <Badge variant="secondary" className="text-xs">{a.commissionPercent}%</Badge>}
                    </div>
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => removeAssignmentMutation.mutate(a.id)} disabled={removeAssignmentMutation.isPending} data-testid={`button-remove-assignment-${a.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && eligibleMachines.length > 0 && (
              <div className="border rounded-md p-3 space-y-2">
                <p className="text-xs font-medium">Agregar máquinas del establecimiento</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {eligibleMachines.map((m) => {
                    const checked = machinesToAdd.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setMachinesToAdd(prev => e.target.checked ? [...prev, m.id] : prev.filter(id => id !== m.id));
                          }}
                          data-testid={`checkbox-add-machine-${m.id}`}
                        />
                        <span className="font-medium">{m.code}</span>
                        <span className="text-muted-foreground">— {m.name}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => addAssignmentsMutation.mutate(machinesToAdd)} disabled={machinesToAdd.length === 0 || addAssignmentsMutation.isPending} data-testid="button-add-assignments">
                    <Plus className="h-3 w-3 mr-1" /> Asignar seleccionadas
                  </Button>
                </div>
              </div>
            )}
            {canEdit && eligibleMachines.length === 0 && linkedViewer.assignments.length > 0 && establishmentMachines.length > 0 && (
              <p className="text-xs text-muted-foreground">Todas las máquinas del establecimiento están asignadas al visor.</p>
            )}
          </div>

          {(canEdit || canDelete) && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ isActive: !linkedViewer.isActive })} disabled={updateMutation.isPending} data-testid="button-toggle-viewer-active">
                  {linkedViewer.isActive ? "Desactivar" : "Activar"}
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)} data-testid="button-delete-viewer">
                  <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                </Button>
              )}
            </div>
          )}
        </CardContent>

        <SimpleModal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Eliminar visor"
          description="Se desactivará el visor y se removerán sus permisos. Esta acción no se puede deshacer fácilmente."
        >
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteViewerMutation.mutate()} disabled={deleteViewerMutation.isPending} data-testid="button-confirm-delete-viewer">
              Eliminar visor
            </Button>
          </div>
        </SimpleModal>
      </Card>
    );
  }

  if (pendingInvite) {
    return (
      <Card>
        {renderHeader(
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Invitación pendiente
          </Badge>
        )}
        <CardContent className="space-y-3 text-sm" data-testid="section-pending-invite">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium" data-testid="text-pending-invite-email">{pendingInvite.email}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enviada {format(new Date(pendingInvite.createdAt), "dd MMM yyyy HH:mm", { locale: es })} · expira {format(new Date(pendingInvite.expiresAt), "dd MMM yyyy", { locale: es })}
          </p>
          <p className="text-muted-foreground text-xs">
            Máquinas pre-asignadas: {pendingInvite.metadata?.machineIds?.length || 0}
          </p>
          {canCreate && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => resendInviteMutation.mutate()} disabled={resendInviteMutation.isPending} data-testid="button-resend-invite">
                <RefreshCw className="h-3 w-3 mr-1" /> Reenviar invitación
              </Button>
            </div>
          )}
        </CardContent>
        <SimpleModal
          open={!!resendResult}
          onClose={() => setResendResult(null)}
          title="Invitación reenviada"
          description="No se pudo enviar el correo automáticamente. Comparte este enlace manualmente con el visor."
        >
          <div className="space-y-3 text-sm" data-testid="modal-resend-link">
            {resendResult && (
              <>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Destinatario: <span className="font-medium text-foreground">{resendResult.email}</span></span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Enlace de invitación</p>
                  <div className="flex items-center gap-2">
                    <Input value={resendResult.url} readOnly onFocus={(e) => e.currentTarget.select()} data-testid="input-resend-link" />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(resendResult.url);
                          toast({ title: "Enlace copiado" });
                        } catch {
                          toast({ title: "No se pudo copiar", variant: "destructive" });
                        }
                      }}
                      data-testid="button-copy-resend-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setResendResult(null)} data-testid="button-close-resend-link">Cerrar</Button>
                </div>
              </>
            )}
          </div>
        </SimpleModal>
      </Card>
    );
  }

  return (
    <Card>
      {renderHeader()}
      <CardContent className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <p className="text-muted-foreground">No hay visor asignado a este establecimiento.</p>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={() => onInviteRequested(establishment)} data-testid="button-invite-viewer-inline">
            <UserPlus className="h-3 w-3 mr-1" /> Invitar Visor
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SimpleModal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description: string; children: React.ReactNode }) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, handleEscape]);

  if (!open) return null;
  const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const descId = `modal-desc-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
      <div className="fixed inset-0 bg-black/80 animate-in fade-in-0" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-background rounded-lg shadow-lg border max-w-2xl w-full max-h-[85vh] flex flex-col pointer-events-auto p-6 relative animate-in fade-in-0 zoom-in-95">
          <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-col space-y-1.5 text-left flex-shrink-0 mb-4">
            <h2 id={titleId} className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
            <p id={descId} className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
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
  const pageSearch = useSearch();
  const initialTab = new URLSearchParams(pageSearch).get("tab") === "activos" ? "activos" : "en-proceso";
  const [mainTab, setMainTab] = useState(initialTab);
  useEffect(() => {
    const t = new URLSearchParams(pageSearch).get("tab");
    if (t === "activos" || t === "en-proceso") setMainTab(t);
  }, [pageSearch]);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterAssigned, setFilterAssigned] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentWithRelations | null>(null);
  const [editingEstablishment, setEditingEstablishment] = useState<EstablishmentWithRelations | null>(null);
  const [editingSection, setEditingSection] = useState<EstablishmentFormSection>("all");
  const selectedId = selectedEstablishment?.id ?? null;

  const { data: selectedFresh } = useQuery<EstablishmentWithRelations>({
    queryKey: ["/api/establishments", selectedId],
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (!selectedFresh || !selectedId) return;
    if (selectedFresh.id !== selectedId) return;
    setSelectedEstablishment((prev) => {
      if (!prev || prev.id !== selectedFresh.id) return prev;
      if (prev.updatedAt === selectedFresh.updatedAt) return prev;
      return { ...prev, ...selectedFresh };
    });
  }, [selectedFresh, selectedId]);

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
      const payload: Record<string, string | number | null | undefined> = { ...data };
      if (!payload.contactEmail) delete payload.contactEmail;
      if (!payload.stageId) delete payload.stageId;
      if (!payload.assignedUserId) payload.assignedUserId = null;
      if (!payload.monthlyEstimatedSales) delete payload.monthlyEstimatedSales;
      if (!payload.nextActionDate) payload.nextActionDate = null;
      if (!payload.nextAction) payload.nextAction = null;
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
      const payload: Record<string, string | number | null | undefined> = { ...data };
      if (!payload.contactEmail) delete payload.contactEmail;
      if (!payload.assignedUserId) delete payload.assignedUserId;
      if (!payload.stageId) delete payload.stageId;
      if (!payload.monthlyEstimatedSales) delete payload.monthlyEstimatedSales;
      if (!payload.nextActionDate) payload.nextActionDate = null;
      if (!payload.nextAction) payload.nextAction = null;
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

  const openEditDialog = (est: EstablishmentWithRelations, section: EstablishmentFormSection = "all") => {
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
    setEditingSection(section);
    setEditingEstablishment(est);
  };

  const CONTACT_FIELDS: (keyof EstablishmentFormValues)[] = ["contactName", "contactPhone", "contactEmail", "address", "city", "zone", "gpsCoordinates"];
  const COMMERCIAL_FIELDS: (keyof EstablishmentFormValues)[] = ["businessType", "priority", "estimatedMachines", "monthlyEstimatedSales", "commissionPercent", "nextAction", "nextActionDate", "notes"];

  const buildSectionPayload = (data: EstablishmentFormValues, section: EstablishmentFormSection): Partial<EstablishmentFormValues> => {
    if (section === "all") return data;
    const keys = section === "contact" ? CONTACT_FIELDS : COMMERCIAL_FIELDS;
    const out: Partial<EstablishmentFormValues> = {};
    for (const k of keys) {
      out[k] = data[k] as never;
    }
    return out;
  };

  const editModalTitle = editingSection === "contact"
    ? "Editar Información de Contacto"
    : editingSection === "commercial"
      ? "Editar Datos Comerciales"
      : "Editar Establecimiento";
  const editModalDescription = editingSection === "contact"
    ? "Actualiza el contacto y la ubicación del establecimiento."
    : editingSection === "commercial"
      ? "Actualiza los datos comerciales y de seguimiento."
      : "Modifica los datos del establecimiento seleccionado.";

  const groupedByStage = stages.map((stage) => ({
    stage,
    items: establishments.filter((e) => e.stageId === stage.id),
  }));

  if (selectedEstablishment) {
    return (
      <>
        <div className="p-6 max-w-4xl mx-auto">
          <EstablishmentDetail
            establishment={selectedEstablishment}
            stages={stages}
            onClose={() => setSelectedEstablishment(null)}
            onEditContact={() => openEditDialog(selectedEstablishment, "contact")}
            onEditCommercial={() => openEditDialog(selectedEstablishment, "commercial")}
            onDelete={() => deleteMutation.mutate(selectedEstablishment.id)}
            canEdit={canEdit}
            canCreate={canCreate}
            canApprove={canApprove}
            canDelete={canDelete}
            onStageChange={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/establishments"] });
              queryClient.invalidateQueries({ queryKey: ["/api/establishments/stats"] });
            }}
          />
        </div>
        <SimpleModal open={!!editingEstablishment} onClose={() => setEditingEstablishment(null)} title={editModalTitle} description={editModalDescription}>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editingEstablishment && updateMutation.mutate({ id: editingEstablishment.id, data: buildSectionPayload(data, editingSection) as EstablishmentFormValues }))} className="flex flex-col min-h-0 flex-1" data-testid={`modal-edit-establishment-${editingSection}`}>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <EstablishmentFormFields form={editForm} isEdit stages={stages} adminUsers={adminUsers} section={editingSection} />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4 flex-shrink-0">
                <Button type="button" variant="ghost" onClick={() => setEditingEstablishment(null)}>Cancelar</Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                  {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Form>
        </SimpleModal>
      </>
    );
  }

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
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color ?? NEUTRAL_STAGE_COLOR }} />
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
          <ActiveEstablishmentsTab canEdit={canEdit} canCreate={canCreate} canDelete={canDelete} />
        </TabsContent>
      </Tabs>

      <SimpleModal open={showCreateDialog} onClose={() => setShowCreateDialog(false)} title="Nuevo Establecimiento" description="Registra un nuevo prospecto en el pipeline de establecimientos.">
        <Form {...createForm}>
          <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="flex flex-col min-h-0 flex-1" data-testid="modal-create-establishment">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <EstablishmentFormFields form={createForm} stages={stages} adminUsers={adminUsers} />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4 flex-shrink-0">
              <Button type="button" variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                {createMutation.isPending ? "Creando..." : "Crear Establecimiento"}
              </Button>
            </div>
          </form>
        </Form>
      </SimpleModal>

      <SimpleModal open={!!editingEstablishment} onClose={() => setEditingEstablishment(null)} title={editModalTitle} description={editModalDescription}>
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit((data) => editingEstablishment && updateMutation.mutate({ id: editingEstablishment.id, data: buildSectionPayload(data, editingSection) as EstablishmentFormValues }))} className="flex flex-col min-h-0 flex-1" data-testid={`modal-edit-establishment-${editingSection}`}>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <EstablishmentFormFields form={editForm} isEdit stages={stages} adminUsers={adminUsers} section={editingSection} />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4 flex-shrink-0">
              <Button type="button" variant="ghost" onClick={() => setEditingEstablishment(null)}>Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </SimpleModal>
    </div>
  );
}
