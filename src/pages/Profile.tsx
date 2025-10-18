import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Upload, User, Building2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ApprovalStatusBanner } from '@/components/ApprovalStatusBanner';
import { toast as sonnerToast } from 'sonner';

interface ProfileData {
  contact_person_name: string;
  email: string;
  phone_number: string;
  website: string;
  industry: string;
  country: string;
  organization_name: string;
  business_type: string;
  account_type: string;
  organization_logo: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<ProfileData>({
    contact_person_name: '',
    email: '',
    phone_number: '',
    website: '',
    industry: '',
    country: '',
    organization_name: '',
    business_type: '',
    account_type: 'Business',
    organization_logo: ''
  });
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Check for signup success message from sessionStorage
  useEffect(() => {
    const signupSuccess = sessionStorage.getItem('signup_success');
    if (signupSuccess === 'true') {
      sessionStorage.removeItem('signup_success');
      sonnerToast.success('Account Created!', {
        description: 'Please check your email to verify your account.',
        duration: 8000,
      });
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadProfile();

      // Auto-populate name and email from auth user
      if (user.email && !profile.email) {
        const metaType = (user.user_metadata?.account_type || '').toLowerCase();
        const normalized = ['organization','ecosystem enabler','enabler','org'].includes(metaType) ? 'organization' : 'business';
        setProfile(prev => ({
          ...prev,
          email: user.email || '',
          contact_person_name: user.user_metadata?.full_name || '',
          account_type: normalized
        }));
      }
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    // Helper to fetch profile
    const fetchOnce = async () => {
      return await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    };

    // Retry with backoff on network errors
    const delays = [300, 800, 1500];
    let data: any = null;
    let error: any = null;
    for (let i = 0; i < delays.length; i++) {
      ({ data, error } = await fetchOnce());
      if (!error) break;
      const isNetwork = error?.name === 'TypeError' || String(error).includes('Failed to fetch');
      if (!isNetwork) break;
      await new Promise(r => setTimeout(r, delays[i]));
    }

    if (error) {
      const msg = (error as any)?.message || (error as any)?.details || String(error);
      // If no profile exists yet, create a default one
      if ((error as any)?.code === 'PGRST116' || msg.toLowerCase().includes('no rows') || msg.toLowerCase().includes('0 rows')) {
        try {
          const { saveProfileForUser } = await import('@/lib/profile');
          const metaType = (user.user_metadata?.account_type || '').toLowerCase();
          const normalized = ['organization','ecosystem enabler','enabler','org'].includes(metaType) ? 'organization' : 'business';
          const { error: upsertError } = await saveProfileForUser(user.id, {
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            account_type: normalized,
            is_profile_complete: false
          });
          if (upsertError) {
            const upMsg = (upsertError as any)?.message || JSON.stringify(upsertError);
            console.error('Error creating default profile:', upMsg);
            toast({ title: 'Profile', description: upMsg, variant: 'destructive' });
            return;
          }
          // Re-fetch after creating
          const { data: created } = await fetchOnce();
          if (created) {
            setProfile({
              contact_person_name: created.full_name || user?.user_metadata?.full_name || '',
              email: created.email || user?.email || '',
              phone_number: created.contact_phone || '',
              website: created.website || '',
              industry: created.industry || '',
              country: created.country || '',
              organization_name: created.organization_name || '',
              business_type: created.business_type || '',
              account_type: created.account_type || user?.user_metadata?.account_type || 'Business',
              organization_logo: created.logo_url || created.profile_picture_url || ''
            });
          }
          return;
        } catch (e: any) {
          const emsg = e?.message || JSON.stringify(e);
          console.error('Profile init error:', emsg);
          toast({ title: 'Profile', description: emsg, variant: 'destructive' });
          return;
        }
      }
      const isNetwork = (error as any)?.name === 'TypeError' || msg.includes('Failed to fetch');
      if (isNetwork) {
        console.warn('Network issue fetching profile, using auth metadata fallback');
        setProfile(prev => ({
          ...prev,
          contact_person_name: user?.user_metadata?.full_name || prev.contact_person_name,
          email: user?.email || prev.email,
        }));
        toast({ title: 'Network issue', description: 'Could not reach server. Showing basic profile. Retry later.', variant: 'destructive' });
        return;
      }
      console.error('Error loading profile:', msg);
      toast({ title: 'Profile', description: msg, variant: 'destructive' });
      return;
    }

    if (data) {
      setProfile({
        contact_person_name: data.full_name || user?.user_metadata?.full_name || '',
        email: data.email || user?.email || '',
        phone_number: data.contact_phone || '',
        website: data.website || '',
        industry: data.industry || '',
        country: data.country || '',
        organization_name: data.organization_name || '',
        business_type: data.business_type || '',
        account_type: data.account_type || user?.user_metadata?.account_type || 'Business',
        organization_logo: data.logo_url || data.profile_picture_url || ''
      });
      
      // Check email confirmation status
      setEmailConfirmed(data.email_confirmed || false);
    }
  };

  const handleResendConfirmation = async () => {
    setResendingEmail(true);
    try {
      // Check current confirmation status first
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email_confirmed')
        .eq('id', user?.id)
        .single();

      if (profileData?.email_confirmed) {
        toast({
          title: "Already Confirmed",
          description: "Your email is already confirmed!",
        });
        setEmailConfirmed(true);
        return;
      }

      const response = await supabase.functions.invoke('resend-confirmation', {
        body: { email: profile.email }
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.error) {
        toast({
          title: "Error",
          description: response.data.error,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Confirmation email sent! Please check your inbox.",
        });
      }
    } catch (error: any) {
      console.error('Error resending confirmation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resend confirmation email",
        variant: "destructive"
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    // Auto-save after 1 second of no typing
    setTimeout(() => saveProfile({ ...profile, [field]: value }), 1000);
  };

  const saveProfile = async (dataToSave = profile) => {
    if (!user || saving) return;

    setSaving(true);
    
    // Use the helper function for proper upsert
    const { saveProfileForUser } = await import('@/lib/profile');
    const { error } = await saveProfileForUser(user.id, {
      email: dataToSave.email,
      full_name: dataToSave.contact_person_name,
      contact_phone: dataToSave.phone_number,
      website: dataToSave.website,
      industry: dataToSave.industry,
      country: dataToSave.country,
      organization_name: dataToSave.organization_name,
      business_type: dataToSave.business_type,
      account_type: dataToSave.account_type,
      profile_picture_url: dataToSave.organization_logo,
      logo_url: dataToSave.organization_logo,
      is_profile_complete: true
    });

    setSaving(false);

    if (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Profile saved successfully",
      });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Math.random()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);

    const imageUrl = data.publicUrl;
    
    const updatedProfile = { ...profile, organization_logo: imageUrl };
    setProfile(updatedProfile);
    await saveProfile(updatedProfile);
    
    setUploading(false);
    toast({
      title: "Success",
      description: "Image uploaded successfully",
    });
  };

  const isOrganization = profile.account_type === 'organization';
  const imageUrl = profile.organization_logo;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Approval Status Banner */}
        <ApprovalStatusBanner className="mb-6" />
        
        {/* Email Confirmation Banner */}
        {!emailConfirmed && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-yellow-800 mb-1">Email Not Confirmed</h3>
                  <p className="text-sm text-yellow-700 mb-3">
                    Please confirm your email address to access all features. Check your inbox for the confirmation link.
                  </p>
                  <Button
                    onClick={handleResendConfirmation}
                    disabled={resendingEmail}
                    size="sm"
                    variant="outline"
                    className="border-yellow-600 text-yellow-800 hover:bg-yellow-100"
                  >
                    {resendingEmail ? 'Sending...' : 'Resend Confirmation Email'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Picture/Logo Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isOrganization ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                {isOrganization ? 'Organization Logo' : 'Profile Photo'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src={imageUrl} />
                  <AvatarFallback className="text-lg">
                    {isOrganization ? 
                      (profile.organization_name?.charAt(0) || 'E') : 
                      (profile.contact_person_name?.charAt(0) || 'B')
                    }
                  </AvatarFallback>
                </Avatar>
                
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <Button disabled={uploading} asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Uploading...' : `Upload ${isOrganization ? 'Logo' : 'Photo'}`}
                    </span>
                  </Button>
                </Label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </CardContent>
          </Card>

          {/* Profile Information */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="account_type">Account Type</Label>
                  <Input
                    id="account_type"
                    value={profile.account_type}
                    disabled
                    className="bg-muted"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contact_person_name">
                    {isOrganization ? 'Contact Person Name' : 'Contact Person Name'}
                  </Label>
                  <Input
                    id="contact_person_name"
                    value={profile.contact_person_name}
                    onChange={(e) => handleInputChange('contact_person_name', e.target.value)}
                  />
                </div>

                {isOrganization && (
                  <div className="space-y-2">
                    <Label htmlFor="organization_name">Organization Name</Label>
                    <Input
                      id="organization_name"
                      value={profile.organization_name}
                      onChange={(e) => handleInputChange('organization_name', e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={profile.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={profile.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={profile.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={profile.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                  />
                </div>

                {!isOrganization && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="business_type">Business Type</Label>
                    <Textarea
                      id="business_type"
                      value={profile.business_type}
                      onChange={(e) => handleInputChange('business_type', e.target.value)}
                      placeholder="Describe your business..."
                    />
                  </div>
                )}
              </div>

              {saving && (
                <p className="text-sm text-muted-foreground">Auto-saving...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
