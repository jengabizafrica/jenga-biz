// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Users, Building2, Globe, TrendingUp, Activity, Calendar } from 'lucide-react';
import { MetricsCard } from './MetricsCard';
import { GeographicChart } from './GeographicChart';
import { ActivityChart } from './ActivityChart';
import { EngagementMetrics } from './EngagementMetrics';
import { BusinessIntelligenceDashboard } from './BusinessIntelligenceDashboard';
import { ReportingDashboard } from './ReportingDashboard';
import { FinancialInsightsDashboard } from './FinancialInsightsDashboard';
import { ProFeature } from '@/components/SubscriptionGate';

interface DashboardMetrics {
  totalUsers: number;
  activeBusinesses: number;
  totalCountries: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyRegistrations: number;
}

export const AnalyticsDashboard = ({ initialPanel }: { initialPanel?: string | null }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<string>(initialPanel || 'business-intelligence');

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  useEffect(() => {
    if (initialPanel) setPanel(initialPanel);
  }, [initialPanel]);

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);

      // Hub-aware: attempt to filter by hub_id when impersonating or in hub context
      const { getCurrentHubIdFromStorage } = await import('@/lib/tenant');
      const hubId = getCurrentHubIdFromStorage();

      // Helper to attempt a filtered query and fall back if the column doesn't exist
      const tryCount = async (builderFn: () => any) => {
        try {
          return await builderFn();
        } catch (e: any) {
          const msg = String(e?.message || e?.error || '');
          if (msg.includes('column') && msg.includes('does not exist')) {
            // Retry without filter
            return await builderFn();
          }
          throw e;
        }
      };

      // Build queries
      const profilesQuery = async () => {
        const q = supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (hubId) q.eq('hub_id', hubId);
        return q;
      };

      const businessesQuery = async () => {
        const q = supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('is_active', true);
        if (hubId) q.eq('hub_id', hubId);
        return q;
      };

      const countriesQuery = async () => {
        const q = supabase.from('geographic_analytics').select('*', { count: 'exact', head: true });
        if (hubId) q.eq('hub_id', hubId);
        return q;
      };

      const dailyActiveQuery = async () => {
        const q = supabase.from('analytics_summaries')
          .select('metric_value')
          .eq('metric_type', 'daily_active_users')
          .eq('metric_date', new Date().toISOString().split('T')[0])
          .maybeSingle();
        if (hubId) q.eq('hub_id', hubId);
        return q;
      };

      const weeklyActiveQuery = async () => {
        const q = supabase.from('analytics_summaries')
          .select('metric_value')
          .eq('metric_type', 'weekly_active_users')
          .gte('metric_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .maybeSingle();
        if (hubId) q.eq('hub_id', hubId);
        return q;
      };

      const monthlyRegsQuery = async () => {
        const q = supabase.from('analytics_summaries')
          .select('metric_value')
          .eq('metric_type', 'monthly_registrations')
          .eq('metric_date', new Date().toISOString().slice(0, 7) + '-01')
          .maybeSingle();
        if (hubId) q.eq('hub_id', hubId);
        return q;
      };

      const [
        { count: totalUsers } = { count: 0 },
        { count: activeBusinesses } = { count: 0 },
        { count: totalCountries } = { count: 0 },
        { data: dailyActive } = { data: null },
        { data: weeklyActive } = { data: null },
        { data: monthlyRegs } = { data: null }
      ] = await Promise.all([
        tryCount(profilesQuery),
        tryCount(businessesQuery),
        tryCount(countriesQuery),
        tryCount(dailyActiveQuery),
        tryCount(weeklyActiveQuery),
        tryCount(monthlyRegsQuery)
      ]);

      setMetrics({
        totalUsers: totalUsers || 0,
        activeBusinesses: activeBusinesses || 0,
        totalCountries: totalCountries || 0,
        dailyActiveUsers: dailyActive?.metric_value || 0,
        weeklyActiveUsers: weeklyActive?.metric_value || 0,
        monthlyRegistrations: monthlyRegs?.metric_value || 0
      });
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform performance and user engagement</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px] mb-2" />
                <Skeleton className="h-3 w-[120px]" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <MetricsCard
              title="Total Users"
              value={metrics?.totalUsers || 0}
              icon={Users}
              description="Registered platform users"
            />
            <MetricsCard
              title="Active Businesses"
              value={metrics?.activeBusinesses || 0}
              icon={Building2}
              description="Businesses currently active"
            />
            <MetricsCard
              title="Countries"
              value={metrics?.totalCountries || 0}
              icon={Globe}
              description="Geographic reach"
            />
            <MetricsCard
              title="Daily Active Users"
              value={metrics?.dailyActiveUsers || 0}
              icon={Activity}
              description="Users active today"
            />
            <MetricsCard
              title="Weekly Active Users"
              value={metrics?.weeklyActiveUsers || 0}
              icon={TrendingUp}
              description="Users active this week"
            />
            <MetricsCard
              title="Monthly Registrations"
              value={metrics?.monthlyRegistrations || 0}
              icon={Calendar}
              description="New users this month"
            />
          </>
        )}
      </div>

      {/* Detailed Analytics */}
      <Tabs value={panel} onValueChange={(v) => setPanel(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 h-auto gap-1 p-1">
          <TabsTrigger value="business-intelligence" className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
            BI Dashboard
          </TabsTrigger>
          <TabsTrigger value="reporting" className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
            Reports
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
            Financial
          </TabsTrigger>
          <TabsTrigger value="geographic" className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
            Geographic
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
            Activity
          </TabsTrigger>
          <TabsTrigger value="engagement" className="text-xs sm:text-sm px-2 py-2 whitespace-nowrap">
            Engagement
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="business-intelligence" className="space-y-4">
          <ProFeature feature="Business Intelligence Dashboard">
            <BusinessIntelligenceDashboard />
          </ProFeature>
        </TabsContent>

        <TabsContent value="reporting" className="space-y-4">
          <ProFeature feature="Advanced Reporting">
            <ReportingDashboard />
          </ProFeature>
        </TabsContent>
        
        <TabsContent value="geographic" className="space-y-4">
          <GeographicChart />
        </TabsContent>
        
        <TabsContent value="activity" className="space-y-4">
          <ActivityChart />
        </TabsContent>
        
        <TabsContent value="engagement" className="space-y-4">
          <EngagementMetrics />
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <ProFeature feature="Financial Insights Dashboard">
            <FinancialInsightsDashboard />
          </ProFeature>
        </TabsContent>
      </Tabs>
    </div>
  );
};
