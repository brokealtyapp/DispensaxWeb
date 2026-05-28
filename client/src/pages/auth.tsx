import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoImage from "@assets/LOGO-DISPENSAX_1764711476889.png";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "forgot-password">("login");

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Panel izquierdo — solo visible en md+ */}
      <div
        className="hidden md:flex relative w-1/2 flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: "#E84545" }}
      >
        {/* Formas decorativas — círculos/blobs semitransparentes */}
        <div
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        />
        <div
          className="absolute top-16 -right-16 w-56 h-56 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        />
        <div
          className="absolute bottom-10 left-10 w-40 h-40 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
        />
        <div
          className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-24 h-24 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        />

        {/* Contenido del panel izquierdo */}
        <div className="relative z-10 flex flex-col items-center gap-8 px-12 text-white text-center">
          {/* Logo en blanco */}
          <img
            src={logoImage}
            alt="Dispensax"
            className="h-14 max-w-[220px] object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />

          {/* Tagline */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight leading-snug">
              Sistema de Gestión de<br />Máquinas Expendedoras
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              Controla tu flota, inventario y ventas<br />desde un solo lugar.
            </p>
          </div>

          {/* Elemento visual decorativo — tarjeta estilizada de máquina */}
          <div
            className="mt-4 rounded-xl px-8 py-6 flex flex-col gap-4 w-72"
            style={{ backgroundColor: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)" }}>
                Máquina #A-07
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}
              >
                Activa
              </span>
            </div>
            <div className="flex justify-between text-white">
              <div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Ventas hoy</p>
                <p className="text-xl font-bold">RD$ 4,320</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Productos</p>
                <p className="text-xl font-bold">38/50</p>
              </div>
            </div>
            {/* Mini barra de progreso de inventario */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Inventario</span>
                <span className="text-xs font-medium">76%</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                <div className="h-1.5 rounded-full" style={{ width: "76%", backgroundColor: "rgba(255,255,255,0.85)" }} />
              </div>
            </div>
          </div>
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
