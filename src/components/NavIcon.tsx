import type { LucideIcon } from "lucide-react";
import { navIconClass } from "@/lib/nav-colors";

export function NavIcon({
  icon: Icon,
  to,
  active,
  size = "h-4 w-4",
}: {
  icon: LucideIcon;
  to: string;
  active: boolean;
  size?: string;
}) {
  const { wrap, icon } = navIconClass(to, active, size);
  return (
    <span className={`inline-flex items-center justify-center rounded-md p-1 ${wrap}`}>
      <Icon className={icon} />
    </span>
  );
}
