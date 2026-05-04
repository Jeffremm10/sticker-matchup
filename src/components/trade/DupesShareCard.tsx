import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

type Sticker = { id: number; code: string; nation: string };

export function DupesShareCard({
  stickers,
  senderName,
  isMe,
}: {
  stickers: Sticker[];
  senderName: string;
  isMe: boolean;
}) {
  const grouped = stickers.reduce<Record<string, Sticker[]>>((acc, s) => {
    (acc[s.nation] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2 my-1 max-w-[85%]">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Layers className="w-3.5 h-3.5"/>
        {isMe ? "Your duplicates" : `${senderName}'s duplicates`}
        <span className="ml-auto">{stickers.length} stickers</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {Object.entries(grouped).map(([nation, stks]) => (
            <div key={nation} className="shrink-0">
              <p className="text-[9px] uppercase font-black text-muted-foreground mb-1">{nation}</p>
              <div className="flex flex-col gap-0.5">
                {stks.map((s) => (
                  <div key={s.id}
                    className="bg-secondary rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-foreground whitespace-nowrap">
                    {s.code}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
