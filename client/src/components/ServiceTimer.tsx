import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, Clock } from "lucide-react";

interface ServiceTimerProps {
  machineName: string;
  onStart?: () => void;
  onPause?: () => void;
  onStop?: (duration: number) => void;
}

export function ServiceTimer({ machineName, onStart, onPause, onStop }: ServiceTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    setStartTime(new Date());
    onStart?.();
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    onPause?.();
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    onStop?.(seconds);
    setSeconds(0);
    setStartTime(null);
  };

  return (
    <Card data-testid="card-service-timer">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg">Servicio en Curso</CardTitle>
          {isRunning && (
            <Badge variant={isPaused ? "secondary" : "default"}>
              {isPaused ? "Pausado" : "Activo"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{machineName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="text-5xl font-bold tabular-nums" data-testid="text-timer-display">
            {formatTime(seconds)}
          </div>
        </div>

        {startTime && (
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Inicio: {startTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          {!isRunning ? (
            <Button onClick={handleStart} className="gap-2" data-testid="button-start-timer">
              <Play className="h-4 w-4" />
              Iniciar Servicio
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handlePause}
                className="gap-2"
                data-testid="button-pause-timer"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {isPaused ? "Reanudar" : "Pausar"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleStop}
                className="gap-2"
                data-testid="button-stop-timer"
              >
                <Square className="h-4 w-4" />
                Finalizar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
