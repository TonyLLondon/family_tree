import { redirect } from "next/navigation";
import { getCorpusSlugs } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getCorpusSlugs().map((slug) => ({ slug }));
}

export default async function CorpusBundleRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/sources/${encodeURIComponent(slug)}`);
}
