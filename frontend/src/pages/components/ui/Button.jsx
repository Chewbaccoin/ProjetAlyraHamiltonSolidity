import * as React from "react";
import { cn } from "../../../lib/utils";

const Button = React.forwardRef(({ 
  className, 
  variant = "default",
  size = "default", 
  children,
  ...props 
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-purple-500 text-white hover:bg-purple-600",
    secondary: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
    outline: "border border-purple-500 text-purple-500 hover:bg-purple-500/10",
  };

  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 px-3 text-sm",
    lg: "h-10 px-8",
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = "Button";

export { Button };