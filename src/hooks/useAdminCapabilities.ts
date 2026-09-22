import { useMemo } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminResource } from "@/hooks/useAdminResource";
import { resolveAdminProfileId } from "@/lib/adminProfile";

type ModuleAccess = "full" | "limited" | "view" | "none";

type PermissionProfile = {
  slug: string;
  permissions: string[];
  modules: Array<{ key: string; access: ModuleAccess }>;
};

const accessRank: Record<ModuleAccess, number> = {
  none: 0,
  view: 1,
  limited: 2,
  full: 3,
};

export function useAdminCapabilities() {
  const { user } = useAdmin();
  const profiles = useAdminResource<PermissionProfile[]>("/api/admin/permissions/overview", []);
  const currentProfileId = resolveAdminProfileId(user);

  const currentProfile = useMemo(
    () => profiles.data.find((profile) => profile.slug === currentProfileId),
    [currentProfileId, profiles.data],
  );

  const can = (permission: string) => {
    if (!currentProfile) return user?.role === "admin";
    return currentProfile.permissions.includes("*") || currentProfile.permissions.includes(permission);
  };

  const canAny = (permissions: string[]) => permissions.some((permission) => can(permission));

  const canAccessModule = (moduleKey: string, minimumAccess: Exclude<ModuleAccess, "none"> = "view") => {
    if (!currentProfile) return user?.role === "admin";
    const module = currentProfile.modules.find((entry) => entry.key === moduleKey);
    return Boolean(module && accessRank[module.access] >= accessRank[minimumAccess]);
  };

  return {
    loading: profiles.loading,
    profile: currentProfile,
    profileId: currentProfileId,
    can,
    canAny,
    canAccessModule,
  };
}
