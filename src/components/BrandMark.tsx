import bookIcon from "@/assets/study-forge-book.png.asset.json";
import { APP_NAME } from "@/lib/brand";

/** The Study Forge book mark. */
export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <img
      src={bookIcon.url}
      alt={`${APP_NAME} logo`}
      className={`shrink-0 rounded-xl object-cover ${className}`}
    />
  );
}
