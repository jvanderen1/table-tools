import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { getTool, tools } from "./tools/registry";
import { Stack, Text } from "./ui";

function Home() {
  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <h1>Table Tools</h1>
        <Text tone="secondary">
          Phone-friendly play aids for the table. Add another tool anytime —
          see AGENTS.md.
        </Text>
      </Stack>
      <div className="grid grid-1" style={{ gap: 12 }}>
        {tools.map(({ meta }) => (
          <Link
            key={meta.id}
            className="tool-card"
            to={`/tools/${meta.id}`}
          >
            <h2>{meta.title}</h2>
            <Text tone="secondary">{meta.summary}</Text>
            <Text tone="tertiary">{meta.tags.join(" · ")}</Text>
          </Link>
        ))}
      </div>
    </Stack>
  );
}

function ToolPage() {
  const { toolId } = useParams();
  const tool = toolId ? getTool(toolId) : undefined;
  if (!tool) {
    return <Navigate to="/" replace />;
  }
  const { Component, meta } = tool;
  return (
    <Stack gap={16}>
      <Link to="/" className="tertiary">
        ← All tools
      </Link>
      <Component key={meta.id} />
    </Stack>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
          <strong>table-tools</strong>
        </Link>
        <Text tone="tertiary">{tools.length} tools</Text>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tools/:toolId" element={<ToolPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
