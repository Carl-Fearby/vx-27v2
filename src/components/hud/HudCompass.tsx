"use client";

import { useMemo, type RefObject } from "react";

const CARDINALS: Record<number, string> = {
  0: "N",
  45: "NE",
  90: "E",
  135: "SE",
  180: "S",
  225: "SW",
  270: "W",
  315: "NW",
};

function labelForDegree(deg: number): string | null {
  const d = ((deg % 360) + 360) % 360;
  if (CARDINALS[d]) {
    return CARDINALS[d];
  }
  if (d % 15 === 0) {
    return String(d);
  }
  return null;
}

function buildCompassMarks(minDeg = -360, maxDeg = 720, step = 5) {
  const marks = [];
  for (let deg = minDeg; deg <= maxDeg; deg += step) {
    const norm = ((deg % 360) + 360) % 360;
    const isMajor = norm % 15 === 0;
    marks.push({
      deg,
      isMajor,
      label: isMajor ? labelForDegree(norm) : null,
      isCardinal: isMajor && CARDINALS[norm] != null,
    });
  }
  return marks;
}

const COMPASS_MARKS = buildCompassMarks();

type HudCompassProps = {
  tapeRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  markersRef?: RefObject<HTMLDivElement | null>;
  blipsRef?: RefObject<HTMLDivElement | null>;
};

export default function HudCompass({
  tapeRef,
  viewportRef,
  markersRef,
  blipsRef,
}: HudCompassProps) {
  const marks = useMemo(() => COMPASS_MARKS, []);

  return (
    <div className="hud-compass" role="img" aria-label="Compass heading">
      <div className="hud-compass__frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ui/compass-background.webp"
          alt=""
          className="hud-compass__bg"
          draggable={false}
        />
        <div ref={viewportRef} className="hud-compass__viewport">
          <div ref={tapeRef} className="hud-compass__tape">
            {marks.map(({ deg, isMajor, label, isCardinal }) => (
              <div
                key={deg}
                className={[
                  "hud-compass__tick",
                  isMajor ? "hud-compass__tick--major" : "",
                  isCardinal ? "hud-compass__tick--cardinal" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ left: `calc(var(--compass-px-per-deg, 3px) * ${deg})` }}
              >
                <span className="hud-compass__tick-line" aria-hidden="true" />
                {label ? (
                  <span
                    className={[
                      "hud-compass__tick-label",
                      isCardinal ? "hud-compass__tick-label--cardinal" : "",
                      label === "N" ? "hud-compass__tick-label--north" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {label}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div
            ref={blipsRef}
            className="hud-compass__blips"
            aria-hidden="true"
          />
          <div
            ref={markersRef}
            className="hud-compass__markers"
            aria-hidden="true"
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ui/compass-pin.webp"
          alt=""
          className="hud-compass__pin"
          draggable={false}
        />
      </div>
    </div>
  );
}
