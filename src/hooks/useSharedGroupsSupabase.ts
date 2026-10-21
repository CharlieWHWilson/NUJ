import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { listSharedGroups } from "@/lib/sharedGroups";
import { useAppRefresh } from "./useAppRefresh";

export const useSharedGroupsSupabase = () => {
  const user = useCurrentUser();
  const query = useQuery({
    queryKey: ["shared-groups", user?.id],
    queryFn: listSharedGroups,
    enabled: Boolean(user?.id),
    retry: false,
    staleTime: 0,
    refetchInterval: 60_000,
  });
  useAppRefresh(() => { if (user?.id) return query.refetch(); });
  return query;
};