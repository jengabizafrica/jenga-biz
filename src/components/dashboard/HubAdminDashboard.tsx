import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserManagement } from './UserManagement';
import { InviteCodeManager } from '../auth/InviteCodeManager';
import { supabase } from '@/integrations/supabase/client';

export default function HubAdminDashboard() {
  const { user } = useAuth();
  const [hubId, setHubId] = useState<string | null>(null);

  useEffect(() => {
    const loadHub = async () => {
      if (!user) return;
      // determine the hub context for this admin (first hub_id found)
      const { data, error } = await supabase.from('user_roles').select('hub_id, role').eq('user_id', user.id).in('role', ['hub_manager','admin']).limit(1).maybeSingle();
      if (error) {
        console.error('Failed to fetch hub context:', error);
        return;
      }
      if (data && data.hub_id) setHubId(data.hub_id);
    };
    loadHub();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <img src="/jenga-biz-logo.png" alt="Jenga Biz Africa" className="h-12 w-auto" />
            <p className="text-sm text-muted-foreground">Hub Admin Dashboard</p>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Hub Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage users and invite codes for your hub.</p>
          </CardContent>
        </Card>

        <div className="mt-6">
          <UserManagement hideSuperAdmins={true} hubId={hubId} />
        </div>

        <div className="mt-6">
          <InviteCodeManager hubId={hubId} />
        </div>
      </main>
    </div>
  );
}
