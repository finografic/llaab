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
    <div className="field">
      <Label htmlFor="tag-input">{label}</Label>
      <div className="tag-field">
        {value.length > 0 && (
          <div className="tag-field__list">
            {value.map((tag) => (
              <span key={tag} className="tag-chip">
                <span>{tag}</span>
                <button
                  type="button"
                  className="tag-chip__remove"
                  aria-label={`Remove ${tag}`}
                  onClick={() => onChange(value.filter((candidate) => candidate !== tag))}
                  disabled={disabled}
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
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
      {description ? <span className="field__hint">{description}</span> : null}

      {inputValue && suggestions.length > 0 && (
        <div className="tag-suggestions">
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
