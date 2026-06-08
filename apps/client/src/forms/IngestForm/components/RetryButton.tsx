import { ReloadIcon } from '@llaab/icons';
import { Button } from 'components/ui/button';

export function RetryButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="pipeline-retry-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label="Retry"
    >
      <ReloadIcon aria-hidden />
    </Button>
  );
}
