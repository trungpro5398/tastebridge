import { initials, inkOn } from "@/lib/members";

export default function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-11 text-sm" : "size-8 text-xs";
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${dims}`}
      style={{ background: color, color: color.startsWith("#") ? inkOn(color) : "#fff" }}
    >
      {initials(name)}
    </span>
  );
}
