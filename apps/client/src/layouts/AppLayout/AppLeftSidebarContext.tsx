import { createContext, useContext, useEffect } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

export interface AppLeftSidebarConfig {
  id: string;
  content: ReactNode;
  defaultOpen?: boolean;
  minWidth?: string;
  maxWidth?: string;
  defaultWidth?: string;
}

export interface AppLeftSidebarContextValue {
  setLeftSidebar: Dispatch<SetStateAction<AppLeftSidebarConfig | null>>;
}

export const AppLeftSidebarContext = createContext<AppLeftSidebarContextValue | undefined>(undefined);

export function useAppLeftSidebar(config: AppLeftSidebarConfig | null) {
  const context = useContext(AppLeftSidebarContext);
  const sidebarId = config?.id;

  useEffect(() => {
    context?.setLeftSidebar(config);
  }, [config, context]);

  useEffect(() => {
    if (!context || !sidebarId) return undefined;

    const id = sidebarId;

    return () => {
      context.setLeftSidebar((current) => (current?.id === id ? null : current));
    };
  }, [sidebarId, context]);
}
