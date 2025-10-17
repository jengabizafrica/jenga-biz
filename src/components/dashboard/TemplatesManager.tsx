import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTemplatesQuery, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useDeleteTemplateForce } from '@/hooks/useTemplates';
import { templateConfigSchema } from '@/lib/schemas/templates';

export default function TemplatesManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const query = useTemplatesQuery();
  const createMut = useCreateTemplate();
  const updateMut = useUpdateTemplate();
  const deleteMut = useDeleteTemplate();
  const deleteForceMut = useDeleteTemplateForce();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', template_config: '{}' });

  useEffect(() => {
    if (query.data) setTemplates(query.data);
    setLoading(query.isLoading);
  }, [query.data, query.isLoading]);

  const handleCreate = async () => {
    let parsed: any;
    try {
      parsed = JSON.parse(form.template_config);
    } catch (err) {
      toast({ title: 'Invalid JSON', description: 'Template config must be valid JSON', variant: 'destructive' });
      return;
    }

    const validated = templateConfigSchema.safeParse(parsed);
    if (!validated.success) {
      const first = validated.error.issues[0];
      toast({ title: 'Validation error', description: first.message, variant: 'destructive' });
      return;
    }

    try {
      const payload = { ...form, template_config: validated.data };
      await createMut.mutateAsync(payload as any);
      toast({ title: 'Template created' });
      setIsCreateOpen(false);
      setForm({ name: '', description: '', category: '', template_config: '{}' });
    } catch (err: any) {
      console.error('Create template failed', err);
      toast({ title: 'Error', description: err?.message || 'Failed to create template', variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    let parsed: any;
    try {
      parsed = JSON.parse(form.template_config);
    } catch (err) {
      toast({ title: 'Invalid JSON', description: 'Template config must be valid JSON', variant: 'destructive' });
      return;
    }

    const validated = templateConfigSchema.safeParse(parsed);
    if (!validated.success) {
      const first = validated.error.issues[0];
      toast({ title: 'Validation error', description: first.message, variant: 'destructive' });
      return;
    }

    try {
      const payload = { name: form.name, description: form.description, category: form.category, template_config: validated.data };
      await updateMut.mutateAsync({ id: editing.id, updates: payload } as any);
      toast({ title: 'Template updated' });
      setEditing(null);
      setForm({ name: '', description: '', category: '', template_config: '{}' });
    } catch (err: any) {
      console.error('Update template failed', err);
      toast({ title: 'Error', description: err?.message || 'Failed to update template', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this template?')) return;
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Template deactivated' });
    } catch (err: any) {
      console.error('Delete template failed', err);
      toast({ title: 'Error', description: err?.message || 'Failed to delete template', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 mt-[120px] lg:mt-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Business Templates</h2>
          <p className="text-muted-foreground">Manage templates available to entrepreneurs</p>
        </div>
        <div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)}>Create Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <Label>Template Config (JSON)</Label>
                  <Textarea rows={8} value={form.template_config} onChange={(e) => setForm(f => ({ ...f, template_config: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate}>Create</Button>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates ({templates.length})</CardTitle>
          <CardDescription>Active templates are available to entrepreneurs</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <div>Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.category}</TableCell>
                    <TableCell>{t.is_active ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => { setEditing(t); setForm({ name: t.name, description: t.description || '', category: t.category || '', template_config: JSON.stringify(t.template_config || {}, null, 2) }); }}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)} className="ml-2" disabled={deleteMut.status === 'pending'}>Deactivate</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="ml-2" disabled={deleteForceMut.status === 'pending'}>
                            Delete permanently
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template Permanently</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the template and any related permissions. This action is irreversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleteForceMut.status === 'pending'}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => { await deleteForceMut.mutateAsync(t.id); }} className="bg-destructive">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Edit dialog */}
          <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setForm({ name: '', description: '', category: '', template_config: '{}' }); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <Label>Template Config (JSON)</Label>
                  <Textarea rows={8} value={form.template_config} onChange={(e) => setForm(f => ({ ...f, template_config: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUpdate}>Save</Button>
                  <Button variant="outline" onClick={() => { setEditing(null); }}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
