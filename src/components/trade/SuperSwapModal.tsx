import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const SUGGESTIONS = [
  "Hey! I have stickers you need — want to swap? ⚡",
  "I checked your profile, we're a great match! Let's trade 🤝",
  "I have duplicates that complete your album!",
  "You have exactly what I need — let's meet up!",
  "Quick swap? I'm nearby and ready 📍",
  "I've been looking for your dupes — interested?",
  "Let's skip the queue and swap directly!",
  "I have 5+ stickers you're missing 👀",
];

export function SuperSwapModal({
  open, onOpenChange, receiverId, receiverName,
}: { open: boolean; onOpenChange: (o: boolean) => void; receiverId: string; receiverName: string; }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();

  const send = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("send_super_swap" as any, {
      _receiver: receiverId, _body: selected,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message === "no_super_swaps" ? "No Super Swaps left" : error.message);
      return;
    }
    toast.success("Super Swap sent ⚡");
    setSelected(null);
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["profile", user?.id] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setSelected(null); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" /> Super Swap {receiverName}
          </DialogTitle>
          <DialogDescription>
            Pick a message — it goes straight to them, no match required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1">
          {SUGGESTIONS.map((msg) => (
            <button
              key={msg}
              onClick={() => setSelected(msg)}
              className={`text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                selected === msg
                  ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                  : "border-border bg-muted hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {msg}
            </button>
          ))}
        </div>

        <Button
          onClick={send}
          disabled={busy || !selected}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-black"
        >
          {busy ? "Sending…" : "Send Super Swap ⚡"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
