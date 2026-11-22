"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Light theme only for now (dark mode is a post-MVP fast-follow). Toasts follow the design:
// charcoal background, white text, mint action button (e.g. Undo).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "#1f2937",
          "--normal-text": "#ffffff",
          "--normal-border": "#1f2937",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !shadow-lg",
          actionButton: "!bg-transparent !text-[#6ee7b7] !font-bold !text-sm",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
