import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import { useToast } from '@/hooks/use-toast';

interface HubConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HubConfigDialog({ open, onOpenChange }: HubConfigDialogProps) {
  const { user } = useAuth();
  const { roles } = useRoles();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hubId, setHubId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', country: '', region: '', contact_email: '' });

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id, organization_name, country, email')
          .eq('id', user.id)
          .single();

        let currentHubId = profile?.organization_id || null;
        if (currentHubId) {
          const { data: hub } = await supabase
            .from('hubs')
            .select('*')
            .eq('id', currentHubId)
            .single();
          if (hub) {
            setHubId(hub.id);
            setForm({
              name: hub.name || profile?.organization_name || '',
              country: hub.country || profile?.country || '',
              region: hub.region || '',
              contact_email: hub.contact_email || profile?.email || ''
            });
            setLoading(false);
            return;
          }
        }
        // Prefill from profile if no hub exists
        setHubId(null);
        setForm({
          name: profile?.organization_name || '',
          country: profile?.country || '',
          region: '',
          contact_email: profile?.email || ''
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, user]);

  const onChange = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Only allow admins to create or link hubs here; requireAdmin is enforced server-side
      if (!roles?.includes('admin') && !roles?.includes('super_admin')) {
        toast({ title: 'Unauthorized', description: 'Only admins can configure a hub', variant: 'destructive' });
        return;
      }

      // If hub exists, call function to update hub. If not, call create route.
      const payload = {
        name: form.name.trim(),
        country: form.country.trim(),
        region: form.region.trim() || null,
        contact_email: form.contact_email.trim() || null,
        slug: undefined,
      } as any;

      if (hubId) payload.id = hubId;

      // Call hub-management function
      console.debug('HubConfigDialog: sending payload to hub-management', payload);
      const { data, error } = await supabase.functions.invoke('hub-management', {
        body: JSON.stringify({ action: hubId ? 'update' : 'create', ...payload }),
      });

      console.debug('HubConfigDialog: raw invoke result', { data, error });

      if (error) {
        throw error;
      }

      // Supabase Functions returns raw text in data by default; parse if needed
      let parsed: any = null;
      try {
        parsed = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (parseErr) {
        console.debug('HubConfigDialog: failed to parse invoke response, using raw data', parseErr);
        parsed = data;
      }

      console.debug('HubConfigDialog: parsed response', parsed);

      if (!parsed || !parsed.success) {
        const msg = parsed?.error?.message || 'Failed to save hub';
        throw new Error(msg);
      }

      const createdHub = parsed.data?.hub || parsed.data;
      if (createdHub?.id) {
        // Update profile locally to reflect new hub
        await supabase.from('profiles').update({ organization_id: createdHub.id }).eq('id', user.id);
        setHubId(createdHub.id);
      }
      toast({ title: 'Hub saved', description: 'Your hub settings have been updated.' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Unable to save hub', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Hub</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="hub-name">Hub/Organization Name</Label>
            <Input id="hub-name" value={form.name} onChange={e => onChange('name', e.target.value)} placeholder="e.g. Nairobi Innovation Hub" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="hub-country">Country</Label>
              <Input id="hub-country" value={form.country} onChange={e => onChange('country', e.target.value)} placeholder="e.g. Kenya" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hub-region">Region/City</Label>
              <Input id="hub-region" value={form.region} onChange={e => onChange('region', e.target.value)} placeholder="e.g. Nairobi" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hub-email">Contact Email</Label>
            <Input id="hub-email" type="email" value={form.contact_email} onChange={e => onChange('contact_email', e.target.value)} placeholder="contact@yourhub.org" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button onClick={save} disabled={loading || !form.name || !form.country}>{loading ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
