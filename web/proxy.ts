import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RENDERABLE_EXTENSIONS = /\.(md|yaml|yml)$/i;

/** Prebuild copy puts these under `public/files/`; serve them as static assets on Vercel. */
const SKIP_VIEW_REWRITE_PREFIXES = ["/files/sources/corpus/", "/files/media/"];

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith("/files/") &&
    RENDERABLE_EXTENSIONS.test(pathname) &&
    !searchParams.has("raw")
  ) {
    if (SKIP_VIEW_REWRITE_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    const viewPath = pathname.replace(/^\/files\//, "/view/");
    return NextResponse.rewrite(new URL(viewPath, request.url));
  }
}

export const config = {
  matcher: "/files/:path*",
};
