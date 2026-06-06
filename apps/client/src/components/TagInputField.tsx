import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { X } from 'lucide-react';

interface TagInputFieldProps {
  label: string;
  description?: string;
  placeholder?: string;
  value: string[];
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
    if (!validateTag(normalized) || value.includes(normalized)) return;
    onChange([...value, normalized]);
    onInputValueChange('');
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="tag-input">{label}</Label>
      <div className="flex flex-col gap-1.5">
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="h-7 gap-1.5 border-accent/30 bg-accent/10 px-2.5 font-mono text-xs text-accent"
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
            ))}
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
                if (value.includes(suggestion)) return;
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
