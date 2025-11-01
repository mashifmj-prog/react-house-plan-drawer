import React, { useRef, useState, useEffect } from "react";
import { saveAs } from 'file-saver';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TOOL = {
  SELECT: "select",
  WALL: "wall",
  DOOR: "door",
  WINDOW: "window",
  ERASE: "erase",
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function HousePlanDrawer() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState(TOOL.WALL);
  const [gridSize, setGridSize] = useState(0.5);
  const [scale, setScale] = useState(100);
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const [walls, setWalls] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [multiSegmentStart, setMultiSegmentStart] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef(null);

  function worldToScreen(pt) {
    return { x: pt.x * scale + pan.x, y: pt.y * scale + pan.y };
  }
  function screenToWorld(pt) {
    return { x: (pt.x - pan.x) / scale, y: (pt.y - pan.y) / scale };
  }

  function exportSVG() {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    saveAs(blob, "house_plan.svg");
  }

  return (
    <div className="flex h-full w-full gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
      <aside className="w-64 p-3 bg-white border-r shadow-sm">
        <Card className="p-2">
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">House Plan Drawer</h3>
            <div className="flex flex-col gap-2">
              {Object.values(TOOL).map((t) => (
                <Button key={t} variant={tool === t ? "default" : "outline"} onClick={() => setTool(t)}>
                  {t}
                </Button>
              ))}
              <Button className="mt-2 bg-green-600 text-white" onClick={exportSVG}>Export SVG</Button>
            </div>
          </CardContent>
        </Card>
      </aside>
      <main ref={containerRef} className="flex-1 relative bg-gray-100">
        <svg ref={svgRef} width="100%" height="100%" style={{ touchAction: 'none', userSelect: 'none' }}>
          {/* Render grid, walls, rooms, openings */}
        </svg>
      </main>
    </div>
  );
}
