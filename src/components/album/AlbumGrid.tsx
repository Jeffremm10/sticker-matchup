import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SlotTile } from "./SlotTile";
import type { InvMap } from "@/hooks/useInventory";

type Sticker = { id: number; code: string; nation: string };

export const AlbumGrid = ({
  stickers, inventory, onTap,
}: {
  stickers: Sticker[];
  inventory: InvMap;
  onTap: (id: number) => void;
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const COLS = 6;
  const rows = Math.ceil(stickers.length / COLS);
  const virt = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-220px)] overflow-y-auto rounded-2xl bg-card border border-border p-2">
      <div style={{ height: virt.getTotalSize(), position: "relative", width: "100%" }}>
        {virt.getVirtualItems().map((row) => {
          const slice = stickers.slice(row.index * COLS, (row.index + 1) * COLS);
          return (
            <div key={row.key}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start}px)`, height: row.size }}
              className="grid grid-cols-6 gap-1.5 px-1 py-1">
              {slice.map((s) => (
                <SlotTile key={s.id} id={s.id} code={s.code} size="sm"
                  status={inventory.get(s.id)} onClick={() => onTap(s.id)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
