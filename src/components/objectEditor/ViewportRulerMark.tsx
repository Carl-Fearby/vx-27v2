import type { ViewportRulerTick } from "@/lib/objectEditor/viewportRuler";

type ViewportRulerMarkProps = {
  tick: ViewportRulerTick;
  axis: "horizontal" | "vertical";
};

export default function ViewportRulerMark({ tick, axis }: ViewportRulerMarkProps) {
  return (
    <span
      className={[
        "object-editor-viewport-ruler-mark",
        tick.major ? "object-editor-viewport-ruler-mark--major" : "",
        tick.label ? "object-editor-viewport-ruler-mark--labeled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        axis === "horizontal"
          ? { left: `${tick.position}px` }
          : { top: `${tick.position}px` }
      }
    >
      {tick.label ? (
        <span
          className={[
            "object-editor-viewport-ruler-mark-label",
            tick.isOrigin ? "object-editor-viewport-ruler-mark-label--origin" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {tick.label}
        </span>
      ) : null}
      <span className="object-editor-viewport-ruler-mark-line" aria-hidden="true" />
    </span>
  );
}
