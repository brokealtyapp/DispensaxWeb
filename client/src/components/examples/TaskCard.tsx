import { TaskCard } from "../TaskCard";

export default function TaskCardExample() {
  // todo: remove mock functionality
  const mockAssignees = [
    { name: "Carlos R", initials: "CR" },
    { name: "María G", initials: "MG" },
  ];

  return (
    <div className="space-y-3 max-w-md">
      <TaskCard
        id="1"
        title="Revisar máquina Plaza Central"
        subtitle="Reabastecimiento urgente"
        time="10:00 AM - 11:45 AM"
        assignees={mockAssignees}
        completed={false}
        onToggle={(completed) => console.log("Task toggled:", completed)}
      />
      <TaskCard
        id="2"
        title="Mantenimiento Edificio Corp"
        subtitle="Limpieza programada"
        time="01:00 PM - 03:00 PM"
        assignees={mockAssignees}
        completed={true}
      />
      <TaskCard
        id="3"
        title="Recolección de efectivo"
        subtitle="Zona Norte - 5 máquinas"
        time="06:00 PM - 07:30 PM"
        assignees={mockAssignees.slice(0, 1)}
        completed={false}
      />
    </div>
  );
}
