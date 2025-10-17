import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, UserPlus, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { EnhancedAuthDialog } from '@/components/auth/EnhancedAuthDialog';
import { CurrencySelector } from '@/components/CurrencySelector';
import { useCurrencies } from '@/hooks/useCurrencies';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Plan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_cycle: string;
  prices?: Record<string, { price: number; currency: string }>;
  available_cycles?: string[];
  features: Record<string, any>;
  is_active: boolean;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showEnhancedAuth, setShowEnhancedAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [selectedCycles, setSelectedCycles] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { selectedCurrency, changeCurrency, currentCurrency } = useCurrencies();

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await apiClient.listPlans();
      const normalized = (Array.isArray(list) ? list : []).filter((p: any) => p.is_active);
      setPlans(normalized);
      
      // Initialize selected cycles for each plan
      const initialCycles: Record<string, string> = {};
      normalized.forEach((plan: Plan) => {
        if (plan.available_cycles && plan.available_cycles.length > 0) {
          initialCycles[plan.id] = plan.available_cycles[0];
        } else {
          initialCycles[plan.id] = plan.billing_cycle || 'monthly';
        }
      });
      setSelectedCycles(initialCycles);
    } catch (e: any) {
      const msg = e?.error?.message || 'Failed to load pricing plans. Please try again.';
      console.error('Error loading plans:', e);
      setError(msg);
      toast({ 
        title: 'Error', 
        description: msg, 
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleRetry = () => {
    fetchPlans();
  };

  const handleSubscribe = async (planId: string) => {
    // If user is not authenticated, show auth dialog
    if (!isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }

    try {
      setBusyPlan(planId);
      const selectedCycle = selectedCycles[planId];
      // Pass selected billing cycle to backend (will need to update edge function to accept this)
      const ret = await apiClient.initiatePaystack(planId, `${window.location.origin}/billing/return?cycle=${selectedCycle}`);
      if (ret?.authorization_url) {
        window.location.href = ret.authorization_url;
      } else {
        toast({ title: 'Payment Error', description: 'No authorization URL received', variant: 'destructive' });
      }
    } catch (e: any) {
      const msg = e?.error?.message || 'Failed to initiate payment';
      toast({ title: 'Payment Error', description: msg, variant: 'destructive' });
    } finally {
      setBusyPlan(null);
    }
  };

  const getDisplayPrice = (plan: Plan) => {
    const cycle = selectedCycles[plan.id] || plan.billing_cycle;
    const key = `${cycle}-${selectedCurrency}`;
    
    // Try to get price for selected cycle and currency
    if (plan.prices && plan.prices[key]) {
      return {
        price: plan.prices[key].price,
        currency: plan.prices[key].currency,
        cycle,
      };
    }
    
    // Fallback to cycle-only key
    if (plan.prices && plan.prices[cycle]) {
      return {
        price: plan.prices[cycle].price,
        currency: plan.prices[cycle].currency,
        cycle,
      };
    }
    
    // Final fallback to default plan price
    return {
      price: plan.price,
      currency: plan.currency,
      cycle: plan.billing_cycle,
    };
  };

  const navigateTo = (path: string) => {
    setShowAuthDialog(false);
    navigate(path);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button 
        variant="ghost" 
        onClick={() => navigateTo('/')} 
        className="mb-4 flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to Home
      </Button>
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Pricing</h1>
        <p className="text-muted-foreground mt-2">Development pricing is set to 1 KES for paid tiers.</p>
        
        <div className="mt-6 max-w-xs mx-auto">
          <CurrencySelector 
            value={selectedCurrency}
            onValueChange={changeCurrency}
            label="Select Currency"
          />
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
            <p className="font-medium">Couldn't load pricing</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 px-4 py-2 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900 rounded-md text-red-700 dark:text-red-300 transition-colors"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Retry'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading pricing plans...</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const displayPrice = getDisplayPrice(plan);
            const isFree = Number(displayPrice.price) === 0;
            const hasMultipleCycles = plan.available_cycles && plan.available_cycles.length > 1;
            const limits = plan.features?.limits || {};
            const features = plan.features?.features || {};
            
            return (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <div className="text-4xl font-bold">
                      {currentCurrency.symbol}{Number(displayPrice.price).toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span className="capitalize">{displayPrice.cycle}</span>
                      {displayPrice.currency !== selectedCurrency && (
                        <>
                          <span className="mx-1">•</span>
                          <span>{displayPrice.currency}</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="mb-6 text-sm leading-relaxed">
                    {plan.description}
                  </CardDescription>

                  {hasMultipleCycles && (
                    <div className="mb-6">
                      <label className="text-sm font-medium mb-2 block">Billing Cycle</label>
                      <div className="flex gap-2">
                        {(plan.available_cycles || []).map((cycle) => (
                          <Button
                            key={cycle}
                            variant={selectedCycles[plan.id] === cycle ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCycles(prev => ({ ...prev, [plan.id]: cycle }))}
                            className="flex-1 capitalize"
                          >
                            {cycle}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plan Limits */}
                  {Object.keys(limits).length > 0 && (
                    <div className="mb-6 p-3 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">Plan Limits</h4>
                      <ul className="space-y-1 text-sm">
                        {limits.businesses && (
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <span>{limits.businesses} {limits.businesses === 1 ? 'business' : 'businesses'}</span>
                          </li>
                        )}
                        {limits.storage_mb && (
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <span>{limits.storage_mb >= 1024 ? `${(limits.storage_mb / 1024).toFixed(0)} GB` : `${limits.storage_mb} MB`} storage</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Features List */}
                  {Object.keys(features).length > 0 && (
                    <div className="mb-6 flex-1">
                      <h4 className="font-semibold text-sm mb-3">Features</h4>
                      <ul className="space-y-2">
                        {features.dashboard && (
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>Dashboard access</span>
                          </li>
                        )}
                        {features.templates_all && (
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>All business templates</span>
                          </li>
                        )}
                        {features.transactions && (
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>Financial tracking</span>
                          </li>
                        )}
                        {features.ocr && (
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>OCR receipt scanning</span>
                          </li>
                        )}
                        {features.reports_basic && (
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>Basic reports</span>
                          </li>
                        )}
                        {features.reports_advanced && (
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>Advanced reports & analytics</span>
                          </li>
                        )}
                        {features.priority_support && (
                          <li className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>Priority support</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Subscribe Button */}
                  <div className="mt-auto">
                    {isFree ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button className="w-full" onClick={() => handleSubscribe(plan.id)} disabled={busyPlan === plan.id}>
                        {busyPlan === plan.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting...
                          </>
                        ) : (
                          <>Subscribe Now</>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Authentication Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sign In Required</DialogTitle>
            <DialogDescription>
              You need to be signed in to subscribe to a plan. Please sign in or create an account to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button 
              onClick={() => {
                setAuthTab('login');
                setShowAuthDialog(false);
                setShowEnhancedAuth(true);
              }} 
              className="w-full"
              variant="outline"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
            <Button 
              onClick={() => {
                setAuthTab('signup');
                setShowAuthDialog(false);
                setShowEnhancedAuth(true);
              }}
              className="w-full"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Create Account
            </Button>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => navigateTo('/')}
              className="text-muted-foreground"
            >
              Maybe later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Auth Dialog */}
      <EnhancedAuthDialog 
        open={showEnhancedAuth} 
        onOpenChange={(open) => {
          setShowEnhancedAuth(open);
          if (!open) {
            // Close both dialogs when the enhanced dialog is closed
            setShowAuthDialog(false);
          }
        }}
        defaultTab={authTab}
      />
    </div>
  );
}
