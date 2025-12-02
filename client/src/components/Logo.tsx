import { Zap } from "lucide-react";

interface LogoProps {
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ collapsed = false, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary rounded-lg p-1.5 flex items-center justify-center">
        <Zap className={`${sizeClasses[size]} text-primary-foreground`} />
      </div>
      {!collapsed && (
        <span className={`font-bold ${textSizes[size]} text-foreground`}>
          Dispensax
        </span>
      )}
    </div>
  );
}
