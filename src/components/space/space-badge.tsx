import { badge } from "@/lib/doc-types";

/** The college's short-name stamp. Four-letter names get a smaller size so they never spill out. */
export function SpaceBadge({ shortName }: { shortName: string }) {
  const text = badge(shortName);
  return (
    <span className="mono" data-len={text.length} aria-hidden="true">
      {text}
    </span>
  );
}
