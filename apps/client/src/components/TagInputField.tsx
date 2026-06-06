import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { LockIcon, X } from 'lucide-react';

const TAG_COLORS: Record<string, string> = {
  'd:llm': 'oklch(0.65 0.18 220)',
  'd:automation': 'oklch(0.65 0.18 290)',
  'd:ingest': 'oklch(0.72 0.14 55)',
  'd:schema': 'oklch(0.68 0.15 185)',
  'd:infra': 'oklch(0.55 0.04 250)',
  'd:integration': 'oklch(0.68 0.16 28)',
  'd:ui': 'oklch(0.68 0.18 340)',
  'd:meta': 'oklch(0.68 0.2 145)',
};

function tagColor(tag: string): string | null {
  return TAG_COLORS[tag] ?? null;
}

interface TagInputFieldProps {
  label: string;
  description?: string;
  placeholder?: string;
  value: string[];
  lockedTags?: string[];
  inputValue: string;
  suggestions: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
  onInputValueChange: (next: string) => void;
  normalizeTag: (value: string) => string;
  validateTag: (value: string) => boolean;
}

export function TagInputField({
  label,
  description,
  placeholder = 'd:llm',
  value,
  lockedTags = [],
  inputValue,
  suggestions,
  disabled = false,
  onChange,
  onInputValueChange,
  normalizeTag,
  validateTag,
}: TagInputFieldProps) {
  const commitInput = () => {
    const normalized = normalizeTag(inputValue);
    if (!validateTag(normalized) || value.includes(normalized) || lockedTags.includes(normalized)) return;
    onChange([...value, normalized]);
    onInputValueChange('');
  };

  const allVisible = lockedTags.length > 0 || value.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="tag-input">{label}</Label>
      <div className="flex flex-col gap-1.5">
        {allVisible && (
          <div className="flex flex-wrap gap-1.5">
            {lockedTags.map((tag) => {
              const color = tagColor(tag);
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className="h-7 gap-1.5 px-2.5 font-mono text-xs"
                  style={
                    color
                      ? {
                          backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
                          borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
                          color,
                        }
                      : {
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--surface-raised)',
                          color: 'var(--text-muted)',
                        }
                  }
                >
                  <LockIcon size={9} aria-hidden />
                  <span>{tag}</span>
                </Badge>
              );
            })}
            {value.map((tag) => {
              const color = tagColor(tag);
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className="h-7 gap-1.5 px-2.5 font-mono text-xs"
                  style={
                    color
                      ? {
                          backgroundColor: 'transparent',
                          borderColor: `color-mix(in oklch, ${color} 45%, transparent)`,
                          color,
                        }
                      : {
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--surface-raised)',
                          color: 'var(--text)',
                        }
                  }
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    className="inline-flex size-4 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`Remove ${tag}`}
                    onClick={() => onChange(value.filter((candidate) => candidate !== tag))}
                    disabled={disabled}
                  >
                    <X size={10} aria-hidden />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        <Input
          id="tag-input"
          type="text"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onInputValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commitInput();
            }
            if (event.key === 'Backspace' && inputValue.length === 0 && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commitInput}
        />
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}

      {inputValue && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="xs"
              className="tag-suggestion"
              onMouseDown={(event) => {
                event.preventDefault();
                if (value.includes(suggestion) || lockedTags.includes(suggestion)) return;
                onChange([...value, suggestion]);
                onInputValueChange('');
              }}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
