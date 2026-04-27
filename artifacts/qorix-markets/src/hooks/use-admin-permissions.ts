import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "./use-auth";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const API = (p: string) => `${BASE_URL}api${p}`;

export interface AdminPermissions {
  role: "super" | "sub" | null;
  modules: string[];
  isSuper: boolean;
}

/**
 * Fetches the current admin's role + module permissions. Returns
 * `{ role: null, modules: [], isSuper: false }` for non-admin users so
 * components can call this unconditionally.
 *
 * Super admins always have access to every module; sub-admins only see
 * the modules their super admin granted them in the matrix.
 */
export function useAdminPermissions() {
  const { user, token } = useAuth();
  const enabled = !!token && !!user?.isAdmin;

  const query = useQuery<AdminPermissions>({
    queryKey: ["admin-me-permissions"],
    queryFn: () => authFetch(API("/admin/me/permissions")),
    enabled,
    staleTime: 60_000,
  });

  const data: AdminPermissions = query.data ?? {
    role: null,
    modules: [],
    isSuper: false,
  };

  /** Returns true if this admin can access the given module slug. */
  function can(module: string): boolean {
    if (!enabled) return false;
    if (data.isSuper) return true;
    return data.modules.includes(module);
  }

  return {
    ...data,
    can,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
