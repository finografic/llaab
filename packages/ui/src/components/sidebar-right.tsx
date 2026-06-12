import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@llaab/ui/components/sidebar';
import { PlusIcon } from 'lucide-react';
import * as React from 'react';

export function SidebarRight({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="none" className="sticky top-0 hidden h-svh border-l lg:flex" {...props}>
      <SidebarHeader className="h-16 border-b border-sidebar-border">RIGHT SIDEBAR HEADER</SidebarHeader>
      <SidebarContent>
        SOME WIDGET FOO
        <SidebarSeparator className="mx-0" />
        SOME WIDGET BAR
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <PlusIcon />
              <span>New Something</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
