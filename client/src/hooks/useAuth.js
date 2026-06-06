/**
 * useAuth.js
 * Convenience hook that returns current user + role helpers.
 */
import useAuthStore from '../store/authStore';

export default function useAuth() {
  const { user, token, logout } = useAuthStore();

  return {
    user,
    token,
    logout,
    isAdmin: user?.role === 'ADMIN',
    isManager: user?.role === 'MANAGER',
    isOfficer: user?.role === 'PROCUREMENT_OFFICER',
    isVendor: user?.role === 'VENDOR',
    hasRole: (...roles) => roles.includes(user?.role),
  };
}