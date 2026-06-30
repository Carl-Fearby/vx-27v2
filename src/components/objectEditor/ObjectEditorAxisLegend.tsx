import type { ViewportAxisLegendState } from "@/lib/objectEditor/viewportAxisLegend";

const ARM_LENGTH = 14;

type ObjectEditorAxisLegendProps = {
  legend: ViewportAxisLegendState | null;
};

function AxisArm({
  axis,
  color,
  arm,
}: {
  axis: string;
  color: string;
  arm: ViewportAxisLegendState["x"];
}) {
  const x2 = 20 + arm.dx * ARM_LENGTH;
  const y2 = 20 + arm.dy * ARM_LENGTH;
  const labelX = 20 + arm.dx * (ARM_LENGTH + 7);
  const labelY = 20 + arm.dy * (ARM_LENGTH + 7);

  return (
    <>
      <line
        x1={20}
        y1={20}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <text
        x={labelX}
        y={labelY}
        fill={color}
        fontSize={8}
        fontWeight={800}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {axis}
      </text>
    </>
  );
}

export default function ObjectEditorAxisLegend({
  legend,
}: ObjectEditorAxisLegendProps) {
  if (!legend) {
    return null;
  }

  return (
    <div
      className="object-editor-axis-legend"
      aria-label="World axis orientation"
    >
      <svg
        className="object-editor-axis-legend-svg"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <circle cx={20} cy={20} r={18} className="object-editor-axis-legend-bg" />
        <AxisArm axis="X" color="#f25252" arm={legend.x} />
        <AxisArm axis="Y" color="#57e67a" arm={legend.y} />
        <AxisArm axis="Z" color="#5294ff" arm={legend.z} />
      </svg>
    </div>
  );
}
