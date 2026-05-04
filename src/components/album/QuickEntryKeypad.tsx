import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, Delete, X, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { InvMap, InvStatus } from "@/hooks/useInventory";

type Sticker = { id: number; code: string };

export const QuickEntryKeypad = ({
  stickers, inventory, onSet, max,
}: {
  stickers: Sticker[];
  inventory: InvMap;
  onSet: (id: number, status: InvStatus) => void;
  max: number;
}) => {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const id = parseInt(val || "0", 10);
  const found = stickers.find((s) => s.id === id);
  const cur = found ? inventory.get(found.id) : undefined;

  const press = (d: string) => {
    setVal((v) => (v + d).replace(/^0+/, "").slice(0, 4));
  };
  const back = () => setVal((v) => v.slice(0, -1));

  const submit = (status: InvStatus) => {
    if (!found) { toast.error(`#${val} not in album (1-${max})`); return; }
    onSet(found.id, status);
    toast.success(`${found.code} → ${status}`);
    setVal("");
  };

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
            onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-auto bg-card border-t border-border rounded-t-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black">Quick Entry</h3>
                <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl bg-secondary p-4 text-center">
                <div className="font-mono text-4xl font-black tracking-wider">
                  {val || <span className="text-muted-foreground">—</span>}
                </div>
                <div className="text-xs mt-1 h-4">
                  {val && (found
                    ? <span className={cur === "owned" ? "text-primary" : cur === "duplicate" ? "text-accent" : "text-muted-foreground"}>
                        {found.code}{cur ? ` · ${cur}` : ""}
                      </span>
                    : <span className="text-destructive">Not in album</span>)}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
