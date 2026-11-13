import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { canOptIntoMeetupAttempt, hasMeetupOfferEnded, joinMeetupAttempt, leaveMeetupAttempt, type MeetupAttempt } from "@/lib/meetups";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const MeetupParticipation = ({ attempt, userId }: { attempt: MeetupAttempt; userId: string }) => {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (action: "join" | "leave") => action === "join" ? joinMeetupAttempt(attempt.id) : leaveMeetupAttempt(attempt.id),
    onSuccess: async () => {
      setConfirmLeave(false);
      await queryClient.invalidateQueries({ queryKey: ["meetup-attempts", userId] });
    },
  });
  const canJoin = canOptIntoMeetupAttempt(attempt, userId);
  return <div className="relative z-10 space-y-2">
    {!attempt.participating && <p className="text-xs text-muted-foreground">
      {hasMeetupOfferEnded(attempt.offer) ? "Offer ended. You can no longer opt in." : canJoin ? "Not opted in yet. Opt in to start counting your check-ins." : "This offer is limited to the group's starting members. You can't opt in to this attempt."}
    </p>}
    {(attempt.participating || canJoin) && <button type="button"
      className={`${attempt.participating ? "nuj-btn-secondary" : "nuj-btn-primary"} w-full text-xs`}
      disabled={update.isPending}
      onClick={() => {
        update.reset();
        if (attempt.participating) setConfirmLeave(true);
        else update.mutate("join");
      }}>
      {update.isPending ? "Saving..." : attempt.participating ? "Opt out" : "Opt in"}
    </button>}
    {update.error && !confirmLeave && <p role="alert" className="text-xs text-destructive">{update.error.message}</p>}
    <Dialog open={confirmLeave} onOpenChange={(open) => { if (!update.isPending) setConfirmLeave(open); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Opt out of this offer?</DialogTitle>
          <DialogDescription>Your progress will reset and any unused reward for this group offer will be forfeited. You will stay in the shared group. You can opt in again with a fresh streak. Redeemed rewards remain single-use.</DialogDescription>
        </DialogHeader>
        <p className="text-sm">{attempt.groupName} · {attempt.offer.venue.name} · {attempt.offer.title}</p>
        {update.error && <p role="alert" className="text-sm text-destructive">{update.error.message}</p>}
        <button type="button" className="nuj-btn-secondary" disabled={update.isPending} onClick={() => setConfirmLeave(false)}>Cancel</button>
        <button type="button" className="nuj-btn-primary" disabled={update.isPending || !attempt.participating} onClick={() => update.mutate("leave")}>Confirm opt out</button>
      </DialogContent>
    </Dialog>
  </div>;
};
