import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApprovals } from '@/hooks/useApprovals';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ApprovalItem {
  id: string;
  user_id: string;
  type: string;
  payload: any;
  status: string;
  created_at: string;
}

export function PendingApprovalsList() {
  const { listPending, approve, reject, loading, error } = useApprovals();
  const { toast } = useToast();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = async () => {
    const list = await listPending();
    setItems(list);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    }
  }, [error, toast]);

  const handleApprove = async (id: string) => {
    setActioning(id);
    const ok = await approve(id);
    setActioning(null);
    if (ok) {
      toast({ title: 'Approved', description: 'Organization approved successfully.' });
      load();
    }
  };

  const handleReject = async (id: string) => {
    setActioning(id);
    const ok = await reject(id, 'Rejected by admin');
    setActioning(null);
    if (ok) {
      toast({ title: 'Rejected', description: 'Request rejected.' });
      load();
    }
  };

  return (
    <div className="space-y-6 mt-[120px] lg:mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Review and act on pending ecosystem enabler signups.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading approvals...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="text-sm text-muted-foreground">No pending approvals.</div>
          )}
          {!loading && items.length > 0 && (
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="border rounded-md p-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{it.type.replace('_', ' ')}</div>
                    <div className="text-xs text-muted-foreground">
                      Request ID: {it.id} • User: {it.user_id} • Submitted: {new Date(it.created_at).toLocaleString()}
                    </div>
                    {it.payload?.org_name && (
                      <div className="text-sm">Org: {it.payload.org_name}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(it.id)}
                      disabled={actioning === it.id}
                    >
                      {actioning === it.id ? 'Approving...' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(it.id)}
                      disabled={actioning === it.id}
                    >
                      {actioning === it.id ? 'Rejecting...' : 'Reject'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
