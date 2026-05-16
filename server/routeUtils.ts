export function computeRouteSlaStatus(
  enteredAt: Date,
  slaHours: number | null,
  thresholdPct: number = 80,
  exitedAt?: Date | null
): string {
  if (!slaHours || slaHours <= 0) return "sin_sla";
  const now = exitedAt ? new Date(exitedAt) : new Date();
  const elapsedH = (now.getTime() - new Date(enteredAt).getTime()) / 3_600_000;
  const pct = (elapsedH / slaHours) * 100;
  if (exitedAt) return pct <= 100 ? "finalizada_a_tiempo" : "finalizada_fuera_de_tiempo";
  if (pct >= 100) return "vencido";
  if (pct >= thresholdPct) return "proximo_vencer";
  return "dentro_tiempo";
}

export function computeRouteElapsedMinutes(enteredAt: Date | null, exitedAt?: Date | null): number {
  if (!enteredAt) return 0;
  const end = exitedAt ? new Date(exitedAt) : new Date();
  return Math.round((end.getTime() - new Date(enteredAt).getTime()) / 60_000);
}
