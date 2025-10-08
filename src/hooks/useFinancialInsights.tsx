import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface FinancialRecord {
  id: string;
  business_id: string;
  record_date: string;
  revenue: number;
  expenses: number;
  currency: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialHealthMetrics {
  profitMargin: number;
  burnRate: number;
  cashflowTrend: 'positive' | 'negative' | 'stable';
  sustainabilityDays: number;
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  healthScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CashflowData {
  date: string;
  revenue: number;
  expenses: number;
  netCashflow: number;
  cumulativeCashflow: number;
}

export interface SustainabilityWarning {
  type: 'burn_rate' | 'negative_trend' | 'low_margin' | 'irregular_revenue';
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendation: string;
}

export const useFinancialInsights = (businessId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch financial records
  const fetchFinancialRecords = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { getCurrentHubIdFromStorage } = await import('@/lib/tenant');
      const hubId = getCurrentHubIdFromStorage();
      // Prefer aggregated financial_records (daily business-level snapshots)
      try {
        // Prefer aggregated financial_records (daily business-level snapshots)
        // If hubId is present, use the view that joins businesses to expose hub_id
        let frSource = 'financial_records';
        if (hubId) frSource = 'financial_records_with_hub';

        // supabase client types expect literal table names; use any for dynamic source
        let frQuery = (supabase as any)
          .from(frSource)
          .select('*')
          .order('record_date', { ascending: false });

        if (businessId) frQuery = frQuery.eq('business_id', businessId);
        else if (hubId) {
          // The view exposes hub_id so filter by it
          frQuery = frQuery.eq('hub_id', hubId as any);
        }

        const { data: frData, error: frError } = await frQuery;
        if (!frError && frData && frData.length > 0) {
          // Normalize aggregated rows into FinancialRecord shape
          const normalized = frData.map((r: any) => ({
            id: r.id,
            business_id: r.business_id,
            record_date: r.record_date,
            revenue: Number(r.revenue ?? r.amount ?? 0),
            expenses: Number(r.expenses ?? 0),
            currency: (r as any).currency || 'USD',
            notes: r.notes || null,
            created_at: r.created_at,
            updated_at: r.updated_at
          }));

          setFinancialRecords(normalized || []);
          return;
        }
      } catch (e) {
        // If the view/table doesn't exist or returns an error, fall back to transactions
        console.warn('financial_records query failed, falling back to financial_transactions', e);
      }

      // Fallback: legacy per-transaction records
      let query = supabase
        .from('financial_transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else if (hubId) {
        try { query = query.eq('hub_id', hubId); } catch (e) { /* ignore */ }
      }

      let res = await query;
      if (res.error && String(res.error.message || res.error).includes('does not exist')) {
        res = await supabase
          .from('financial_transactions')
          .select('*')
          .order('transaction_date', { ascending: false });
      }

      const { data, error } = res;

      if (error) throw error;

      const rows = data || [];
      // Normalize legacy and new shapes
      const normalized = rows.map((r: any) => ({
        id: r.id,
        business_id: r.business_id || null,
        record_date: r.record_date || r.transaction_date,
        revenue: r.revenue ?? (r.amount > 0 ? Number(r.amount) : 0),
        expenses: r.expenses ?? (r.amount < 0 ? Math.abs(Number(r.amount)) : 0),
        currency: r.currency || r.currency || 'USD',
        notes: r.notes || r.description || null,
        created_at: r.created_at,
        updated_at: r.updated_at
      }));

      setFinancialRecords(normalized || []);
    } catch (err: any) {
      console.error('Error fetching financial records:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add financial record
  const addFinancialRecord = async (record: Omit<FinancialRecord, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    
    try {
      const payload: any = {
        ...record,
        transaction_date: (record as any).record_date || (record as any).transaction_date,
        transaction_type: (record as any).transaction_type || (record as any).category || 'transaction'
      };

      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([payload])
        .select()
        .single();
      
      if (error) throw error;
      
      await fetchFinancialRecords();
      toast({
        title: 'Success',
        description: 'Financial record added successfully',
      });
      
      return data;
    } catch (err: any) {
      console.error('Error adding financial record:', err);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  // Calculate financial health metrics
  const financialHealthMetrics = useMemo((): FinancialHealthMetrics => {
    if (financialRecords.length === 0) {
      return {
        profitMargin: 0,
        burnRate: 0,
        cashflowTrend: 'stable',
        sustainabilityDays: 0,
        revenueGrowthRate: 0,
        expenseGrowthRate: 0,
        healthScore: 50,
        riskLevel: 'medium'
      };
    }

    const totalRevenue = financialRecords.reduce((sum, record) => sum + record.revenue, 0);
    const totalExpenses = financialRecords.reduce((sum, record) => sum + record.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    
    // Profit margin
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    // Monthly burn rate (average monthly expenses)
    const monthlyExpenses = totalExpenses / Math.max(1, financialRecords.length / 30);
    const burnRate = monthlyExpenses;
    
    // Cashflow trend analysis
    const recentRecords = financialRecords.slice(0, 7); // Last 7 records
    const oldRecords = financialRecords.slice(7, 14); // Previous 7 records
    
    const recentAvgCashflow = recentRecords.length > 0 
      ? recentRecords.reduce((sum, r) => sum + (r.revenue - r.expenses), 0) / recentRecords.length 
      : 0;
    const oldAvgCashflow = oldRecords.length > 0 
      ? oldRecords.reduce((sum, r) => sum + (r.revenue - r.expenses), 0) / oldRecords.length 
      : 0;
    
    let cashflowTrend: 'positive' | 'negative' | 'stable' = 'stable';
    if (recentAvgCashflow > oldAvgCashflow * 1.1) cashflowTrend = 'positive';
    else if (recentAvgCashflow < oldAvgCashflow * 0.9) cashflowTrend = 'negative';
    
    // Sustainability (days of operation at current burn rate)
    const currentCash = totalProfit;
    const sustainabilityDays = burnRate > 0 ? Math.max(0, currentCash / (burnRate / 30)) : 365;
    
    // Growth rates
    const recentRevenue = recentRecords.reduce((sum, r) => sum + r.revenue, 0);
    const oldRevenue = oldRecords.reduce((sum, r) => sum + r.revenue, 0);
    const recentExpenses = recentRecords.reduce((sum, r) => sum + r.expenses, 0);
    const oldExpenses = oldRecords.reduce((sum, r) => sum + r.expenses, 0);
    
    const revenueGrowthRate = oldRevenue > 0 ? ((recentRevenue - oldRevenue) / oldRevenue) * 100 : 0;
    const expenseGrowthRate = oldExpenses > 0 ? ((recentExpenses - oldExpenses) / oldExpenses) * 100 : 0;
    
    // Health score calculation
    let healthScore = 50;
    if (profitMargin > 20) healthScore += 20;
    else if (profitMargin > 10) healthScore += 10;
    else if (profitMargin < 0) healthScore -= 20;
    
    if (cashflowTrend === 'positive') healthScore += 15;
    else if (cashflowTrend === 'negative') healthScore -= 15;
    
    if (sustainabilityDays > 90) healthScore += 15;
    else if (sustainabilityDays < 30) healthScore -= 20;
    
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    // Risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (healthScore < 40 || sustainabilityDays < 30) riskLevel = 'high';
    else if (healthScore < 60 || sustainabilityDays < 60) riskLevel = 'medium';
    
    return {
      profitMargin,
      burnRate,
      cashflowTrend,
      sustainabilityDays,
      revenueGrowthRate,
      expenseGrowthRate,
      healthScore,
      riskLevel
    };
  }, [financialRecords]);

  // Generate cashflow data for charts
  const cashflowData = useMemo((): CashflowData[] => {
    if (financialRecords.length === 0) return [];
    
    const sortedRecords = [...financialRecords].sort((a, b) => 
      new Date(a.record_date).getTime() - new Date(b.record_date).getTime()
    );
    
    let cumulativeCashflow = 0;
    
    return sortedRecords.map(record => {
      const netCashflow = record.revenue - record.expenses;
      cumulativeCashflow += netCashflow;
      
      return {
        date: record.record_date,
        revenue: record.revenue,
        expenses: record.expenses,
        netCashflow,
        cumulativeCashflow
      };
    });
  }, [financialRecords]);

  // Generate sustainability warnings
  const sustainabilityWarnings = useMemo((): SustainabilityWarning[] => {
    const warnings: SustainabilityWarning[] = [];
    const metrics = financialHealthMetrics;
    
    // High burn rate warning
    if (metrics.burnRate > metrics.revenueGrowthRate * 1.5) {
      warnings.push({
        type: 'burn_rate',
        severity: 'high',
        message: 'Expenses are growing faster than revenue',
        recommendation: 'Review and optimize operational costs'
      });
    }
    
    // Negative trend warning
    if (metrics.cashflowTrend === 'negative') {
      warnings.push({
        type: 'negative_trend',
        severity: 'medium',
        message: 'Cashflow trend is declining',
        recommendation: 'Focus on increasing revenue or reducing expenses'
      });
    }
    
    // Low margin warning
    if (metrics.profitMargin < 10) {
      warnings.push({
        type: 'low_margin',
        severity: metrics.profitMargin < 0 ? 'high' : 'medium',
        message: 'Profit margin is below healthy threshold',
        recommendation: 'Optimize pricing strategy or reduce costs'
      });
    }
    
    // Sustainability warning
    if (metrics.sustainabilityDays < 60) {
      warnings.push({
        type: 'burn_rate',
        severity: metrics.sustainabilityDays < 30 ? 'high' : 'medium',
        message: `Current runway: ${Math.round(metrics.sustainabilityDays)} days`,
        recommendation: 'Improve cashflow to extend operational runway'
      });
    }
    
    return warnings;
  }, [financialHealthMetrics]);

  // Revenue/expense aggregation by period
  const getAggregatedData = (period: 'daily' | 'weekly' | 'monthly' | 'quarterly') => {
    const grouped = new Map<string, { revenue: number; expenses: number; count: number }>();
    
    financialRecords.forEach(record => {
      const date = new Date(record.record_date);
      let key: string;
      
      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarterly':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `${date.getFullYear()}-Q${quarter}`;
          break;
      }
      
      const existing = grouped.get(key) || { revenue: 0, expenses: 0, count: 0 };
      grouped.set(key, {
        revenue: existing.revenue + record.revenue,
        expenses: existing.expenses + record.expenses,
        count: existing.count + 1
      });
    });
    
    return Array.from(grouped.entries()).map(([period, data]) => ({
      period,
      revenue: data.revenue,
      expenses: data.expenses,
      profit: data.revenue - data.expenses,
      count: data.count
    }));
  };

  useEffect(() => {
    fetchFinancialRecords();
  }, [user, businessId]);

  return {
    financialRecords,
    financialHealthMetrics,
    cashflowData,
    sustainabilityWarnings,
    loading,
    error,
    addFinancialRecord,
    fetchFinancialRecords,
    getAggregatedData
  };
};
