import { Button } from 'components/ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from 'components/ui/combobox';
import { XIcon } from 'lucide-react';

interface AuthorFilterProps {
  authors: string[];
  selected: string[];
  onChange: (authors: string[]) => void;
}

/** Multi-select (OR) filter over the sidebar's author chips, with a clear-all button. */
export function AuthorFilter({ authors, selected, onChange }: AuthorFilterProps) {
  const anchorRef = useComboboxAnchor();

  return (
    <div className="flex items-center gap-1.5">
      <Combobox items={authors} multiple value={selected} onValueChange={onChange}>
        <ComboboxChips ref={anchorRef} className="flex-1">
          {selected.map((author) => (
            <ComboboxChip key={author} aria-label={author}>
              {author}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder={selected.length === 0 ? 'Filter by author…' : undefined} />
        </ComboboxChips>
        <ComboboxContent anchor={anchorRef}>
          <ComboboxEmpty>No authors found.</ComboboxEmpty>
          <ComboboxList>
            {(author: string) => (
              <ComboboxItem key={author} value={author}>
                {author}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {selected.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear author filter"
          onClick={() => onChange([])}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
