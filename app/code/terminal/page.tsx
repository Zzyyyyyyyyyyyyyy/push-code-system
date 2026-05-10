import { PageHeader } from "@/components/shared";
import { CodeTerminalClient } from "./CodeTerminalClient";

export const metadata = {
  title: "Code Terminal",
};

export default async function MerchantCodeTerminalPage() {
  return (
    <main className="ct-shell">
      <PageHeader
        eyebrow="(REDEEM)"
        subtitle="Type the customer's 6-digit code."
        title="Code Terminal"
      />
      <CodeTerminalClient />
    </main>
  );
}
