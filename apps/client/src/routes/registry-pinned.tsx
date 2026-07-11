import { Navigate } from 'react-router-dom';

/** Deprecated standalone page — pinned packages live on `/registry` (Pinned tab). */
export function RegistryPinnedPage() {
  return <Navigate to="/registry/packages" replace />;
}
