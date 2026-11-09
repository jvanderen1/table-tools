import { useState } from "react";
import { ArrowLeft, ChevronRight, DatabaseBackup, Dices } from "lucide-react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { BackupDrawer } from "./BackupDrawer";
import { UpdatePrompt } from "./UpdatePrompt";
import { getTool, tools } from "./tools/registry";
import { Stack, Text } from "./ui";

function Home() {
  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <h1 className="text-3xl font-semibold text-gold-soft">Table Tools</h1>
        <Text tone="secondary">Phone-friendly play aids for the table.</Text>
      </Stack>
      <div className="grid grid-cols-1 gap-3">
        {tools.map(({ meta }) => (
          <Link
            key={meta.id}
            className="group flex items-center gap-4 rounded-xl border border-line bg-surface/85 p-4 text-ink no-underline transition-colors hover:border-gold/60 hover:no-underline"
            to={`/tools/${meta.id}`}
          >
            <Stack gap={4} className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{meta.title}</h2>
              <Text tone="secondary">{meta.summary}</Text>
              <Text tone="tertiary">{meta.tags.join(" · ")}</Text>
            </Stack>
            <ChevronRight
              className="size-5 shrink-0 text-faint transition-colors group-hover:text-gold"
              aria-hidden
            />
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
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-faint hover:text-gold-soft hover:no-underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All tools
      </Link>
      <Component key={meta.id} />
    </Stack>
  );
}

export default function App() {
  const [backupOpen, setBackupOpen] = useState(false);
  return (
    <div className="mx-auto max-w-5xl px-4 pt-5 pb-28">
      <header className="mb-5 flex items-center justify-between gap-3 border-b border-line/70 pb-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-ink no-underline hover:no-underline"
        >
          <Dices className="size-5 text-gold" aria-hidden />
          <span className="font-display text-sm font-semibold tracking-[0.18em] uppercase">
            table-tools
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Text tone="tertiary">
            {tools.length} {tools.length === 1 ? "tool" : "tools"}
          </Text>
          <button
            type="button"
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface/70 px-2.5 text-sm text-muted transition-colors hover:border-gold/50 hover:text-ink"
            onClick={() => setBackupOpen(true)}
          >
            <DatabaseBackup className="size-4 text-gold/80" aria-hidden />
            Backup
          </button>
        </div>
      </header>
      <BackupDrawer open={backupOpen} onClose={() => setBackupOpen(false)} />
      <UpdatePrompt />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tools/:toolId" element={<ToolPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
