import { createContext, useContext } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

export interface SecondaryActionBarContextValue {
  setLeadingAction: Dispatch<SetStateAction<ReactNode>>;
}

export const SecondaryActionBarContext = createContext<SecondaryActionBarContextValue | undefined>(undefined);

export function useSecondaryActionBar() {
  return useContext(SecondaryActionBarContext);
}
