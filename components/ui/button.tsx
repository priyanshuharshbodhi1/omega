import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md border text-sm font-semibold ring-offset-white transition-[background-color,color,box-shadow,border-color,transform] duration-150 shadow-[0_1px_2px_rgba(60,64,67,0.28),0_2px_6px_rgba(60,64,67,0.18)] hover:shadow-[0_2px_4px_rgba(60,64,67,0.3),0_6px_14px_rgba(60,64,67,0.2)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
  {
    variants: {
      variant: {
        default: "border-[#1F1A15] bg-[#1F1A15] text-[#FFFDF7] hover:bg-[#17120f]",
        brand: "border-[#245944] bg-[#2D6A4F] text-[#F7F2E9] hover:bg-[#245944]",
        dark: "border-[#9CD4A7] bg-[#D2F7D7] text-[#0F3B1F] hover:bg-[#C3F3CA]",
        violet: "border-violet-700 bg-violet-600 text-white hover:bg-violet-700",
        violetSoft: "border-[#C5B8E8] bg-[#E9D8FD] text-[#4C1D95] hover:bg-[#DDC7FA]",
        destructive:
          "border-red-600 bg-red-500 text-gray-50 hover:bg-red-600 dark:bg-red-900 dark:text-gray-50 dark:hover:bg-red-900/90",
        outline:
          "border border-[#D9CDBA] bg-[#FFFDF7] text-[#1F1A15] hover:bg-[#E6D8C6]",
        secondary:
          "border-[#D2C4B3] bg-[#E6D8C6] text-[#1F1A15] hover:bg-[#DCCAB4]",
        ghost:
          "border-[#E3D7C8] bg-[#FFFDF7] text-[#1F1A15] hover:bg-[#E6D8C6] hover:text-[#1F1A15]",
        link: "border-transparent bg-transparent text-[#1F1A15] shadow-none hover:underline underline-offset-4",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
