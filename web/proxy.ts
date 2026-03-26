import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RENDERABLE_EXTENSIONS = /\.(md|yaml|yml)$/i;

/** Prebuild copy puts these under `public/files/`. On Vercel only, skip `/view/` rewrite so the static CDN serves them (`/view` has no full repo there). Local dev keeps rewrite → rendered markdown in `/view`. */
const SKIP_VIEW_REWRITE_PREFIXES = ["/files/sources/corpus/", "/files/media/"];

function forceStaticRenderableUnderFiles(): boolean {
  return process.env.VERCEL === "1";
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith("/files/") &&
    RENDERABLE_EXTENSIONS.test(pathname) &&
    !searchParams.has("raw")
  ) {
    if (
      forceStaticRenderableUnderFiles() &&
      SKIP_VIEW_REWRITE_PREFIXES.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.next();
    }
    const viewPath = pathname.replace(/^\/files\//, "/view/");
    return NextResponse.rewrite(new URL(viewPath, request.url));
  }
}

export const config = {
  matcher: "/files/:path*",
};
