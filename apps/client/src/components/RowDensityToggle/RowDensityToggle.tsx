import { Rows3Icon, Rows4Icon } from '@llaab/icons';
import { ToggleGroup, ToggleGroupItem } from 'components/ui/toggle-group';

export type RowDensity = 'condensed' | 'expanded';

export interface RowDensityToggleProps {
  value: RowDensity;
  onChange: (value: RowDensity) => void;
  ariaLabel?: string;
}

/** Condensed / expanded density control shared by list surfaces (transcripts, wikis, …). */
export function RowDensityToggle({ value, onChange, ariaLabel = 'Row density' }: RowDensityToggleProps) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(next) => {
        if (next === 'condensed' || next === 'expanded') onChange(next);
      }}
      aria-label={ariaLabel}
    >
      <ToggleGroupItem value="condensed" aria-label="Condensed rows">
        <Rows4Icon />
      </ToggleGroupItem>
      <ToggleGroupItem value="expanded" aria-label="Expanded rows">
        <Rows3Icon />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
