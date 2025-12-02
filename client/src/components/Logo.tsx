import logoImage from "@assets/LOGO-DISPENSAX_1764711476889.png";

interface LogoProps {
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ collapsed = false, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  const iconSizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  if (collapsed) {
    return (
      <div className="flex items-center justify-center">
        <img 
          src={logoImage} 
          alt="Dispensax" 
          className={`${iconSizeClasses[size]} object-contain`}
          style={{ objectPosition: 'left' }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <img 
        src={logoImage} 
        alt="Dispensax" 
        className={`${sizeClasses[size]} max-w-[200px] object-contain`}
        data-testid="img-logo"
      />
    </div>
  );
}
