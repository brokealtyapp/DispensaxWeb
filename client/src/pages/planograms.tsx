import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LayoutGrid, Search, Save, Copy, X, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PlanogramMachine {
  id: string;
  name: string;
  code: string | null;
  zone: string | null;
}

interface PlanogramProduct {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
}

interface PlanogramEntry {
  machineId: string;
  productId: string;
  currentQuantity: number;
  maxCapacity: number;
  minLevel: number;
  standardQuantity: number | null;
}

interface PlanogramData {
  machines: PlanogramMachine[];
  products: PlanogramProduct[];
  entries: PlanogramEntry[];
}

interface CellEditorState {
  productId: string;
  machineId: string;
  standardQuantity: string;
  maxCapacity: string;
}

interface BulkApplyState {
  productId: string;
  productName: string;
  selectedMachineIds: Set<string>;
  standardQuantity: string;
  maxCapacity: string;
}

export function PlanogramsPage() {
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const canEditPlanograms = canEdit("machines");

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [hideEmptyRows, setHideEmptyRows] = useState(true);
  const [editingCell, setEditingCell] = useState<CellEditorState | null>(null);
  const [bulkApply, setBulkApply] = useState<BulkApplyState | null>(null);

  const { data, isLoading } = useQuery<PlanogramData>({
    queryKey: ["/api/planograms"],
  });

  const machines = data?.machines ?? [];
  const products = data?.products ?? [];
  const entries = data?.entries ?? [];

  // Index entries by machine+product for fast lookup
  const entryMap = useMemo(() => {
    const m = new Map<string, PlanogramEntry>();
    for (const e of entries) {
      m.set(`${e.machineId}:${e.productId}`, e);
    }
    return m;
  }, [entries]);

  // Available zones / categories for filters
  const zones = useMemo(() => {
    const set = new Set<string>();
    machines.forEach(m => m.zone && set.add(m.zone));
    return Array.from(set).sort();
  }, [machines]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const filteredMachines = useMemo(() => {
    if (zoneFilter === "all") return machines;
    return machines.filter(m => m.zone === zoneFilter);
  }, [machines, zoneFilter]);

  const filteredProducts = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter(p => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (s) {
        const matches =
          p.name.toLowerCase().includes(s) ||
          (p.code ?? "").toLowerCase().includes(s);
        if (!matches) return false;
      }
      if (hideEmptyRows) {
        const hasAny = filteredMachines.some(m => entryMap.has(`${m.id}:${p.id}`));
        if (!hasAny) return false;
      }
      return true;
    });
  }, [products, search, categoryFilter, hideEmptyRows, filteredMachines, entryMap]);

  const updateCellMutation = useMutation({
    mutationFn: async (vars: {
      machineId: string;
      productId: string;
      standardQuantity: number | null;
      maxCapacity: number;
      isCreate: boolean;
    }) => {
      if (vars.isCreate) {
        // Si la celda no existía, crear vía bulk endpoint con una sola máquina
        const response = await apiRequest("POST", "/api/planograms/bulk", {
          productId: vars.productId,
          machineIds: [vars.machineId],
          standardQuantity: vars.standardQuantity,
          maxCapacity: vars.maxCapacity,
        });
        return response.json();
      }
      const response = await apiRequest(
        "PATCH",
        `/api/machines/${vars.machineId}/inventory/${vars.productId}`,
        {
          standardQuantity: vars.standardQuantity,
          maxCapacity: vars.maxCapacity,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planograms"] });
      setEditingCell(null);
      toast({ title: "Celda actualizada", description: "El planograma se guardó correctamente" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la celda",
        variant: "destructive",
      });
    },
  });

  const bulkApplyMutation = useMutation({
    mutationFn: async (vars: {
      productId: string;
      machineIds: string[];
      standardQuantity?: number | null;
      maxCapacity?: number;
    }) => {
      const response = await apiRequest("POST", "/api/planograms/bulk", vars);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/planograms"] });
      setBulkApply(null);
      const hasAdjustments = Array.isArray(data?.adjusted) && data.adjusted.length > 0;
      toast({
        title: hasAdjustments ? "Aplicado con ajustes" : "Aplicado a varias máquinas",
        description: data?.message || "Planograma actualizado",
        variant: hasAdjustments ? "destructive" : undefined,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo aplicar el planograma",
        variant: "destructive",
      });
    },
  });

  const openCellEditor = (productId: string, machineId: string) => {
    if (!canEditPlanograms) return;
    const e = entryMap.get(`${machineId}:${productId}`);
    setEditingCell({
      productId,
      machineId,
      standardQuantity:
        e?.standardQuantity !== null && e?.standardQuantity !== undefined
          ? String(e.standardQuantity)
          : "",
      maxCapacity: String(e?.maxCapacity ?? 20),
    });
  };

  const handleSaveCell = () => {
    if (!editingCell) return;
    const max = parseInt(editingCell.maxCapacity, 10);
    if (!Number.isFinite(max) || max < 1) {
      toast({
        title: "Capacidad inválida",
        description: "La capacidad máxima debe ser mayor a 0",
        variant: "destructive",
      });
      return;
    }
    const stdRaw = editingCell.standardQuantity.trim();
    let std: number | null = null;
    if (stdRaw !== "") {
      const parsed = parseInt(stdRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast({
          title: "Carga estándar inválida",
          description: "Debe ser un número mayor o igual a 0",
          variant: "destructive",
        });
        return;
      }
      if (parsed > max) {
        toast({
          title: "Valor incoherente",
          description: "La carga estándar no puede ser mayor a la capacidad máxima",
          variant: "destructive",
        });
        return;
      }
      std = parsed;
    }
    const isCreate = !entryMap.has(`${editingCell.machineId}:${editingCell.productId}`);
    updateCellMutation.mutate({
      machineId: editingCell.machineId,
      productId: editingCell.productId,
      standardQuantity: std,
      maxCapacity: max,
      isCreate,
    });
  };

  const openBulkApply = (product: PlanogramProduct) => {
    if (!canEditPlanograms) return;
    // Pre-seleccionar máquinas que ya tienen el producto
    const existing = new Set<string>();
    filteredMachines.forEach(m => {
      if (entryMap.has(`${m.id}:${product.id}`)) existing.add(m.id);
    });
    setBulkApply({
      productId: product.id,
      productName: product.name,
      selectedMachineIds: existing,
      standardQuantity: "",
      maxCapacity: "",
    });
  };

  const toggleBulkMachine = (machineId: string) => {
    setBulkApply(prev => {
      if (!prev) return prev;
      const next = new Set(prev.selectedMachineIds);
      if (next.has(machineId)) next.delete(machineId);
      else next.add(machineId);
      return { ...prev, selectedMachineIds: next };
    });
  };

  const toggleBulkAllMachines = () => {
    setBulkApply(prev => {
      if (!prev) return prev;
      if (prev.selectedMachineIds.size === filteredMachines.length) {
        return { ...prev, selectedMachineIds: new Set() };
      }
      return {
        ...prev,
        selectedMachineIds: new Set(filteredMachines.map(m => m.id)),
      };
    });
  };

  const handleBulkSubmit = () => {
    if (!bulkApply) return;
    const machineIds = Array.from(bulkApply.selectedMachineIds);
    if (machineIds.length === 0) {
      toast({
        title: "Sin selección",
        description: "Selecciona al menos una máquina",
        variant: "destructive",
      });
      return;
    }

    const stdRaw = bulkApply.standardQuantity.trim();
    const maxRaw = bulkApply.maxCapacity.trim();
    if (stdRaw === "" && maxRaw === "") {
      toast({
        title: "Sin valores",
        description: "Ingresa al menos carga estándar o capacidad máxima",
        variant: "destructive",
      });
      return;
    }

    const payload: {
      productId: string;
      machineIds: string[];
      standardQuantity?: number | null;
      maxCapacity?: number;
    } = {
      productId: bulkApply.productId,
      machineIds,
    };

    let parsedMax: number | undefined;
    if (maxRaw !== "") {
      const parsed = parseInt(maxRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        toast({
          title: "Capacidad inválida",
          description: "La capacidad máxima debe ser mayor a 0",
          variant: "destructive",
        });
        return;
      }
      parsedMax = parsed;
      payload.maxCapacity = parsed;
    }

    if (stdRaw !== "") {
      const parsed = parseInt(stdRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast({
          title: "Carga estándar inválida",
          description: "Debe ser un número mayor o igual a 0",
          variant: "destructive",
        });
        return;
      }
      if (parsedMax !== undefined && parsed > parsedMax) {
        toast({
          title: "Valor incoherente",
          description: "La carga estándar no puede ser mayor a la capacidad máxima",
          variant: "destructive",
        });
        return;
      }
      payload.standardQuantity = parsed;
    }

    bulkApplyMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-planograms">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
            <LayoutGrid className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-planograms-title">
              Planogramas
            </h1>
            <p className="text-sm text-muted-foreground">
              Edita capacidad máxima y carga estándar de cada producto en cada máquina.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Tabla pivote (productos × máquinas)</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-56"
                data-testid="input-search-product"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48" data-testid="select-category">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-44" data-testid="select-zone">
                <SelectValue placeholder="Zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las zonas</SelectItem>
                {zones.map(z => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 pl-1">
              <Checkbox
                id="hide-empty"
                checked={hideEmptyRows}
                onCheckedChange={(v) => setHideEmptyRows(v === true)}
                data-testid="checkbox-hide-empty"
              />
              <Label htmlFor="hide-empty" className="text-sm cursor-pointer">
                Ocultar productos sin asignar
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMachines.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground" data-testid="text-empty-machines">
              No hay máquinas activas en esta selección.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground" data-testid="text-empty-products">
              No hay productos que coincidan con los filtros.
            </div>
          ) : (
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <div className="min-w-max">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur px-3 py-2 text-left font-medium border-r min-w-[260px]">
                        Producto
                      </th>
                      {canEditPlanograms && (
                        <th className="bg-muted/80 px-2 py-2 text-left font-medium border-r min-w-[170px]">
                          Acciones
                        </th>
                      )}
                      {filteredMachines.map(m => (
                        <th
                          key={m.id}
                          className="px-3 py-2 text-left font-medium border-r min-w-[140px]"
                          data-testid={`header-machine-${m.id}`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{m.code}</span>
                            <span className="font-semibold truncate max-w-[140px]" title={m.name}>
                              {m.name}
                            </span>
                            {m.zone && (
                              <span className="text-[10px] text-muted-foreground">{m.zone}</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="border-t" data-testid={`row-product-${p.id}`}>
                        <td className="sticky left-0 z-10 bg-background px-3 py-2 border-r">
                          <div className="flex flex-col">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.code || "—"} {p.category && `· ${p.category}`}
                            </span>
                          </div>
                        </td>
                        {canEditPlanograms && (
                          <td className="bg-background px-2 py-2 border-r">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openBulkApply(p)}
                              data-testid={`button-bulk-apply-${p.id}`}
                            >
                              <Copy className="h-3.5 w-3.5 mr-1.5" />
                              Aplicar a varias
                            </Button>
                          </td>
                        )}
                        {filteredMachines.map(m => {
                          const e = entryMap.get(`${m.id}:${p.id}`);
                          const isEditing =
                            editingCell?.productId === p.id &&
                            editingCell?.machineId === m.id;
                          return (
                            <td
                              key={m.id}
                              className="px-2 py-2 border-r align-top"
                              data-testid={`cell-${m.id}-${p.id}`}
                            >
                              <Popover
                                open={isEditing}
                                onOpenChange={(open) => {
                                  if (!open) setEditingCell(null);
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => openCellEditor(p.id, m.id)}
                                    disabled={!canEditPlanograms}
                                    className="w-full text-left rounded-md hover-elevate active-elevate-2 px-2 py-1.5 disabled:cursor-default disabled:hover:bg-transparent"
                                    data-testid={`button-cell-${m.id}-${p.id}`}
                                  >
                                    {e ? (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-mono text-sm">
                                          {e.standardQuantity ?? "—"} / {e.maxCapacity}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          actual {e.currentQuantity}
                                        </span>
                                      </div>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] font-normal">
                                        sin asignar
                                      </Badge>
                                    )}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-3" align="start">
                                  <div className="space-y-3">
                                    <div className="text-xs text-muted-foreground">
                                      {p.name} · {m.code}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Carga estándar</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={editingCell?.standardQuantity ?? ""}
                                          onChange={(ev) =>
                                            setEditingCell(prev =>
                                              prev
                                                ? { ...prev, standardQuantity: ev.target.value }
                                                : prev
                                            )
                                          }
                                          data-testid={`input-cell-std-${m.id}-${p.id}`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Capacidad máx</Label>
                                        <Input
                                          type="number"
                                          min={1}
                                          value={editingCell?.maxCapacity ?? ""}
                                          onChange={(ev) =>
                                            setEditingCell(prev =>
                                              prev
                                                ? { ...prev, maxCapacity: ev.target.value }
                                                : prev
                                            )
                                          }
                                          data-testid={`input-cell-max-${m.id}-${p.id}`}
                                        />
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                      Deja la carga estándar vacía para no fijar un valor.
                                    </p>
                                    <div className="flex justify-end gap-2 pt-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingCell(null)}
                                        data-testid={`button-cancel-cell-${m.id}-${p.id}`}
                                      >
                                        <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleSaveCell}
                                        disabled={updateCellMutation.isPending}
                                        data-testid={`button-save-cell-${m.id}-${p.id}`}
                                      >
                                        <Save className="h-3.5 w-3.5 mr-1" /> Guardar
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!bulkApply} onOpenChange={(open) => !open && setBulkApply(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aplicar a varias máquinas</DialogTitle>
            <DialogDescription>
              Producto: <span className="font-medium">{bulkApply?.productName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bulk-std" className="text-xs">Carga estándar</Label>
                <Input
                  id="bulk-std"
                  type="number"
                  min={0}
                  value={bulkApply?.standardQuantity ?? ""}
                  onChange={(e) =>
                    setBulkApply(prev =>
                      prev ? { ...prev, standardQuantity: e.target.value } : prev
                    )
                  }
                  placeholder="Ej. 12"
                  data-testid="input-bulk-std"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bulk-max" className="text-xs">Capacidad máxima</Label>
                <Input
                  id="bulk-max"
                  type="number"
                  min={1}
                  value={bulkApply?.maxCapacity ?? ""}
                  onChange={(e) =>
                    setBulkApply(prev =>
                      prev ? { ...prev, maxCapacity: e.target.value } : prev
                    )
                  }
                  placeholder="Ej. 20"
                  data-testid="input-bulk-max"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Deja un campo vacío para no modificarlo. Si no existe el producto en una máquina seleccionada, se creará la entrada.
            </p>

            <div className="border rounded-md">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bulk-all"
                    checked={
                      bulkApply
                        ? bulkApply.selectedMachineIds.size === filteredMachines.length &&
                          filteredMachines.length > 0
                        : false
                    }
                    onCheckedChange={() => toggleBulkAllMachines()}
                    data-testid="checkbox-bulk-all"
                  />
                  <Label htmlFor="bulk-all" className="text-sm cursor-pointer">
                    Seleccionar todas ({filteredMachines.length})
                  </Label>
                </div>
                <span className="text-xs text-muted-foreground" data-testid="text-bulk-selected-count">
                  {bulkApply?.selectedMachineIds.size ?? 0} seleccionadas
                </span>
              </div>
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {filteredMachines.map(m => {
                    const checked = bulkApply?.selectedMachineIds.has(m.id) ?? false;
                    const hasEntry = entryMap.has(`${m.id}:${bulkApply?.productId ?? ""}`);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleBulkMachine(m.id)}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover-elevate active-elevate-2 text-left"
                        data-testid={`button-bulk-machine-${m.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{m.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {m.code}{m.zone ? ` · ${m.zone}` : ""}
                            </span>
                          </div>
                        </div>
                        {hasEntry ? (
                          <Badge variant="secondary" className="text-[10px]">existe</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">se creará</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkApply(null)} data-testid="button-bulk-cancel">
              Cancelar
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={bulkApplyMutation.isPending}
              data-testid="button-bulk-submit"
            >
              <Check className="h-4 w-4 mr-1.5" /> Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PlanogramsPage;
