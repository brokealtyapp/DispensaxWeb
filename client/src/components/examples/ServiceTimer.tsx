import { ServiceTimer } from "../ServiceTimer";

export default function ServiceTimerExample() {
  return (
    <div className="max-w-md">
      <ServiceTimer
        machineName="Plaza Central - Centro Comercial Norte"
        onStart={() => console.log("Timer started")}
        onPause={() => console.log("Timer paused")}
        onStop={(duration) => console.log("Timer stopped, duration:", duration)}
      />
    </div>
  );
}
