'use client';

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

const Toaster = ({ theme = 'dark', position = 'bottom-right', ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      position={position}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[var(--success-text)]" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
          success: 'llaab-toast-success',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
