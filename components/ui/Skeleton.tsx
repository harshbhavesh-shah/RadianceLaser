/** Base pulsing block for loading.tsx skeleton screens — compose these into
 * shapes that roughly match the real content (a title-sized bar, a table
 * row, a card) so navigation feels like the page is already there and
 * filling in, rather than a blank pause. */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-beige-300/60 ${className}`} />;
}
