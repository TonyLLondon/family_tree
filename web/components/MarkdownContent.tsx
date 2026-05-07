"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkVaultLinks } from "@/lib/vaultLinks";
import { useLightbox, LightboxOverlay } from "@/components/Lightbox";
import { MermaidBlock } from "@/components/MermaidBlock";

type Props = {
  content: string;
  /** Path relative to repo root, POSIX slashes (e.g. `people/foo.md`). */
  filePath: string;
};

export function MarkdownContent({ content, filePath }: Props) {
  const filePosix = filePath.replace(/\\/g, "/");

  const lightbox = useLightbox();

  return (
    <div className="prose prose-zinc min-w-0 max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-a:text-sky-700 prose-a:underline dark:prose-a:text-sky-400">
      <LightboxOverlay src={lightbox.src} alt={lightbox.alt} onClose={lightbox.close} />
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkVaultLinks(filePosix)]}
        components={{
          a: ({ href, children }) => {
            // Links to binaries: embed as <img> unless the URL has a #fragment (use that to force a text link).
            const pathOnly = href?.split("#")[0] ?? "";
            const isImagePath =
              pathOnly.length > 0 &&
              /\.(jpe?g|png|gif|webp|jfif|JPG|JPEG|PNG)(\?.*)?$/i.test(pathOnly);
            const forceTextLink = typeof href === "string" && href.includes("#");
            if (isImagePath && !forceTextLink && href) {
              const label = typeof children === "string" ? children : (Array.isArray(children) ? children.join("") : "");
              return (
                <span className="not-prose my-3 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={href}
                    alt={label}
                    className="max-h-64 cursor-zoom-in rounded-md border border-zinc-200 object-contain transition hover:shadow-lg active:shadow-lg active:ring-2 active:ring-sky-300"
                    onClick={() => lightbox.open(href, label)}
                  />
                  {label && <span className="mt-1 block text-xs text-zinc-500">{label}</span>}
                </span>
              );
            }
            if (href?.startsWith("/")) {
              return (
                <Link href={href} className="font-medium">
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} className="font-medium" target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            <span className="not-prose my-3 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt ?? ""}
                className="max-h-64 cursor-zoom-in rounded-md border border-zinc-200 object-contain transition hover:shadow-lg active:shadow-lg active:ring-2 active:ring-sky-300 dark:border-zinc-700"
                onClick={() => src && typeof src === "string" && lightbox.open(src, alt ?? "")}
              />
              {alt && <span className="mt-1 block text-xs text-zinc-500">{alt}</span>}
            </span>
          ),
          table: ({ children }) => (
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
              <table className="min-w-full w-max">{children}</table>
            </div>
          ),
          code: ({ className, children, ...rest }) => {
            const match = /language-mermaid/.test(className ?? "");
            if (match) {
              const text = String(children).replace(/\n$/, "");
              return <MermaidBlock chart={text} key={text} />;
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
