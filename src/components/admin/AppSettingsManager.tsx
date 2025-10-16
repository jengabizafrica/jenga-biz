import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Copy, CheckCircle } from 'lucide-react';

export function AppSettingsManager() {
  const [autoApproveOrgs, setAutoApproveOrgs] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowedCurrencies, setAllowedCurrencies] = useState<string[]>([]);
  const [paystackWebhookUrl, setPaystackWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const {
    getAutoApprove,
    setAutoApprove,
    getMaintenanceMode,
    setMaintenanceMode: saveMaintenanceMode,
    getAllowedCurrencies,
    setAllowedCurrencies: saveAllowedCurrencies,
    getPaystackWebhookUrl,
    setPaystackWebhookUrl: savePaystackWebhookUrl,
    loading: settingsLoading,
    error: settingsError,
  } = useAppSettings();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [autoApprove, maintenance, currencies, webhookUrl] = await Promise.all([
      getAutoApprove(),
      getMaintenanceMode(),
      getAllowedCurrencies(),
      getPaystackWebhookUrl(),
    ]);
    setAutoApproveOrgs(autoApprove);
    setMaintenanceMode(maintenance);
    setAllowedCurrencies(currencies);
    setPaystackWebhookUrl(webhookUrl);
  };

  const saveSettings = async () => {
    const [s1, s2, s3, s4] = await Promise.all([
      setAutoApprove(autoApproveOrgs),
      saveMaintenanceMode(maintenanceMode),
      saveAllowedCurrencies(allowedCurrencies),
      savePaystackWebhookUrl(paystackWebhookUrl),
    ]);

    if (s1 && s2 && s3 && s4) {
      toast({
        title: 'Settings saved',
        description: 'All system settings updated successfully.',
      });
    } else if (settingsError) {
      toast({
        title: 'Save failed',
        description: settingsError,
        variant: 'destructive',
      });
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(paystackWebhookUrl);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Webhook URL copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
        <CardDescription>
          Configure system-wide settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Auto-approve Organizations */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Auto-approve Organization Accounts</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, newly registered ecosystem enablers will be activated automatically.
              </p>
            </div>
            <Switch
              checked={autoApproveOrgs}
              onCheckedChange={setAutoApproveOrgs}
              disabled={settingsLoading}
            />
          </div>

          {/* Maintenance Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, bypasses all subscription gating for end users.
              </p>
            </div>
            <Switch
              checked={maintenanceMode}
              onCheckedChange={setMaintenanceMode}
              disabled={settingsLoading}
            />
          </div>

          {/* Allowed Currencies */}
          <div className="space-y-2">
            <Label htmlFor="currencies">Allowed Currencies</Label>
            <Input
              id="currencies"
              value={allowedCurrencies.join(', ')}
              onChange={(e) =>
                setAllowedCurrencies(
                  e.target.value
                    .split(',')
                    .map((c) => c.trim().toUpperCase())
                    .filter(Boolean)
                )
              }
              placeholder="USD, KES, EUR, GBP"
              disabled={settingsLoading}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated currency codes (e.g., USD, KES, EUR, GBP, ZAR, NGN)
            </p>
          </div>

          {/* Paystack Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhook">Paystack Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook"
                value={paystackWebhookUrl}
                onChange={(e) => setPaystackWebhookUrl(e.target.value)}
                placeholder="https://..."
                disabled={settingsLoading}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyWebhookUrl}
                disabled={!paystackWebhookUrl}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure this URL in Paystack dashboard. Update when switching from sandbox to live.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex gap-2 pt-4">
            <Button onClick={saveSettings} disabled={settingsLoading}>
              {settingsLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save All Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
