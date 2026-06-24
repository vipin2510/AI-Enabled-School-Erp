"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  type Block,
  type Box,
  type Layout,
  type PageSize,
  type TextStyle,
  type VarPath,
  VAR_PATHS,
  IMAGE_SOURCES,
  type ImageSource,
  newBlockId,
  renderText,
  PAGE_DIMS,
} from "@/lib/result-template";
import { saveLayout } from "../../actions";

// ── Sample data the editor preview substitutes for variable bindings.
// (Real bindings are resolved at PDF render time from the API route.)
const SAMPLE = {
  school: {
    name: "Your School",
    city: "Kondagaon",
    code: "CG024",
    affiliation: "Affiliated to CISCE",
    address: "Kondagaon, Dist- Kondagaon (C.G)",
    mobile: "+91 XXXXX XXXXX",
    email: "school@example.com",
    logoDataUrl: "/letterhead/aps-logo.jpeg",
  },
  session: { academic_year: "2026-27", term_label: "Term 1" },
  student: {
    full_name: "Sample Student",
    admission_no: "1067",
    class: "X",
    section: "A",
    father_name: "Father's Name",
    mother_name: "Mother's Name",
    dob: "29-04-2012",
    contact_number: "+91 XXXXX XXXXX",
  },
  result: { total: 403, max: 500, percent: 80.6, grade: "A", status: "PASS" as const },
  marksGrid: {
    subjects: [
      { name: "English", cells: {} },
      { name: "Mathematics", cells: {} },
      { name: "Science", cells: {} },
    ],
    coCurricular: [],
  },
};

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Helvetica",
  fontSize: 10,
  fontWeight: 400,
  color: "#1c1917",
  align: "left",
  underline: false,
  italic: false,
  backgroundColor: null,
  paddingX: 0,
  paddingY: 0,
};

type TemplateProp = {
  id: string;
  name: string;
  description: string | null;
  page_size: PageSize;
  is_default: boolean;
  layout: Layout;
};

export default function TemplateEditor({ template }: { template: TemplateProp }) {
  const [name, setName] = useState(template.name);
  const [pageSize, setPageSize] = useState<PageSize>(template.page_size);
  const [layout, setLayout] = useState<Layout>(template.layout);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => (selectedId ? layout.find((b) => b.id === selectedId) ?? null : null),
    [selectedId, layout]
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<Block>) => {
      setLayout((cur) =>
        cur.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))
      );
    },
    []
  );

  const addBlock = (kind: Block["type"]) => {
    const id = newBlockId();
    const baseBox: Box = { x: 10, y: 10, w: 30, h: 8 };
    let block: Block;
    switch (kind) {
      case "text":
        block = {
          id,
          type: "text",
          box: baseBox,
          text: "New text",
          bind: null,
          style: { ...DEFAULT_TEXT_STYLE },
        };
        break;
      case "image":
        block = {
          id,
          type: "image",
          box: { ...baseBox, h: 12 },
          source: "school.logo",
          customUrl: null,
          fit: "contain",
          opacity: 1,
        };
        break;
      case "line":
        block = {
          id,
          type: "line",
          box: { ...baseBox, h: 0.3 },
          color: "#1c1917",
          thickness: 1,
        };
        break;
      case "signature":
        block = {
          id,
          type: "signature",
          box: { ...baseBox, h: 6 },
          label: "Signature",
          style: { ...DEFAULT_TEXT_STYLE, align: "center" },
        };
        break;
      case "table.marks":
        block = {
          id,
          type: "table.marks",
          box: { x: 6, y: 30, w: 88, h: 30 },
          columns: [
            { id: newBlockId(), examKey: "TERM_1", cell: "exam.marks", label: "Marks", widthPct: 12 },
            { id: newBlockId(), examKey: "TERM_1", cell: "exam.grade", label: "Grade", widthPct: 10 },
            { id: newBlockId(), examKey: "__total__", cell: "total.percent", label: "%", widthPct: 10 },
          ],
          subjectColumnWidthPct: 28,
          headerStyle: { ...DEFAULT_TEXT_STYLE, fontWeight: 700, align: "center", backgroundColor: "#f5f5f4" },
          bodyStyle: { ...DEFAULT_TEXT_STYLE, align: "center" },
          borderColor: "#d6d3d1",
          zebra: true,
        };
        break;
      case "table.cocurricular":
        block = {
          id,
          type: "table.cocurricular",
          box: { x: 6, y: 64, w: 88, h: 14 },
          headerStyle: { ...DEFAULT_TEXT_STYLE, fontWeight: 700, align: "center", backgroundColor: "#f5f5f4" },
          bodyStyle: { ...DEFAULT_TEXT_STYLE, align: "center" },
          borderColor: "#d6d3d1",
        };
        break;
      case "table.summary":
        block = {
          id,
          type: "table.summary",
          box: { x: 6, y: 80, w: 88, h: 8 },
          rows: ["total", "percent", "grade", "status"],
          style: { ...DEFAULT_TEXT_STYLE, fontWeight: 700, align: "center" },
          borderColor: "#d6d3d1",
        };
        break;
    }
    setLayout((c) => [...c, block]);
    setSelectedId(id);
  };

  const removeBlock = (id: string) => {
    setLayout((c) => c.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Drag + resize. Pointer events normalize mouse + touch.
  // `op` records the gesture in-progress; on pointermove we mutate the
  // selected block's box; on pointerup we release.
  type Op =
    | { kind: "drag"; id: string; startBox: Box; pointerX: number; pointerY: number }
    | {
        kind: "resize";
        id: string;
        startBox: Box;
        pointerX: number;
        pointerY: number;
        handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
      };
  const opRef = useRef<Op | null>(null);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const op = opRef.current;
    if (!op) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dxPct = ((e.clientX - op.pointerX) / rect.width) * 100;
    const dyPct = ((e.clientY - op.pointerY) / rect.height) * 100;
    if (op.kind === "drag") {
      const nx = clamp(op.startBox.x + dxPct, 0, 100 - op.startBox.w);
      const ny = clamp(op.startBox.y + dyPct, 0, 100 - op.startBox.h);
      updateBlock(op.id, { box: { ...op.startBox, x: nx, y: ny } } as Partial<Block>);
    } else {
      const { startBox, handle } = op;
      let nx = startBox.x, ny = startBox.y, nw = startBox.w, nh = startBox.h;
      if (handle.includes("e")) nw = clamp(startBox.w + dxPct, 2, 100 - startBox.x);
      if (handle.includes("s")) nh = clamp(startBox.h + dyPct, 1, 100 - startBox.y);
      if (handle.includes("w")) {
        const newX = clamp(startBox.x + dxPct, 0, startBox.x + startBox.w - 2);
        nw = startBox.w - (newX - startBox.x);
        nx = newX;
      }
      if (handle.includes("n")) {
        const newY = clamp(startBox.y + dyPct, 0, startBox.y + startBox.h - 1);
        nh = startBox.h - (newY - startBox.y);
        ny = newY;
      }
      updateBlock(op.id, { box: { x: nx, y: ny, w: nw, h: nh } } as Partial<Block>);
    }
  }, [updateBlock]);

  const onPointerUp = useCallback(() => {
    opRef.current = null;
  }, []);

  const beginDrag = (block: Block, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    opRef.current = {
      kind: "drag",
      id: block.id,
      startBox: { ...block.box },
      pointerX: e.clientX,
      pointerY: e.clientY,
    };
    setSelectedId(block.id);
  };

  const beginResize = (
    block: Block,
    handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w",
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    opRef.current = {
      kind: "resize",
      id: block.id,
      startBox: { ...block.box },
      pointerX: e.clientX,
      pointerY: e.clientY,
      handle,
    };
    setSelectedId(block.id);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await saveLayout(template.id, layout, {
        name,
        page_size: pageSize,
      });
      if (!result.ok) throw new Error(result.error);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    // Open the preview in a new tab — the route reads from the DB so the
    // user needs to save first; we save then open.
    handleSave().then(() => {
      window.open(`/api/results/templates/${template.id}/preview`, "_blank");
    });
  };

  // ── Canvas aspect ratio so the on-screen preview matches A4.
  const dims = PAGE_DIMS[pageSize];
  const ratio = dims.h / dims.w;

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-6 py-3 md:px-10">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium"
        />
        <select
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value as PageSize)}
          className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="a4-portrait">A4 portrait</option>
          <option value="a4-landscape">A4 landscape</option>
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {savedAt && !error && (
            <span className="text-xs text-emerald-700">Saved at {savedAt}</span>
          )}
          <button
            type="button"
            onClick={handlePreview}
            className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm hover:bg-stone-100"
          >
            Save &amp; Preview
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[180px_1fr_280px] overflow-hidden">
        {/* Left rail: block palette */}
        <aside className="overflow-y-auto border-r border-stone-200 bg-stone-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Add block
          </div>
          <div className="flex flex-col gap-1.5">
            {(
              [
                ["text", "Text"],
                ["image", "Image"],
                ["line", "Line"],
                ["signature", "Signature"],
                ["table.marks", "Marks table"],
                ["table.cocurricular", "Co-curricular"],
                ["table.summary", "Summary box"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => addBlock(kind)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-800 hover:border-stone-400"
              >
                + {label}
              </button>
            ))}
          </div>

          <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Blocks ({layout.length})
          </div>
          <div className="flex flex-col gap-1">
            {layout.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={
                  "rounded px-2 py-1 text-left text-xs " +
                  (b.id === selectedId
                    ? "bg-stone-900 text-white"
                    : "bg-white text-stone-700 hover:bg-stone-100")
                }
              >
                {i + 1}. {b.type}
              </button>
            ))}
          </div>
        </aside>

        {/* Centre: canvas */}
        <div className="flex items-center justify-center overflow-auto bg-stone-200 p-6">
          <div
            ref={canvasRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => setSelectedId(null)}
            className="relative origin-top bg-white shadow-2xl"
            style={{
              width: pageSize === "a4-portrait" ? 595 : 842,
              height: pageSize === "a4-portrait" ? 842 : 595,
              aspectRatio: `1 / ${ratio}`,
            }}
          >
            {layout.map((block) => (
              <BlockView
                key={block.id}
                block={block}
                selected={block.id === selectedId}
                onPointerDown={(e) => beginDrag(block, e)}
                onResize={(handle, e) => beginResize(block, handle, e)}
                onSelect={() => setSelectedId(block.id)}
              />
            ))}
          </div>
        </div>

        {/* Right inspector */}
        <aside className="overflow-y-auto border-l border-stone-200 bg-white p-4">
          {selected ? (
            <Inspector
              block={selected}
              onChange={(patch) => updateBlock(selected.id, patch)}
              onDelete={() => removeBlock(selected.id)}
            />
          ) : (
            <div className="text-sm text-stone-500">
              Click a block on the canvas to edit its properties, or add one
              from the left.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ── Canvas block rendering ───────────────────────────────────────────
function BlockView({
  block,
  selected,
  onPointerDown,
  onResize,
  onSelect,
}: {
  block: Block;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onResize: (
    handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w",
    e: React.PointerEvent
  ) => void;
  onSelect: () => void;
}) {
  const positionStyle: React.CSSProperties = {
    position: "absolute",
    left: `${block.box.x}%`,
    top: `${block.box.y}%`,
    width: `${block.box.w}%`,
    height: `${block.box.h}%`,
    cursor: "move",
    outline: selected ? "2px solid #ea580c" : undefined,
    outlineOffset: selected ? "1px" : undefined,
  };

  return (
    <div
      style={positionStyle}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <BlockBody block={block} />
      {selected && <ResizeHandles onResize={onResize} />}
    </div>
  );
}

function ResizeHandles({
  onResize,
}: {
  onResize: (
    handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w",
    e: React.PointerEvent
  ) => void;
}) {
  const corners = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
  const pos: Record<(typeof corners)[number], React.CSSProperties> = {
    nw: { top: -4, left: -4, cursor: "nwse-resize" },
    n:  { top: -4, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
    ne: { top: -4, right: -4, cursor: "nesw-resize" },
    e:  { top: "50%", right: -4, transform: "translateY(-50%)", cursor: "ew-resize" },
    se: { bottom: -4, right: -4, cursor: "nwse-resize" },
    s:  { bottom: -4, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
    sw: { bottom: -4, left: -4, cursor: "nesw-resize" },
    w:  { top: "50%", left: -4, transform: "translateY(-50%)", cursor: "ew-resize" },
  };
  return (
    <>
      {corners.map((c) => (
        <div
          key={c}
          onPointerDown={(e) => onResize(c, e)}
          style={{
            position: "absolute",
            width: 8,
            height: 8,
            background: "#fff",
            border: "1px solid #ea580c",
            ...pos[c],
          }}
        />
      ))}
    </>
  );
}

function BlockBody({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
    case "signature": {
      const text =
        block.type === "text"
          ? renderText(block.text, SAMPLE) || block.text
          : block.label;
      const s = block.type === "text" ? block.style : block.style;
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent:
              s.align === "left" ? "flex-start" : s.align === "right" ? "flex-end" : "center",
            color: s.color,
            fontFamily: s.fontFamily,
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            fontStyle: s.italic ? "italic" : "normal",
            textDecoration: s.underline ? "underline" : "none",
            background: s.backgroundColor ?? "transparent",
            padding: `${s.paddingY}px ${s.paddingX}px`,
            borderTop: block.type === "signature" ? `1px solid ${s.color}` : "none",
            paddingTop: block.type === "signature" ? 6 : s.paddingY,
            overflow: "hidden",
          }}
        >
          {text}
        </div>
      );
    }
    case "line":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${block.thickness}px`,
              background: block.color,
            }}
          />
        </div>
      );
    case "image":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#f5f5f4",
            border: "1px dashed #d6d3d1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#78716c",
            fontSize: 10,
            opacity: block.opacity,
          }}
        >
          {block.source === "school.logo"
            ? "🏫 School logo"
            : block.source === "student.photo"
              ? "📸 Student photo"
              : block.customUrl
                ? "🖼 Custom image"
                : "🖼 Image (set source)"}
        </div>
      );
    case "table.marks":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: `1px solid ${block.borderColor}`,
            background: "#fff",
            fontSize: 9,
            color: "#1c1917",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", background: block.headerStyle.backgroundColor ?? "transparent", fontWeight: block.headerStyle.fontWeight }}>
            <div style={{ width: `${block.subjectColumnWidthPct}%`, padding: 4, borderRight: `1px solid ${block.borderColor}` }}>Subject</div>
            {block.columns.map((c) => (
              <div key={c.id} style={{ width: `${c.widthPct}%`, padding: 4, borderRight: `1px solid ${block.borderColor}`, textAlign: "center" }}>
                {c.label}
              </div>
            ))}
          </div>
          {SAMPLE.marksGrid.subjects.map((sub, i) => (
            <div
              key={sub.name}
              style={{
                display: "flex",
                background: block.zebra && i % 2 ? "#fafaf9" : "transparent",
                borderTop: `1px solid ${block.borderColor}`,
              }}
            >
              <div style={{ width: `${block.subjectColumnWidthPct}%`, padding: 4, borderRight: `1px solid ${block.borderColor}`, textAlign: "left" }}>
                {sub.name}
              </div>
              {block.columns.map((c) => (
                <div key={c.id} style={{ width: `${c.widthPct}%`, padding: 4, borderRight: `1px solid ${block.borderColor}`, textAlign: "center" }}>
                  —
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case "table.cocurricular":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: `1px dashed ${block.borderColor}`,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#78716c",
            fontSize: 10,
          }}
        >
          Co-curricular grades table
        </div>
      );
    case "table.summary":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: `1px solid ${block.borderColor}`,
            background: "#fff",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            fontSize: 9,
            color: block.style.color,
            fontWeight: block.style.fontWeight,
          }}
        >
          {block.rows.map((r) => (
            <div key={r} style={{ textAlign: "center", padding: 4 }}>
              <div style={{ fontSize: 8, color: "#78716c", textTransform: "uppercase" }}>{r}</div>
              <div>{r === "total" ? "403 / 500" : r === "percent" ? "80.60%" : r === "grade" ? "A" : "PASS"}</div>
            </div>
          ))}
        </div>
      );
  }
}

// ── Right-rail inspector ─────────────────────────────────────────────
function Inspector({
  block,
  onChange,
  onDelete,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {block.type}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-rose-600 hover:text-rose-800 hover:underline"
        >
          Delete
        </button>
      </div>

      <BoxFields block={block} onChange={onChange} />

      {block.type === "text" && (
        <TextFields block={block} onChange={onChange as (p: Partial<Block>) => void} />
      )}
      {block.type === "signature" && (
        <SignatureFields block={block} onChange={onChange as (p: Partial<Block>) => void} />
      )}
      {block.type === "line" && (
        <LineFields block={block} onChange={onChange as (p: Partial<Block>) => void} />
      )}
      {block.type === "image" && (
        <ImageFields block={block} onChange={onChange as (p: Partial<Block>) => void} />
      )}
      {block.type === "table.summary" && (
        <SummaryFields block={block} onChange={onChange as (p: Partial<Block>) => void} />
      )}
      {block.type === "table.marks" && (
        <MarksFields block={block} onChange={onChange as (p: Partial<Block>) => void} />
      )}
    </div>
  );
}

function BoxFields({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}) {
  const set = (k: keyof Box, v: number) => {
    onChange({ box: { ...block.box, [k]: v } } as Partial<Block>);
  };
  return (
    <div>
      <Section label="Position (% of page)">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={block.box.x} onChange={(v) => set("x", v)} />
          <NumberInput label="Y" value={block.box.y} onChange={(v) => set("y", v)} />
          <NumberInput label="Width" value={block.box.w} onChange={(v) => set("w", v)} />
          <NumberInput label="Height" value={block.box.h} onChange={(v) => set("h", v)} />
        </div>
      </Section>
    </div>
  );
}

function TextFields({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "text" }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  return (
    <Section label="Text">
      <textarea
        rows={2}
        value={block.text}
        onChange={(e) => onChange({ text: e.target.value })}
        className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      />
      <label className="mt-2 block text-xs text-stone-600">Bind variable</label>
      <select
        value={block.bind ?? ""}
        onChange={(e) => onChange({ bind: (e.target.value || null) as VarPath | null })}
        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      >
        <option value="">— None (use {"{{var}}"} tokens inside text) —</option>
        {VAR_PATHS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <StyleFields style={block.style} onChange={(style) => onChange({ style })} />
    </Section>
  );
}

function SignatureFields({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "signature" }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  return (
    <Section label="Signature">
      <TextInput label="Label" value={block.label} onChange={(v) => onChange({ label: v })} />
      <StyleFields style={block.style} onChange={(style) => onChange({ style })} />
    </Section>
  );
}

function LineFields({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "line" }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  return (
    <Section label="Line">
      <ColorInput label="Color" value={block.color} onChange={(v) => onChange({ color: v })} />
      <NumberInput
        label="Thickness (px)"
        value={block.thickness}
        onChange={(v) => onChange({ thickness: v })}
      />
    </Section>
  );
}

function ImageFields({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "image" }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  return (
    <Section label="Image">
      <label className="block text-xs text-stone-600">Source</label>
      <select
        value={block.source}
        onChange={(e) => onChange({ source: e.target.value as ImageSource })}
        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      >
        {IMAGE_SOURCES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {block.source === "custom" && (
        <TextInput
          label="Image URL"
          value={block.customUrl ?? ""}
          onChange={(v) => onChange({ customUrl: v || null })}
        />
      )}
      <NumberInput
        label="Opacity (0–1)"
        value={block.opacity}
        onChange={(v) => onChange({ opacity: Math.max(0, Math.min(1, v)) })}
      />
      <label className="mt-2 block text-xs text-stone-600">Fit</label>
      <select
        value={block.fit}
        onChange={(e) => onChange({ fit: e.target.value as "contain" | "cover" })}
        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      >
        <option value="contain">Contain</option>
        <option value="cover">Cover</option>
      </select>
    </Section>
  );
}

function SummaryFields({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "table.summary" }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  const toggle = (r: "total" | "percent" | "grade" | "status") => {
    const present = block.rows.includes(r);
    const rows = present ? block.rows.filter((x) => x !== r) : [...block.rows, r];
    onChange({ rows });
  };
  return (
    <Section label="Summary rows">
      {(["total", "percent", "grade", "status"] as const).map((r) => (
        <label key={r} className="mt-1 flex items-center gap-2 text-xs text-stone-700">
          <input
            type="checkbox"
            checked={block.rows.includes(r)}
            onChange={() => toggle(r)}
            className="h-3.5 w-3.5 accent-stone-900"
          />
          {r}
        </label>
      ))}
      <ColorInput label="Border" value={block.borderColor} onChange={(v) => onChange({ borderColor: v })} />
      <StyleFields style={block.style} onChange={(style) => onChange({ style })} />
    </Section>
  );
}

function MarksFields({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "table.marks" }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  const addCol = () => {
    onChange({
      columns: [
        ...block.columns,
        {
          id: newBlockId(),
          examKey: "TERM_1",
          cell: "exam.marks",
          label: "Marks",
          widthPct: 10,
        },
      ],
    });
  };
  const updateCol = (id: string, patch: Partial<(typeof block.columns)[number]>) => {
    onChange({
      columns: block.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };
  const removeCol = (id: string) => {
    onChange({ columns: block.columns.filter((c) => c.id !== id) });
  };
  return (
    <Section label="Marks table">
      <NumberInput
        label="Subject column %"
        value={block.subjectColumnWidthPct}
        onChange={(v) => onChange({ subjectColumnWidthPct: v })}
      />
      <label className="mt-2 flex items-center gap-2 text-xs text-stone-700">
        <input
          type="checkbox"
          checked={block.zebra}
          onChange={(e) => onChange({ zebra: e.target.checked })}
          className="h-3.5 w-3.5 accent-stone-900"
        />
        Zebra stripes
      </label>
      <ColorInput label="Border" value={block.borderColor} onChange={(v) => onChange({ borderColor: v })} />

      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Columns
      </div>
      {block.columns.map((c) => (
        <div key={c.id} className="mt-2 rounded border border-stone-200 p-2">
          <TextInput
            label="Label"
            value={c.label}
            onChange={(v) => updateCol(c.id, { label: v })}
          />
          <TextInput
            label="Exam key"
            value={c.examKey}
            onChange={(v) => updateCol(c.id, { examKey: v })}
          />
          <label className="mt-2 block text-xs text-stone-600">Cell</label>
          <select
            value={c.cell}
            onChange={(e) =>
              updateCol(c.id, { cell: e.target.value as typeof c.cell })
            }
            className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
          >
            <option value="exam.max">Exam max</option>
            <option value="exam.marks">Exam marks</option>
            <option value="exam.grade">Exam grade</option>
            <option value="total.max">Total max</option>
            <option value="total.marks">Total marks</option>
            <option value="total.percent">Total %</option>
            <option value="total.grade">Total grade</option>
          </select>
          <NumberInput
            label="Width %"
            value={c.widthPct}
            onChange={(v) => updateCol(c.id, { widthPct: v })}
          />
          <button
            type="button"
            onClick={() => removeCol(c.id)}
            className="mt-2 text-xs text-rose-600 hover:underline"
          >
            Remove column
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addCol}
        className="mt-2 w-full rounded border border-dashed border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-500"
      >
        + Add column
      </button>
    </Section>
  );
}

function StyleFields({
  style,
  onChange,
}: {
  style: TextStyle;
  onChange: (s: TextStyle) => void;
}) {
  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
        Text style
      </div>
      <label className="block text-xs text-stone-600">Font family</label>
      <select
        value={style.fontFamily}
        onChange={(e) => onChange({ ...style, fontFamily: e.target.value as TextStyle["fontFamily"] })}
        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      >
        <option value="Helvetica">Helvetica</option>
        <option value="Times-Roman">Times-Roman</option>
        <option value="Courier">Courier</option>
      </select>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <NumberInput
          label="Size"
          value={style.fontSize}
          onChange={(v) => onChange({ ...style, fontSize: v })}
        />
        <div>
          <label className="block text-xs text-stone-600">Weight</label>
          <select
            value={style.fontWeight}
            onChange={(e) => onChange({ ...style, fontWeight: Number(e.target.value) as 400 | 700 })}
            className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
          >
            <option value={400}>Regular</option>
            <option value={700}>Bold</option>
          </select>
        </div>
      </div>
      <ColorInput
        label="Color"
        value={style.color}
        onChange={(v) => onChange({ ...style, color: v })}
      />
      <label className="mt-2 block text-xs text-stone-600">Align</label>
      <div className="mt-1 flex gap-1">
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange({ ...style, align: a })}
            className={
              "flex-1 rounded border px-2 py-1 text-xs " +
              (style.align === a
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white text-stone-700")
            }
          >
            {a}
          </button>
        ))}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-stone-700">
        <input
          type="checkbox"
          checked={style.italic}
          onChange={(e) => onChange({ ...style, italic: e.target.checked })}
          className="h-3.5 w-3.5 accent-stone-900"
        />
        Italic
      </label>
      <label className="mt-1 flex items-center gap-2 text-xs text-stone-700">
        <input
          type="checkbox"
          checked={style.underline}
          onChange={(e) => onChange({ ...style, underline: e.target.checked })}
          className="h-3.5 w-3.5 accent-stone-900"
        />
        Underline
      </label>
      <label className="mt-2 block text-xs text-stone-600">Background colour</label>
      <input
        type="text"
        value={style.backgroundColor ?? ""}
        placeholder="e.g. #f5f5f4 or transparent"
        onChange={(e) =>
          onChange({ ...style, backgroundColor: e.target.value || null })
        }
        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      />
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-stone-600">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        step={0.5}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      />
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-2">
      <label className="block text-xs text-stone-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      />
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-2">
      <label className="block text-xs text-stone-600">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-stone-300 bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}
