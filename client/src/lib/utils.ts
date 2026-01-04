import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Zona horaria de República Dominicana (GMT-4)
export const TIMEZONE = 'America/Santo_Domingo';
export const LOCALE = 'es-DO';

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
