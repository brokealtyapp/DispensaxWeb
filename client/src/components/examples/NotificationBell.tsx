import { NotificationBell } from "../NotificationBell";
import { useState } from "react";

export default function NotificationBellExample() {
  // todo: remove mock functionality
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      title: "Máquina sin stock",
      message: "Plaza Central se ha quedado sin Coca-Cola 600ml",
      time: "Hace 5 min",
      read: false,
      type: "warning" as const,
    },
    {
      id: "2",
      title: "Ruta completada",
      message: "Carlos completó la ruta Norte exitosamente",
      time: "Hace 1 hora",
      read: false,
      type: "success" as const,
    },
    {
      id: "3",
      title: "Nuevo empleado",
      message: "Se ha registrado un nuevo abastecedor",
      time: "Hace 3 horas",
      read: true,
      type: "info" as const,
    },
  ]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <NotificationBell
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    />
  );
}
