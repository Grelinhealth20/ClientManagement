// Hairline brackets at the panel corners — reads as instrumentation, not chrome.
const CORNERS = [
  "left-3 top-5 border-l border-t rounded-tl-md",
  "right-3 top-5 border-r border-t rounded-tr-md",
  "bottom-3 left-3 border-b border-l rounded-bl-md",
  "bottom-3 right-3 border-b border-r rounded-br-md",
];

export default function CornerTicks() {
  return (
    <>
      {CORNERS.map((corner) => (
        <span
          key={corner}
          aria-hidden="true"
          className={`pointer-events-none absolute h-4 w-4 border-copper/35 ${corner}`}
        />
      ))}
    </>
  );
}
