"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-2 group-[.toaster]:border-slate-300 group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:font-bold group-[.toaster]:text-sm sm:group-[.toaster]:text-base",
          description: "group-[.toast]:text-slate-500",
          actionButton:
            "group-[.toast]:bg-emerald-700 group-[.toast]:text-white font-black rounded-xl",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-700 font-bold rounded-xl",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
