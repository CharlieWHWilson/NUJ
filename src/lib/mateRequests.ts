import { supabase } from "./supabase";

export type MateRequest = { id: string; userId: string; name: string };
export type PreviousMate = { id: string; userId: string | null; name: string };
export type MateRequests = {
  incoming: MateRequest[];
  outgoing: MateRequest[];
  previous: PreviousMate[];
};
export type MateRequestResult = {
  status: "pending" | "incoming" | "mates";
  requestId: string | null;
  mateId: string | null;
};

export const MATES_UPDATED_EVENT = "nuj:mates-updated";

async function requestRpc<Result>(name: string, args?: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    throw new Error(error.code === "PGRST202"
      ? "Mate requests aren't available yet. Apply Supabase migration 036_mate_requests.sql."
      : error.message || "Unable to update this mate request.");
  }
  if (name !== "list_mate_requests" && typeof window !== "undefined") {
    window.dispatchEvent(new Event(MATES_UPDATED_EVENT));
  }
  return data as Result;
}

export const listMateRequests = () => requestRpc<MateRequests>("list_mate_requests");
export const sendMateRequest = (userId: string) =>
  requestRpc<MateRequestResult>("send_mate_request", { p_recipient_id: userId });
export const respondToMateRequest = (requestId: string, action: "accept" | "decline" | "cancel") =>
  requestRpc<string | null>("respond_to_mate_request", { p_request_id: requestId, p_action: action });
export const removeMateConnection = (mateId: string) =>
  requestRpc<null>("remove_mate_connection", { p_mate_id: mateId });
export const dismissPreviousMate = (mateId: string) =>
  requestRpc<null>("dismiss_previous_mate", { p_mate_id: mateId });