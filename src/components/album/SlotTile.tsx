import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { InvStatus } from "@/hooks/useInventory";

interface Props {
  id: number;
  code: string;
  status?: InvStatus;
  onClick?: () => void;
  size?: "sm" | "md";
}

export const SlotTile = ({ id, code, status, onClick, size = "md" }: Props) => {
  const owned = status === "owned";
  const dup = status === "duplicate";
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      animate={{
        boxShadow: owned ? "0 0 18px hsl(var(--owned) / 0.7)"
          : dup ? "0 0 18px hsl(var(--duplicate) / 0.7)"
          : "0 0 0 hsl(0 0% 0% / 0)",
      }}
      transition={{ duration: 0.18 }}
      className={cn(
        "relative aspect-[3/4] rounded-lg overflow-hidden border text-foreground transition-colors",
        size === "sm" ? "text-[10px]" : "text-xs",
        owned
          ? "bg-primary/15 border-primary"
          : dup
          ? "bg-accent/15 border-accent"
          : "bg-secondary border-border"
      )}
      aria-label={`Sticker ${code}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
        <div className={cn("font-black", size === "sm" ? "text-[10px]" : "text-sm")}>
          {code.split(" ")[0]}
        </div>
        <div className={cn("font-bold", size === "sm" ? "text-xs" : "text-base")}>
          {code.split(" ")[1]}
        </div>
      </div>
      {dup && (
        <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">
          +
        </span>
      )}
    </motion.button>
  );
};
