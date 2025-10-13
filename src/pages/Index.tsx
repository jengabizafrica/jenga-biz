import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Zap, LogOut, User, ChartBar as BarChart3, LogIn, ShieldCheck } from 'lucide-react';
import { useRoles } from '@/hooks/useRoles';
import { useAuth } from '@/hooks/useAuth';
import { useStrategy } from '@/hooks/useStrategy';
import LanguageSelector from '@/components/LanguageSelector';
import { EnhancedAuthDialog } from '@/components/auth/EnhancedAuthDialog';
import { ApprovalStatusBanner } from '@/components/ApprovalStatusBanner';

const RoleAwareSaaSButton = () => {
  const { roles, loading } = useRoles();
  const navigate = useNavigate();
  
  if (loading) return null;
  
  const canSee = roles.includes('super_admin') || roles.includes('admin') || roles.includes('hub_manager');
  if (!canSee) return null;
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate('/saas')}
      className="flex items-center gap-2 text-xs sm:text-sm"
    >
      <BarChart3 className="w-4 h-4" />
      SaaS
    </Button>
  );
};

const RoleAwareSuperAdminButton = () => {
  const { roles, loading } = useRoles();
  const navigate = useNavigate();
  
  if (loading) return null;
  if (!roles.includes('super_admin')) return null;
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate('/super-admin')}
      className="flex items-center gap-2 text-xs sm:text-sm"
    >
      <ShieldCheck className="w-4 h-4" />
      Super Admin
    </Button>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { setCurrentStrategy } = useStrategy();
  const [language, setLanguage] = useState('en');
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const translations = {
    en: {
      title: 'Jenga Biz Africa',
      subtitle: 'Build Your Business Strategy for the African Market',
      signOut: 'Sign Out',
      signIn: 'Sign In',
      features: {
        templates: {
          title: 'Business Templates',
          description: 'Choose from 15+ pre-built templates specifically designed for popular African businesses and market needs',
          buttonText: 'Use Templates'
        },
        strategy: {
          title: 'Custom Strategy', 
          description: 'Build a completely custom business strategy from scratch with all features included - perfect for unique business models',
          buttonText: 'Start from Scratch'
        },
        milestones: {
          title: 'Milestone Tracking',
          description: 'Set and track business milestones based on your current stage and growth goals with deadlines',
          buttonText: 'Track Milestones'
        },
        financial: {
          title: 'Financial Tracking',
          description: 'Monitor daily revenue and expenses with calendar-based entries and generate financial reports',
          buttonText: 'Track Finances'
        }
      }
    },
    sw: {
      title: 'Jenga Biz Africa',
      subtitle: 'Jenga Mkakati wa Biashara Yako kwa Soko la Afrika',
      signOut: 'Toka',
      signIn: 'Ingia',
      features: {
        templates: {
          title: 'Violezo vya Biashara',
          description: 'Chagua kutoka violezo 15+ vilivyotengenezwa maalum kwa biashara maarufu za Afrika na mahitaji ya soko',
          buttonText: 'Tumia Violezo'
        },
        strategy: {
          title: 'Mkakati wa Kawaida',
          description: 'Jenga mkakati wa biashara wa kipekee kutoka mwanzo hadi mwisho na vipengele vyote vimejumuishwa - bora kwa mifano ya kipekee ya biashara',
          buttonText: 'Anza Kutoka Mwanzo'
        },
        milestones: {
          title: 'Ufuatiliaji wa Malengo',
          description: 'Weka na fuatilia malengo ya biashara kulingana na hatua yako ya sasa na malengo ya ukuaji na tarehe za mwisho',
          buttonText: 'Fuatilia Malengo'
        },
        financial: {
          title: 'Ufuatiliaji wa Kifedha',
          description: 'Fuatilia mapato na matumizi ya kila siku na maingizo ya kalenda na tengeneza ripoti za kifedha',
          buttonText: 'Fuatilia Fedha'
        }
      }
    },
    ar: {
      title: 'جنجا بيز أفريقيا',
      subtitle: 'ابني استراتيجية عملك للسوق الأفريقي',
      signOut: 'تسجيل الخروج',
      signIn: 'تسجيل الدخول',
      features: {
        templates: {
          title: 'قوالب الأعمال',
          description: 'اختر من أكثر من 15 قالب مسبق الصنع مصمم خصيصاً للأعمال الأفريقية الشائعة واحتياجات السوق',
          buttonText: 'استخدم القوالب'
        },
        strategy: {
          title: 'استراتيجية مخصصة',
          description: 'ابني اس��راتيجية عمل مخصصة تماماً من الصفر مع تضمين جميع الميزات - مثالي للنماذج التجارية الفريدة',
          buttonText: 'ابدأ من الصفر'
        },
        milestones: {
          title: 'تتبع المعالم',
          description: 'ضع وتتبع معالم العمل بناءً على مرحلتك الحالية وأهداف النمو مع المواعيد النهائية',
          buttonText: 'تتبع المعالم'
        },
        financial: {
          title: 'التتبع المالي',
          description: 'راقب الإيرادات والمصروفات اليومية مع إدخالات تستند إلى التقويم وأنشئ تقارير مالية',
          buttonText: 'تتبع الأموال'
        }
      }
    },
    fr: {
      title: 'Jenga Biz Africa',
      subtitle: 'Construisez Votre Stratégie d\'Entreprise pour le Marché Africain',
      signOut: 'Se Déconnecter',
      signIn: 'Se Connecter',
      features: {
        templates: {
          title: 'Modèles d\'Entreprise',
          description: 'Choisissez parmi plus de 15 modèles pré-construits spécialement conçus pour les entreprises africaines populaires et les besoins du marché',
          buttonText: 'Utiliser les Modèles'
        },
        strategy: {
          title: 'Stratégie Personnalisée',
          description: 'Construisez une stratégie d\'entreprise complètement personnalisée à partir de zéro avec toutes les fonctionnalités incluses - parfait pour les modèles d\'entreprise uniques',
          buttonText: 'Commencer de Zéro'
        },
        milestones: {
          title: 'Suivi des Jalons',
          description: 'Définissez et suivez les jalons d\'entreprise basés sur votre étape actuelle et vos objectifs de croissance avec des échéances',
          buttonText: 'Suivre les Jalons'
        },
        financial: {
          title: 'Suivi Financier',
          description: 'Surveillez les revenus et dépenses quotidiens avec des entrées basées sur le calendrier et générez des rapports financiers',
          buttonText: 'Suivre les Finances'
        }
      }
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  // Handle authentication-required actions
  const handleAuthRequiredAction = (action: () => void) => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    action();
  };

  const features = [
    {
      icon: FileText,
      title: t.features.templates.title,
      description: t.features.templates.description,
      buttonText: t.features.templates.buttonText,
      buttonColor: 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
      onClick: () => handleAuthRequiredAction(() => navigate('/templates', { state: { language } }))
    },
    {
      icon: Zap,
      title: t.features.strategy.title,
      description: t.features.strategy.description,
      buttonText: t.features.strategy.buttonText,
      buttonColor: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      onClick: () => {
        handleAuthRequiredAction(() => {
          setCurrentStrategy(null);
          navigate('/strategies', { state: { language } });
        });
      }
    }
  ];

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            <img src="/jenga-biz-logo.png" alt="Jenga Biz Africa" className="h-12 w-auto" />
            
            {/* Mobile-responsive navigation - Show different content based on auth state */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
              <LanguageSelector 
                currentLanguage={language}
                onLanguageChange={setLanguage}
              />
              
              {user ? (
                // Authenticated user navigation
                <>
                  <Button
                    variant="outline"
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
                  {/* Show SaaS for admins/hub managers/super admins */}
                  <RoleAwareSaaSButton />
                  <RoleAwareSuperAdminButton />
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
                        // Stay on current page after sign out
                      } catch (error) {
                        console.error('Sign out error:', error);
                      }
                    }}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.signOut}
                  </Button>
                </>
              ) : (
                // Non-authenticated user navigation
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAuthDialog(true)}
                  className="flex items-center gap-2 text-xs sm:text-sm bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  <LogIn className="w-4 h-4" />
                  {t.signIn}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Approval Status Banner */}
      {user && <ApprovalStatusBanner className="mx-4 sm:mx-6 lg:mx-8 mt-4" />}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-orange-600 mb-6">
            {t.title}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card key={index} className={`${feature.bgColor} border-0 shadow-lg hover:shadow-xl transition-shadow`}>
                <CardContent className="p-8">
                  <div className="flex items-center mb-6">
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-md">
                      <IconComponent className={`w-8 h-8 ${feature.iconColor}`} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 mb-8 leading-relaxed">
                    {feature.description}
                  </p>
                  <Button 
                    onClick={feature.onClick}
                    className={`w-full ${feature.buttonColor} text-white font-semibold py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105`}
                  >
                    {feature.buttonText}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Auth Dialog */}
      <EnhancedAuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
      />
    </div>
  );
};

export default Index;
