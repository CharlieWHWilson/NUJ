import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { useMatesSupabase } from "./useMatesSupabase";
import { listMateRequests, MATES_UPDATED_EVENT, respondToMateRequest, sendMateRequest } from "@/lib/mateRequests";

export const useMateConnections = () => {
  const user = useCurrentUser();
  const mates = useMatesSupabase();
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ["mate-requests", user?.id],
    queryFn: listMateRequests,
    enabled: Boolean(user?.id),
    retry: false,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const update = () => { void queryClient.invalidateQueries({ queryKey: ["mate-requests"] }); };
    window.addEventListener(MATES_UPDATED_EVENT, update);
    return () => window.removeEventListener(MATES_UPDATED_EVENT, update);
  }, [queryClient]);

  const refresh = async () => {
    await Promise.all([requests.refetch(), mates.refresh()]);
  };

  const send = async (userId: string) => {
    const result = await sendMateRequest(userId);
    await refresh();
    return result;
  };

  const respond = async (requestId: string, action: "accept" | "decline" | "cancel") => {
    const mateId = await respondToMateRequest(requestId, action);
    await refresh();
    return mateId;
  };

  return {
    userId: user?.id,
    mates: mates.mates,
    incoming: requests.data?.incoming ?? [],
    outgoing: requests.data?.outgoing ?? [],
    previous: requests.data?.previous ?? [],
    loading: user === undefined || mates.loading || requests.isPending,
    error: requests.error?.message ?? mates.error,
    refresh, send, respond,
  };
};

export type MateConnections = ReturnType<typeof useMateConnections>;