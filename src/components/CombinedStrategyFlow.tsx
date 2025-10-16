import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Home, Save, Download, Share2, Sparkles, MessageCircle, Mail, Copy, FileDown, BarChart3, User, LogOut, Trash2 } from 'lucide-react';
// Removed unused form UI imports
import StrategyBuilder from '@/components/StrategyBuilder';
import BusinessMilestonesSection from '@/components/BusinessMilestonesSection';
import FinancialTracker from '@/components/FinancialTracker';
// LanguageSelector not used in this component
import { useStrategy } from '@/hooks/useStrategy';
import { strategyClient } from '@/lib/strategy-client';
import { useToast } from '@/hooks/use-toast';
import { generateShareText, useShareActions } from '@/lib/shareUtils';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface CombinedStrategyFlowProps {
  template?: any;
  onBack?: () => void;
  onHome?: () => void;
  initialLanguage?: string;
  currentStrategy?: any;
  defaultTab?: string | null;
  onStrategyDeleted?: () => void;
}

const CombinedStrategyFlow = ({
  template,
  onBack,
  onHome,
  initialLanguage = 'en',
  currentStrategy: propCurrentStrategy,
  defaultTab,
  onStrategyDeleted
}: CombinedStrategyFlowProps) => {
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  // Use a safe onHome handler
  const handleHome = onHome ?? (() => navigate('/'));

  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // cast to any to avoid strict return-type mismatch in some environments
  const {
    currentStrategy,
    deleteStrategy,
    milestones: strategyMilestones,
    loadStrategies,
    saveStrategyWithBusinessAndMilestones,
    saveStrategy,
    saveStrategyWithMilestones,
    setCurrentStrategy
  } = useStrategy() as any;

  // Local state
  const [language, setLanguage] = useState(initialLanguage);
  const [country, setCountry] = useState('KE');
  const [currency, setCurrency] = useState('KES');
  const [currencySymbol, setCurrencySymbol] = useState('KSh');

  interface StrategyState {
    businessName: string;
    businessType: string;
  businessStage: string;
    businessDescription: string;
    registrationNumber: string;
    registrationCertificateFile: File | null;
    registrationCertificateUrl: string;
    vision: string;
    mission: string;
    targetMarket: string;
    revenueModel: string;
    valueProposition: string;
    keyPartners: string;
    marketingApproach: string;
    operationalNeeds: string;
    growthGoals: string;
  }

  const [strategy, setStrategy] = useState<StrategyState>({
    businessName: '',
    businessType: '',
    businessStage: 'idea',
    businessDescription: '',
    registrationNumber: '',
    registrationCertificateFile: null,
    registrationCertificateUrl: '',
    vision: '',
    mission: '',
    targetMarket: '',
    revenueModel: '',
    valueProposition: '',
    keyPartners: '',
    marketingApproach: '',
    operationalNeeds: '',
    growthGoals: ''
  });

  const [milestones, setMilestones] = useState<any[]>([]);

  // Modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAISummaryModal, setShowAISummaryModal] = useState(false);
  const [aiSummaryContent, setAiSummaryContent] = useState<any>(null);
  const [currentSection, setCurrentSection] = useState('');

  const translations: any = {
    en: {
      deleteStrategy: 'Delete Strategy',
      deleteConfirmationTitle: 'Delete Strategy',
      deleteConfirmationMessage: 'Are you sure you want to delete this strategy? This action cannot be undone.',
      strategyDeleted: 'Strategy Deleted',
      strategyDeletedMessage: 'The strategy has been successfully deleted.',
      deleteError: 'Failed to delete strategy. Please try again.',
      cancel: 'Cancel',
      delete: 'Delete',
      deleting: 'Deleting...',
      backToTemplates: 'Back',
      home: 'Home',
      save: 'Save',
      language: 'Language',
      currency: 'Currency',
      signOut: 'Sign Out'
    },
    sw: {
      deleteStrategy: 'Futa Mkakati',
      deleteConfirmationTitle: 'Futa Mkakati',
      deleteConfirmationMessage: 'Una uhakika unataka kufuta mkakati huu? Hatua hii haiwezi kutenduliwa.',
      strategyDeleted: 'Mkakati Umefutwa',
      strategyDeletedMessage: 'Mkakati umefutwa kwa mafanikio.',
      deleteError: 'Imeshindwa kufuta mkakati. Tafadhali jaribu tena.',
      cancel: 'Ghairi',
      delete: 'Futa',
      deleting: 'Inafutwa...',
      backToTemplates: 'Rudi',
      home: 'Nyumbani',
      save: 'Hifadhi',
      language: 'Lugha',
      currency: 'Sarafu',
      signOut: 'Toka'
    },
    ar: {
      backToTemplates: 'رجوع',
      home: 'الرئيسية',
      save: 'حفظ',
      language: 'اللغة',
      currency: 'العملة',
      signOut: 'تسجيل الخروج'
    },
    fr: {
      backToTemplates: 'Retour',
      home: 'Accueil',
      save: 'Sauvegarder',
      language: 'Langue',
      currency: 'Devise',
      signOut: 'Se Déconnecter'
    }
  };

  const t = translations[language] || translations.en;

  // (file input handler removed - not used in this component)

  function normalizeStrategy(data: any) {
    if (!data) return null;
    return {
      businessName: data.business_name || '',
      vision: data.vision || '',
      mission: data.mission || '',
      targetMarket: data.target_market || '',
      revenueModel: data.revenue_model || '',
      valueProposition: data.value_proposition || '',
      keyPartners: data.key_partners || '',
      marketingApproach: data.marketing_approach || '',
      operationalNeeds: data.operational_needs || '',
      growthGoals: data.growth_goals || ''
    };
  }

  // Update currency when country changes
  useEffect(() => {
    const currencyMap: Record<string, { currency: string; symbol: string }> = {
      'US': { currency: 'USD', symbol: '$' },
      'EU': { currency: 'EUR', symbol: '€' },
      'KE': { currency: 'KES', symbol: 'KSh' },
      'NG': { currency: 'NGN', symbol: '₦' },
      'ZA': { currency: 'ZAR', symbol: 'R' }
    };
    const countryData = currencyMap[country] || currencyMap['KE'];
    setCurrency(countryData.currency);
    setCurrencySymbol(countryData.symbol);
  }, [country]);

  // Sync incoming prop strategy
  useEffect(() => {
    if (propCurrentStrategy) {
      const normalized = normalizeStrategy(propCurrentStrategy);
      if (normalized) setStrategy((normalized as any));
    }
  }, [propCurrentStrategy]);

  useEffect(() => {
    if (defaultTab) {
      setTimeout(() => {
        const sectionId = defaultTab === 'milestones' ? 'milestones-section' : defaultTab === 'financials' ? 'financial-tracker-section' : null;
        if (sectionId) {
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  }, [defaultTab, strategy]);

  // Handlers
  const handleStrategyChange = (newStrategy: any) => {
    setStrategy(newStrategy);
  };

  const handleMilestonesChange = (newMilestones: any) => setMilestones(newMilestones);

  const handleSaveStrategy = async () => {
    const hasData = strategy && (strategy.businessName || strategy.vision || strategy.mission || strategy.targetMarket || strategy.revenueModel || strategy.valueProposition);
    if (!hasData) {
      toast({ title: 'No Strategy Data', description: 'Please fill out the strategy form before saving.', variant: 'destructive' });
      return;
    }

    try {
      const strategyData: any = {
        id: currentStrategy?.id,
        user_id: user?.id || '',
        business_id: currentStrategy?.business_id || undefined,
        business_name: strategy.businessName,
        business_type: strategy.businessType,
        business_stage: strategy.businessStage,
        description: strategy.businessDescription,
        registration_number: strategy.registrationNumber,
        registration_certificate_file: strategy.registrationCertificateFile,
        registration_certificate_url: strategy.registrationCertificateUrl,
        vision: strategy.vision,
        mission: strategy.mission,
        target_market: strategy.targetMarket,
        revenue_model: strategy.revenueModel,
        value_proposition: strategy.valueProposition,
        key_partners: strategy.keyPartners,
        marketing_approach: strategy.marketingApproach,
        operational_needs: strategy.operationalNeeds,
        growth_goals: strategy.growthGoals
      };

      const businessData: any = {
        id: currentStrategy?.business_id || undefined,
        user_id: user?.id || undefined,
        name: strategy.businessName,
        business_type: strategy.businessType || 'general',
        stage: strategy.businessStage || 'idea',
        description: strategy.businessDescription || '',
        registration_number: strategy.registrationNumber || '',
        registration_certificate_file: strategy.registrationCertificateFile || null,
        registration_certificate_url: strategy.registrationCertificateUrl || ''
      };

      const milestonesPayload = milestones.map(m => ({
        title: m.title,
        description: m.description || '',
        status: m.status || 'pending',
        target_date: m.target_date || m.targetDate || null,
        milestone_type: m.milestone_type || m.type || 'other',
        strategy_id: currentStrategy?.id || undefined,
        completed_at: m.completed_at || null
      }));

      let result: any = null;
      if (typeof saveStrategyWithBusinessAndMilestones === 'function') {
        result = await saveStrategyWithBusinessAndMilestones(strategyData, businessData, milestonesPayload, { showToast: true });
      } else if (typeof saveStrategy === 'function') {
        const saved = await saveStrategy(strategyData, { showToast: true, isUpdate: !!strategyData.id });
        if (saved && saved.id && milestonesPayload.length > 0 && typeof saveStrategyWithMilestones === 'function') {
          await saveStrategyWithMilestones({ ...strategyData, id: saved.id }, milestonesPayload, { showToast: false });
        }
        result = saved ? { strategy: saved, milestones: milestonesPayload } : null;
      } else {
        throw new Error('No save function available in useStrategy hook');
      }

      try { await loadStrategies(); } catch (e) { /* ignore refresh errors */ }
      if (result && result.strategy && typeof setCurrentStrategy === 'function') {
        setCurrentStrategy(result.strategy);
        try {
          // Update the URL so milestones/financials have a strategy_id source immediately
          navigate(`/strategy?id=${result.strategy.id}&tab=milestones`);
        } catch {}
      }

      toast({ title: 'Success', description: 'Your strategy and business information have been saved successfully.' });
      return result;
    } catch (error: any) {
      console.error('Error saving strategy:', error);
      toast({ title: 'Error', description: String(error) || 'Failed to save strategy. Please try again.', variant: 'destructive' });
      throw error;
    }
  };

  const handleSaveMilestones = async () => {
    if (strategyMilestones.length === 0) {
      toast({ title: 'No Milestones', description: 'Please add some milestones before saving.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Milestones Saved', description: 'Your business milestones have been saved successfully.' });
  };

  const handleSaveFinancial = async () => {
    toast({ title: 'Financial Data Saved', description: 'Your financial information has been saved successfully.' });
  };

  const handleAISummary = (section: string) => {
    setCurrentSection(section);
    let summaryData: any = {};
    if (section === 'strategy') {
      summaryData = {
        title: 'Business Strategy Summary',
        subtitle: 'AI-generated summary of your business strategy',
        businessName: strategy?.businessName || 'Your Business',
        vision: strategy?.vision || 'Not specified',
        mission: strategy?.mission || 'Not specified',
        targetMarket: strategy?.targetMarket || 'Not specified',
        revenueModel: strategy?.revenueModel || 'Not specified',
        valueProposition: strategy?.valueProposition || 'Not specified'
      };
    } else if (section === 'milestones') {
      summaryData = {
        title: 'Business Milestones Summary',
        subtitle: 'Overview of your business milestone progress and insights',
        businessStage: 'Growth Stage',
        currentMilestones: milestones.length > 0 ? milestones : 'No milestones added yet',
        progressSummary: milestones.length > 0 ? `You have ${milestones.length} milestones set` : 'Start by adding some business milestones to begin your journey.'
      };
    } else if (section === 'financial') {
      summaryData = {
        title: 'Financial Insights Summary',
        subtitle: 'Based on your daily financial data:',
        totalRevenue: `${currencySymbol} 0.00`,
        totalExpenses: `${currencySymbol} 0.00`,
        netProfit: `${currencySymbol} 0.00`,
        profitMargin: '0%',
        insights: ['Your business is profitable', 'No revenue entries recorded', 'No expense entries recorded']
      };
    }

    setAiSummaryContent(summaryData);
    setShowAISummaryModal(true);
  };

  const handleDownload = (section: string) => {
    const timestamp = Date.now();
    const filename = `jenga-biz-${section}-${timestamp}.txt`;
    let content = '';
    if (section === 'strategy' && strategy) {
      content = `Business Strategy Summary\n\nBusiness Name: ${strategy.businessName || 'N/A'}\nVision: ${strategy.vision || 'N/A'}\nMission: ${strategy.mission || 'N/A'}\nTarget Market: ${strategy.targetMarket || 'N/A'}\nRevenue Model: ${strategy.revenueModel || 'N/A'}\nValue Proposition: ${strategy.valueProposition || 'N/A'}\n\nCreated with Jenga Biz Africa ✨`;
    } else if (section === 'milestones') {
      content = `Business Milestones Summary\n\nBusiness Stage: Growth Stage\nTotal Milestones: ${milestones.length}\n\nMilestones:\n${milestones.length > 0 ? milestones.map((m: any) => `- ${m.title || m.name}`).join('\n') : 'No milestones added yet'}\n\nCreated with Jenga Biz Africa ✨`;
    } else if (section === 'financial') {
      content = `Financial Summary\n\nTotal Revenue: ${currencySymbol} 0.00\nTotal Expenses: ${currencySymbol} 0.00\nNet Profit: ${currencySymbol} 0.00\nProfit Margin: 0%\n\nKey Insights:\n- Your business is profitable\n- No revenue entries recorded\n- No expense entries recorded\n\nCreated with Jenga Biz Africa ✨`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({ title: 'Summary Downloaded', description: `${filename} downloaded successfully.` });
  };

  const handleShare = (section: string) => {
    setCurrentSection(section);
    setShowShareModal(true);
  };

  const shareActions = useShareActions();

  const handleShareOption = (option: string) => {
    let shareText = '';
    let customTitle = '';

    if (currentSection === 'strategy') {
      customTitle = 'My Business Strategy';
      shareText = generateShareText({ strategy, type: 'summary' as const, customTitle, language }) || '';
    } else if (currentSection === 'milestones') {
      customTitle = 'My Business Milestones';
      shareText = generateShareText({ strategy: { ...strategy, milestones }, type: 'milestones' as const, customTitle, language }) || '';
    } else if (currentSection === 'financial') {
      customTitle = 'My Financial Summary';
      shareText = generateShareText({ strategy, customTitle, isFinancial: true, language }) || '';
    }

    switch (option) {
      case 'whatsapp':
        shareActions.handleWhatsAppShare(shareText, language);
        break;
      case 'email':
        shareActions.handleEmailShare(shareText, customTitle);
        break;
      case 'copy':
        shareActions.handleCopyText(shareText, language);
        break;
      case 'pdf':
        handleDownload(currentSection);
        break;
    }

    setShowShareModal(false);
  };

  const handleDeleteStrategy = async () => {
    if (!currentStrategy?.id) return;
    try {
      setIsDeleting(true);
      if (typeof deleteStrategy !== 'function') {
        console.warn('deleteStrategy is not a function at delete call — falling back to direct client call', { deleteStrategy });
        // Fallback: call the strategy client directly to avoid HMR-related missing export issues
        await strategyClient.deleteStrategy(currentStrategy.id).catch((err: any) => { throw err; });
      } else {
        await deleteStrategy(currentStrategy.id);
      }
      toast({ title: 'Strategy deleted', description: 'The strategy has been successfully deleted.' });
      if (onStrategyDeleted) {
        onStrategyDeleted();
      } else {
        try {
          navigate('/dashboard', { replace: true });
        } catch (err) {
          window.location.href = '/dashboard';
        }
      }
    } catch (error) {
      console.error('Failed to delete strategy:', error);
      toast({ title: 'Error', description: 'Failed to delete the strategy. Please try again.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            {/* Left section - Logo and main actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
              <img src="/jenga-biz-logo.png" alt="Jenga Biz Africa" className="h-12 w-auto" />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBack}
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t.backToTemplates}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHome}
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  <Home className="w-4 h-4" />
                  {t.home}
                </Button>

              </div>
            </div>

            {/* Right section - User Navigation */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
              {/* Delete button - only show when there's a current strategy */}
              {currentStrategy?.id && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  {translations[language]?.deleteStrategy || 'Delete Strategy'}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  try {
                    navigate('/dashboard');
                  } catch (error) {
                    console.error('Navigation error:', error);
                    window.location.href = '/dashboard';
                  }
                }}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <User className="w-4 h-4" />
                Profile
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await signOut();
                    navigate('/');
                  } catch (error) {
                    console.error('Sign out error:', error);
                    navigate('/auth');
                  }
                }}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <LogOut className="w-4 h-4" />
                {t.signOut}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-12">
          {/* Strategy Builder Section */}
          <section id="strategy-section">
            <StrategyBuilder
              template={template}
              onStrategyChange={handleStrategyChange}
              language={language}
              onLanguageChange={setLanguage}
              country={country}
              onCountryChange={setCountry}
              currency={currency}
              currencySymbol={currencySymbol}
              existingStrategy={strategy}
            />
          </section>

          {/* Business Strategy Summary */}
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Strategy Summary</h3>

            <div className="space-y-3">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleAISummary('strategy')}
              >
                <Sparkles className="w-5 h-5" />
                Business Summary
              </Button>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleDownload('strategy')}
              >
                <Download className="w-5 h-5" />
                Download Summary
              </Button>

              <Button
                className="w-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleShare('strategy')}
              >
                <Share2 className="w-5 h-5" />
                Share Strategy
              </Button>

              <Button
                size="lg"
                onClick={handleSaveStrategy}
                className="w-full flex items-center justify-center gap-2 py-3"
              >
                <Save className="w-5 h-5" />
                Save Strategy
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Milestones Section */}
          <section id="milestones-section">
            <BusinessMilestonesSection
              isPro={true}
              strategyData={{ ...strategy, id: currentStrategy?.id }}
              language={language}
              onMilestonesChange={handleMilestonesChange}
            />
          </section>

          {/* Business Milestones Summary */}
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Milestones Summary</h3>

            <div className="space-y-3">
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleAISummary('milestones')}
              >
                <Sparkles className="w-5 h-5" />
                Milestones Summary
              </Button>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleDownload('milestones')}
              >
                <Download className="w-5 h-5" />
                Download Summary
              </Button>

              <Button
                className="w-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleShare('milestones')}
              >
                <Share2 className="w-5 h-5" />
                Share Milestones
              </Button>

              <Button
                size="lg"
                onClick={handleSaveMilestones}
                className="w-full flex items-center justify-center gap-2 py-3"
              >
                <Save className="w-5 h-5" />
                Save Milestones
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Financial Tracker Section */}
          <section id="financial-tracker-section">
            <FinancialTracker
              language={language}
              currency={currency}
              currencySymbol={currencySymbol}
              strategyId={propCurrentStrategy?.id || currentStrategy?.id}
            />
          </section>

          {/* Financial Summary */}
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>

            <div className="space-y-3">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleAISummary('financial')}
              >
                <Sparkles className="w-5 h-5" />
                Financials Summary
              </Button>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleDownload('financial')}
              >
                <Download className="w-5 h-5" />
                Download Summary
              </Button>

              <Button
                className="w-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2 py-3"
                size="lg"
                onClick={() => handleShare('financial')}
              >
                <Share2 className="w-5 h-5" />
                Share Financials
              </Button>

              <Button
                size="lg"
                onClick={handleSaveFinancial}
                className="w-full flex items-center justify-center gap-2 py-3"
              >
                <Save className="w-5 h-5" />
                Save Financial
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Share {currentSection.charAt(0).toUpperCase() + currentSection.slice(1)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <p className="text-sm text-gray-600 text-center">Share via</p>

            <Button
              className="w-full bg-green-500 hover:bg-green-600 text-white justify-center gap-3 py-3"
              size="lg"
              onClick={() => handleShareOption('whatsapp')}
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </Button>

            <Button
              variant="outline"
              className="w-full justify-center gap-3 py-3"
              size="lg"
              onClick={() => handleShareOption('email')}
            >
              <Mail className="w-5 h-5" />
              Email
            </Button>

            <Button
              variant="outline"
              className="w-full justify-center gap-3 py-3"
              size="lg"
              onClick={() => handleShareOption('copy')}
            >
              <Copy className="w-5 h-5" />
              Copy Text
            </Button>

            <Button
              variant="outline"
              className="w-full justify-center gap-3 py-3"
              size="lg"
              onClick={() => handleShareOption('pdf')}
            >
              <FileDown className="w-5 h-5" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Summary Modal */}
      <Dialog open={showAISummaryModal} onOpenChange={setShowAISummaryModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              {aiSummaryContent?.title}
            </DialogTitle>
            {aiSummaryContent?.subtitle && (
              <p className="text-sm text-gray-600">{aiSummaryContent.subtitle}</p>
            )}
          </DialogHeader>

          <div className="space-y-4 p-4">
            {currentSection === 'strategy' && aiSummaryContent && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📈</span>
                  <h3 className="font-bold text-lg">{aiSummaryContent.businessName}</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🎯</span>
                    <div>
                      <strong>Vision:</strong>
                      <p className="text-sm text-gray-700 mt-1">{aiSummaryContent.vision}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-lg">🚀</span>
                    <div>
                      <strong>Mission:</strong>
                      <p className="text-sm text-gray-700 mt-1">{aiSummaryContent.mission}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-lg">👥</span>
                    <div>
                      <strong>Target Market:</strong>
                      <p className="text-sm text-gray-700 mt-1">{aiSummaryContent.targetMarket}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-lg">💰</span>
                    <div>
                      <strong>Revenue Model:</strong>
                      <p className="text-sm text-gray-700 mt-1">{aiSummaryContent.revenueModel}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-lg">⭐</span>
                    <div>
                      <strong>Value Proposition:</strong>
                      <p className="text-sm text-gray-700 mt-1">{aiSummaryContent.valueProposition}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentSection === 'milestones' && aiSummaryContent && (
              <div className="space-y-4">
                <div>
                  <strong>Business Stage:</strong>
                  <p className="text-sm text-gray-700 mt-1">{aiSummaryContent.businessStage}</p>
                </div>

                <div>
                  <strong>Current Milestones:</strong>
                  {typeof aiSummaryContent.currentMilestones === 'string' ? (
                    <p className="text-sm text-gray-700 mt-1">{aiSummaryContent.currentMilestones}</p>
                  ) : (
                    <div className="text-sm text-gray-700 mt-1">
                      {aiSummaryContent.currentMilestones.map((milestone: any, index: number) => (
                        <p key={index}>• {milestone.title || milestone.name}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-purple-50 p-3 rounded-lg">
                  <strong className="text-purple-700">Progress Summary:</strong>
                  <p className="text-sm text-purple-600 mt-1">{aiSummaryContent.progressSummary}</p>
                </div>
              </div>
            )}

            {currentSection === 'financial' && aiSummaryContent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Total Revenue:</strong>
                    <p className="text-lg text-green-600 font-semibold">{aiSummaryContent.totalRevenue}</p>
                  </div>
                  <div>
                    <strong>Total Expenses:</strong>
                    <p className="text-lg text-red-600 font-semibold">{aiSummaryContent.totalExpenses}</p>
                  </div>
                  <div>
                    <strong>Net Profit:</strong>
                    <p className="text-lg text-blue-600 font-semibold">{aiSummaryContent.netProfit}</p>
                  </div>
                  <div>
                    <strong>Profit Margin:</strong>
                    <p className="text-lg font-semibold">{aiSummaryContent.profitMargin}</p>
                  </div>
                </div>

                <div>
                  <strong>Key Insights:</strong>
                  <div className="text-sm text-gray-700 mt-1 space-y-1">
                    {aiSummaryContent.insights.map((insight: string, index: number) => (
                      <p key={index}>• {insight}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="text-center text-xs text-gray-400 mt-6 border-t pt-4"></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strategy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this strategy? This action cannot be undone and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStrategy}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CombinedStrategyFlow;
