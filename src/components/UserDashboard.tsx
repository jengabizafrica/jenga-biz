import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Building2, 
  ArrowLeft, 
  Plus, 
  Settings,
  Eye,
  Edit,
  Trash2,
  Download,
  Share2,
  Target,
  DollarSign,
  MoreVertical
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useStrategy } from '@/hooks/useStrategy';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useShareActions } from '@/lib/shareUtils';
import { formatError } from '@/lib/formatError';
import ReportModal from './ReportModal';

interface UserDashboardProps {
  // No props needed - using React Router navigation
}

interface UserProfile {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  organization_name?: string | null;
  profile_picture_url?: string | null;
  logo_url?: string | null;
  account_type: string | null;
  industry?: string | null;
  country?: string | null;
}

// Domain types
interface Business {
  id: string;
  name?: string | null;
  business_type?: string | null;
  stage?: string | null;
  description?: string | null;
  registration_number?: string | null;
  registration_certificate_url?: string | null;
  hub_id?: string | null;
  user_id?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface Milestone {
  id?: string;
  strategy_id?: string;
  title?: string;
  description?: string;
  status?: string;
  target_date?: string | null;
  milestone_type?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Strategy {
  id: string;
  user_id: string;
  template_id?: string | null;
  template_name?: string | null;
  business_name?: string | null;
  vision?: string | null;
  mission?: string | null;
  target_market?: string | null;
  revenue_model?: string | null;
  value_proposition?: string | null;
  key_partners?: string | null;
  marketing_approach?: string | null;
  operational_needs?: string | null;
  growth_goals?: string | null;
  language?: string | null;
  country?: string | null;
  currency?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  business_id?: string | null;
  business?: Business | null;
  milestones?: Milestone[] | null;
}

const UserDashboard = ({ }: UserDashboardProps) => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  console.log('🔍 UserDashboard - Component rendering v2 (no-onboarding)', user?.email, 'authLoading:', authLoading);
  
  // Import useStrategy hook
  const { strategies, currentStrategy, setCurrentStrategy, loading, loadStrategies } = useStrategy() as any;
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [allMilestones, setAllMilestones] = useState<any[]>([]);
    const [, setLoadingMilestones] = useState(true);
    const [, setLoadingFinancial] = useState(true);
  const [financialData, setFinancialData] = useState<any>({ totalRevenue: 0, totalExpenses: 0, recentTransactions: [] });
  
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportMode, setReportMode] = useState<'download' | 'share'>('download');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [fallbackStrategies, setFallbackStrategies] = useState<Strategy[]>([]);

  // Helpers to safely handle possibly-null/undefined date strings coming from the DB
  const safeParseDate = (dateStr?: string | null): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const safeFormatDistanceToNow = (dateStr?: string | null) => {
    const d = safeParseDate(dateStr);
    if (!d) return 'Unknown';
    try {
      return formatDistanceToNow(d, { addSuffix: true });
    } catch (e) {
      return 'Unknown';
    }
  };

  // Navigation handlers using React Router
  const handleBackToHome = () => navigate('/');
  
  const handleViewStrategy = (strategy: any) => {
    console.log('🔍 Dashboard - View strategy clicked, strategy.id:', strategy.id);
    navigate(`/strategy?id=${strategy.id}`);
  };
  const handleEditProfile = () => navigate('/profile');

  // Delete strategy handler
  const handleDeleteStrategy = async (id: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this strategy?");
    if (!confirmed) return;

    console.log('🔍 Delete strategy - ID:', id, 'User:', user?.id);

    try {
      // First verify the strategy exists and belongs to the user
      const { data: strategyCheck, error: checkError } = await supabase
        .from('strategies')
        .select('id, business_name, user_id')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (checkError || !strategyCheck) {
        console.error('Strategy not found or access denied:', checkError);
        toast({
          title: "Error",
          description: "Strategy not found or you don't have permission to delete it.",
          variant: "destructive"
        });
        return;
      }

      console.log('🔍 Strategy verified:', strategyCheck);

      // Delete the strategy
      const { error: deleteError } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (deleteError) {
        console.error("Error deleting strategy:", deleteError);
        toast({
          title: "Error",
          description: "Failed to delete strategy. Please try again.",
          variant: "destructive"
        });
      } else {
        console.log('🔍 Strategy deleted successfully');
        toast({
          title: "Success",
          description: "Strategy deleted successfully.",
        });
        // Refresh strategies after delete
        loadStrategies();
      }
    } catch (error) {
      console.error("Unexpected error during delete:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Navigation to specific strategy tabs
  const handleUpdateMilestones = (strategyId: string) => {
    navigate(`/strategy?id=${strategyId}&tab=milestones`);
  };

  const handleUpdateFinancials = (strategyId: string) => {
    navigate(`/strategy?id=${strategyId}&tab=financials`);
  };

  // Report modal handlers
  const handleDownloadReport = (strategy: any) => {
    setSelectedStrategy(strategy);
    setReportMode('download');
    setReportModalOpen(true);
  };

  const handleShareReport = (strategy: any) => {
    setSelectedStrategy(strategy);
    setReportMode('share');
    setReportModalOpen(true);
  };
  const handleReportConfirm = (options: { type: string; period: string }) => {
    if (reportMode === 'download') {
      if (options.type === 'financials') {
        handleComprehensiveDownload('milestones'); // Use existing logic for now
      } else {
        handleComprehensiveDownload(options.type as 'full' | 'strategy' | 'milestones');
      }
    } else {
      handleComprehensiveShare();
    }
  };

  // Do not auto-set strategies[0]. Just load data for the user
  const lastLoadedUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    // If we've already loaded data for this user id, skip
    if (lastLoadedUserRef.current === user.id) return;
    lastLoadedUserRef.current = user.id || null;

    console.log('🔍 UserDashboard - loading user data...');
    loadUserProfile();
    // Primary load via strategy hook
    loadStrategies();
    // Also fetch a fallback list of strategies (including business) in case the hook/context hasn't populated yet
    fetchFallbackStrategiesIfNeeded();
    loadUserMilestones();
    loadUserFinancialData();
  }, [user]);

  // Fallback: directly query strategies including business relation if strategies from hook are empty
  const fetchFallbackStrategiesIfNeeded = async () => {
    try {
      // If the hook already has strategies, no need to fetch
      if (strategies && strategies.length > 0) return;
      if (!user) return;

      console.log('🔍 UserDashboard - fallback fetching strategies directly');
      const { data, error } = await supabase
        .from('strategies')
        .select('*, business:businesses(*)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) {
        console.warn('Fallback strategies fetch error:', formatError(error));
        return;
      }

      if (data && data.length > 0) {
        // save fallback list and set the selected/current strategy so the dashboard can render immediately
        // Cast to any because Supabase query shape can include select errors when relations are missing
        setFallbackStrategies(data as any[] || []);
        setSelectedStrategy((data[0] ?? null) as any);
        try {
          // prefer updating context currentStrategy if available
          setCurrentStrategy && setCurrentStrategy(data[0]);
        } catch (e) {
          // ignore if not settable
        }
      }
    } catch (err) {
      console.error('Unexpected fallback fetch error:', err);
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      const msg = formatError(error);
      console.error('Error loading user profile:', msg, error);
      toast({ title: 'Profile load failed', description: msg, variant: 'destructive' });
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadUserMilestones = async () => {
    if (!user) return;

    try {
      setLoadingMilestones(true);
      console.log('Loading milestones for user:', user.id);

      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Loaded milestones:', data);
      setAllMilestones(data || []);
    } catch (error: any) {
      const msg = formatError(error);
      console.error('Error loading user milestones:', msg, error);
      toast({ title: 'Failed to load milestones', description: msg, variant: 'destructive' });
    } finally {
      setLoadingMilestones(false);
    }
  };

  const loadUserFinancialData = async () => {
    if (!user) return;

    try {
      setLoadingFinancial(true);
      console.log('Loading financial data for user:', user.id);
      // First attempt: use aggregated `financial_records` (business-level daily snapshots)
      // Fetch user's strategies to map to business_id(s)
      const { data: userStrategies, error: stratErr } = await supabase
        .from('strategies')
        .select('id, business_id')
        .eq('user_id', user.id);

      let businessIds: string[] = [];
      if (!stratErr && userStrategies && userStrategies.length > 0) {
        businessIds = userStrategies.map((s: any) => s.business_id).filter(Boolean);
      }

      if (businessIds.length > 0) {
        try {
          // Query financial_records for these businesses
          const { data: frData, error: frError } = await supabase
            .from('financial_records')
            .select('business_id, revenue, expenses, metric_type, record_date')
            .in('business_id', businessIds)
            .not('revenue', 'is', null);

          if (!frError && frData && frData.length > 0) {
            // Aggregate totals using revenue/expenses columns when available
            const totalRevenue = frData.reduce((sum: number, r: any) => sum + Number(r.revenue || 0), 0);
            const totalExpenses = frData.reduce((sum: number, r: any) => sum + Number(r.expenses || 0), 0);

            // Recent transactions: fall back to the most recent financial_transactions for listing, since records are daily aggregates
            const { data: recentTx, error: rtErr } = await supabase
              .from('financial_transactions')
              .select('*')
              .eq('user_id', user.id)
              .order('transaction_date', { ascending: false })
              .limit(5);

            setFinancialData({
              totalRevenue,
              totalExpenses,
              netProfit: totalRevenue - totalExpenses,
              recentTransactions: (!rtErr && recentTx) ? recentTx : []
            });
            return;
          }
        } catch (err) {
          console.warn('Error querying financial_records, will fall back to transactions', err);
        }
      }

      // Fallback: query financial_transactions directly (per-user)
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      console.log('Loaded financial transactions (fallback):', data);

      const totalRevenue = data?.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalExpenses = data?.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const recentTransactions = data?.slice(0, 5) || [];

      setFinancialData({
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        recentTransactions
      });
    } catch (error: any) {
      const msg = formatError(error);
      console.error('Error loading financial data:', msg, error);
      toast({ title: 'Failed to load financial data', description: msg, variant: 'destructive' });
    } finally {
      setLoadingFinancial(false);
    }
  };

  const getUserDisplayName = () => {
    if (!profile) return 'User';
    
    if (profile.account_type === 'organization') {
      return profile.organization_name || 'Organization';
    } else {
      return profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
    }
  };

  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getProfileImage = () => {
    if (profile?.account_type === 'organization') {
      return profile.logo_url;
    } else {
      return profile?.profile_picture_url;
    }
  };

  const getAccountTypeDisplay = () => {
    if (profile?.account_type === 'organization') {
      return 'Organization';
    } else {
      return 'Entrepreneur';
    }
  };

  const handleComprehensiveDownload = (type: 'full' | 'strategy' | 'milestones') => {
    const timestamp = new Date().toISOString().split('T')[0];
    let content = '';
    let filename = '';

    if (type === 'full') {
      filename = `jenga-biz-full-report-${timestamp}.txt`;
      content = generateFullReport();
    } else if (type === 'strategy') {
      filename = `jenga-biz-strategies-${timestamp}.txt`;
      content = generateStrategyReport();
    } else if (type === 'milestones') {
      filename = `jenga-biz-milestones-${timestamp}.txt`;
      content = generateMilestonesReport();
    }

    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Report Downloaded',
      description: `${filename} downloaded successfully.`,
    });
  };

  const shareActions = useShareActions();

  const handleComprehensiveShare = () => {
    const shareText = generateFullReport();
    shareActions.handleCopyText(shareText);
  };

  const generateFullReport = () => {
    const userName = getUserDisplayName();
    const timestamp = new Date().toLocaleDateString();
    
    let report = `JENGA BIZ AFRICA - COMPREHENSIVE BUSINESS REPORT\n`;
    report += `Generated for: ${userName}\n`;
    report += `Date: ${timestamp}\n`;
    report += `${'='.repeat(60)}\n\n`;

  // Add strategies section
  report += `BUSINESS STRATEGIES (${(strategies || []).length})\n`;
    report += `${'-'.repeat(30)}\n`;
    if ((strategies || []).length > 0) {
      (strategies || []).forEach((strategy: Strategy, index: number) => {
        report += `${index + 1}. ${strategy.business_name || 'Untitled Strategy'}\n`;
        if (strategy.vision) report += `   Vision: ${strategy.vision}\n`;
        if (strategy.mission) report += `   Mission: ${strategy.mission}\n`;
        if (strategy.target_market) report += `   Target Market: ${strategy.target_market}\n`;
        if (strategy.revenue_model) report += `   Revenue Model: ${strategy.revenue_model}\n`;
        report += `   Updated: ${safeFormatDistanceToNow(strategy.updated_at || strategy.created_at)}\n\n`;
      });
    } else {
      report += `No strategies created yet.\n\n`;
    }

    // Add milestones section
  report += `BUSINESS MILESTONES (${(allMilestones || []).length})\n`;
    report += `${'-'.repeat(30)}\n`;
    if ((allMilestones || []).length > 0) {
      (allMilestones || []).forEach((milestone: any, index: number) => {
        report += `${index + 1}. ${milestone.title || 'Untitled'}\n`;
        report += `   Status: ${milestone.status === 'not-started' ? 'Not Started' : 
                      milestone.status === 'in-progress' ? 'In Progress' : 
                      milestone.status === 'complete' ? 'Complete' : 'Overdue'}\n`;
        if (milestone.target_date) {
          const td = safeParseDate(milestone.target_date);
          report += `   Target Date: ${td ? td.toLocaleDateString() : 'Unknown'}\n`;
        }
        report += `   Created: ${safeFormatDistanceToNow(milestone.created_at)}\n\n`;
      });
    } else {
      report += `No milestones created yet.\n\n`;
    }

    // Add financial section
    report += `FINANCIAL SUMMARY\n`;
    report += `${'-'.repeat(30)}\n`;
  const totalRevenue = financialData?.totalRevenue ?? 0;
  const totalExpenses = financialData?.totalExpenses ?? 0;
  const netProfit = financialData?.netProfit ?? (totalRevenue - totalExpenses);
  const recentTransactions = financialData?.recentTransactions ?? [];

  report += `Total Revenue: KSh ${Number(totalRevenue).toLocaleString()}\n`;
  report += `Total Expenses: KSh ${Number(totalExpenses).toLocaleString()}\n`;
  report += `Net Profit: KSh ${Number(netProfit).toLocaleString()}\n`;
  report += `Recent Transactions: ${recentTransactions.length}\n\n`;

    if ((recentTransactions || []).length > 0) {
      report += `RECENT TRANSACTIONS (Last 5)\n`;
      report += `${'-'.repeat(30)}\n`;
      (recentTransactions || []).forEach((transaction: any, index: number) => {
        report += `${index + 1}. ${transaction.description || 'No description'}\n`;
        report += `   Type: ${transaction.transaction_type || 'unknown'}\n`;
        report += `   Amount: KSh ${Number(transaction.amount || 0).toLocaleString()}\n`;
        report += `   Category: ${transaction.category || 'Uncategorized'}\n`;
        const td = safeParseDate(transaction.transaction_date);
        report += `   Date: ${td ? td.toLocaleDateString() : 'Unknown'}\n\n`;
      });
    }

    report += `\n${'='.repeat(60)}\n`;
    report += `This report was generated by Jenga Biz Africa\n`;
    report += `Empowering African Entrepreneurs ✨\n`;

    return report;
  };

  const generateStrategyReport = () => {
    let report = `JENGA BIZ AFRICA - BUSINESS STRATEGIES REPORT\n`;
    report += `Generated: ${new Date().toLocaleDateString()}\n`;
    report += `${'='.repeat(50)}\n\n`;

    if ((strategies || []).length > 0) {
      (strategies || []).forEach((strategy: Strategy, index: number) => {
        report += `STRATEGY ${index + 1}: ${strategy.business_name || 'Untitled'}\n`;
        report += `${'-'.repeat(40)}\n`;
        if (strategy.vision) report += `Vision: ${strategy.vision}\n\n`;
        if (strategy.mission) report += `Mission: ${strategy.mission}\n\n`;
        if (strategy.target_market) report += `Target Market: ${strategy.target_market}\n\n`;
        if (strategy.value_proposition) report += `Value Proposition: ${strategy.value_proposition}\n\n`;
        if (strategy.revenue_model) report += `Revenue Model: ${strategy.revenue_model}\n\n`;
        if (strategy.key_partners) report += `Key Partners: ${strategy.key_partners}\n\n`;
        if (strategy.marketing_approach) report += `Marketing Approach: ${strategy.marketing_approach}\n\n`;
        if (strategy.operational_needs) report += `Operational Needs: ${strategy.operational_needs}\n\n`;
        if (strategy.growth_goals) report += `Growth Goals: ${strategy.growth_goals}\n\n`;
        report += `Created: ${safeFormatDistanceToNow(strategy.created_at)}\n`;
        report += `Updated: ${safeFormatDistanceToNow(strategy.updated_at)}\n\n`;
        report += `${'='.repeat(50)}\n\n`;
      });
    } else {
      report += `No strategies found. Start creating your business strategy today!\n\n`;
    }

    report += `Generated with Jenga Biz Africa ✨\n`;
    return report;
  };

  const generateMilestonesReport = () => {
    let report = `JENGA BIZ AFRICA - BUSINESS MILESTONES REPORT\n`;
    report += `Generated: ${new Date().toLocaleDateString()}\n`;
    report += `${'='.repeat(50)}\n\n`;

    if (allMilestones.length > 0) {
      const groupedMilestones = {
        'not-started': allMilestones.filter(m => m.status === 'not-started'),
        'in-progress': allMilestones.filter(m => m.status === 'in-progress'), 
        'complete': allMilestones.filter(m => m.status === 'complete'),
        'overdue': allMilestones.filter(m => m.status === 'overdue')
      };

      Object.entries(groupedMilestones).forEach(([status, milestones]) => {
        if ((milestones || []).length > 0) {
          report += `${status.toUpperCase().replace('-', ' ')} MILESTONES (${milestones.length})\n`;
          report += `${'-'.repeat(40)}\n`;
          (milestones || []).forEach((milestone: any, index: number) => {
            report += `${index + 1}. ${milestone.title || 'Untitled'}\n`;
            if (milestone.target_date) {
              const td = safeParseDate(milestone.target_date);
              report += `   Target: ${td ? td.toLocaleDateString() : 'Unknown'}\n`;
            }
            report += `   Stage: ${milestone.business_stage || 'Not specified'}\n`;
            report += `   Created: ${safeFormatDistanceToNow(milestone.created_at)}\n\n`;
          });
          report += `\n`;
        }
      });

      report += `SUMMARY:\n`;
      report += `Total Milestones: ${allMilestones.length}\n`;
      report += `Completed: ${groupedMilestones.complete.length}\n`;
      report += `In Progress: ${groupedMilestones['in-progress'].length}\n`;
      report += `Not Started: ${groupedMilestones['not-started'].length}\n`;
      report += `Overdue: ${groupedMilestones.overdue.length}\n\n`;
      
      const completionRate = allMilestones.length > 0 ? 
        Math.round((groupedMilestones.complete.length / allMilestones.length) * 100) : 0;
      report += `Completion Rate: ${completionRate}%\n\n`;
    } else {
      report += `No milestones found. Start setting business milestones to track your progress!\n\n`;
    }

    report += `Generated with Jenga Biz Africa ✨\n`;
    return report;
  };

  // Check auth loading first
  // If auth appears stuck, provide a small diagnostic UI to let the developer/user retry the session check
  if (authLoading) {
    console.log('[Dashboard] auth still loading...');
    const handleRetryAuth = async () => {
      try {
        console.log('[Dashboard] retrying auth.getSession()...');
        const { data } = await supabase.auth.getSession();
        console.log('[Dashboard] getSession result:', data?.session?.user ?? null);
        // Note: the AuthProvider listens to auth state changes and will update context accordingly
      } catch (err) {
        console.error('Auth retry failed', err);
      }
    };

    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="mb-4">Loading dashboard... (auth still initializing)</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleRetryAuth}
              className="px-4 py-2 bg-orange-600 text-white rounded-md"
            >
              Retry auth
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              Go to landing
            </button>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            <div>authLoading: {String(authLoading)}</div>
            <div>user id: {user?.id ?? 'null'}</div>
            <div>Tip: if this stays stuck, check DevTools network tab for blocked requests or service-worker routing.</div>
          </div>
        </div>
      </div>
    );
  }

  // If no user, redirect to auth
  if (!user) {
    console.log('[Dashboard] no user, redirecting to landing...');
    navigate('/');
    return null;
  }

  // We no longer block the entire dashboard render while profile or strategies load.
  // Individual sections show their own loading states. This prevents the UI from
  // getting stuck when one of the loads is delayed or has missing data.
  if (loadingProfile || loading) {
    console.log('[Dashboard] partial data loading...', { loadingProfile, loading });
  }

  console.log('[Dashboard] render check', { currentStrategy, strategiesCount: strategies.length });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <div className="bg-white border-b border-orange-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Top Row - Back button and Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <img src="/jenga-biz-logo.png" alt="Jenga Biz Africa" className="h-10 w-auto" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  console.log('Back to Home clicked');
                  handleBackToHome();
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('Settings clicked');
                  handleEditProfile();
                }}
                className="border-orange-200 text-orange-700 hover:bg-orange-50 text-xs sm:text-sm"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Settings
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  console.log('Sign out clicked');
                  try {
                    await signOut();
                    navigate('/');
                  } catch (error) {
                    console.error('Sign out error:', error);
                    // Force navigation even if signOut fails
                    window.location.href = '/';
                  }
                }}
                className="border-gray-200 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm"
              >
                Sign Out
              </Button>
            </div>
          </div>

          {/* Profile Information Row */}
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0">
              <AvatarImage src={getProfileImage() ?? undefined} alt={getUserDisplayName()} />
              <AvatarFallback className="bg-orange-100 text-orange-700 text-lg">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 truncate">
                {getUserDisplayName()}
              </h1>
              
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs sm:text-sm">
                  {getAccountTypeDisplay()}
                </Badge>
                {profile?.industry && (
                  <Badge variant="outline" className="text-xs sm:text-sm">
                    {profile.industry}
                  </Badge>
                )}
                {profile?.country && (
                  <Badge variant="outline" className="text-xs sm:text-sm">
                    {profile.country}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Strategies Overview */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Strategies</h2>
            {profile?.account_type !== 'organization' && (
              <a href="/b2c" className="flex items-center gap-2 text-xs sm:text-sm bg-slate-900 text-white px-3 py-2 rounded-md">
                <Plus className="w-4 h-4 mr-2" />
                Create New Strategy
              </a>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading strategies...</p>
            </div>
          ) : strategies.length === 0 ? (
            <div className="border border-dashed border-orange-200 rounded-lg p-6 text-center bg-orange-50">
              <Building2 className="mx-auto text-orange-500" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No strategies yet</h3>
              <p className="mt-2 text-sm text-gray-600">Get started by creating a strategy. You can use a template or start from scratch.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              { (strategies && strategies.length > 0 ? strategies : fallbackStrategies).map((strategy: Strategy) => (
                <Card key={strategy.id} className="border-orange-200 hover:border-orange-300 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-gray-900 line-clamp-1">
                          {strategy.business_name || 'Untitled Strategy'}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {strategy.vision && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {strategy.vision}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>
                        Updated {safeFormatDistanceToNow(strategy.updated_at || strategy.created_at)}
                      </span>
                      <div className="flex items-center gap-1">
                        {strategy.language && (
                          <Badge variant="secondary" className="text-xs">
                            {strategy.language?.toUpperCase()}
                          </Badge>
                        )}
                        {strategy.country && (
                          <Badge variant="secondary" className="text-xs">
                            {strategy.country}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Desktop actions */}
                      <div className="hidden md:flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => {
                            console.log('DASHBOARD DEBUG: View button clicked, strategy.id:', strategy.id);
                            console.log('DASHBOARD DEBUG: Full strategy object:', strategy);
                            handleViewStrategy(strategy);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log('DASHBOARD DEBUG: Edit button clicked, strategy.id:', strategy.id);
                            console.log('DASHBOARD DEBUG: Full strategy object:', strategy);
                            handleViewStrategy(strategy);
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateMilestones(strategy.id)}
                        >
                          <Target className="w-3 h-3 mr-1" />
                          Milestones
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateFinancials(strategy.id)}
                        >
                          <DollarSign className="w-3 h-3 mr-1" />
                          Financials
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteStrategy(strategy.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>

                      {/* Mobile actions */}
                      <div className="flex md:hidden gap-2 w-full">
                        <Button
                          size="sm"
                          onClick={() => {
                            console.log('DASHBOARD DEBUG: View button clicked, strategy.id:', strategy.id);
                            console.log('DASHBOARD DEBUG: Full strategy object:', strategy);
                            handleViewStrategy(strategy);
                          }}
                          className="flex-1"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log('DASHBOARD DEBUG: Edit button clicked, strategy.id:', strategy.id);
                            console.log('DASHBOARD DEBUG: Full strategy object:', strategy);
                            handleViewStrategy(strategy);
                          }}
                          className="flex-1"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>

                        {/* More menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background border z-50">
                            <DropdownMenuItem onClick={() => handleUpdateMilestones(strategy.id)}>
                              <Target className="w-4 h-4 mr-2" />
                              Update Milestones
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateFinancials(strategy.id)}>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Update Financials
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadReport(strategy)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download Report
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShareReport(strategy)}>
                              <Share2 className="w-4 h-4 mr-2" />
                              Share Report
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteStrategy(strategy.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>



      </div>

      {/* Report Modal */}
      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onConfirm={handleReportConfirm}
        mode={reportMode}
        strategy={selectedStrategy || undefined}
        language={(selectedStrategy as any)?.language || 'en'}
      />
    </div>
  );
};

export default UserDashboard;
