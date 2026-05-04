import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SlotTile } from "./SlotTile";
import type { InvMap } from "@/hooks/useInventory";

type Sticker = { id: number; code: string; nation: string };

type Group = { nation: string; stickers: Sticker[] };

function groupByNation(stickers: Sticker[]): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  for (const s of stickers) {
    if (!current || current.nation !== s.nation) {
      current = { nation: s.nation, stickers: [] };
      groups.push(current);
    }
    current.stickers.push(s);
  }
  return groups;
}

export const AlbumBook = ({
  stickers, inventory, onTap,
}: {
  stickers: Sticker[];
  inventory: InvMap;
  onTap: (id: number) => void;
}) => {
  const groups = useMemo(() => groupByNation(stickers), [stickers]);
  const totalPages = Math.max(1, groups.length);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);

  const go = (p: number) => {
    if (p < 0 || p >= totalPages) return;
    setDir(p > page ? 1 : -1);
    setPage(p);
  };

  const group = groups[page] ?? { nation: "", stickers: [] };
  const slice = group.stickers;
  const nation = group.nation;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => go(page - 1)} disabled={page === 0}
          className="p-2 rounded-full bg-secondary disabled:opacity-30">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Page {page + 1} / {totalPages}</div>
          <div className="text-base font-black">{nation}</div>
        </div>
        <button onClick={() => go(page + 1)} disabled={page === totalPages - 1}
          className="p-2 rounded-full bg-secondary disabled:opacity-30">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-card border border-border min-h-[420px] p-3">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={page}
            custom={dir}
            initial={{ x: dir * 300, opacity: 0, rotateY: dir * 25 }}
            animate={{ x: 0, opacity: 1, rotateY: 0 }}
            exit={{ x: -dir * 300, opacity: 0, rotateY: -dir * 25 }}
            transition={{ duration: 0.35 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) go(page + 1);
              else if (info.offset.x > 80) go(page - 1);
            }}
            className="grid grid-cols-4 gap-2"
          >
            {slice.map((s) => (
              <SlotTile key={s.id} id={s.id} code={s.code}
                status={inventory.get(s.id)} onClick={() => onTap(s.id)} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-1 flex-wrap px-2">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button key={i} onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all ${i === page ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
        ))}
      </div>
    </div>
  );
};
