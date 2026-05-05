import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export function SuperSwapModal({
  open, onOpenChange, receiverId, receiverName,
}: { open: boolean; onOpenChange: (o: boolean) => void; receiverId: string; receiverName: string; }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("send_super_swap" as any, {
      _receiver: receiverId, _body: body.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message === "no_super_swaps" ? "No Super Swaps left" : error.message);
      return;
    }
    toast.success("Super Swap sent ⚡");
    setBody("");
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["profile", user?.id] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" /> Super Swap {receiverName}
          </DialogTitle>
          <DialogDescription>
            Send a direct message — no match required. They'll get a high-priority notification.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={body} onChange={(e) => setBody(e.target.value)} maxLength={280} rows={4}
          placeholder={`Hey ${receiverName}, I have your missing #042 and I need…`}
        />
        <div className="text-xs text-muted-foreground text-right">{body.length}/280</div>
        <Button onClick={send} disabled={busy || !body.trim()} className="w-full">
          {busy ? "Sending…" : "Send Super Swap"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}