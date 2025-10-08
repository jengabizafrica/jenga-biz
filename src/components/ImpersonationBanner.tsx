// React is available via the JSX runtime; no default import required.
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, X, Building } from 'lucide-react';
import { useHubContext } from '@/hooks/useHubContext';

export function ImpersonationBanner() {
  const { isImpersonating, currentHub, stopImpersonation, loading } = useHubContext();

  if (!isImpersonating || !currentHub || loading) {
    return null;
  }

  return (
    <Alert className="border-orange-200 bg-orange-50 text-orange-800 mb-4">
      <Eye className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="font-medium">Viewing as Organization:</span>
          </div>
          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
            {currentHub.name || currentHub.slug || 'Unnamed Organization'}
          </Badge>
          <span className="text-sm text-orange-600">
            ({currentHub.country})
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={stopImpersonation}
          className="h-8 px-3 text-orange-700 border-orange-300 hover:bg-orange-100"
        >
          <X className="h-3 w-3 mr-1" />
          Exit
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export default ImpersonationBanner;