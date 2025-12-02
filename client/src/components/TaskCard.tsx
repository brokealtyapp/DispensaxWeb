import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock } from "lucide-react";
import { useState } from "react";

interface TaskCardProps {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  assignees?: { name: string; initials: string }[];
  completed?: boolean;
  onToggle?: (completed: boolean) => void;
}

export function TaskCard({
  id,
  title,
  subtitle,
  time,
  assignees = [],
  completed = false,
  onToggle,
}: TaskCardProps) {
  const [isCompleted, setIsCompleted] = useState(completed);

  const handleToggle = () => {
    const newState = !isCompleted;
    setIsCompleted(newState);
    onToggle?.(newState);
  };

  return (
    <Card
      className={`transition-opacity ${isCompleted ? "opacity-60" : ""}`}
      data-testid={`card-task-${id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={handleToggle}
            className="mt-1"
            data-testid={`checkbox-task-${id}`}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h4
                className={`font-medium text-sm ${isCompleted ? "line-through text-muted-foreground" : ""}`}
              >
                {title}
              </h4>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{time}</span>
              </div>
              <div className="flex -space-x-2">
                {assignees.slice(0, 3).map((assignee, index) => (
                  <Avatar key={index} className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {assignee.initials}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
