import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Zona horaria de República Dominicana (GMT-4)
export const TIMEZONE = 'America/Santo_Domingo';
export const LOCALE = 'es-DO';
export const CURRENCY = 'DOP';

// Formatear moneda en Pesos Dominicanos (RD$ 1,234.56)
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return 'RD$ 0.00';
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return 'RD$ 0.00';
  
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericAmount);
}

// Formatear moneda compacta para valores grandes (ej: RD$ 1.2M)
export function formatCurrencyCompact(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return 'RD$ 0';
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return 'RD$ 0';
  
  if (numericAmount >= 1000000) {
    return `RD$ ${(numericAmount / 1000000).toFixed(1)}M`;
  } else if (numericAmount >= 1000) {
    return `RD$ ${(numericAmount / 1000).toFixed(1)}K`;
  }
  return formatCurrency(numericAmount);
}

// Formatear solo hora (ej: "14:30")
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleTimeString(LOCALE, { 
      timeZone: TIMEZONE, 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return "";
  }
}

// Formatear solo fecha (ej: "4 ene 2026")
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString(LOCALE, { 
      timeZone: TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return "";
  }
}

// Formatear fecha corta (ej: "4/1/2026")
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString(LOCALE, { 
      timeZone: TIMEZONE
    });
  } catch {
    return "";
  }
}

// Formatear fecha y hora completa (ej: "4 ene 2026, 14:30")
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleString(LOCALE, { 
      timeZone: TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return "";
  }
}

// Obtener la hora actual en la zona horaria configurada (para saludos, etc.)
// Usa Intl.DateTimeFormat.formatToParts para extraer la hora numéricamente
// de forma independiente de la zona horaria del navegador del cliente
export function getCurrentHour(): number {
  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    hour: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const hourPart = parts.find(part => part.type === 'hour');
  return hourPart ? parseInt(hourPart.value, 10) : 0;
}

// Formatear día de la semana largo (ej: "lunes")
export function formatWeekday(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString(LOCALE, { 
      timeZone: TIMEZONE,
      weekday: 'long'
    });
  } catch {
    return "";
  }
}

// Formatear día de la semana corto (ej: "lun")
export function formatWeekdayShort(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString(LOCALE, { 
      timeZone: TIMEZONE,
      weekday: 'short'
    });
  } catch {
    return "";
  }
}

// Obtener fecha/hora actual en zona horaria de RD
export function getCurrentTime(): Date {
  return new Date();
}

// Formatear hora actual en zona horaria de RD
export function formatCurrentTime(): string {
  return formatTime(new Date());
}

// Formatear fecha actual en zona horaria de RD  
export function formatCurrentDate(): string {
  return formatDate(new Date());
}

// Formatear hora con segundos en formato 12 horas (ej: "5:30:45 p. m.") - para relojes en tiempo real
export function formatTimeWithSeconds(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleTimeString(LOCALE, { 
      timeZone: TIMEZONE, 
      hour: 'numeric', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return "";
  }
}

// Formatear fecha completa con día de la semana (ej: "domingo, 4 enero")
export function formatFullDateWithWeekday(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString(LOCALE, { 
      timeZone: TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  } catch {
    return "";
  }
}

// Obtener la fecha en formato YYYY-MM-DD en la zona horaria de RD
export function getDateKeyInTimezone(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    const d = new Date(date);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d); // Returns YYYY-MM-DD
  } catch {
    return "";
  }
}

// Comparar si dos fechas son el mismo día en la zona horaria de RD
export function isSameDayInTimezone(date1: Date | string | null | undefined, date2: Date | string | null | undefined): boolean {
  if (!date1 || !date2) return false;
  return getDateKeyInTimezone(date1) === getDateKeyInTimezone(date2);
}

// Verificar si una fecha es hoy en la zona horaria de RD
export function isTodayInTimezone(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  return getDateKeyInTimezone(date) === getDateKeyInTimezone(new Date());
}

// Obtener el día de la semana en la zona horaria de RD (0=domingo, 1=lunes, etc.)
export function getDayOfWeekInTimezone(date: Date | string | null | undefined): number {
  if (!date) return 0;
  try {
    const d = new Date(date);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      weekday: 'short'
    });
    const weekdayName = formatter.format(d);
    const weekdayMap: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    return weekdayMap[weekdayName] ?? 0;
  } catch {
    return 0;
  }
}

// Obtener la fecha actual como Date object normalizado a mediodía GMT-4
// Esto crea una Date que representa "hoy" en República Dominicana
export function getTodayInTimezone(): Date {
  const dateKey = getDateKeyInTimezone(new Date()); // YYYY-MM-DD en GMT-4
  // Crear fecha a mediodía para evitar problemas con cambios de día
  return new Date(`${dateKey}T12:00:00-04:00`);
}

// Obtener el inicio de la semana (lunes) anclado a la zona horaria GMT-4
export function getStartOfWeekInTimezone(): Date {
  const now = new Date();
  const dateKey = getDateKeyInTimezone(now); // YYYY-MM-DD en GMT-4
  const dayOfWeek = getDayOfWeekInTimezone(now); // 0=domingo, 1=lunes en GMT-4
  
  // Calcular días para retroceder al lunes (weekStartsOn: 1)
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Parsear la fecha actual en GMT-4 y restar días
  const [year, month, day] = dateKey.split('-').map(Number);
  const mondayDate = new Date(Date.UTC(year, month - 1, day - daysToMonday, 16, 0, 0)); // 16:00 UTC = 12:00 GMT-4
  
  return mondayDate;
}
