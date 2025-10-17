import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from "@/hooks/use-toast";
import { useUserManagement, useRoleManagement, useDeleteUserHard } from "@/hooks/useEdgeUserManagement";
import { Users, UserPlus, Edit, Trash2, Search, Shield } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import type { User } from "@/lib/api-client";
import { startImpersonation } from '@/lib/tenant';

interface UserWithRoles extends User {
  roles: string[];
}

export function UserManagement({ hideSuperAdmins = false, hubId }: { hideSuperAdmins?: boolean; hubId?: string | null }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editValues, setEditValues] = useState<{ 
    full_name: string; 
    email: string; 
    account_type: string; 
    country: string; 
    organization_name: string; 
  }>({ full_name: "", email: "", account_type: "", country: "", organization_name: "" });
  
  const { toast } = useToast();
  
  // Use the edge function hooks
  const {
    users,
    stats,
    isLoading: loading,
    updateUserRole,
    updateUser,
    deactivateUser: deactivateUserMutation,
    isUpdatingRole,
    isUpdatingUser,
    isDeactivating
  } = useUserManagement({ 
    search: searchQuery || undefined, 
    role: filterRole === "all" ? undefined : filterRole,
    hideSuperAdmins,
    hubId: hubId || undefined,
  });
  
  const { getRoleColor } = useRoleManagement();
  const deleteUserHardMut = useDeleteUserHard();

  const handleUpdateUserRole = async (userId: string, newRole: 'entrepreneur' | 'hub_manager' | 'admin' | 'super_admin', action: 'add' | 'remove') => {
    // Find user locally to avoid redundant calls
    const target = users.find(u => u.id === userId);
    const hasRole = target?.roles?.includes(newRole);

    if (action === 'add' && hasRole) {
      toast({ title: 'Role exists', description: `User already has role ${newRole}`, variant: 'destructive' });
      return;
    }

    if (action === 'remove' && !hasRole) {
      toast({ title: 'Role missing', description: `User does not have role ${newRole}`, variant: 'destructive' });
      return;
    }

    try {
      await updateUserRole(userId, newRole, action);
      // Success handling is done in the hook
    } catch (err: any) {
      console.error('Error updating user role:', err);
      const message = err?.error?.message || err?.message || 'Failed to update user role.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleOpenEdit = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditValues({
      full_name: user.full_name || "",
      email: user.email || "",
      account_type: user.account_type || "",
      country: user.country || "",
      organization_name: user.organization_name || "",
    });
    setIsEditModalOpen(true);
  };

  const saveProfileChanges = async () => {
    if (!selectedUser) return;
    try {
      await updateUser(selectedUser.id, {
        full_name: editValues.full_name,
        account_type: editValues.account_type,
        country: editValues.country || undefined,
        organization_name: editValues.organization_name || undefined,
      });
      
      // Success handling is done in the hook
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      // Error handling is done in the hook
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      await deactivateUserMutation(userId);
      // Success handling is done in the hook
    } catch (error: any) {
      console.error('Error deactivating user:', error);
      // Error handling is done in the hook
    }
  };

  // Since filtering is now handled by the hook, we just use the users directly
  const filteredUsers = users.filter(user => {
    // Additional client-side filtering if needed
    if (searchQuery) {
      const matchesSearch = user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
    }
    if (filterRole !== "all" && !user.roles.includes(filterRole)) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div />
      </div>

      <div className="text-2xl font-bold leading-8">User Management</div>
      <div className="text-slate-500 font-normal">Manage user accounts and permissions</div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
        
        {!hideSuperAdmins && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.superAdmins}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.admins}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hub Managers</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.hubManagers}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Search Users</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="role-filter">Filter by Role</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {!hideSuperAdmins && <SelectItem value="super_admin">Super Admin</SelectItem>}
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="hub_manager">Hub Manager</SelectItem>
                <SelectItem value="entrepreneur">Entrepreneur</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>Manage user accounts and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name || 'No name'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.account_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge key={role} className={getRoleColor(role)}>
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary">No roles</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Dialog 
                        open={isEditModalOpen && selectedUser?.id === user.id}
                        onOpenChange={(open) => {
                          setIsEditModalOpen(open);
                          if (!open) setSelectedUser(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Manage User</DialogTitle>
                            <DialogDescription>
                              Update profile or roles for {user.email}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="full_name">Full Name</Label>
                                <Input id="full_name" value={editValues.full_name} onChange={(e) => setEditValues(v => ({ ...v, full_name: e.target.value }))} />
                              </div>
                              <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={editValues.email} onChange={(e) => setEditValues(v => ({ ...v, email: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Account Type</Label>
                                <Select value={editValues.account_type} onValueChange={(val) => setEditValues(v => ({ ...v, account_type: val }))}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="business">Business</SelectItem>
                                    <SelectItem value="organization">Organization</SelectItem>
                                    <SelectItem value="deactivated">Deactivated</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="country">Country</Label>
                                <Input id="country" value={editValues.country} onChange={(e) => setEditValues(v => ({ ...v, country: e.target.value }))} />
                              </div>
                              <div className="md:col-span-2">
                                <Label htmlFor="organization_name">Organization</Label>
                                <Input id="organization_name" value={editValues.organization_name} onChange={(e) => setEditValues(v => ({ ...v, organization_name: e.target.value }))} />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button 
                                onClick={saveProfileChanges}
                                disabled={isUpdatingUser}
                              >
                                {isUpdatingUser ? 'Saving...' : 'Save'}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="destructive" 
                                    disabled={isDeactivating}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" /> Deactivate
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deactivate User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will deactivate the user's account and remove access. This action can be reversed by a super admin.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeactivateUser(user.id)} className="bg-destructive">Deactivate</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>

                              {/* Permanent delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" className="ml-2" disabled={deleteUserHardMut.isPending}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete permanently
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently remove the user and associated records. This action is irreversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={deleteUserHardMut.isPending}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={async () => { await deleteUserHardMut.mutateAsync(user.id); }} className="bg-destructive">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>

                            <div className="space-y-4 border-t pt-4">
                              <div>
                                <Label>Current Roles</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {user.roles.map((role) => (
                                    <div key={role} className="flex items-center gap-2">
                                      <Badge className={getRoleColor(role)}>{role}</Badge>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUpdateUserRole(user.id, role as any, 'remove')}
                                        disabled={isUpdatingRole}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <Label>Add Role</Label>
                                <div className="flex gap-2 mt-2 flex-wrap">
                                  {(['entrepreneur', 'hub_manager', 'admin', 'super_admin'] as string[])
                                    .filter(r => !(hideSuperAdmins && r === 'super_admin'))
                                    .map((role) => (
                                      !user.roles.includes(role) && (
                                        <Button
                                          key={role}
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleUpdateUserRole(user.id, role as any, 'add')}
                                          disabled={isUpdatingRole}
                                        >
                                          <UserPlus className="h-3 w-3 mr-1" />
                                          {role}
                                        </Button>
                                      )
                                    ))}
                                </div>
                              </div>
                              {/* Start Impersonation (super-admin only) */}
                              {/** Only show if current user is super-admin; handled by hideSuperAdmins prop elsewhere */}
                              <div>
                                <Label>Impersonation</Label>
                                <div className="mt-2">
                                  { (user.roles.includes('admin') || user.roles.includes('hub_manager')) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          // Fetch hub_id for the target user from Supabase
                                          const { data: rolesData, error: rolesErr } = await supabase.from('user_roles').select('hub_id').eq('user_id', user.id).limit(1).maybeSingle();
                                          if (rolesErr) throw rolesErr;
                                          const hubId = rolesData?.hub_id;
                                          if (!hubId) {
                                            toast({ title: 'No hub', description: 'Target user is not associated with a hub', variant: 'destructive' });
                                            return;
                                          }
                                          const res = await startImpersonation(hubId);
                                          if (res.success) {
                                            toast({ title: 'Impersonation started', description: 'You are now impersonating the target hub' });
                                            // reload page to pick up impersonation (HubContext polls status)
                                            window.location.reload();
                                          } else {
                                            toast({ title: 'Impersonation failed', description: res.error || 'Could not start impersonation', variant: 'destructive' });
                                          }
                                        } catch (e) {
                                          console.error('Start impersonation failed', e);
                                          toast({ title: 'Impersonation error', description: 'Failed to start impersonation', variant: 'destructive' });
                                        }
                                      }}
                                    >
                                      Start Impersonation
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
