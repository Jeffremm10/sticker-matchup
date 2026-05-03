import { NATION_MAP } from "@/lib/nations";
import { cn } from "@/lib/utils";

type Status = "none" | "need" | "duplicate";

interface Props {
  code: string;
  nation: string;
  status?: Status;
  onClick?: () => void;
  size?: "sm" | "md";
  blurred?: boolean;
}

const palette: Record<string, string> = {
  badge: "from-secondary to-primary",
  team: "from-primary to-primary-glow",
  player: "from-primary-glow to-primary",
  legend: "from-accent to-secondary",
  stadium: "from-secondary to-primary-glow",
  trophy: "from-accent to-primary",
};

export const StickerCard = ({ code, nation, status = "none", onClick, size = "md", blurred }: Props) => {
  const [, num] = code.split(" ");
  const flag = NATION_MAP[nation]?.flag ?? "⚽";
  const ring =
    status === "need" ? "ring-4 ring-need" :
    status === "duplicate" ? "ring-4 ring-duplicate" : "ring-1 ring-border";

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-md transition-transform active:scale-95",
        ring,
        size === "sm" ? "text-xs" : "text-sm"
      )}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1">
        <div className={size === "sm" ? "text-lg" : "text-2xl"}>{flag}</div>
        <div className={cn("font-black tracking-tight", size === "sm" ? "text-base" : "text-xl")}>
          {nation}
        </div>
        <div className={cn("font-mono font-bold", size === "sm" ? "text-xs" : "text-sm", blurred && "blur-sm")}>
          {num ?? "00"}
        </div>
      </div>
      {status === "need" && (
        <span className="absolute top-1 right-1 text-[10px] font-bold bg-need text-white px-1.5 py-0.5 rounded">NEED</span>
      )}
      {status === "duplicate" && (
        <span className="absolute top-1 right-1 text-[10px] font-bold bg-duplicate text-white px-1.5 py-0.5 rounded">DUP</span>
      )}
    </button>
  );
};