import React, { useRef, useState, useEffect } from "react";

// 🏠 House Plan Drawer — React component
// Features: draw walls, add doors/windows, snap-to-grid, pan, zoom, export SVG/JSON, import JSON

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
  const [gridSize, setGridSize] = useState(0.5); // meters
  const [scale, setScale] = useState(100); // pixels per meter
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const [walls, setWalls] = useState([]); // {id,x1,y1,x2,y2}
  const [openings, setOpenings] = useState([]); // {id,type,x,y,angle,length}

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef(null);

  function worldToScreen(pt) {
    return { x: pt.x * scale + pan.x, y: pt.y * scale + pan.y };
  }
  function screenToWorld(pt) {
    return { x: (pt.x - pan.x) / scale, y: (pt.y - pan.y) / scale };
  }

  function snapToGrid(pt) {
    if (!snap) return pt;
    const gx = gridSize;
    return {
      x: Math.round(pt.x / gx) * gx,
      y: Math.round(pt.y / gx) * gx,
    };
  }

  function handlePointerDown(e) {
    if (e.button !== 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = snapToGrid(screenToWorld(screen));

    if (tool === TOOL.WALL) {
      setIsDrawing(true);
      setCurrentLine({ x1: world.x, y1: world.y, x2: world.x, y2: world.y });
    } else if (tool === TOOL.SELECT) {
      const pick = pickEntity(world);
      setSelectedId(pick ? pick.id : null);
    } else if (tool === TOOL.ERASE) {
      const pick = pickEntity(world);
      if (pick) {
        if (pick.type === "wall") setWalls((w) => w.filter((i) => i.id !== pick.id));
        else setOpenings((o) => o.filter((i) => i.id !== pick.id));
      }
    } else if (tool === TOOL.DOOR || tool === TOOL.WINDOW) {
      const nearest = findNearestWall(world);
      if (nearest) {
        const { wall, proj } = nearest;
        const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
        const id = uid("op");
        setOpenings((prev) => [
          ...prev,
          { id, type: tool, x: proj.x, y: proj.y, angle, length: 0.9 },
        ]);
      }
    }
  }

  function handlePointerMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = snapToGrid(screenToWorld(screen));

    if (isDrawing && currentLine) {
      setCurrentLine((c) => ({ ...c, x2: world.x, y2: world.y }));
    }

    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.pan.x + dx, y: panStartRef.current.pan.y + dy });
    }
  }

  function handlePointerUp() {
    if (isDrawing && currentLine) {
      const dx = currentLine.x2 - currentLine.x1;
      const dy = currentLine.y2 - currentLine.y1;
      const len = Math.hypot(dx, dy);
      if (len > 0.05) {
        const newWall = { id: uid("w"), ...currentLine };
        setWalls((prev) => [...prev, newWall]);
      }
      setCurrentLine(null);
      setIsDrawing(false);
    }
    setIsPanning(false);
    panStartRef.current = null;
  }

  function pickEntity(world) {
    const PICK_DIST = 0.15;
    for (let o of openings) {
      const d = Math.hypot(world.x - o.x, world.y - o.y);
      if (d <= PICK_DIST) return { id: o.id, type: "opening", kind: o.type };
    }
    for (let w of walls) {
      const dist = pointToSegmentDistance(world, w);
      if (dist <= PICK_DIST) return { id: w.id, type: "wall" };
    }
    return null;
  }

  function pointToSegmentDistance(p, s) {
    const { x, y } = p;
    const { x1, y1, x2, y2 } = s;
    const A = x - x1,
      B = y - y1,
      C = x2 - x1,
      D = y2 - y1;
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    const dx = x - xx;
    const dy = y - yy;
    return Math.hypot(dx, dy);
  }

  function findNearestWall(pt) {
    let best = null;
    let bestd = Infinity;
    for (let w of walls) {
      const proj = projectPointToSegment(pt, w);
      const d = Math.hypot(pt.x - proj.x, pt.y - proj.y);
      if (d < bestd) {
        bestd = d;
        best = { wall: w, proj };
      }
    }
    if (best && bestd < 0.5) return best;
    return null;
  }

  function projectPointToSegment(p, s) {
    const x1 = s.x1,
      y1 = s.y1,
      x2 = s.x2,
      y2 = s.y2;
    const dx = x2 - x1,
      dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return { x: x1, y: y1 };
    const t = ((p.x - x1) * dx + (p.y - y1) * dy) / l2;
    const tt = Math.max(0, Math.min(1, t));
    return { x: x1 + tt * dx, y: y1 + tt * dy };
  }

  function exportSVG() {
    const svgEl = svgRef.current.cloneNode(true);
    const serializer = new XMLSerializer();
    const str = serializer.serializeToString(svgEl);
    const blob = new Blob([str], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "house-plan.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const obj = { walls, openings, gridSize, scale };
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "house-plan.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.walls) setWalls(data.walls);
        if (data.openings) setOpenings(data.openings);
        if (data.gridSize) setGridSize(data.gridSize);
        if (data.scale) setScale(data.scale);
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  }

  function renderGrid(width, height) {
    if (!showGrid) return null;
    const spacing = gridSize * scale;
    const lines = [];
    const leftWorld = screenToWorld({ x: 0, y: 0 });
    const rightWorld = screenToWorld({ x: width, y: height });
    const minX = Math.floor(Math.min(leftWorld.x, rightWorld.x) / gridSize) * gridSize;
    const maxX = Math.ceil(Math.max(leftWorld.x, rightWorld.x) / gridSize) * gridSize;
    const minY = Math.floor(Math.min(leftWorld.y, rightWorld.y) / gridSize) * gridSize;
    const maxY = Math.ceil(Math.max(leftWorld.y, rightWorld.y) / gridSize) * gridSize;

    for (let x = minX; x <= maxX; x += gridSize) {
      const sx = worldToScreen({ x, y: 0 }).x;
      lines.push(<line key={`vx${x}`} x1={sx} y1={0} x2={sx} y2={height} stroke="#eee" strokeWidth={1} />);
    }
    for (let y = minY; y <= maxY; y += gridSize) {
      const sy = worldToScreen({ x: 0, y }).y;
      lines.push(<line key={`hy${y}`} x1={0} y1={sy} x2={width} y2={sy} stroke="#eee" strokeWidth={1} />);
    }
    return <g>{lines}</g>;
  }

  const [viewSize, setViewSize] = useState({ w: 1200, h: 700 });
  useEffect(() => {
    function onResize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setViewSize({ w: rect.width, h: rect.height });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <h3>House Plan Drawer</h3>
        <div className="toolbar">
          {Object.values(TOOL).map((t) => (
            <button key={t} className={tool === t ? "active" : ""} onClick={() => setTool(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="controls">
          <label>Grid size (m)</label>
          <input type="number" step="0.1" value={gridSize} onChange={(e) => setGridSize(+e.target.value)} />

          <label>Scale (px/m)</label>
          <input type="number" step="10" value={scale} onChange={(e) => setScale(+e.target.value)} />

          <label>
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap
          </label>

          <label>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Show grid
          </label>

          <button onClick={exportSVG}>Export SVG</button>
          <button onClick={exportJSON}>Export JSON</button>
          <label className="import-label">
            Import JSON
            <input type="file" accept="application/json" onChange={importJSON} />
          </label>
          <button
            onClick={() => {
              if (confirm("Clear drawing?")) {
                setWalls([]);
                setOpenings([]);
              }
            }}
            className="danger"
          >
            Clear
          </button>
        </div>
      </aside>

      <main ref={containerRef} className="canvas">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewSize.w} ${viewSize.h}`}
          onMouseDown={(e) => {
            if (e.button === 1) {
              setIsPanning(true);
              panStartRef.current = { x: e.clientX, y: e.clientY, pan: { ...pan } };
            }
            handlePointerDown(e);
          }}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
        >
          <rect x={0} y={0} width={viewSize.w} height={viewSize.h} fill="#fff" />
          {renderGrid(viewSize.w, viewSize.h)}

          {/* walls */}
          <g>
            {walls.map((w) => {
              const p1 = worldToScreen({ x: w.x1, y: w.y1 });
              const p2 = worldToScreen({ x: w.x2, y: w.y2 });
              return (
                <line
                  key={w.id}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={selectedId === w.id ? "#ff6600" : "#333"}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              );
            })}
            {currentLine && (
              <line
                x1={worldToScreen({ x: currentLine.x1, y: currentLine.y1 }).x}
                y1={worldToScreen({ x: currentLine.x1, y: currentLine.y1 }).y}
                x2={worldToScreen({ x: currentLine.x2, y: currentLine.y2 }).x}
                y2={worldToScreen({ x: currentLine.x2, y: currentLine.y2 }).y}
                stroke="#0066ff"
                strokeWidth={4}
                strokeDasharray="6 4"
              />
            )}
          </g>

          {/* openings */}
          <g>
            {openings.map((o) => {
              const p = worldToScreen({ x: o.x, y: o.y });
              const angle = o.angle;
              const len = o.length * scale;
              const x2 = p.x + Math.cos(angle) * len;
              const y2 = p.y + Math.sin(angle) * len;
              return (
                <g key={o.id}>
                  <line x1={p.x} y1={p.y} x2={x2} y2={y2} stroke="#00aaff" strokeWidth={4} />
                  <text x={p.x} y={p.y - 10} fontSize={12} textAnchor="middle">
                    {o.type}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </main>
    </div>
  );
}
