import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, Delete, X, Plus, Copy, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { NATIONS } from "@/lib/nations";
import type { InvMap, InvStatus } from "@/hooks/useInventory";

type Sticker = { id: number; code: string; nation: string };

export const QuickEntryKeypad = ({
  stickers, inventory, onSet,
}: {
  stickers: Sticker[];
  inventory: InvMap;
  onSet: (id: number, status: InvStatus) => void;
  max?: number;
}) => {
  const [open, setOpen] = useState(false);
  const [nation, setNation] = useState<string | null>(null);
  const [val, setVal] = useState("");

  // Stickers for the selected nation, sorted by code
  const nationStickers = useMemo(
    () => nation ? stickers.filter((s) => s.nation === nation) : [],
    [stickers, nation],
  );

  // Max slot for selected nation
  const maxSlot = nationStickers.length;

  // Resolve sticker from current val
  const slotNum = parseInt(val || "0", 10);
  const paddedCode = nation ? `${nation} ${String(slotNum).padStart(2, "0")}` : "";
  const found = nation && slotNum > 0 ? stickers.find((s) => s.code === paddedCode) : undefined;
  const cur = found ? inventory.get(found.id) : undefined;

  const press = (d: string) => {
    setVal((v) => (v + d).replace(/^0+/, "").slice(0, 3));
  };
  const back = () => setVal((v) => v.slice(0, -1));

  const submit = (status: InvStatus) => {
    if (!found) {
      toast.error(maxSlot > 0 ? `${nation} only has slots 1–${maxSlot}` : "Pick a valid sticker");
      return;
    }
    onSet(found.id, status);
    toast.success(`${found.code} → ${status}`);
    setVal("");
  };

  const close = () => { setOpen(false); setNation(null); setVal(""); };
  const backToNation = () => { setNation(null); setVal(""); };

  // Nation appearance order: regular nations alphabetically, then specials
  const regularNations = NATIONS.filter((n) => !["LEG", "STA", "TRO"].includes(n.code));
  const specialNations = NATIONS.filter((n) => ["LEG", "STA", "TRO"].includes(n.code));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 flex items-center justify-center active:scale-95 transition-transform">
        <Keyboard className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end"
            onClick={close}>
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-auto bg-card border-t border-border rounded-t-3xl p-5 space-y-4">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {nation && (
                    <button onClick={backToNation} className="p-1 rounded-full hover:bg-secondary">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <h3 className="text-base font-black">
                    {nation
                      ? `${NATIONS.find(n => n.code === nation)?.flag} ${NATIONS.find(n => n.code === nation)?.name}`
                      : "Quick Entry — Pick country"}
                  </h3>
                </div>
                <button onClick={close} className="p-1 rounded-full hover:bg-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nation picker */}
              {!nation && (
                <div className="max-h-72 overflow-y-auto space-y-1">
                  <div className="grid grid-cols-4 gap-1.5">
                    {regularNations.map((n) => {
                      const count = stickers.filter(s => s.nation === n.code).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={n.code}
                          onClick={() => setNation(n.code)}
                          className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary p-2 active:bg-muted text-center">
                          <span className="text-2xl leading-none">{n.flag}</span>
                          <span className="text-[10px] font-bold leading-none mt-1">{n.code}</span>
                        </button>
                      );
                    })}
                  </div>
                  {specialNations.some(n => stickers.some(s => s.nation === n.code)) && (
                    <>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide pt-1 px-1">Special</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {specialNations.map((n) => {
                          const count = stickers.filter(s => s.nation === n.code).length;
                          if (count === 0) return null;
                          return (
                            <button
                              key={n.code}
                              onClick={() => setNation(n.code)}
                              className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary p-2 active:bg-muted text-center">
                              <span className="text-2xl leading-none">{n.flag}</span>
                              <span className="text-[10px] font-bold leading-none mt-1">{n.code}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Number keypad */}
              {nation && (
                <>
                  <div className="rounded-xl bg-secondary p-4 text-center">
                    <div className="font-mono text-4xl font-black tracking-wider">
                      {val
                        ? <span>{nation} {val.padStart(2, "0")}</span>
                        : <span className="text-muted-foreground">— —</span>}
                    </div>
                    <div className="text-xs mt-1 h-4">
                      {val && (found
                        ? <span className={
                            cur === "owned" ? "text-primary"
                            : cur === "duplicate" ? "text-accent"
                            : "text-muted-foreground"
                          }>
                            {found.code}{cur ? ` · ${cur}` : " · not marked"}
                          </span>
                        : <span className="text-destructive">
                            {slotNum > maxSlot ? `Max slot is ${maxSlot}` : "Not found"}
                          </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {["1","2","3","4","5","6","7","8","9"].map((d) => (
                      <button key={d} onClick={() => press(d)}
                        className="h-14 rounded-xl bg-secondary text-2xl font-bold active:bg-muted">{d}</button>
                    ))}
                    <button onClick={back}
                      className="h-14 rounded-xl bg-secondary flex items-center justify-center active:bg-muted">
                      <Delete className="w-5 h-5" />
                    </button>
                    <button onClick={() => press("0")}
                      className="h-14 rounded-xl bg-secondary text-2xl font-bold active:bg-muted">0</button>
                    <button onClick={() => setVal("")}
                      className="h-14 rounded-xl bg-secondary text-sm font-bold active:bg-muted">CLR</button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => submit("owned")} className="h-12 bg-primary text-primary-foreground">
                      <Plus className="w-4 h-4" /> Owned
                    </Button>
                    <Button onClick={() => submit("duplicate")} className="h-12 bg-accent text-accent-foreground hover:bg-accent/90">
                      <Copy className="w-4 h-4" /> Duplicate
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
