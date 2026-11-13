import { useMutation, useQueryClient } from "@tanstack/react-query";
import { canOptIntoMeetupAttempt, hasMeetupOfferEnded, joinMeetupAttempt, type MeetupAttempt } from "@/lib/meetups";

export const MeetupParticipation = ({ attempt, userId }: { attempt: MeetupAttempt; userId: string }) => {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: () => joinMeetupAttempt(attempt.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meetup-attempts", userId] });
    },
  });
  const canJoin = canOptIntoMeetupAttempt(attempt, userId);
  return <div className="relative z-10 space-y-2">
    {!attempt.participating && <p className="text-xs text-muted-foreground">
      {hasMeetupOfferEnded(attempt.offer) ? "Offer ended. You can no longer opt in." : canJoin ? "Not opted in yet. Opt in to start counting your check-ins." : "This offer is limited to the group's starting members. You can't join this offer."}
    </p>}
    {!attempt.participating && canJoin && <button type="button"
      className="nuj-btn-primary w-full text-xs"
      disabled={update.isPending}
      onClick={() => {
        update.reset();
        update.mutate();
      }}>
      {update.isPending ? "Saving..." : "Opt in"}
    </button>}
    {update.error && <p role="alert" className="text-xs text-destructive">{update.error.message}</p>}
  </div>;
};
