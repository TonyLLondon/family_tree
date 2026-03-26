import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RENDERABLE_EXTENSIONS = /\.(md|yaml|yml)$/i;

/**
 * Rewrite `/files/…` text assets to `/view/…` so they render in the site shell
 * (Markdown / YAML). `?raw` bypasses the rewrite and serves the static file.
 *
 * `/view/` pages are pre-rendered at build time via `generateStaticParams`, so
 * both local dev and production serve the same rendered HTML.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith("/files/") &&
    RENDERABLE_EXTENSIONS.test(pathname) &&
    !searchParams.has("raw")
  ) {
    const viewPath = pathname.replace(/^\/files\//, "/view/");
    return NextResponse.rewrite(new URL(viewPath, request.url));
  }
}

export const config = {
  matcher: "/files/:path*",
};
