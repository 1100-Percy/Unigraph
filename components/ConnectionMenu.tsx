import React from "react";
import { EDGE_TYPES, EdgeTypeKey } from "@/lib/edge-types";

interface ConnectionMenuProps {
  position: { x: number; y: number };
  onSelect: (type: EdgeTypeKey) => void;
  onClose: () => void;
}

export default function ConnectionMenu({
  position,
  onSelect,
  onClose,
}: ConnectionMenuProps) {
  return (
    <>
      {/* Overlay to close menu when clicking outside */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      <div
        className="fixed z-50 flex flex-col gap-1 rounded-md border bg-white p-1 shadow-md"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        {Object.entries(EDGE_TYPES).map(([key, config]) => (
          <button
            key={key}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-100 text-left"
            onClick={() => onSelect(key as EdgeTypeKey)}
          >
            <div
              className="h-4 w-8 border-b"
              style={{
                borderColor: config.style.stroke,
                borderStyle: config.style.strokeDasharray ? "dashed" : "solid",
                borderWidth: config.style.strokeWidth || 1,
              }}
            />
            <span>{config.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
