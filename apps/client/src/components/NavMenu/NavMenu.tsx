import { cn } from '@llaab/ui/lib/utils';
import { NavMenuListItem, NavMenuMobileItem } from 'components/NavMenu/NavMenuListItem';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from 'components/ui/accordion';
import { Button } from 'components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from 'components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from 'components/ui/sheet';
import { MenuIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { NAV_MENU_SECTIONS } from 'lib/nav-menu.config';
import { getActiveNavSectionId } from 'lib/nav-menu.utils';

import styles from './NavMenu.module.css';

interface NavMenuProps {
  pathname: string;
}

function NavMenuDropdownPanel({
  sectionId,
  itemCount,
  pathname,
}: {
  sectionId: string;
  itemCount: number;
  pathname: string;
}) {
  const section = NAV_MENU_SECTIONS.find((entry) => entry.id === sectionId);
  if (!section) {
    return null;
  }

  return (
    <ul
      className={cn(
        'grid gap-1 p-3',
        itemCount >= 4 ? 'w-[min(100vw-2rem,520px)] grid-cols-2' : 'w-[280px] grid-cols-1',
      )}
    >
      {section.items.map((item) => (
        <NavMenuListItem key={item.href} item={item} pathname={pathname} />
      ))}
    </ul>
  );
}

export function NavMenu({ pathname }: NavMenuProps) {
  const activeSectionId = getActiveNavSectionId(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const defaultAccordionSections = useMemo(
    () => (activeSectionId ? [activeSectionId] : []),
    [activeSectionId],
  );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-6">
      <Link to="/" className={styles.brand} aria-current={pathname === '/' ? 'page' : undefined}>
        <span aria-hidden="true">🌱</span>
        <span className={styles.brandText}>LLAAB</span>
      </Link>

      {/* Desktop — Tailwind owns display toggling; do not set display in CSS modules (it overrides hidden). */}
      <NavigationMenu
        viewport={false}
        className="relative hidden max-w-none flex-1 items-center justify-start md:flex"
      >
        <NavigationMenuList className="flex-nowrap justify-start gap-0.5">
          {NAV_MENU_SECTIONS.map((section) => (
            <NavigationMenuItem key={section.id} value={section.id}>
              <NavigationMenuTrigger
                className={cn(
                  navigationMenuTriggerStyle(),
                  'h-7 py-0.5',
                  activeSectionId === section.id && 'bg-muted/60 text-foreground',
                )}
                // Radix opens on hover by default — prevent that so menus are click-only.
                onPointerMove={(event) => event.preventDefault()}
                onPointerLeave={(event) => event.preventDefault()}
              >
                {section.label}
              </NavigationMenuTrigger>
              <NavigationMenuContent
                className={cn(
                  'absolute top-full left-0 z-50 mt-0 w-auto',
                  section.id === 'system' && 'left-auto right-0',
                )}
              >
                <NavMenuDropdownPanel
                  sectionId={section.id}
                  itemCount={section.items.length}
                  pathname={pathname}
                />
              </NavigationMenuContent>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>

      {/* Mobile drawer */}
      <div className="ml-auto md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Open navigation menu">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100vw,320px)] gap-0 p-0">
            <SheetHeader className="border-b border-border px-4 py-4 text-left">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <Accordion
              type="multiple"
              defaultValue={defaultAccordionSections}
              className="overflow-y-auto px-2 py-2"
            >
              {NAV_MENU_SECTIONS.map((section) => (
                <AccordionItem key={section.id} value={section.id} className="border-border/60">
                  <AccordionTrigger className="px-2 py-3 text-base hover:no-underline">
                    {section.label}
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <ul className="flex flex-col gap-0.5">
                      {section.items.map((item) => (
                        <NavMenuMobileItem
                          key={item.href}
                          item={item}
                          pathname={pathname}
                          onNavigate={() => setMobileOpen(false)}
                        />
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
