'use client';

import { ChevronRightIcon } from 'lucide-react';
import { Collapsible as CollapsiblePrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from 'utils';

function Collapsible({ className, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" className={className} {...props} />;
}

function CollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className={cn(
        'group/collapsible-trigger flex w-full items-start gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&[data-state=open]>svg]:rotate-90',
        className,
      )}
      {...props}
    >
      <ChevronRightIcon
        data-slot="collapsible-trigger-icon"
        className="pointer-events-none mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200"
      />
      {children}
    </CollapsiblePrimitive.CollapsibleTrigger>
  );
}

function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={className}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
