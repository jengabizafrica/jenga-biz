import { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Building, 
  TrendingUp, 
  Settings, 
  Shield,
  BarChart3,
  PlusCircle,
  CreditCard
} from "lucide-react";
import { InviteCodeManager } from "../auth/InviteCodeManager";
import { UserManagement } from "./UserManagement";
import { HubsList } from './HubsList';
import { Switch } from '@/components/ui/switch';
import { useAppSettings } from '@/hooks/useAppSettings';
import { PendingApprovalsList } from '../admin/PendingApprovalsList';
import { SubscriptionPlansManager } from '../admin/SubscriptionPlansManager';
import TemplatesManager from './TemplatesManager';


export function AdminDashboard({ saasMode = false }: { saasMode?: boolean }) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBusinesses: 0,
    activeUsers: 0,
    totalRevenue: 0
  });

  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [autoApproveOrgs, setAutoApproveOrgs] = useState<boolean>(false);
  const { getAutoApprove, setAutoApprove, loading: settingsLoading, error: settingsError } = useAppSettings();

  const loadSettings = async () => {
    const value = await getAutoApprove();
    setAutoApproveOrgs(value);
  };

  const saveSettings = async () => {
    const success = await setAutoApprove(autoApproveOrgs);
    if (success) {
      toast({ title: 'Settings saved', description: 'System settings updated successfully.' });
    } else if (settingsError) {
      toast({ title: 'Save failed', description: settingsError, variant: 'destructive' });
    }
  };

  useEffect(() => {
    checkAdminStatus();
    fetchStats();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      console.log('No user found, setting isAdmin to null');
      setIsAdmin(null);
      return;
    }
  
    console.log('Checking admin status for user:', {
      userId: user.id,
      email: user.email,
      currentTime: new Date().toISOString()
    });
  
    try {
      // Log the raw query we're about to make
      console.log('Querying user_roles for roles: admin, super_admin, hub_manager');
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')  // Select all columns for debugging
        .eq('user_id', user.id)
        .in('role', ['admin', 'super_admin', 'hub_manager']);
  
      if (error) {
        console.error('Error fetching user roles:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
  
      console.log('Fetched roles from database:', {
        roles: data,
        count: data?.length || 0,
        hasSuperAdmin: data?.some(r => r.role === 'super_admin')
      });
  
      // Log each role separately
      data?.forEach((role, index) => {
        console.log(`Role ${index + 1}:`, {
          id: role.id,
          role: role.role,
          hub_id: role.hub_id,
          created_at: role.created_at
        });
      });
  
      const adminRole = data?.find(role => 
        ['admin', 'super_admin', 'hub_manager'].includes(role.role)
      );
      
      const allowed = !!adminRole;
      console.log('User has admin access:', allowed, 'Role:', adminRole?.role);
  
      // Check specifically for super_admin
      const superAdmin = data?.some(r => r.role === 'super_admin');
      console.log('Is super admin:', superAdmin);
      setIsSuperAdmin(!!superAdmin);
  
      if (!allowed) {
        console.warn('User does not have admin access. Available roles:', 
          data?.map(r => r.role).join(', ') || 'none');
      }
  
      setIsAdmin(allowed);
  
      // Load system settings if admin
      if (allowed) {
        console.log('Loading system settings...');
        await loadSettings();
      } else {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges. Please contact support.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error in checkAdminStatus:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast({
        title: "Error",
        description: "Failed to verify admin status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchStats = async () => {
    try {
      // Determine super admin ids if in saasMode
      let superAdminIds: string[] = [];
      if (saasMode) {
        const { data: sa, error: saError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin');
        if (!saError && sa) {
          superAdminIds = sa.map((r: any) => r.user_id);
        }
      }

      // Helper to build not-in filter for profiles
      const notInFilter = superAdminIds.length > 0 ? `(${superAdminIds.map((id) => `"${id}"`).join(',')})` : null;

      // Get total users
      const profilesQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      const { count: userCount } = notInFilter
        ? await profilesQuery.not('id', 'in', notInFilter)
        : await profilesQuery;

      // Get total businesses
      const { count: businessCount } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true });

      // Get active users (users who logged in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const activitiesQuery = supabase
        .from('user_activities')
        .select('*', { count: 'exact', head: true })
        .eq('activity_type', 'login')
        .gte('created_at', thirtyDaysAgo.toISOString());
      const { count: activeCount } = notInFilter
        ? await activitiesQuery.not('user_id', 'in', notInFilter)
        : await activitiesQuery;

      // Get total revenue from aggregated financial_records (daily snapshots)
      let totalRevenue = 0;
      try {
        // Prefer explicit revenue/expenses columns when available
        const { data: frData, error: frError } = await supabase
          .from('financial_records')
          .select('revenue, expenses')
          .not('revenue', 'is', null);

        if (frError) {
          console.warn('financial_records query failed', frError);
          totalRevenue = 0;
        } else {
          totalRevenue = (frData || []).reduce((sum: number, r: any) => sum + (Number(r.revenue || 0) || 0), 0);
        }
      } catch (err) {
        console.error('Error querying financial_records', err);
        totalRevenue = 0;
      }

      setStats({
        totalUsers: userCount || 0,
        totalBusinesses: businessCount || 0,
        activeUsers: activeCount || 0,
        totalRevenue
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Please Sign In</CardTitle>
            <CardDescription>You need to be authenticated to access the dashboard</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isAdmin === null) {
    return null;
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Restricted
            </CardTitle>
            <CardDescription>
              You don't have admin privileges to access this dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <img src="/jenga-biz-logo.png" alt="Jenga Biz Africa" className="h-12 w-auto" />
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.email}
            </span>
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Businesses</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBusinesses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users (30d)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Content */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="max-[991px]:flex max-[991px]:flex-row max-[991px]:flex-wrap">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="invites" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Invite Codes
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="approvals" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Approvals
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Templates
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="subscriptions" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Subscription Plans
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <UserManagement hideSuperAdmins={saasMode} />
          </TabsContent>

          <TabsContent value="invites" className="space-y-6">
            <InviteCodeManager />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="approvals" className="space-y-6">
              <PendingApprovalsList />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="templates" className="space-y-6">
              <TemplatesManager />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>
                    Configure system-wide settings and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium">Auto-approve Organization Accounts</h3>
                        <p className="text-sm text-muted-foreground">When enabled, newly registered ecosystem enablers will be activated automatically. Otherwise, they will remain pending approval.</p>
                      </div>
                      <div>
                        {/* Switch */}
                        <Switch
                          checked={autoApproveOrgs}
                          onCheckedChange={(val: any) => setAutoApproveOrgs(!!val)}
                          disabled={!isSuperAdmin || settingsLoading}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          onClick={saveSettings}
                          disabled={!isSuperAdmin || settingsLoading}
                        >
                          {settingsLoading ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="subscriptions" className="space-y-6">
              <SubscriptionPlansManager />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="analytics" className="space-y-6">
              {/* Super Admin: list of organizations (hubs) for impersonation */}
              <HubsList />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
