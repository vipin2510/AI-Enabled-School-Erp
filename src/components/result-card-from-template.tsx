/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  Image,
} from "@react-pdf/renderer";
import {
  type Block,
  type Layout,
  type PageSize,
  type TemplateData,
  PAGE_DIMS,
  boxToPoints,
  renderText,
  resolveBinding,
} from "@/lib/result-template";

// Renders a result card from a Canva-style layout.
// Each block becomes an absolutely-positioned React-PDF View whose
// coordinates are derived from the block's percentage box.

function blockStyle(block: Block, pageSize: PageSize) {
  const pos = boxToPoints(block.box, pageSize);
  return {
    position: "absolute" as const,
    left: pos.left,
    top: pos.top,
    width: pos.width,
    height: pos.height,
  };
}

function alignFlex(a: "left" | "center" | "right") {
  return a === "left" ? "flex-start" : a === "right" ? "flex-end" : "center";
}

function BlockNode({
  block,
  data,
  pageSize,
}: {
  block: Block;
  data: TemplateData;
  pageSize: PageSize;
}) {
  const baseStyle = blockStyle(block, pageSize);
  switch (block.type) {
    case "text": {
      const txt = block.bind
        ? resolveBinding(block.bind, data)
        : renderText(block.text, data);
      const s = block.style;
      return (
        <View
          style={{
            ...baseStyle,
            justifyContent: "center",
            alignItems: alignFlex(s.align),
            backgroundColor: s.backgroundColor ?? undefined,
            paddingHorizontal: s.paddingX,
            paddingVertical: s.paddingY,
          }}
        >
          <Text
            style={{
              fontFamily: s.fontFamily,
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              fontStyle: s.italic ? "italic" : undefined,
              textDecoration: s.underline ? "underline" : undefined,
              color: s.color,
              textAlign: s.align,
            }}
          >
            {txt}
          </Text>
        </View>
      );
    }
    case "signature": {
      const s = block.style;
      return (
        <View style={{ ...baseStyle, justifyContent: "flex-end" }}>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: s.color,
              paddingTop: 4,
              alignItems: alignFlex(s.align),
            }}
          >
            <Text
              style={{
                fontFamily: s.fontFamily,
                fontSize: s.fontSize,
                fontWeight: s.fontWeight,
                color: s.color,
                textAlign: s.align,
              }}
            >
              {block.label}
            </Text>
          </View>
        </View>
      );
    }
    case "line":
      return (
        <View
          style={{
            ...baseStyle,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: "100%",
              height: block.thickness,
              backgroundColor: block.color,
            }}
          />
        </View>
      );
    case "image": {
      const src =
        block.source === "school.logo"
          ? data.school.logoDataUrl
          : block.source === "student.photo"
            ? data.school.studentPhotoUrl ?? null
            : block.customUrl;
      if (!src) {
        return (
          <View
            style={{
              ...baseStyle,
              borderWidth: 0.5,
              borderColor: "#d6d3d1",
              borderStyle: "dashed",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 6, color: "#a8a29e" }}>(no image)</Text>
          </View>
        );
      }
      return (
        <View
          style={{
            ...baseStyle,
            opacity: block.opacity,
          }}
        >
          <Image
            src={src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: block.fit,
            }}
          />
        </View>
      );
    }
    case "table.summary": {
      const items: Array<[string, string]> = [];
      for (const r of block.rows) {
        switch (r) {
          case "total":
            items.push(["TOTAL", `${data.result.total} / ${data.result.max}`]);
            break;
          case "percent":
            items.push(["%", `${data.result.percent.toFixed(2)}%`]);
            break;
          case "grade":
            items.push(["GRADE", data.result.grade]);
            break;
          case "status":
            items.push(["RESULT", data.result.status]);
            break;
        }
      }
      return (
        <View
          style={{
            ...baseStyle,
            flexDirection: "row",
            borderWidth: 1,
            borderColor: block.borderColor,
          }}
        >
          {items.map(([label, value], i) => (
            <View
              key={i}
              style={{
                flex: 1,
                padding: 4,
                borderRightWidth: i < items.length - 1 ? 1 : 0,
                borderRightColor: block.borderColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 7, color: "#78716c" }}>{label}</Text>
              <Text
                style={{
                  fontFamily: block.style.fontFamily,
                  fontSize: block.style.fontSize,
                  fontWeight: block.style.fontWeight,
                  color: block.style.color,
                  marginTop: 2,
                }}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    case "table.marks": {
      const subjectColW = block.subjectColumnWidthPct;
      const cols = block.columns;
      const headerBg = block.headerStyle.backgroundColor ?? "transparent";
      return (
        <View
          style={{
            ...baseStyle,
            borderWidth: 1,
            borderColor: block.borderColor,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: headerBg,
              borderBottomWidth: 1,
              borderBottomColor: block.borderColor,
            }}
          >
            <View
              style={{
                width: `${subjectColW}%`,
                padding: 3,
                borderRightWidth: 1,
                borderRightColor: block.borderColor,
              }}
            >
              <Text
                style={{
                  fontFamily: block.headerStyle.fontFamily,
                  fontSize: block.headerStyle.fontSize,
                  fontWeight: block.headerStyle.fontWeight,
                  color: block.headerStyle.color,
                }}
              >
                Subject
              </Text>
            </View>
            {cols.map((c, i) => (
              <View
                key={c.id}
                style={{
                  width: `${c.widthPct}%`,
                  padding: 3,
                  borderRightWidth: i < cols.length - 1 ? 1 : 0,
                  borderRightColor: block.borderColor,
                }}
              >
                <Text
                  style={{
                    fontFamily: block.headerStyle.fontFamily,
                    fontSize: block.headerStyle.fontSize,
                    fontWeight: block.headerStyle.fontWeight,
                    color: block.headerStyle.color,
                    textAlign: "center",
                  }}
                >
                  {c.label}
                </Text>
              </View>
            ))}
          </View>
          {/* Body */}
          {data.marksGrid.subjects.map((sub, ri) => (
            <View
              key={`${sub.name}-${ri}`}
              style={{
                flexDirection: "row",
                backgroundColor: block.zebra && ri % 2 ? "#fafaf9" : "transparent",
                borderBottomWidth: ri < data.marksGrid.subjects.length - 1 ? 1 : 0,
                borderBottomColor: block.borderColor,
              }}
            >
              <View
                style={{
                  width: `${subjectColW}%`,
                  padding: 3,
                  borderRightWidth: 1,
                  borderRightColor: block.borderColor,
                }}
              >
                <Text
                  style={{
                    fontFamily: block.bodyStyle.fontFamily,
                    fontSize: block.bodyStyle.fontSize,
                    fontWeight: block.bodyStyle.fontWeight,
                    color: block.bodyStyle.color,
                  }}
                >
                  {sub.name}
                </Text>
              </View>
              {cols.map((c, i) => {
                const v = sub.cells[`${c.examKey}:${c.cell}`];
                return (
                  <View
                    key={c.id}
                    style={{
                      width: `${c.widthPct}%`,
                      padding: 3,
                      borderRightWidth: i < cols.length - 1 ? 1 : 0,
                      borderRightColor: block.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: block.bodyStyle.fontFamily,
                        fontSize: block.bodyStyle.fontSize,
                        fontWeight: block.bodyStyle.fontWeight,
                        color: block.bodyStyle.color,
                        textAlign: "center",
                      }}
                    >
                      {v !== undefined ? String(v) : "—"}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      );
    }
    case "table.cocurricular": {
      const items = data.marksGrid.coCurricular;
      return (
        <View
          style={{
            ...baseStyle,
            borderWidth: 1,
            borderColor: block.borderColor,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: block.headerStyle.backgroundColor ?? "transparent",
              borderBottomWidth: 1,
              borderBottomColor: block.borderColor,
            }}
          >
            <View style={{ flex: 2, padding: 3, borderRightWidth: 1, borderRightColor: block.borderColor }}>
              <Text
                style={{
                  fontFamily: block.headerStyle.fontFamily,
                  fontSize: block.headerStyle.fontSize,
                  fontWeight: block.headerStyle.fontWeight,
                  color: block.headerStyle.color,
                }}
              >
                Co-curricular
              </Text>
            </View>
            <View style={{ flex: 1, padding: 3 }}>
              <Text
                style={{
                  fontFamily: block.headerStyle.fontFamily,
                  fontSize: block.headerStyle.fontSize,
                  fontWeight: block.headerStyle.fontWeight,
                  color: block.headerStyle.color,
                  textAlign: "center",
                }}
              >
                Grade
              </Text>
            </View>
          </View>
          {items.map((it, i) => (
            <View
              key={`${it.name}-${i}`}
              style={{
                flexDirection: "row",
                borderBottomWidth: i < items.length - 1 ? 1 : 0,
                borderBottomColor: block.borderColor,
              }}
            >
              <View style={{ flex: 2, padding: 3, borderRightWidth: 1, borderRightColor: block.borderColor }}>
                <Text style={{ fontSize: block.bodyStyle.fontSize, color: block.bodyStyle.color }}>{it.name}</Text>
              </View>
              <View style={{ flex: 1, padding: 3 }}>
                <Text style={{ fontSize: block.bodyStyle.fontSize, color: block.bodyStyle.color, textAlign: "center" }}>
                  {it.grade ?? "—"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      );
    }
  }
}

export function ResultCardFromTemplate({
  layout,
  data,
  pageSize,
}: {
  layout: Layout;
  data: TemplateData;
  pageSize: PageSize;
}) {
  const dims = PAGE_DIMS[pageSize];
  return (
    <Document>
      <Page size={[dims.w, dims.h]} style={{ position: "relative", backgroundColor: "#ffffff" }}>
        {layout.map((b) => (
          <BlockNode key={b.id} block={b} data={data} pageSize={pageSize} />
        ))}
      </Page>
    </Document>
  );
}
