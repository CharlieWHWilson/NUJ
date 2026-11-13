import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMeetupRewardCode } from "@/lib/meetups";
import { useAppRefresh } from "@/hooks/useAppRefresh";

export const MeetupRewardCode = ({ rewardId, userId, expiresAt }: { rewardId: string; userId: string; expiresAt: string }) => {
  const [now, setNow] = useState(Date.now);
  const expiry = new Date(expiresAt).getTime();
  const expired = !Number.isFinite(expiry) || expiry <= now;
  useEffect(() => {
    if (expired) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(expiry - now, 2147483647));
    return () => clearTimeout(timer);
  }, [expired, expiry, now]);
  const code = useQuery({
    queryKey: ["meetup-reward-code", userId, rewardId],
    queryFn: () => getMeetupRewardCode(rewardId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    enabled: !expired,
  });
  useAppRefresh(() => {
    setNow(Date.now());
    if (expiry > Date.now()) return code.refetch();
  });
  if (expired) return <p className="text-sm text-muted-foreground">Reward expired. The code is no longer available.</p>;
  return <div className="space-y-2">
    <p className="text-xs text-muted-foreground">Redemption code · show to venue staff</p>
    {code.isPending && <p role="status" className="text-sm">Loading redemption code...</p>}
    {code.error && <div role="alert" className="text-sm text-destructive">
      {code.error.message}
      <button type="button" className="ml-2 underline" onClick={() => void code.refetch()}>Retry code</button>
    </div>}
    {code.isSuccess && <p className="break-all rounded-xl border bg-background p-3 font-mono text-xl font-bold">{code.data}</p>}
  </div>;
};
