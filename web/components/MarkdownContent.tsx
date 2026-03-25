"use client";

import Link from "next/link";
import { useEffect, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkVaultLinks } from "@/lib/vaultLinks";
import { useLightbox, LightboxOverlay } from "@/components/Lightbox";

type Props = {
  content: string;
  /** Path relative to repo root, POSIX slashes (e.g. `people/foo.md`). */
  filePath: string;
};

export function MarkdownContent({ content, filePath }: Props) {
  const filePosix = filePath.replace(/\\/g, "/");
  const instanceId = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "neutral",
        securityLevel: "loose",
      });
      if (cancelled) return;
      await mermaid.run({ querySelector: `.mermaid-root-${instanceId} .mermaid` });
    })();
    return () => {
      cancelled = true;
    };
  }, [content, instanceId]);

  const lightbox = useLightbox();

  return (
    <div className={`mermaid-root-${instanceId} prose prose-zinc max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-a:text-sky-700 prose-a:underline dark:prose-a:text-sky-400`}>
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
                    className="max-h-64 cursor-zoom-in rounded-md border border-zinc-200 object-contain transition hover:shadow-lg"
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? ""}
              className="max-w-full cursor-zoom-in rounded-md border border-zinc-200 transition hover:shadow-lg dark:border-zinc-700"
              onClick={() => src && typeof src === "string" && lightbox.open(src, alt ?? "")}
            />
          ),
          code: ({ className, children, ...rest }) => {
            const match = /language-mermaid/.test(className ?? "");
            if (match) {
              const text = String(children).replace(/\n$/, "");
              return (
                <div className="not-prose my-6 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
                  <pre className="mermaid text-center">{text}</pre>
                </div>
              );
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
