import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

type Sticker = { id: number; code: string; nation: string };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  stickers: Sticker[];         // available pool
  selected: number[];
  onConfirm: (ids: number[]) => void;
};

export function StickerPicker({ open, onOpenChange, title, stickers, selected: initial, onConfirm }: Props) {
  const [picked, setPicked] = useState<Set<number>>(new Set(initial));

  const toggle = (id: number) =>
    setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const grouped = stickers.reduce<Record<string, Sticker[]>>((acc, s) => {
    (acc[s.nation] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <p className="text-xs text-muted-foreground text-left">{picked.size} selected</p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {Object.entries(grouped).map(([nation, stks]) => (
            <div key={nation}>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-1.5 px-1">{nation}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {stks.map((s) => {
                  const sel = picked.has(s.id);
                  return (
                    <button key={s.id} onClick={() => toggle(s.id)}
                      className={`relative rounded-lg p-2 text-xs font-bold border transition-all ${
                        sel ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground"
                      }`}>
                      {sel && <Check className="absolute top-0.5 right-0.5 w-3 h-3"/>}
                      {s.code}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="pt-3 border-t border-border">
          <Button className="w-full" onClick={() => { onConfirm(Array.from(picked)); onOpenChange(false); }}
            disabled={picked.size === 0}>
            Confirm {picked.size} sticker{picked.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
