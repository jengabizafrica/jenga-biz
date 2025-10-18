import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useSubscriptionStatus } from './useSubscriptionStatus';
import { supabase } from '@/integrations/supabase/client';

interface UsageLimits {
  businesses: number;
  strategies: number;
  milestones: number;
  receiptsThisMonth: number;
  downloadsThisMonth: number;
  aiSummariesThisMonth: number;
}

interface PlanLimits {
  businesses?: number;
  strategies?: number;
  milestones?: {
    total: number;
    stages: string[];
  };
  financial_tracking?: {
    receipts_per_month: number;
    ocr_enabled: boolean;
  };
  ai_summary?: {
    type: string;
    count: string;
  };
  share_download?: {
    whatsapp: string;
    email: string;
    downloads_per_month: number;
    formats: string[];
  };
}

export function useSubscriptionGating() {
  const { user } = useAuth();
  const { plan } = useSubscriptionStatus();
  
  const [usage, setUsage] = useState<UsageLimits>({
    businesses: 0,
    strategies: 0,
    milestones: 0,
    receiptsThisMonth: 0,
    downloadsThisMonth: 0,
    aiSummariesThisMonth: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);

  const loadUsage = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get current month range
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Count businesses
      const { count: businessCount } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count strategies
      const { count: strategyCount } = await supabase
        .from('strategies')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count milestones
      const { count: milestoneCount } = await supabase
        .from('milestones')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Count receipts this month
      const { count: receiptsCount } = await supabase
        .from('user_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('activity_type', 'receipt_upload')
        .gte('created_at', firstDay.toISOString())
        .lte('created_at', lastDay.toISOString());

      // Count downloads this month
      const { count: downloadsCount } = await supabase
        .from('user_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('activity_type', 'document_download')
        .gte('created_at', firstDay.toISOString())
        .lte('created_at', lastDay.toISOString());

      // Count AI summaries this month
      const { count: aiSummariesCount } = await supabase
        .from('user_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('activity_type', 'ai_summary_generated')
        .gte('created_at', firstDay.toISOString())
        .lte('created_at', lastDay.toISOString());

      setUsage({
        businesses: businessCount || 0,
        strategies: strategyCount || 0,
        milestones: milestoneCount || 0,
        receiptsThisMonth: receiptsCount || 0,
        downloadsThisMonth: downloadsCount || 0,
        aiSummariesThisMonth: aiSummariesCount || 0,
      });
    } catch (error) {
      console.error('Error loading usage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const getPlanLimits = useCallback((): PlanLimits => {
    const features = plan?.features as any;
    return features?.limits || {};
  }, [plan]);

  const canCreateBusiness = useCallback((): boolean => {
    const limits = getPlanLimits();
    const maxBusinesses = limits.businesses || 0;
    
    // -1 or 0 means unlimited
    if (maxBusinesses === -1 || maxBusinesses === 0) return true;
    
    return usage.businesses < maxBusinesses;
  }, [usage.businesses, getPlanLimits]);

  const canCreateStrategy = useCallback((): boolean => {
    const limits = getPlanLimits();
    const maxStrategies = limits.strategies || 0;
    
    // -1 or 0 means unlimited
    if (maxStrategies === -1 || maxStrategies === 0) return true;
    
    return usage.strategies < maxStrategies;
  }, [usage.strategies, getPlanLimits]);

  const canCreateMilestone = useCallback((stage?: string): boolean => {
    const limits = getPlanLimits();
    const milestoneConfig = limits.milestones;
    
    if (!milestoneConfig) return true;
    
    // Check total limit
    const maxMilestones = milestoneConfig.total || 0;
    if (maxMilestones !== -1 && maxMilestones !== 0 && usage.milestones >= maxMilestones) {
      return false;
    }
    
    // Check stage restrictions
    if (stage && milestoneConfig.stages && Array.isArray(milestoneConfig.stages)) {
      return milestoneConfig.stages.includes(stage);
    }
    
    return true;
  }, [usage.milestones, getPlanLimits]);

  const canUploadReceipt = useCallback((): boolean => {
    const limits = getPlanLimits();
    const financialTracking = limits.financial_tracking;
    
    if (!financialTracking) return true;
    
    const maxReceipts = financialTracking.receipts_per_month || 0;
    
    // -1 or 0 means unlimited
    if (maxReceipts === -1 || maxReceipts === 0) return true;
    
    return usage.receiptsThisMonth < maxReceipts;
  }, [usage.receiptsThisMonth, getPlanLimits]);

  const canDownload = useCallback((): boolean => {
    const limits = getPlanLimits();
    const shareDownload = limits.share_download;
    
    if (!shareDownload) return true;
    
    const maxDownloads = shareDownload.downloads_per_month || 0;
    
    // -1 or 0 means unlimited
    if (maxDownloads === -1 || maxDownloads === 0) return true;
    
    return usage.downloadsThisMonth < maxDownloads;
  }, [usage.downloadsThisMonth, getPlanLimits]);

  const canUseAISummary = useCallback((type: 'lite' | 'advanced' = 'lite'): boolean => {
    const limits = getPlanLimits();
    const aiSummary = limits.ai_summary;
    
    if (!aiSummary) return false;
    
    // Check if type is allowed
    if (aiSummary.type === 'none') return false;
    if (type === 'advanced' && aiSummary.type !== 'advanced') return false;
    
    // Check count (unlimited or within limit)
    if (aiSummary.count === 'unlimited') return true;
    
    const maxCount = parseInt(aiSummary.count) || 0;
    if (maxCount === 0) return false;
    
    return usage.aiSummariesThisMonth < maxCount;
  }, [usage.aiSummariesThisMonth, getPlanLimits]);

  const hasOcrAccess = useCallback((): boolean => {
    const limits = getPlanLimits();
    const financialTracking = limits.financial_tracking;
    
    return financialTracking?.ocr_enabled || false;
  }, [getPlanLimits]);

  const getAvailableDownloadFormats = useCallback((): string[] => {
    const limits = getPlanLimits();
    const shareDownload = limits.share_download;
    
    return shareDownload?.formats || [];
  }, [getPlanLimits]);

  const trackActivity = useCallback(async (activityType: string, activityData: any = {}) => {
    if (!user?.id) return;

    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      await supabase.from('user_activities').insert({
        user_id: user.id,
        activity_type: activityType,
        activity_data: { ...activityData, month },
      });

      // Refresh usage after tracking
      await loadUsage();
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  }, [user?.id, loadUsage]);

  return {
    usage,
    isLoading,
    canCreateBusiness,
    canCreateStrategy,
    canCreateMilestone,
    canUploadReceipt,
    canDownload,
    canUseAISummary,
    hasOcrAccess,
    getAvailableDownloadFormats,
    trackActivity,
    refreshUsage: loadUsage,
  };
}
