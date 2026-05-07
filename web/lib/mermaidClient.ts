/**
 * Mermaid is always rendered with a **light, print-style palette** so diagrams
 * stay legible in site dark mode and edge labels stay dark-on-light (SVG text
 * does not inherit prose invert).
 */
export async function runMermaidOnNode(node: HTMLElement | null) {
  if (!node) return;
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "loose",
    themeVariables: {
      background: "#ffffff",
      mainBkg: "#ffffff",
      secondaryColor: "#eef0f3",
      tertiaryColor: "#f8fafc",
      primaryTextColor: "#0f172a",
      secondaryTextColor: "#334155",
      tertiaryTextColor: "#475569",
      lineColor: "#475569",
      textColor: "#0f172a",
      edgeLabelBackground: "#ffffff",
      edgeLabelText: "#0f172a",
      clusterBkg: "#f1f5f9",
      clusterBorder: "#94a3b8",
      titleColor: "#0f172a",
      fontSize: "17px",
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    },
    flowchart: {
      /* tspans handle \n in edge labels more reliably than foreignObject */
      htmlLabels: false,
      useMaxWidth: true,
      padding: 28,
      nodeSpacing: 56,
      rankSpacing: 72,
      curve: "basis",
      diagramPadding: 16,
    },
  });
  await mermaid.run({ nodes: [node] });
}
