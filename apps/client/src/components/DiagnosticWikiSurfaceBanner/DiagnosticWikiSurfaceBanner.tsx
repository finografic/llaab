import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import { InfoIcon } from 'lucide-react';

export function DiagnosticWikiSurfaceBanner({ surface }: { surface: 'draft' | 'candidate' }) {
  const noun = surface === 'draft' ? 'wiki draft' : 'wiki candidate';
  return (
    <Alert className="mb-4">
      <InfoIcon aria-hidden="true" />
      <AlertTitle>Diagnostic / recovery surface</AlertTitle>
      <AlertDescription>
        Normal creation is <strong>Create Wiki(s)</strong> on a transcript with canonical ideas. This {noun}{' '}
        page is for audit, lineage, and specialist recovery — not a required creation step.
      </AlertDescription>
    </Alert>
  );
}
