/** Skeleton for space pages: the shape of the ask screen, so nothing jumps when content arrives. */
export default function Loading() {
  return (
    <div className="wrap skeleton-page" aria-busy="true" aria-label="Loading">
      <div className="skel skel-title" />
      <div className="skel skel-line" />
      <div className="skel skel-line short" />
      <div className="skel skel-card" />
      <div className="skel skel-card" />
    </div>
  );
}
