import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Check, X, Lock } from "lucide-react";
import { toast } from "sonner";

type Proposal = {
  id: string; match_id: string; proposer_id: string;
  give_ids: number[]; receive_ids: number[];
  status: "pending" | "accepted" | "locked" | "declined";
};

type Sticker = { id: number; code: string };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:  { label: "Awaiting reply", className: "bg-amber-500 text-white" },
  accepted: { label: "Accepted",       className: "bg-green-600 text-white" },
  locked:   { label: "Locked ✓",       className: "bg-primary text-primary-foreground" },
  declined: { label: "Declined",       className: "bg-destructive text-white" },
};

export function TradeProposalCard({
  proposal, isProposer, stickerMap, matchId,
}: {
  proposal: Proposal;
  isProposer: boolean;
  stickerMap: Map<number, Sticker>;
  matchId: string;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const badge = STATUS_BADGE[proposal.status];

  const updateStatus = async (status: "accepted" | "locked" | "declined") => {
    setBusy(true);
    const { error } = await supabase
      .from("trade_proposals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", proposal.id);
    if (error) { toast.error(error.message); setBusy(false); return; }

    if (status === "locked") {
      // create swap session with random 6-digit PIN
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      await supabase.from("swap_sessions").insert({ trade_id: proposal.id, pin });
    }

    qc.invalidateQueries({ queryKey: ["trade_proposals", matchId] });
    qc.invalidateQueries({ queryKey: ["swap_session", proposal.id] });
    setBusy(false);
  };

  const giveStickers = proposal.give_ids.map((id) => stickerMap.get(id)).filter(Boolean) as Sticker[];
  const receiveStickers = proposal.receive_ids.map((id) => stickerMap.get(id)).filter(Boolean) as Sticker[];

  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-3 my-1 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <ArrowLeftRight className="w-4 h-4 text-primary"/>
          Trade Proposal
        </div>
        <Badge className={`text-[10px] px-2 ${badge.className}`}>{badge.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
            {isProposer ? "You give" : "They give"}
          </p>
          <div className="flex flex-wrap gap-1">
            {giveStickers.slice(0, 12).map((s) => (
              <span key={s.id} className="text-[10px] bg-give/20 text-give-foreground rounded px-1 py-0.5 font-mono font-bold">
                {s.code}
              </span>
            ))}
            {giveStickers.length > 12 && (
              <span className="text-[10px] text-muted-foreground">+{giveStickers.length - 12}</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
            {isProposer ? "You get" : "They want"}
          </p>
          <div className="flex flex-wrap gap-1">
            {receiveStickers.slice(0, 12).map((s) => (
              <span key={s.id} className="text-[10px] bg-get/20 text-get-foreground rounded px-1 py-0.5 font-mono font-bold">
                {s.code}
              </span>
            ))}
            {receiveStickers.length > 12 && (
              <span className="text-[10px] text-muted-foreground">+{receiveStickers.length - 12}</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions for the receiver when pending */}
      {!isProposer && proposal.status === "pending" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive"
            onClick={() => updateStatus("declined")} disabled={busy}>
            <X className="w-3 h-3 mr-1"/> Decline
          </Button>
          <Button size="sm" className="flex-1" onClick={() => updateStatus("accepted")} disabled={busy}>
            <Check className="w-3 h-3 mr-1"/> Accept
          </Button>
        </div>
      )}

      {/* Proposer locks after receiver accepts */}
      {isProposer && proposal.status === "accepted" && (
        <Button size="sm" className="w-full bg-primary" onClick={() => updateStatus("locked")} disabled={busy}>
          <Lock className="w-3 h-3 mr-1"/> Lock Trade — Pick Meetup
        </Button>
      )}
    </div>
  );
}
