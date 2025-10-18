import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { SubscriptionPlanForm } from './SubscriptionPlansForm';

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  tier?: string;
  trial_period_days?: number;
  price: number;
  currency: string;
  billing_cycle: string;
  prices: Record<string, { price: number; currency: string }>;
  available_cycles: string[];
  features: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PriceConfig {
  monthly?: { price: number; currency: string };
  quarterly?: { price: number; currency: string };
  yearly?: { price: number; currency: string };
}

export function SubscriptionPlansManager() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tier: 'free',
    trial_period_days: 0,
    price: 0,
    currency: 'KES',
    billing_cycle: 'monthly',
    is_active: true,
    limits: {
      businesses: 1,
      strategies: 1,
      milestones: {
        total: 20,
        stages: ['concept', 'early_stage'],
      },
      financial_tracking: {
        receipts_per_month: 0,
        ocr_enabled: false,
      },
      ai_summary: {
        type: 'none',
        count: '0',
      },
      share_download: {
        whatsapp: 'unlimited',
        email: 'unlimited',
        downloads_per_month: 0,
        formats: [] as string[],
      },
    },
    feature_descriptions: {
      business_strategy: '',
      milestones: '',
      financial_tracking: '',
      ai_summary: '',
      share_download: '',
    },
  });

  // New pricing state for multiple billing cycles
  const [priceConfig, setPriceConfig] = useState<PriceConfig>({
    monthly: { price: 0, currency: 'KES' },
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
  const data = await apiClient.listPlans();
  setPlans(Array.isArray(data) ? (data as SubscriptionPlan[]) : []);
    } catch (error: any) {
      console.error('Failed to load plans:', error);
      toast({
        title: 'Error',
        description: error?.error?.message || 'Failed to load subscription plans',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      tier: 'free',
      trial_period_days: 0,
      price: 0,
      currency: 'KES',
      billing_cycle: 'monthly',
      is_active: true,
      limits: {
        businesses: 1,
        strategies: 1,
        milestones: {
          total: 20,
          stages: ['concept', 'early_stage'],
        },
        financial_tracking: {
          receipts_per_month: 0,
          ocr_enabled: false,
        },
        ai_summary: {
          type: 'none',
          count: '0',
        },
        share_download: {
          whatsapp: 'unlimited',
          email: 'unlimited',
          downloads_per_month: 0,
          formats: [] as string[],
        },
      },
      feature_descriptions: {
        business_strategy: '',
        milestones: '',
        financial_tracking: '',
        ai_summary: '',
        share_download: '',
      },
    });
    setPriceConfig({
      monthly: { price: 0, currency: 'KES' },
    });
  };

  const handleCreate = async () => {
    try {
      const available_cycles = Object.keys(priceConfig) as string[];
      const payload = {
        ...formData,
        features: {
          limits: formData.limits,
          features: formData.feature_descriptions,
        },
        prices: priceConfig,
        available_cycles,
      };
      await apiClient.createPlan(payload as any);
      toast({
        title: 'Success',
        description: 'Subscription plan created successfully',
      });
      setIsCreateDialogOpen(false);
      resetForm();
      loadPlans();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.error?.message || 'Failed to create subscription plan',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = async () => {
    if (!editingPlan) return;
    
    try {
      const available_cycles = Object.keys(priceConfig) as string[];
      const payload = {
        ...formData,
        features: {
          limits: formData.limits,
          features: formData.feature_descriptions,
        },
        prices: priceConfig,
        available_cycles,
      };
      await apiClient.updatePlan(editingPlan.id, payload as any);
      toast({
        title: 'Success',
        description: 'Subscription plan updated successfully',
      });
      setIsEditDialogOpen(false);
      setEditingPlan(null);
      resetForm();
      loadPlans();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.error?.message || 'Failed to update subscription plan',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (planId: string) => {
    try {
      await apiClient.deletePlan(planId);
      toast({
        title: 'Success',
        description: 'Subscription plan deactivated successfully',
      });
      loadPlans();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.error?.message || 'Failed to deactivate subscription plan',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    
    const features = plan.features || {};
    const limits = features.limits || {};
    const descriptions = features.features || {};
    
    setFormData({
      name: plan.name,
      description: plan.description || '',
      tier: plan.tier || features.tier || 'free',
      trial_period_days: plan.trial_period_days || 0,
      price: plan.price,
      currency: plan.currency,
      billing_cycle: plan.billing_cycle,
      is_active: plan.is_active,
      limits: {
        businesses: limits.businesses || 1,
        strategies: limits.strategies || 1,
        milestones: {
          total: limits.milestones?.total || 20,
          stages: limits.milestones?.stages || ['concept', 'early_stage'],
        },
        financial_tracking: {
          receipts_per_month: limits.financial_tracking?.receipts_per_month || 0,
          ocr_enabled: limits.financial_tracking?.ocr_enabled || false,
        },
        ai_summary: {
          type: limits.ai_summary?.type || 'none',
          count: limits.ai_summary?.count || '0',
        },
        share_download: {
          whatsapp: limits.share_download?.whatsapp || 'unlimited',
          email: limits.share_download?.email || 'unlimited',
          downloads_per_month: limits.share_download?.downloads_per_month || 0,
          formats: limits.share_download?.formats || [],
        },
      },
      feature_descriptions: {
        business_strategy: descriptions.business_strategy || '',
        milestones: descriptions.milestones || '',
        financial_tracking: descriptions.financial_tracking || '',
        ai_summary: descriptions.ai_summary || '',
        share_download: descriptions.share_download || '',
      },
    });
    
    // Load existing prices or fallback to single price
    if (plan.prices && Object.keys(plan.prices).length > 0) {
      setPriceConfig(plan.prices as PriceConfig);
    } else {
      setPriceConfig({
        [plan.billing_cycle]: { price: plan.price, currency: plan.currency },
      } as PriceConfig);
    }
    setIsEditDialogOpen(true);
  };

  const updatePriceConfig = (cycle: 'monthly' | 'quarterly' | 'yearly', field: 'price' | 'currency', value: any) => {
    setPriceConfig(prev => ({
      ...prev,
      [cycle]: {
        ...prev[cycle],
        [field]: field === 'price' ? parseFloat(value) || 0 : value,
      } as { price: number; currency: string },
    }));
  };

  const toggleBillingCycle = (cycle: 'monthly' | 'quarterly' | 'yearly') => {
    setPriceConfig(prev => {
      const newConfig = { ...prev };
      if (newConfig[cycle]) {
        delete newConfig[cycle];
      } else {
        newConfig[cycle] = { price: 0, currency: 'KES' };
      }
      return newConfig;
    });
  };

  const formatPrice = (price: number, currency: string) => {
    return `${currency} ${price.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="mt-[120px] lg:mt-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading subscription plans...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-[120px] lg:mt-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Subscription Plans</h2>
          <p className="text-muted-foreground">Manage subscription plans and pricing</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Create Subscription Plan</DialogTitle>
              <DialogDescription>
                Configure plan limits, features, and pricing
              </DialogDescription>
            </DialogHeader>
            
            <SubscriptionPlanForm formData={formData} setFormData={setFormData} />
            
            {/* Pricing Section */}
            <div className="space-y-3 mt-4 border-t pt-4">
              <Label>Billing Cycles & Pricing</Label>
              
              {(['monthly', 'quarterly', 'yearly'] as const).map((cycle) => (
                <div key={cycle} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={!!priceConfig[cycle]}
                        onCheckedChange={() => toggleBillingCycle(cycle)}
                      />
                      <Label className="capitalize">{cycle}</Label>
                    </div>
                  </div>
                  {priceConfig[cycle] && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={priceConfig[cycle]?.price || 0}
                          onChange={(e) => updatePriceConfig(cycle, 'price', e.target.value)}
                        />
                      </div>
                      <div>
                        <Select 
                          value={priceConfig[cycle]?.currency || 'KES'} 
                          onValueChange={(value) => updatePriceConfig(cycle, 'currency', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KES">KES</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Plan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {plan.name}
                    <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(plan)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Plan</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to deactivate this plan? This will prevent new subscriptions but won't affect existing users.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(plan.id)}>
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {plan.prices && Object.keys(plan.prices).length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(plan.prices).map(([cycle, priceData]: [string, any]) => (
                      <Badge key={cycle} variant="outline" className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatPrice(priceData.price, priceData.currency)} / {cycle}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    {formatPrice(plan.price, plan.currency)} / {plan.billing_cycle}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Created {new Date(plan.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Subscription Plan</DialogTitle>
            <DialogDescription>
              Update plan limits, features, and pricing
            </DialogDescription>
          </DialogHeader>
          
          <SubscriptionPlanForm formData={formData} setFormData={setFormData} />
          
          {/* Pricing Section */}
          <div className="space-y-3 mt-4 border-t pt-4">
            <Label>Billing Cycles & Pricing</Label>
            
            {(['monthly', 'quarterly', 'yearly'] as const).map((cycle) => (
              <div key={cycle} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={!!priceConfig[cycle]}
                      onCheckedChange={() => toggleBillingCycle(cycle)}
                    />
                    <Label className="capitalize">{cycle}</Label>
                  </div>
                </div>
                {priceConfig[cycle] && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={priceConfig[cycle]?.price || 0}
                        onChange={(e) => updatePriceConfig(cycle, 'price', e.target.value)}
                      />
                    </div>
                    <div>
                      <Select 
                        value={priceConfig[cycle]?.currency || 'KES'} 
                        onValueChange={(value) => updatePriceConfig(cycle, 'currency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KES">KES</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Update Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
