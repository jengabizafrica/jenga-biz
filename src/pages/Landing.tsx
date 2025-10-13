import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EnhancedAuthDialog } from '@/components/auth/EnhancedAuthDialog';
import { ApprovalStatusBanner } from '@/components/ApprovalStatusBanner';
import { LogIn, Rocket, ShieldCheck, BarChart3, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import { useNavigate } from 'react-router-dom';

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

const Landing = () => {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Check for password reset tokens and redirect to reset page
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    // If recovery tokens are present, redirect to password reset page
    if (accessToken && type === 'recovery') {
      navigate('/reset-password' + window.location.hash);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <img src="/jenga-biz-logo.png" alt="Jenga Biz Africa" className="h-10 w-auto" />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/pricing')}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                Pricing
              </Button>
              {!user ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAuthDialog(true)}
                  className="flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Dashboard
                  </Button>
                  <RoleAwareSaaSButton />
                  <RoleAwareSuperAdminButton />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/profile')}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    Profile
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => { await signOut(); }}
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    Sign Out
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Approval Status Banner */}
      {user && <ApprovalStatusBanner className="mx-4 sm:mx-6 lg:mx-8 mt-4" />}

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto py-16 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900">
            Build your business strategy with confidence
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            Jenga Biz Africa helps entrepreneurs plan, track milestones, and manage finances with tools built for African markets.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {!user ? (
              <>
                <Button
                  onClick={() => setShowAuthDialog(true)}
                  className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white px-8 py-6 text-lg"
                >
                  Register as Entrepreneur
                </Button>
                <Button variant="outline" onClick={() => setShowAuthDialog(true)}>
                  I already have an account
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => navigate('/b2c')} className="px-8 py-6 text-lg">
                  Go to App
                </Button>
                <Button variant="outline" onClick={() => navigate('/profile')}>
                  View Profile
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {[{
            icon: Rocket,
            title: 'Templates to start fast',
            desc: 'Start with curated templates for popular African business models.'
          }, {
            icon: BarChart3,
            title: 'Track what matters',
            desc: 'Milestones, finances, and KPIs in one simple workspace.'
          }, {
            icon: ShieldCheck,
            title: 'Own your journey',
            desc: 'Built-in guidance to help you grow confidently and sustainably.'
          }].map((f, idx) => {
            const Icon = f.icon;
            return (
              <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-600">{f.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-6">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              { title: 'Create your account', desc: 'Register in seconds and set up your profile.' },
              { title: 'Pick a template or start from scratch', desc: 'Use ready-made strategies or build your own.' },
              { title: 'Track and grow', desc: 'Use milestones and finance tools to stay on track.' },
            ].map((s, i) => (
              <Card key={i} className="border-0 bg-white/70">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-gray-600">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* For enablers blurb */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-5xl mx-auto">
          <Card className="border-orange-200 bg-orange-50/60">
            <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white text-orange-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">For Ecosystem Enablers</h4>
                <p className="text-gray-600">Hubs, universities, and institutions can onboard teams and track startups. Use the same sign up to get started.</p>
              </div>
              <Button variant="outline" onClick={() => user ? navigate('/saas') : setShowAuthDialog(true)}>Get Started</Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Auth Dialog */}
      <EnhancedAuthDialog open={showAuthDialog && !user} onOpenChange={setShowAuthDialog} />
    </div>
  );
};

export default Landing;
