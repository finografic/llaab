export const INGEST_FORM_RESET_EVENT = 'llaab:ingest-form-reset';

export function dispatchIngestFormReset(): void {
  window.dispatchEvent(new CustomEvent(INGEST_FORM_RESET_EVENT));
}
