import { Button } from 'components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip';
import { ArrowLeftIcon } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import styles from './AppLayout.module.css';

export interface SecondaryActionBarContextValue {
  setLeadingAction: Dispatch<SetStateAction<ReactNode>>;
}

export const SecondaryActionBarContext = createContext<SecondaryActionBarContextValue | undefined>(undefined);

export function useSecondaryActionBar() {
  return useContext(SecondaryActionBarContext);
}

/** Register per-route leading content in the SecondaryActionBar; clears on unmount. */
export function useSecondaryLeadingAction(action: ReactNode | null) {
  const context = useSecondaryActionBar();

  useEffect(() => {
    if (!context) return undefined;
    context.setLeadingAction(action);
    return () => {
      context.setLeadingAction(null);
    };
  }, [action, context]);
}

/** Standard back icon button for the SecondaryActionBar leading slot. */
export function useSecondaryBackAction(to: string, label = 'Back') {
  const action = useMemo(
    () => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={styles.secondaryPanelTrigger}
            aria-label={label}
          >
            <Link to={to}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    ),
    [to, label],
  );

  useSecondaryLeadingAction(action);
}
