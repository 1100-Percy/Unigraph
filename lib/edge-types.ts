import { MarkerType } from "reactflow";
import { CSSProperties } from "react";

// Extend CSSProperties to include SVG specific attributes that might be missing
export interface EdgeStyle extends CSSProperties {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

export interface EdgeTypeConfig {
  label: string;
  style: EdgeStyle;
  markerEnd?: {
    type: MarkerType;
    color?: string;
  };
}

export const EDGE_TYPES: Record<string, EdgeTypeConfig> = {
  PREREQUISITE: {
    label: "Prerequisite (前置)",
    style: { stroke: "black" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "black" },
  },
  COMPLEMENTARY: {
    label: "Complementary (补充)",
    style: { stroke: "#888", strokeDasharray: "5,5" },
    markerEnd: undefined,
  },
  CONSTRAINT: {
    label: "Constraint (约束)",
    style: { stroke: "#ef4444" }, // red-500
    markerEnd: undefined,
  },
  EVOLUTIONARY: {
    label: "Evolutionary (演化)",
    style: { stroke: "#2563eb", strokeWidth: 3 }, // blue-600
    markerEnd: { type: MarkerType.ArrowClosed, color: "#2563eb" },
  },
};

export type EdgeTypeKey = keyof typeof EDGE_TYPES;
