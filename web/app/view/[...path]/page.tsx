import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import matter from "gray-matter";
import { REPO_ROOT } from "@/lib/paths";
import { MarkdownContent } from "@/components/MarkdownContent";
import { SiteNav } from "@/components/SiteNav";

type Props = { params: Promise<{ path: string[] }> };

export default async function FileViewPage({ params }: Props) {
  const { path: segments } = await params;
  if (!segments?.length) notFound();

  const decoded = segments.map((s) => decodeURIComponent(s));
  const rel = decoded.join("/");
  const abs = path.resolve(path.join(REPO_ROOT, rel));
  const rootResolved = path.resolve(REPO_ROOT);

  if (!abs.startsWith(rootResolved + path.sep) && abs !== rootResolved) {
    notFound();
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    notFound();
  }

  const ext = path.extname(abs).toLowerCase();
  const raw = fs.readFileSync(abs, "utf8");
  const rawUrl = `/files/${rel}?raw`;

  if (ext === ".md") {
    return <MarkdownView raw={raw} filePath={rel} rawUrl={rawUrl} />;
  }

  return <YamlView raw={raw} filePath={rel} rawUrl={rawUrl} />;
}

function FileHeader({
  filePath,
  rawUrl,
}: {
  filePath: string;
  rawUrl: string;
}) {
  const crumbs = filePath.split("/");
  return (
    <header className="mb-6 border-b border-zinc-200 pb-4">
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-zinc-400">
        {crumbs.map((seg, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1">/</span>}
            <span className={i === crumbs.length - 1 ? "text-zinc-700 font-medium" : ""}>
              {seg}
            </span>
          </span>
        ))}
      </nav>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {crumbs[crumbs.length - 1]}
        </h1>
        <a
          href={rawUrl}
          className="rounded border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700"
        >
          Raw
        </a>
      </div>
    </header>
  );
}

function FrontmatterTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/50">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-zinc-100 last:border-0">
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-medium text-zinc-500">
                {key}
              </td>
              <td className="px-4 py-2 text-zinc-700">
                {typeof value === "object"
                  ? JSON.stringify(value, null, 2)
                  : String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownView({
  raw,
  filePath,
  rawUrl,
}: {
  raw: string;
  filePath: string;
  rawUrl: string;
}) {
  const { data, content } = matter(raw);
  const hasFrontmatter = Object.keys(data).length > 0;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
        <FileHeader filePath={filePath} rawUrl={rawUrl} />
        {hasFrontmatter && <FrontmatterTable data={data} />}
        <MarkdownContent content={content} filePath={filePath} />
      </main>
    </>
  );
}

function YamlView({
  raw,
  filePath,
  rawUrl,
}: {
  raw: string;
  filePath: string;
  rawUrl: string;
}) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
        <FileHeader filePath={filePath} rawUrl={rawUrl} />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
          <pre className="p-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            <code>{raw}</code>
          </pre>
        </div>
      </main>
    </>
  );
}
