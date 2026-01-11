import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarIcon,
  DollarSign,
  Percent,
  Box,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface MachineWithSales {
  id: string;
  machineId: string;
  machineName: string;
  machineCode: string;
  location: string;
  commissionPercent: number;
  totalSales: number;
  commission: number;
}

interface SalesSummary {
  totalSales: number;
  totalCommission: number;
  machines: MachineWithSales[];
}

type DatePreset = "7days" | "30days" | "custom";

export default function ViewerDashboardPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>("7days");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const getDateRange = () => {
    const now = new Date();
    switch (datePreset) {
      case "7days":
        return {
          startDate: format(startOfDay(subDays(now, 7)), "yyyy-MM-dd"),
          endDate: format(endOfDay(now), "yyyy-MM-dd"),
        };
      case "30days":
        return {
          startDate: format(startOfDay(subDays(now, 30)), "yyyy-MM-dd"),
          endDate: format(endOfDay(now), "yyyy-MM-dd"),
        };
      case "custom":
        if (customRange?.from && customRange?.to) {
          return {
            startDate: format(startOfDay(customRange.from), "yyyy-MM-dd"),
            endDate: format(endOfDay(customRange.to), "yyyy-MM-dd"),
          };
        }
        return {
          startDate: format(startOfDay(subDays(now, 7)), "yyyy-MM-dd"),
          endDate: format(endOfDay(now), "yyyy-MM-dd"),
        };
    }
  };

  const dateRange = getDateRange();

  const { data: salesSummary, isLoading: isLoadingSales } = useQuery<SalesSummary>({
    queryKey: ["/api/viewer/sales-summary", { startDate: dateRange.startDate, endDate: dateRange.endDate }],
  });

  const { data: myMachines = [], isLoading: isLoadingMachines } = useQuery<any[]>({
    queryKey: ["/api/viewer/my-machines"],
  });

  const isLoading = isLoadingSales || isLoadingMachines;

  const handlePresetChange = (value: string) => {
    setDatePreset(value as DatePreset);
    if (value !== "custom") {
      setCustomRange(undefined);
    }
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      setDatePreset("custom");
    }
  };

  const getDateRangeLabel = () => {
    switch (datePreset) {
      case "7days":
        return "Últimos 7 días";
      case "30days":
        return "Últimos 30 días";
      case "custom":
        if (customRange?.from && customRange?.to) {
          return `${format(customRange.from, "dd MMM", { locale: es })} - ${format(customRange.to, "dd MMM yyyy", { locale: es })}`;
        }
        return "Seleccionar fechas";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Mis Ventas y Comisiones
            </h1>
            <p className="text-muted-foreground">
              Resumen de ventas de tus máquinas asignadas
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={datePreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[180px]" data-testid="select-date-preset">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Últimos 7 días</SelectItem>
                <SelectItem value="30days">Últimos 30 días</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {datePreset === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !customRange && "text-muted-foreground"
                    )}
                    data-testid="button-date-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customRange?.from ? (
                      customRange.to ? (
                        <>
                          {format(customRange.from, "dd/MM/yy")} -{" "}
                          {format(customRange.to, "dd/MM/yy")}
                        </>
                      ) : (
                        format(customRange.from, "dd/MM/yy")
                      )
                    ) : (
                      "Seleccionar"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customRange?.from}
                    selected={customRange}
                    onSelect={handleCustomRangeSelect}
                    numberOfMonths={2}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Ventas
              </CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold" data-testid="text-total-sales">
                {formatCurrency(salesSummary?.totalSales || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {getDateRangeLabel()}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mi Comisión
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-commission">
                {formatCurrency(salesSummary?.totalCommission || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {getDateRangeLabel()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              Detalle por Máquina
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesSummary?.machines && salesSummary.machines.length > 0 ? (
              <>
                <div className="hidden md:block">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Máquina</TableHead>
                          <TableHead>Ubicación</TableHead>
                          <TableHead className="text-right">Ventas</TableHead>
                          <TableHead className="text-center">Comisión %</TableHead>
                          <TableHead className="text-right">Mi Comisión</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesSummary.machines.map((machine) => (
                          <TableRow key={machine.id} data-testid={`row-machine-${machine.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Box className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{machine.machineName}</p>
                                  <p className="text-xs text-muted-foreground">{machine.machineCode}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {machine.location}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(machine.totalSales)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                <Percent className="h-3 w-3 mr-1" />
                                {machine.commissionPercent}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(machine.commission)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="md:hidden space-y-3">
                  {salesSummary.machines.map((machine) => (
                    <Card key={machine.id} className="p-4" data-testid={`card-machine-${machine.id}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Box className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{machine.machineName}</p>
                            <p className="text-xs text-muted-foreground">{machine.machineCode}</p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {machine.commissionPercent}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                        <MapPin className="h-3 w-3" />
                        {machine.location}
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Ventas</p>
                          <p className="font-semibold">{formatCurrency(machine.totalSales)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Mi Comisión</p>
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(machine.commission)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            ) : myMachines.length > 0 ? (
              <div className="text-center py-12">
                <Box className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Sin ventas en este período</h3>
                <p className="text-sm text-muted-foreground">
                  No se registraron ventas en las máquinas asignadas durante el período seleccionado
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <Box className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Sin máquinas asignadas</h3>
                <p className="text-sm text-muted-foreground">
                  Aún no tienes máquinas asignadas. Contacta al administrador para más información.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>Los datos se actualizan automáticamente cada hora</p>
        </div>
      </div>
    </div>
  );
}

export { ViewerDashboardPage };
