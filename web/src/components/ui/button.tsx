import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Neon-edge button from 21st.dev, recolored to the emerald brand (was blue).
const buttonVariants = cva(
  "relative group inline-flex items-center justify-center gap-2 border text-center rounded-full font-semibold transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary/5 hover:bg-primary/0 border-primary/20 text-foreground",
        solid: "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.5)]",
        outline: "border-border bg-background/60 text-foreground/80 backdrop-blur hover:bg-muted hover:border-border",
        ghost: "border-transparent bg-transparent text-foreground/80 hover:bg-muted",
      },
      size: {
        default: "px-7 py-2 text-sm",
        sm: "px-4 py-1.5 text-sm",
        lg: "px-9 py-3 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  neon?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, neon = true, size, variant, children, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
        <span
          className={cn(
            "absolute h-px opacity-0 group-hover:opacity-100 transition-all duration-500 ease-in-out inset-x-0 top-0 bg-gradient-to-r w-3/4 mx-auto from-transparent via-primary to-transparent hidden",
            neon && "block"
          )}
        />
        {children}
        <span
          className={cn(
            "absolute group-hover:opacity-40 opacity-0 transition-all duration-500 ease-in-out inset-x-0 h-px -bottom-px bg-gradient-to-r w-3/4 mx-auto from-transparent via-primary to-transparent hidden",
            neon && "block"
          )}
        />
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
