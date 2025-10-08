/**
 * User Management Hooks using Edge Functions
 * Provides React Query hooks for user management operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type User, ApiError } from '@/lib/api-client';
import { useToast } from './use-toast';

// ==========================================
// User Management Query Hooks
// ==========================================

export function useUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  accountType?: string;
} = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => apiClient.getUsers(params),
    staleTime: 30000, // 30 seconds
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiClient.getProfile(),
    staleTime: 60000, // 1 minute
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof ApiError && error.error.code === 'AUTH_ERROR') {
        return false;
      }
      return failureCount < 3;
    },
  });
}

// ==========================================
// User Management Mutation Hooks
// ==========================================

export function useUpdateCurrentUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (updates: Partial<Pick<User, 'full_name' | 'account_type' | 'country' | 'organization_name'>>) => 
      apiClient.updateProfile(updates),
    onSuccess: (data) => {
      // Update current user cache
      queryClient.setQueryData(['current-user'], data);
      
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
    },
    onError: (error: ApiError) => {
      toast({
        title: 'Error',
        description: error.error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ 
      userId, 
      role, 
      action 
    }: { 
      userId: string; 
      role: string; 
      action: 'add' | 'remove' 
    }) => apiClient.updateUserRole(userId, role, action),
    onSuccess: (data, variables) => {
      // Invalidate users list to refetch with updated roles
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      toast({
        title: 'Role Updated',
        description: `User role ${variables.action === 'add' ? 'added' : 'removed'} successfully.`,
      });
    },
    onError: (error: ApiError) => {
      toast({
        title: 'Error',
        description: error.error.message || 'Failed to update user role',
        variant: 'destructive',
      });
    },
  });
}

export function useAdminUpdateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: ({ 
      userId, 
      updates 
    }: { 
      userId: string; 
      updates: Partial<Pick<User, 'full_name' | 'account_type' | 'country' | 'organization_name'>>
    }) => apiClient.adminUpdateUser(userId, updates),
    onSuccess: () => {
      // Invalidate users list to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      toast({
        title: 'User Updated',
        description: 'User profile has been updated successfully.',
      });
    },
    onError: (error: ApiError) => {
      toast({
        title: 'Error',
        description: error.error.message || 'Failed to update user',
        variant: 'destructive',
      });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: (userId: string) => apiClient.deactivateUser(userId),
    onSuccess: () => {
      // Invalidate users list to refetch without deactivated user
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      toast({
        title: 'User Deactivated',
        description: 'User has been deactivated successfully.',
      });
    },
    onError: (error: ApiError) => {
      toast({
        title: 'Error',
        description: error.error.message || 'Failed to deactivate user',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteUserHard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userId: string) => apiClient.deleteUserHard(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User deleted', description: 'User permanently deleted.' });
    },
    onError: (error: ApiError) => {
      toast({ title: 'Error', description: error.error.message || 'Failed to delete user', variant: 'destructive' });
    }
  });
}

// ==========================================
// Composite Hook for UserManagement Component
// ==========================================

/**
 * Combined hook that provides all user management functionality
 * for the UserManagement component
 */
export function useUserManagement(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  hideSuperAdmins?: boolean;
  hubId?: string | null;
} = {}) {
  const { hideSuperAdmins, ...queryParams } = params;
  
  // Fetch users data
  const usersQuery = useUsers(queryParams as any);
  
  // Mutation hooks
  const updateUserRoleMutation = useUpdateUserRole();
  const adminUpdateUserMutation = useAdminUpdateUser();
  const deactivateUserMutation = useDeactivateUser();
  
  // Filter out super admins if hideSuperAdmins is true
  const users = usersQuery.data?.data?.filter(user => {
    if (hideSuperAdmins) {
      return !user.roles.includes('super_admin');
    }
    return true;
  }) || [];
  
  // Statistics
  const stats = {
    totalUsers: users.length,
    superAdmins: users.filter(u => u.roles.includes('super_admin')).length,
    admins: users.filter(u => u.roles.includes('admin')).length,
    hubManagers: users.filter(u => u.roles.includes('hub_manager')).length,
    entrepreneurs: users.filter(u => u.roles.includes('entrepreneur')).length,
  };
  
  // Helper functions
  const updateUserRole = async (userId: string, role: string, action: 'add' | 'remove') => {
    return updateUserRoleMutation.mutateAsync({ userId, role, action });
  };
  
  const updateUser = async (userId: string, updates: Partial<User>) => {
    return adminUpdateUserMutation.mutateAsync({ userId, updates });
  };
  
  const deactivateUser = async (userId: string) => {
    return deactivateUserMutation.mutateAsync(userId);
  };
  
  return {
    // Data
    users,
    pagination: usersQuery.data?.meta?.pagination,
    stats,
    
    // Loading states
    isLoading: usersQuery.isLoading,
    isUpdatingRole: updateUserRoleMutation.isPending,
    isUpdatingUser: adminUpdateUserMutation.isPending,
    isDeactivating: deactivateUserMutation.isPending,
    
    // Errors
    error: usersQuery.error,
    
    // Actions
    updateUserRole,
    updateUser,
    deactivateUser,
    
    // Refetch function
    refetch: usersQuery.refetch,
  };
}

// ==========================================
// Utility Hook for Role Management
// ==========================================

/**
 * Helper hook for managing user roles with validation
 */
export function useRoleManagement() {
  const updateUserRoleMutation = useUpdateUserRole();
  
  const availableRoles = ['entrepreneur', 'hub_manager', 'admin', 'super_admin'];
  
  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'super_admin': 
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'admin': 
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'hub_manager': 
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'entrepreneur': 
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: 
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };
  
  const getRoleDisplayName = (role: string): string => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  const canAssignRole = (currentUserRoles: string[], targetRole: string): boolean => {
    // Super admins can assign any role
    if (currentUserRoles.includes('super_admin')) {
      return true;
    }
    
    // Admins can assign entrepreneur and hub_manager roles
    if (currentUserRoles.includes('admin')) {
      return ['entrepreneur', 'hub_manager'].includes(targetRole);
    }
    
    return false;
  };
  
  return {
    availableRoles,
    getRoleColor,
    getRoleDisplayName,
    canAssignRole,
    updateRole: updateUserRoleMutation.mutateAsync,
    isUpdating: updateUserRoleMutation.isPending,
  };
}