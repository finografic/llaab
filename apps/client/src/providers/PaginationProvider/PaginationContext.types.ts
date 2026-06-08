import type { CreateSettersType } from '@finografic/zustand-context-creator';
import type { PaginationKeys, SETTER_PREFIX } from './PaginationContext';
import type { ReactNode } from 'react';

export interface PaginationValues {
  [PaginationKeys.total]: number;
  [PaginationKeys.current]: number;
  [PaginationKeys.isPrevDisabled]: boolean;
  [PaginationKeys.isNextDisabled]: boolean;
}

type PaginationSetters = CreateSettersType<PaginationValues, typeof SETTER_PREFIX>;

type PaginationActions = PaginationSetters & {
  setIsPrevDisabled: (isPrevDisabled: boolean) => void;
  setIsNextDisabled: (isNextDisabled: boolean) => void;
};

export interface PaginationProviderProps {
  initialValue?: PaginationStore;
  children: ReactNode;
}

export interface PaginationStore extends PaginationValues {
  actions: PaginationActions;
}
