import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader as Loader2, Eye, EyeOff, CircleAlert as AlertCircle, Building2, Users, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { apiClient } from '@/lib/api-client';
import { saveProfileForUser } from '@/lib/profile';
import { formatError } from '@/lib/formatError';

interface EnhancedAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'signup';
}

export function EnhancedAuthDialog({ open, onOpenChange, defaultTab = 'login' }: EnhancedAuthDialogProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(defaultTab);

  // Update active tab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    fullName: "",
    accountType: "business",
    inviteCode: ""
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [inviteCodeValid, setInviteCodeValid] = useState<boolean | null>(null);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: "" });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();

  // Password strength checker
  const checkPasswordStrength = (password: string) => {
    let score = 0;
    let feedback = [];

    if (password.length >= 8) score += 1;
    else feedback.push("at least 8 characters");

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push("an uppercase letter");

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push("a lowercase letter");

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push("a number");

    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push("a special character");

    const strengthText = feedback.length === 0 
      ? "Strong password!" 
      : `Password needs: ${feedback.join(", ")}`;

    setPasswordStrength({ score, feedback: strengthText });
  };

  // Validate invite code via Edge Function to ensure server-side rules and consistent behavior
  const validateInviteCode = async (code: string) => {
    if (!code.trim()) {
      setInviteCodeValid(null);
      return;
    }

    try {
      const res = await apiClient.validateInviteCode(code.trim());
      setInviteCodeValid(!!res?.valid);
    } catch (err) {
      console.error('Invite validation error:', err);
      setInviteCodeValid(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AUTH] Login attempt started', { email: loginData.email });
    setIsLoading(true);

    const { error } = await signIn(loginData.email, loginData.password);
    
    if (error) {
      console.error('[AUTH] Login failed:', error);
      toast({
        title: "Login Failed",
        description: formatError(error),
        variant: "destructive",
      });
    } else {
      console.log('[AUTH] Login successful');
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      try {
        const { data: { user: current } } = await supabase.auth.getUser();
        if (current) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', current.id);
          const roleList = (roles || []).map(r => r.role as string);
          if (roleList.includes('super_admin')) {
            window.location.href = '/super-admin';
          } else if (roleList.includes('admin') || roleList.includes('hub_manager')) {
            window.location.href = '/saas';
          } else {
            window.location.href = '/b2c';
          }
        } else {
          window.location.href = '/';
        }
      } catch {
        window.location.href = '/';
      }
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AUTH] Signup attempt started', { 
      email: signupData.email, 
      fullName: signupData.fullName,
      accountType: signupData.accountType,
      hasInviteCode: !!signupData.inviteCode 
    });
    
    // Validate password strength
    if (passwordStrength.score < 4) {
      console.warn('[AUTH] Password too weak', { score: passwordStrength.score, feedback: passwordStrength.feedback });
      toast({
        title: "Password Too Weak",
        description: passwordStrength.feedback,
        variant: "destructive",
      });
      return;
    }

    // Invite code validation is now optional for organizations
    // Users can sign up without invite codes and get permissions later

    setIsLoading(true);

    console.log('[AUTH] Calling signUp with data:', {
      email: signupData.email,
      fullName: signupData.fullName,
      accountType: signupData.accountType,
      inviteCode: signupData.inviteCode || 'none'
    });

    const { error } = await signUp(
      signupData.email,
      signupData.password,
      signupData.fullName,
      signupData.accountType,
      signupData.inviteCode || undefined
    );

    if (error) {
      console.error('[AUTH] Signup failed:', error);
      toast({
        title: "Signup Failed",
        description: formatError(error),
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    console.log('[AUTH] Signup successful, proceeding with post-signup');

    try {
      // Attempt to fetch the newly created user
      console.log('[AUTH] Fetching newly created user...');
      const { data: { user: newUser } } = await supabase.auth.getUser();
      console.log('[AUTH] User fetched:', { userId: newUser?.id, email: newUser?.email });
      
      if (newUser?.id) {
        if (signupData.accountType === 'organization') {
          console.log('[AUTH] Processing organization signup with RPC');
          // Use the handle_org_signup RPC for organization accounts
          const { data: result, error: rpcError } = await supabase.rpc('handle_org_signup', {
            user_id: newUser.id,
            user_email: signupData.email,
            full_name: signupData.fullName,
            invite_code: signupData.inviteCode || undefined
          }) as { data: { status: string } | null; error: any };

          console.log('[AUTH] RPC response:', { result, error: rpcError });

          if (rpcError) {
            console.error('[AUTH] Organization signup RPC error:', rpcError);
            toast({
              title: 'Signup Error',
              description: 'Failed to complete organization signup. Please contact support.',
              variant: 'destructive'
            });
            setIsLoading(false);
            return;
          }

          // Handle the result based on approval status
          const status = result && typeof result === 'object' && 'status' in result ? (result as any).status : null;
          if (status === 'approved') {
            toast({
              title: 'Organization Account Approved!',
              description: 'Your ecosystem enabler account has been automatically approved. Welcome!',
            });
            // Redirect to profile to complete setup
            setTimeout(() => {
              onOpenChange(false);
              window.location.href = '/profile';
            }, 1000);
          } else if (status === 'pending') {
            toast({
              title: 'Account Pending Approval',
              description: 'Your ecosystem enabler account is pending approval by a super admin. You will be notified when approved.',
            });
            // Close dialog and redirect to home
            setTimeout(() => {
              onOpenChange(false);
              window.location.href = '/';
            }, 1000);
          } else {
            // Unexpected status, show error
            toast({
              title: 'Signup Error',
              description: 'Unexpected response from signup process. Please contact support.',
              variant: 'destructive'
            });
          }
          setIsLoading(false);
          return;
        } else {
          // For business accounts, create basic profile
          console.log('[AUTH] Creating business profile');
          const profilePayload: any = {
            email: signupData.email,
            full_name: signupData.fullName,
            account_type: signupData.accountType,
            is_profile_complete: false
          };

          console.log('[AUTH] Profile payload:', profilePayload);
          const profileResult = await saveProfileForUser(newUser.id, profilePayload);
          console.log('[AUTH] Profile creation result:', profileResult);
        }
      } else {
        console.warn('[AUTH] No user ID found after signup');
      }

      // Store signup success message in sessionStorage so it persists across redirect
      sessionStorage.setItem('signup_success', 'true');
      
      // Redirect to profile page to complete setup
      onOpenChange(false);
      window.location.href = '/profile';
    } catch (e: any) {
      console.error('[AUTH] Error in post-signup processing:', {
        error: e,
        message: e?.message,
        stack: e?.stack,
        name: e?.name
      });
      // Store signup success message in sessionStorage so it persists across redirect
      sessionStorage.setItem('signup_success', 'true');
      
      onOpenChange(false);
      window.location.href = '/';
    } finally {
      console.log('[AUTH] Signup process completed, setting loading to false');
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await resetPassword(forgotPasswordEmail);
    
    if (error) {
      toast({
        title: "Reset Failed",
        description: formatError(error),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reset Email Sent!",
        description: "Check your email for password reset instructions.",
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    }
    
    setIsLoading(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[65vh] sm:max-h-[90vh] overflow-y-auto pb-20 sm:pb-6">
        <DialogHeader>
          <DialogTitle className="text-center text-foreground">Welcome to Jenga Biz Africa</DialogTitle>
        </DialogHeader>
        
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as 'login' | 'signup')} 
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-card-foreground">Sign In</CardTitle>
                <CardDescription>Enter your credentials to access your account</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                   <div className="flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                       <Checkbox 
                         id="remember-me" 
                         checked={rememberMe}
                         onCheckedChange={(checked) => setRememberMe(checked === true)}
                       />
                       <Label htmlFor="remember-me" className="text-sm">Remember me</Label>
                     </div>
                     <Button
                       type="button"
                       variant="link"
                       className="px-0 text-sm"
                       onClick={() => setShowForgotPassword(true)}
                     >
                       Forgot Password?
                     </Button>
                   </div>
                   
                   <Button 
                     type="submit" 
                     className="w-full" 
                     disabled={isLoading}
                   >
                     {isLoading ? (
                       <>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         Signing in...
                       </>
                     ) : (
                       "Sign In"
                     )}
                   </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="signup">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-card-foreground">Create Account</CardTitle>
                <CardDescription>Join us to start building your business strategy</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Your full name"
                      value={signupData.fullName}
                      onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Account Type</Label>
                    <RadioGroup 
                      value={signupData.accountType} 
                      onValueChange={(value) => setSignupData({ ...signupData, accountType: value })}
                    >
                      <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-accent/50">
                        <RadioGroupItem value="business" id="business" />
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <Label htmlFor="business" className="font-medium">Business</Label>
                          <p className="text-sm text-muted-foreground">For SMEs and entrepreneurs</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-accent/50">
                        <RadioGroupItem value="organization" id="enabler" />
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <Label htmlFor="enabler" className="font-medium">Ecosystem Enabler</Label>
                          <p className="text-sm text-muted-foreground">For hubs, TVET, universities, VCs, foundations, financial institutions, NGOs</p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invite-code">Invite Code (optional)</Label>
                    <Input
                      id="invite-code"
                      type="text"
                      placeholder="Enter invite code (optional)"
                      value={signupData.inviteCode}
                      onChange={(e) => {
                        setSignupData({ ...signupData, inviteCode: e.target.value });
                        if (e.target.value) {
                          validateInviteCode(e.target.value);
                        }
                      }}
                    />
                    {inviteCodeValid === false && signupData.inviteCode && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Invalid invite code, but you can still proceed</AlertDescription>
                      </Alert>
                    )}
                    {inviteCodeValid === true && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>Valid invite code!</AlertDescription>
                      </Alert>
                    )}
                    {!signupData.inviteCode && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>💡 No invite code? You can sign up now and get admin permissions later.</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignupPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={signupData.password}
                        onChange={(e) => {
                          setSignupData({ ...signupData, password: e.target.value });
                          checkPasswordStrength(e.target.value);
                        }}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                      >
                        {showSignupPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {signupData.password && (
                      <div className="text-sm">
                        <div className={`font-medium ${passwordStrength.score >= 4 ? 'text-green-600' : 'text-orange-600'}`}>
                          {passwordStrength.feedback}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded ${
                                i < passwordStrength.score ? 'bg-green-500' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Password must include: 8+ characters, uppercase & lowercase letters, numbers, and special characters.
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
      
      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="your.email@example.com"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowForgotPassword(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
