import fs from "fs";
import path from "path";
import { SiteNav } from "@/components/SiteNav";
import { LondonAddressMapLoader } from "@/components/LondonAddressMapLoader";
import type { LondonAddressData } from "@/components/LondonAddressMap";

export const metadata = {
  title: "London Addresses – The Lewis Line",
  description:
    "Street-level map of family addresses across Islington, Clerkenwell, Holloway, and St Pancras from the 1850s to the 1920s.",
};

function loadLondonAddresses(): LondonAddressData {
  const filePath = path.join(process.cwd(), "london-addresses.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as LondonAddressData;
}

export default function LondonMapPage() {
  const data = loadLondonAddresses();

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        <LondonAddressMapLoader data={data} />
      </main>
    </div>
  );
}
