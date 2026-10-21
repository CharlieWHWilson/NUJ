import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { listSharedGroups } from "@/lib/sharedGroups";

export const useSharedGroupsSupabase = () => {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ["shared-groups", user?.id],
    queryFn: listSharedGroups,
    enabled: Boolean(user?.id),
    retry: false,
    staleTime: 0,
  });
};