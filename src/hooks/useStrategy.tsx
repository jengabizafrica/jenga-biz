import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import {
  strategyClient,
  type Strategy,
  type Milestone,
  type Business,
  type BusinessInput,
} from '@/lib/strategy-client';
import { StrategyFinancialsService, type FinancialRecord } from '@/services/strategyFinancials';
import { formatError } from '@/lib/formatError';

// Types are now imported from strategy-client

export const useStrategy = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  // start as not-loading so the first invocation of loadStrategies can run
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currentStrategy, setCurrentStrategy] = useState<Strategy | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  // Load user's strategies
  const lastLoadRef = useRef<number | null>(null);
  const loadStrategies = useCallback(async () => {
    const now = Date.now();
    // Throttle: if we loaded within the last 1s, skip
    if (lastLoadRef.current && now - lastLoadRef.current < 1000) {
      console.log('loadStrategies: skip due to throttle');
      return;
    }

    if (!user) {
      console.log('loadStrategies called but no user');
      return;
    }

    if (loading) {
      console.log('loadStrategies: already loading, skip');
      return;
    }

    lastLoadRef.current = now;
    setLoading(true);
    try {
      console.log('Fetching strategies for user:', user.id);
      const userStrategies = await strategyClient.getStrategies(user.id);
      console.log('Fetched strategies:', userStrategies);
      setStrategies(userStrategies);
      // NOTE: do not refresh currentStrategy here to avoid re-entrant updates
    } catch (error: any) {
      console.error('Error loading strategies:', error);
      toastRef.current?.({
        title: 'Failed to load strategies',
        description: formatError(error),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load a specific strategy with its milestones
  const loadStrategy = useCallback(async (strategyId: string) => {
    if (!strategyId) return null;
    
    setLoadingMilestones(true);
    try {
      const strategyWithMilestones = await strategyClient.getStrategyWithMilestones(strategyId);
      setCurrentStrategy(strategyWithMilestones);
      setMilestones(strategyWithMilestones.milestones);
      return strategyWithMilestones;
    } catch (error: any) {
      console.error('Error loading strategy:', error);
      toast({
        title: 'Failed to load strategy',
        description: formatError(error),
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoadingMilestones(false);
    }
  }, [toast]);

  // Save or update a strategy with business information
  const saveStrategy = useCallback(async (
    strategyData: Omit<Strategy, 'id' | 'created_at' | 'updated_at'> & { 
      id?: string;
      business_type?: string;
      description?: string;
      registration_number?: string;
      registration_certificate_file?: File | null;
      business_id?: string;
    },
    options: { showToast?: boolean; isUpdate?: boolean } = {}
  ) => {
    const { showToast = true, isUpdate = false } = options;
    if (!user) return null;

    try {
      let savedStrategy: Strategy;
      // Certificate URL may be provided on either strategyData (legacy) or businessData; prefer provided value
      let certificateUrl = (strategyData as any).registration_certificate_url ?? undefined;
      const businessId = (strategyData as any).business_id;

      // Handle file upload if a new certificate file is provided (legacy field)
      if ((strategyData as any).registration_certificate_file) {
        try {
          certificateUrl = await strategyClient.uploadBusinessCertificate(
            (strategyData as any).registration_certificate_file,
            businessId || 'temp'
          );
        } catch (error) {
          console.error('Error uploading certificate:', error);
          throw new Error('Failed to upload business registration certificate');
        }
      }
      
      if (isUpdate && strategyData.id) {
        // Update existing strategy and business
        const { id, registration_certificate_file, ...updates } = strategyData;
        
        // Create business data if we have business fields
        const businessData = {
          id: businessId,
          user_id: user.id,
          name: updates.business_name,
          business_type: updates.business_type ?? null,
          stage: (updates as any).business_stage ?? null,
          description: updates.description ?? null,
          registration_number: updates.registration_number ?? null,
          registration_certificate_url: certificateUrl ?? null,
        } as BusinessInput & { id?: string };

        // Use the new method to update strategy with business
        const result = await strategyClient.saveStrategyWithBusinessAndMilestones(
          { ...(updates as any), id },
          businessData,
          [] // No milestones to update in this flow
        );

        savedStrategy = result.strategy;
      } else {
        // Create new strategy with business
        const businessData = {
          user_id: user.id,
          name: strategyData.business_name,
          business_type: (strategyData as any).business_type ?? null,
          stage: (strategyData as any).business_stage ?? null,
          description: strategyData.description ?? null,
          registration_number: strategyData.registration_number ?? null,
          registration_certificate_url: certificateUrl ?? null,
        } as BusinessInput;

        // Use the new method to create strategy with business
        const result = await strategyClient.saveStrategyWithBusinessAndMilestones(
          (strategyData as any),
          businessData,
          [] // No milestones to create in this flow
        );

        savedStrategy = result.strategy;
      }

      // Update local state
      setCurrentStrategy(savedStrategy);
      
      // Refresh strategies list
      const updatedStrategies = await strategyClient.getStrategies(user.id);
      setStrategies(updatedStrategies);

      if (showToast) {
        toast({
          title: `Strategy ${isUpdate ? 'updated' : 'saved'} successfully`,
          description: `Your business strategy has been ${isUpdate ? 'updated' : 'created'}.`,
        });
      }

      return savedStrategy;
    } catch (error: any) {
      console.error('Error saving strategy:', error);
      toast({
        title: `Failed to ${isUpdate ? 'update' : 'save'} strategy`,
        description: formatError(error),
        variant: 'destructive',
      });
      throw error;
    }
  }, [user, toast]);

  // Save strategy with business and milestones in a transaction
  const saveStrategyWithBusinessAndMilestones = useCallback(async (
    strategyData: Omit<Strategy, 'id' | 'created_at' | 'updated_at'> & { id?: string },
    businessData: Omit<Business, 'id' | 'created_at' | 'updated_at'> & { id?: string },
    milestonesData: Array<Omit<Milestone, 'id' | 'strategy_id' | 'created_at' | 'updated_at'>>,
    options: { showToast?: boolean } = {}
  ) => {
    const { showToast = true } = options;
    if (!user) return null;

    try {
      // Handle file upload if a new certificate file is provided
      let certificateUrl = (businessData as any).registration_certificate_url ?? undefined;

      if ((businessData as any).registration_certificate_file) {
        try {
          certificateUrl = await strategyClient.uploadBusinessCertificate(
            (businessData as any).registration_certificate_file,
            businessData.id || 'temp'
          );
        } catch (error) {
          console.error('Error uploading certificate:', error);
          throw new Error('Failed to upload business registration certificate');
        }
      }

      // Prepare business data
      const businessUpdate = {
        ...businessData,
        registration_certificate_url: certificateUrl ?? null,
        user_id: user.id
      } as BusinessInput & { id?: string };

      // Prepare strategy data (keep it permissive)
      const strategyUpdate = ({
        ...(strategyData as any),
        user_id: user.id,
        business_name: businessData.name,
      } as any);

      // Call the enhanced method
      const result = await strategyClient.saveStrategyWithBusinessAndMilestones(
        strategyUpdate,
        businessUpdate,
        milestonesData.map(milestone => ({
          ...milestone,
          business_id: (businessData as any).id || undefined,
          strategy_id: (milestone as any).strategy_id || (strategyData as any).id || undefined,
        })) as any
      );

      // Update local state
      setCurrentStrategy(result.strategy);
      setMilestones(result.milestones || []);
      
      // Refresh strategies list
      const updatedStrategies = await strategyClient.getStrategies(user.id);
      setStrategies(updatedStrategies);

      if (showToast) {
        toast({
          title: 'Strategy saved successfully',
          description: 'Your business strategy and milestones have been saved.',
        });
      }

      return result;
    } catch (error: any) {
      console.error('Error saving strategy with business and milestones:', error);
      if (showToast) {
        toast({
          title: 'Error',
          description: formatError(error) || 'Failed to save strategy',
          variant: 'destructive'
        });
      }
      throw error;
    }
  }, [user, toast]);

  // Legacy method for backward compatibility
  const saveStrategyWithMilestones = useCallback(async (
    strategyData: Omit<Strategy, 'id' | 'created_at' | 'updated_at'>,
    milestonesData: Array<Omit<Milestone, 'id' | 'strategy_id' | 'created_at' | 'updated_at'>>,
    options: { showToast?: boolean } = {}
  ) => {
    // For backward compatibility, create a minimal business object
    const businessData: BusinessInput = {
      user_id: strategyData.user_id || '',
      name: strategyData.business_name || 'My Business',
      business_type: 'general',
      stage: (strategyData as any).business_stage ?? 'idea',
      description: '',
      registration_number: '',
      registration_certificate_url: ''
    };

    // Ensure we pass a fully-populated business object (no undefined fields) matching the DB shape
    const businessDataFull = {
      ...businessData,
      business_type: businessData.business_type ?? null,
      stage: businessData.stage ?? null,
      description: businessData.description ?? null,
      registration_number: businessData.registration_number ?? null,
      registration_certificate_url: businessData.registration_certificate_url ?? null,
    } as Omit<Business, 'id' | 'created_at' | 'updated_at'> & { id?: string };

    return saveStrategyWithBusinessAndMilestones(
      strategyData,
      businessDataFull,
      milestonesData,
      options
    );
  }, [saveStrategyWithBusinessAndMilestones]);

  // Auto-save strategy with debouncing
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const autoSaveStrategy = useCallback(async (strategyData: Omit<Strategy, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
    if (!user) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      // Convert null to undefined for business_id to match the expected type
      const cleanedData = {
        ...strategyData,
        business_id: strategyData.business_id ?? undefined
      };
      saveStrategy(cleanedData as any, { showToast: false }); // Don't show toast for auto-save
    }, 1000); // 1 second debounce
  }, [user, saveStrategy]);

  // Load milestones for current strategy
  const loadMilestones = async (strategyId?: string) => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('milestones')
        .select('*')
        .eq('user_id', user.id);
      
      if (strategyId) {
        query = query.eq('strategy_id', strategyId);
      }
      
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      // Map DB rows into our Milestone type (ensuring required fields exist)
      const formattedMilestonesAny = (data || []).map((milestone: any) => {
        const obj: any = {};
        obj.id = milestone.id;
        obj.strategy_id = milestone.strategy_id ?? null;
        obj.business_stage = milestone.business_stage ?? null;
        obj.title = milestone.title;
        // DB milestone rows don't always include free-text 'description'; include if present
        obj.description = (milestone as any).description ?? null;
        obj.status = (milestone.status ?? null) as any;
        obj.target_date = milestone.target_date ?? null;
        obj.created_at = milestone.created_at;
        obj.updated_at = milestone.updated_at;
        obj.milestone_type = milestone.milestone_type ?? null;
        obj.completed_at = milestone.completed_at ?? null;
        obj.user_id = milestone.user_id ?? user?.id ?? '';
        return obj;
      });

      setMilestones(formattedMilestonesAny as Milestone[]);
    } catch (error) {
      console.error('Error loading milestones:', error);
    }
  };

  // Save milestone - simplified version
  const saveMilestone = async (milestone: Omit<Milestone, 'id' | 'created_at' | 'updated_at' | 'strategy_id' | 'business_id'> & {
    id?: string;
    strategy_id?: string;
  }) => {
    // Require authenticated user only; strategy may be provided via payload
    if (!user) return null;

    const milestoneData: any = {
      id: milestone.id,
      strategy_id: milestone.strategy_id || currentStrategy?.id || undefined,
      title: milestone.title,
      description: (milestone as any).description ?? null,
      status: milestone.status as any,
      target_date: milestone.target_date ?? null,
      milestone_type: (milestone.milestone_type as any) ?? null,
      completed_at: milestone.completed_at ?? null,
      user_id: user?.id ?? undefined,
    };

    if (!milestoneData.strategy_id && !currentStrategy?.id) {
      toast({
        title: 'Error',
        description: 'Please save your strategy first before adding milestones.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('milestones')
        .upsert(milestoneData as any, { onConflict: 'id' })
        .select()
        .single();
      
      if (error) throw error;

      setMilestones(prev =>
        milestone.id ? prev.map(m => (m.id === (data as any).id ? (data as any) : m)) : [(data as any), ...prev]
      );

      toast({
        title: milestone.id ? 'Milestone updated successfully' : 'Milestone added successfully',
        description: milestone.id
          ? 'Your milestone changes have been saved.'
          : 'Your new milestone has been added.',
      });

      return data;
    } catch (error) {
      console.error('Error saving milestone:', error);
      toast({
        title: 'Error',
        description: 'Failed to save milestone. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Create strategy from template
  const createFromTemplate = async (template: any) => {
    if (!user) return null;
    // TODO: Implement template creation logic here
    return null;
  };

  // Load strategies when user changes
  useEffect(() => {
    if (user) {
      loadStrategies();
    } else if (user === null) {
      // User is confirmed not logged in
      setStrategies([]);
      setCurrentStrategy(null);
      setMilestones([]);
      setLoading(false);
    }
    // If user is undefined, keep loading state
  }, [user]);

  // Maintain currentStrategy without auto-selecting to avoid cross-strategy leakage
  useEffect(() => {
    if (!loading) {
      // Clear selection if strategies list becomes empty
      if (strategies.length === 0 && currentStrategy != null) {
        setCurrentStrategy(null);
      }
    }
  }, [loading, strategies, currentStrategy]);

  // 2️⃣ Load milestones whenever currentStrategy changes
  useEffect(() => {
    if (currentStrategy?.id) {
      loadMilestones(currentStrategy.id);
    } else {
      setMilestones([]);
    }
  }, [currentStrategy?.id]);

  const clearStrategy = () => {
    setCurrentStrategy(null);
    setMilestones([]);
  };

  // Financial Records Management
  const getFinancialRecords = useCallback(async (strategyId: string): Promise<FinancialRecord[]> => {
    if (!strategyId) {
      throw new Error('No strategy ID provided');
    }
    return StrategyFinancialsService.getFinancialRecords(strategyId);
  }, []);

  const createFinancialRecord = useCallback(async (strategyId: string, record: Omit<FinancialRecord, 'id' | 'strategy_id' | 'created_at' | 'updated_at'>) => {
    if (!strategyId) {
      throw new Error('No strategy ID provided');
    }
    return StrategyFinancialsService.createFinancialRecord(strategyId, record);
  }, []);

  const updateFinancialRecord = useCallback(async (id: string, updates: Partial<Omit<FinancialRecord, 'id' | 'strategy_id' | 'created_at' | 'updated_at'>>) => {
    if (!id) {
      throw new Error('No record ID provided');
    }
    return StrategyFinancialsService.updateFinancialRecord(id, updates);
  }, []);

  const deleteFinancialRecord = useCallback(async (id: string) => {
    if (!id) {
      throw new Error('No record ID provided');
    }
    return StrategyFinancialsService.deleteFinancialRecord(id);
  }, []);

  // Milestone management
  const createMilestone = useCallback(async (milestoneData: Omit<Milestone, 'id' | 'created_at' | 'updated_at'>) => {
    if (!milestoneData.strategy_id) {
      throw new Error('Strategy ID is required to create a milestone');
    }

    try {
      const newMilestone = await strategyClient.createMilestone({
        ...milestoneData,
        strategy_id: currentStrategy?.id,
        user_id: user?.id,
      } as any);

      setMilestones(prev => [...prev, newMilestone]);
      return newMilestone;
    } catch (error: any) {
      console.error('Error creating milestone:', error);
      toast({
        title: 'Failed to create milestone',
        description: formatError(error),
        variant: 'destructive',
      });
      throw error;
    }
  }, [currentStrategy?.id, user?.id, toast]);

  const updateMilestone = useCallback(async (
    milestoneId: string, 
    updates: Partial<Omit<Milestone, 'id' | 'user_id' | 'strategy_id' | 'created_at'>>
  ) => {
    try {
      const updatedMilestone = await strategyClient.updateMilestone(milestoneId, updates);
      
      setMilestones(prev => 
        prev.map(m => m.id === milestoneId ? { ...m, ...updatedMilestone } : m)
      );
      
      return updatedMilestone;
    } catch (error: any) {
      console.error('Error updating milestone:', error);
      toast({
        title: 'Failed to update milestone',
        description: formatError(error),
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  const deleteMilestone = useCallback(async (milestoneId: string) => {
    try {
      await strategyClient.deleteMilestone(milestoneId);
      setMilestones(prev => prev.filter(m => m.id !== milestoneId));
      toast({
        title: 'Milestone deleted',
        description: 'The milestone has been removed.',
      });
    } catch (error: any) {
      console.error('Error deleting milestone:', error);
      toast({
        title: 'Failed to delete milestone',
        description: formatError(error),
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  // Delete a strategy
  const deleteStrategy = useCallback(async (strategyId: string) => {
    try {
      await strategyClient.deleteStrategy(strategyId);
      
      // Update local state
      if (currentStrategy?.id === strategyId) {
        setCurrentStrategy(null);
        setMilestones([]);
      }
      
      setStrategies(prev => prev.filter(s => s.id !== strategyId));
      
      toast({
        title: 'Strategy deleted',
        description: 'The strategy has been removed.',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error deleting strategy:', error);
      toast({
        title: 'Failed to delete strategy',
        description: formatError(error),
        variant: 'destructive',
      });
      throw error;
    }
  }, [currentStrategy?.id, toast]);

  // Load strategies on mount and when user changes
  // NOTE: depend only on `user` to avoid re-running when `loadStrategies` identity changes
  useEffect(() => {
    if (user) {
      // call the stable function directly
      loadStrategies();
    } else {
      setStrategies([]);
      setCurrentStrategy(null);
      setMilestones([]);
    }
    // Intentionally only depend on `user` to avoid infinite loops when callbacks change identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Get business by ID
  const getBusiness = useCallback(async (businessId: string): Promise<Business | null> => {
    try {
      return await strategyClient.getBusiness(businessId);
    } catch (error) {
      console.error('Error fetching business:', error);
      throw error;
    }
  }, []);

  // Get all businesses for the current user
  const getBusinesses = useCallback(async (): Promise<Business[]> => {
    if (!user) return [];
    
    try {
      return await strategyClient.getBusinessesByUser(user.id);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      throw error;
    }
  }, [user]);

  // Debug: surface what the hook is returning at runtime (one-time)
  useEffect(() => {
    try {
      const exportedKeys = [
        'loading', 'strategies', 'currentStrategy', 'milestones',
        'loadStrategies', 'loadStrategy', 'saveStrategy', 'saveMilestone', 'saveStrategyWithBusinessAndMilestones'
      ];
      console.debug('useStrategy debug - exports (keys):', exportedKeys);
      // show types of key functions
      console.debug('useStrategy debug - types:', {
        saveMilestone: typeof (saveMilestone as any),
        saveStrategyWithBusinessAndMilestones: typeof (saveStrategyWithBusinessAndMilestones as any)
      });
    } catch (e) {
      // swallow logging errors
    }
    // Intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upload business registration certificate
  const uploadBusinessCertificate = useCallback(async (file: File, businessId: string): Promise<string> => {
    try {
      return await strategyClient.uploadBusinessCertificate(file, businessId);
    } catch (error) {
      console.error('Error uploading business certificate:', error);
      throw error;
    }
  }, [user, toast]);

  return {
    loading,
    strategies,
    currentStrategy,
    setCurrentStrategy,
    milestones,
    loadingMilestones,
    loadStrategies,
    loadStrategy,
    saveStrategy,
    saveStrategyWithMilestones,
  autoSaveStrategy,
    saveMilestone,
    saveStrategyWithBusinessAndMilestones,
    createFromTemplate,
    clearStrategy,
    getFinancialRecords,
    createFinancialRecord,
    updateFinancialRecord,
    deleteFinancialRecord,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    loadMilestones,
    deleteStrategy,
    // helper functions
    getBusiness,
    getBusinesses,
    uploadBusinessCertificate,
  };
}
