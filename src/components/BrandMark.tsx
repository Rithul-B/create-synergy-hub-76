import bookIcon from "@/assets/book-icon.png";
import { APP_NAME } from "@/lib/brand";

/** The Study Forge book mark. */
export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <img
      src={bookIcon}
      alt={`${APP_NAME} logo`}
      className={`shrink-0 rounded-xl object-cover ${className}`}
    />
  );
}
