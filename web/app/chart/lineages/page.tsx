import { loadFamilyTree } from "@/lib/tree";
import { buildBloodlineData } from "@/lib/bloodlines";
import { BloodlineChart } from "@/components/BloodlineChart";

export const metadata = {
  title: "Bloodlines — Stump & Addobbati",
  description: "Two lineages traced back through the centuries",
};

export default function LineagesPage() {
  const tree = loadFamilyTree();
  const data = buildBloodlineData(tree);

  return <BloodlineChart data={data} />;
}
