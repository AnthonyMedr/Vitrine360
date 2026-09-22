import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user, loading: authLoading, signOut } = useAuth();
  const canStartAssistedSale = Boolean(user && (user.role === "admin" || user.role === "seller" || user.user_metadata?.can_start_assisted_sale));

  return {
    isAdmin: user?.role === "admin",
    canStartAssistedSale,
    loading: authLoading,
    user,
    signOut,
  };
}
