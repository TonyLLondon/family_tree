import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RENDERABLE_EXTENSIONS = /\.(md|yaml|yml)$/i;

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
