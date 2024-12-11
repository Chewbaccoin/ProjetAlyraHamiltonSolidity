import * as React from "react";
import { cn } from "../../../lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const Alert = React.forwardRef(({ className, variant = "default", children, ...props }, ref) => {
  const variants = {
    default: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    destructive: "bg-red-500/10 text-red-500 border-red-500/20",
    success: "bg-green-500/10 text-green-500 border-green-500/20",
  };

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "relative w-full rounded-lg border p-4",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("font-medium leading-none tracking-tight mb-1", className)}
    {...props}
  />
));

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));

Alert.displayName = "Alert";
AlertTitle.displayName = "AlertTitle";
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };