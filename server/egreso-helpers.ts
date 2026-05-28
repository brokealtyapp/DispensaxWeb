export type Frecuencia =
  | "diario"
  | "semanal"
  | "quincenal"
  | "mensual"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

const FRECUENCIA_FACTOR: Record<Frecuencia, number> = {
  diario: 30,
  semanal: 4.33,
  quincenal: 2,
  mensual: 1,
  bimestral: 1 / 2,
  trimestral: 1 / 3,
  semestral: 1 / 6,
  anual: 1 / 12,
};

export function calcMontoMensual(monto: number, frecuencia: Frecuencia): number {
  return monto * (FRECUENCIA_FACTOR[frecuencia] ?? 1);
}

export function calcMontoAnual(monto: number, frecuencia: Frecuencia): number {
  return calcMontoMensual(monto, frecuencia) * 12;
}

export function calcTasaDiaria(montoMensual: number): number {
  return montoMensual / 30;
}

export function avanzarProximaFecha(fecha: Date, frecuencia: Frecuencia): Date {
  const d = new Date(fecha);
  switch (frecuencia) {
    case "diario":
      d.setDate(d.getDate() + 1);
      break;
    case "semanal":
      d.setDate(d.getDate() + 7);
      break;
    case "quincenal":
      d.setDate(d.getDate() + 15);
      break;
    case "mensual":
      d.setMonth(d.getMonth() + 1);
      break;
    case "bimestral":
      d.setMonth(d.getMonth() + 2);
      break;
    case "trimestral":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semestral":
      d.setMonth(d.getMonth() + 6);
      break;
    case "anual":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

export function calcEstadoFijo(
  proximaFecha: Date | null | undefined,
  alertDiasPrevios: number,
  totalPagadoCiclo: number,
  monto: number,
  isActive: boolean,
): "al_dia" | "alerta" | "vencido" | "parcial" | "inactivo" {
  if (!isActive) return "inactivo";
  if (!proximaFecha) return "al_dia";

  if (totalPagadoCiclo > 0 && totalPagadoCiclo < monto) return "parcial";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(proximaFecha);
  vence.setHours(0, 0, 0, 0);
  const diffMs = vence.getTime() - hoy.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return "vencido";
  if (diffDias <= alertDiasPrevios) return "alerta";
  return "al_dia";
}

export const CATEGORIAS_DEFAULT = [
  { nombre: "Renta de locaciones", color: "#6366f1", icono: "Building2" },
  { nombre: "Combustible y transporte", color: "#f97316", icono: "Fuel" },
  { nombre: "Mantenimiento de equipos", color: "#0ea5e9", icono: "Wrench" },
  { nombre: "Salarios y nómina", color: "#8b5cf6", icono: "Users" },
  { nombre: "Insumos y productos", color: "#10b981", icono: "Package" },
  { nombre: "Servicios públicos", color: "#f59e0b", icono: "Zap" },
  { nombre: "Tecnología y software", color: "#3b82f6", icono: "Monitor" },
  { nombre: "Seguros de equipos", color: "#ec4899", icono: "Shield" },
  { nombre: "Marketing y publicidad", color: "#14b8a6", icono: "TrendingUp" },
  { nombre: "Impuestos y tasas", color: "#64748b", icono: "FileText" },
  { nombre: "Otros gastos", color: "#9ca3af", icono: "MoreHorizontal" },
];
