// @ts-nocheck
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { FinancialInsightsDashboard } from '@/components/analytics/FinancialInsightsDashboard';
import { ImpactMeasurementDashboard } from '@/components/analytics/ImpactMeasurementDashboard';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';

import { useHubContext } from '@/hooks/useHubContext';
import { useRoles } from '@/hooks/useRoles';
import { useHubAnalytics } from '@/hooks/useHubAnalytics';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InviteCodeManager } from '@/components/auth/InviteCodeManager';
import { HubConfigDialog } from '@/components/Hubs/HubConfigDialog';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  FileText, 
  Settings, 
  LogOut,
  Building2,
  Target,
  DollarSign
} from 'lucide-react';

interface SaaSFeaturesProps {
  onSignOut: () => void;
}

const SaaSFeatures = ({ onSignOut }: SaaSFeaturesProps) => {
  const { signOut } = useAuth();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [analyticsPanel, setAnalyticsPanel] = useState<string | undefined>(undefined);
  const [showInvite, setShowInvite] = useState(false);
  const [showHubConfig, setShowHubConfig] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const { currentHub, isImpersonating } = useHubContext();
  const { data: hubAnalytics, isLoading: analyticsLoading, error: analyticsError } = useHubAnalytics();
  const { roles, loading: rolesLoading } = useRoles();

  // Determine if the logged-in user is an admin who hasn't configured a hub yet.
  // In that case, block interaction with SaaS features until they configure the hub.
  const isAdminUser = (roles || []).includes('admin') || (roles || []).includes('super_admin');
  const requiresHubConfig = !rolesLoading && isAdminUser && !currentHub;

  console.debug('SaaSFeatures: role check', { roles, isAdminUser, requiresHubConfig, currentHub });

  useEffect(() => {
    // Initialize from URL query params: ?tab=analytics&panel=reporting
    const tab = searchParams.get('tab');
    const panel = searchParams.get('panel');
    if (tab) setActiveTab(tab);
    if (tab === 'analytics' && panel) {
      setAnalyticsPanel(panel);
    }
  }, [searchParams]);

  // If the admin user lacks a hub, open the hub config dialog on mount.
  useEffect(() => {
    if (requiresHubConfig) {
      setShowHubConfig(true);
    }
  }, [requiresHubConfig]);
  
  

 

  const handleSignOut = async () => {
    await signOut();
    onSignOut();
    window.location.href = '/';
  };

  // Get display title based on context
  const getHeaderTitle = () => {
    if (isImpersonating && currentHub) {
      return `${currentHub.name || currentHub.slug || 'Organization'} Dashboard`;
    }
    return 'Ecosystem Enabler Dashboard';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <Building2 className="h-6 w-6" />
            <h1 className="text-xl font-semibold">{getHeaderTitle()}</h1>
          </div>
          <div className="ml-auto flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => setShowHubConfig(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4 p-6">
        <ImpersonationBanner />
        <div className="relative">
          <Tabs value={activeTab} onValueChange={(v) => {
            // Prevent tab changes while admin is required to configure hub
            if (!requiresHubConfig) setActiveTab(v);
          }} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2" disabled={requiresHubConfig}>
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2" disabled={requiresHubConfig}>
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2" disabled={requiresHubConfig}>
              <DollarSign className="h-4 w-4" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="impact" className="flex items-center gap-2" disabled={requiresHubConfig}>
              <Target className="h-4 w-4" />
              Impact
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2" disabled={requiresHubConfig}>
              <Users className="h-4 w-4" />
              Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Businesses</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsLoading ? '...' : (hubAnalytics?.total_businesses || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isImpersonating ? 'Organization scope' : 'Total across platform'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Businesses</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsLoading ? '...' : (hubAnalytics?.active_businesses || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Currently operating</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${analyticsLoading ? '...' : ((hubAnalytics?.total_revenue || 0).toLocaleString())}
                  </div>
                  <p className="text-xs text-muted-foreground">Cumulative revenue tracked</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Entrepreneurs</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsLoading ? '...' : (hubAnalytics?.total_users || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Unique entrepreneurs</p>
                </CardContent>
              </Card>
            </div>
            
            {analyticsError && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <p className="text-sm text-destructive">
                    Error loading analytics: {analyticsError.message}
                  </p>
                </CardContent>
              </Card>
            )}
            
            <Separator />
            
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <Button
                    className="h-24 flex-col gap-2"
                    variant="outline"
                    onClick={() => {
                      // set UI and deep link to analytics reporting panel
                      setActiveTab('analytics');
                      setAnalyticsPanel('reporting');
                      setSearchParams({ tab: 'analytics', panel: 'reporting' });
                    }}
                  >
                    <FileText className="h-6 w-6" />
                    Generate Report
                  </Button>
                  <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => setShowInvite(true)}>
                    <Users className="h-6 w-6" />
                    Invite Users
                  </Button>
                  <Button className="h-24 flex-col gap-2" variant="outline" onClick={() => setShowHubConfig(true)}>
                    <Settings className="h-6 w-6" />
                    Configure Hub
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard initialPanel={analyticsPanel} />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialInsightsDashboard />
          </TabsContent>

          <TabsContent value="impact">
            <ImpactMeasurementDashboard />
          </TabsContent>

          <TabsContent value="admin">
            <AdminDashboard saasMode />
          </TabsContent>
        </Tabs>

          {/* If admin must configure hub, render a blocking overlay over the tabs area with a CTA */}
          {requiresHubConfig && (
            <div className="absolute inset-0 z-40 flex items-center justify-center">
              <div className="w-full max-w-2xl mx-4 p-6 bg-white/95 border rounded-lg shadow-lg text-center">
                <h2 className="text-lg font-semibold mb-2">Configure your hub to continue</h2>
                <p className="text-sm text-muted-foreground mb-4">Before using the SaaS dashboard you must create or configure your Hub/Organization. Only hub admins can perform this step.</p>
                <div className="flex items-center justify-center gap-4">
                  <Button variant="default" onClick={() => setShowHubConfig(true)}>Configure Hub</Button>
                  <Button variant="ghost" onClick={() => { signOut(); onSignOut(); window.location.href = '/'; }}>Sign out</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Invite Users Dialog */}
        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invite Users</DialogTitle>
            </DialogHeader>
            <InviteCodeManager />
          </DialogContent>
        </Dialog>

        {/* Configure Hub Dialog */}
        <HubConfigDialog open={showHubConfig} onOpenChange={setShowHubConfig} />
      </div>
    </div>
  );
};

export default SaaSFeatures;
