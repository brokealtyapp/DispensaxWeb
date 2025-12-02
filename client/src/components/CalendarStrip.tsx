import { useState } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

interface CalendarStripProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
}

export function CalendarStrip({ selectedDate, onDateSelect }: CalendarStripProps) {
  const today = new Date();
  const [selected, setSelected] = useState(selectedDate || today);

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleSelect = (date: Date) => {
    setSelected(date);
    onDateSelect?.(date);
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2">
      {days.map((day, index) => {
        const isSelected = isSameDay(day, selected);
        const isToday = isSameDay(day, today);

        return (
          <button
            key={index}
            onClick={() => handleSelect(day)}
            className={`flex flex-col items-center justify-center min-w-[56px] h-[70px] rounded-xl transition-all ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : isToday
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`}
            data-testid={`button-date-${format(day, "yyyy-MM-dd")}`}
          >
            <span className="text-xs font-medium uppercase">
              {format(day, "EEE", { locale: es })}
            </span>
            <span className={`text-xl font-semibold ${isSelected ? "" : "text-foreground"}`}>
              {format(day, "d")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
