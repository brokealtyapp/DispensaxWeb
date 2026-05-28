import { useState, useEffect } from "react";
import { LoginForm } from "@/components/LoginForm";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoImage from "@assets/LOGO-DISPENSAX_1764711476889.png";
import {
  MonitorSpeaker,
  Package,
  ClipboardList,
  TrendingUp,
  Wrench,
  Fuel,
} from "lucide-react";

const SLIDES = [
  {
    icon: MonitorSpeaker,
    title: "Gestión de Máquinas",
    description: "Monitorea el estado, ventas e inventario de toda tu flota en tiempo real.",
    stats: [
      { label: "Máquinas activas", value: "48" },
      { label: "Ventas hoy", value: "RD$ 87,240" },
    ],
    bar: { label: "Disponibilidad de flota", pct: 92 },
  },
  {
    icon: Package,
    title: "Almacén & Kardex",
    description: "Control de inventario con costo promedio ponderado y alertas de stock bajo.",
    stats: [
      { label: "SKUs en stock", value: "134" },
      { label: "Valor inventario", value: "RD$ 312,500" },
    ],
    bar: { label: "Nivel de stock promedio", pct: 78 },
  },
  {
    icon: TrendingUp,
    title: "Ventas & Cobros",
    description: "Conciliación cruzada Nayax, conteo de denominaciones y cierre de caja.",
    stats: [
      { label: "Cobros este mes", value: "RD$ 1.2M" },
      { label: "Máquinas cobradas", value: "43/48" },
    ],
    bar: { label: "Cobros completados", pct: 89 },
  },
  {
    icon: ClipboardList,
    title: "Órdenes de Trabajo",
    description: "Kanban con SLA por etapa, checklists configurables y seguimiento de técnicos.",
    stats: [
      { label: "Órdenes abiertas", value: "17" },
      { label: "Tiempo prom. cierre", value: "2.4 h" },
    ],
    bar: { label: "Órdenes dentro del SLA", pct: 85 },
  },
  {
    icon: TrendingUp,
    title: "Finanzas & Compras",
    description: "Facturas de proveedores, pagos, notas de débito y control de egresos.",
    stats: [
      { label: "Facturas pendientes", value: "9" },
      { label: "Por pagar", value: "RD$ 58,000" },
    ],
    bar: { label: "Facturas al día", pct: 82 },
  },
  {
    icon: Wrench,
    title: "Rutas de Servicio",
    description: "Planifica y ejecuta rutas de abastecimiento con etapas y SLA configurables.",
    stats: [
      { label: "Rutas esta semana", value: "24" },
      { label: "A tiempo", value: "21/24" },
    ],
    bar: { label: "Cumplimiento de rutas", pct: 87 },
  },
];

const INTERVAL_MS = 4000;

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "forgot-password">("login");
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % SLIDES.length);
        setVisible(true);
      }, 350);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[current];
  const Icon = slide.icon;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Panel izquierdo — solo visible en md+ */}
      <div
        className="hidden md:flex relative w-1/2 flex-col overflow-hidden"
        style={{ backgroundColor: "#E84545" }}
      >
        {/* Formas decorativas de fondo */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
        <div className="absolute top-16 -right-16 w-56 h-56 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div className="absolute bottom-10 left-10 w-40 h-40 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />

        {/* Logo fijo en la parte superior */}
        <div className="relative z-10 flex flex-col items-center pt-10 pb-4 px-12">
          <img
            src={logoImage}
            alt="Dispensax"
            className="h-12 max-w-[200px] object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* Área de slide — ocupa el espacio restante */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-12 pb-16">
          <div
            className="flex flex-col items-center gap-6 text-white text-center w-full max-w-xs"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 350ms ease, transform 350ms ease",
            }}
          >
            {/* Ícono del módulo */}
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
            >
              <Icon size={32} strokeWidth={1.8} />
            </div>

            {/* Título y descripción */}
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold tracking-tight">{slide.title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
                {slide.description}
              </p>
            </div>

            {/* Mini-card decorativa con stats */}
            <div
              className="w-full rounded-xl px-6 py-5 flex flex-col gap-4"
              style={{ backgroundColor: "rgba(255,255,255,0.13)", backdropFilter: "blur(8px)" }}
            >
              {/* Stats */}
              <div className="flex justify-between">
                {slide.stats.map((s) => (
                  <div key={s.label} className={slide.stats.indexOf(s) === 1 ? "text-right" : ""}>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>{s.label}</p>
                    <p className="text-lg font-bold">{s.value}</p>
                  </div>
                ))}
              </div>
              {/* Barra de progreso */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>{slide.bar.label}</span>
                  <span className="text-xs font-semibold">{slide.bar.pct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${slide.bar.pct}%`,
                      backgroundColor: "rgba(255,255,255,0.85)",
                      transition: "width 500ms ease",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Indicadores de posición (dots) */}
        <div className="relative z-10 flex justify-center gap-2 pb-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setVisible(false);
                setTimeout(() => {
                  setCurrent(i);
                  setVisible(true);
                }, 350);
              }}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? "20px" : "8px",
                height: "8px",
                backgroundColor: i === current ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
              }}
              aria-label={`Ir a slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 flex-col bg-background">
        {/* Cabecera con ThemeToggle */}
        <div className="flex items-center justify-end p-4">
          <ThemeToggle />
        </div>

        {/* Contenido centrado */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
          <div className="w-full max-w-md">
            {mode === "forgot-password" ? (
              <ForgotPasswordForm onBackToLogin={() => setMode("login")} />
            ) : (
              <LoginForm onForgotPassword={() => setMode("forgot-password")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
