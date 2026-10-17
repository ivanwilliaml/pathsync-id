import type { Metadata } from "next";
import { LinkButton } from "@/components/kit";
import { Mascot } from "@/components/mascot";

export const metadata: Metadata = { title: "Page Not Found", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <Mascot name="oops" size={180} priority />
      <h1 className="mt-4 text-[28px] font-bold text-ink">This page took a wrong turn</h1>
      <p className="mt-2 text-muted-foreground">The link may be old or mistyped. Your route is still where you left it.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <LinkButton href="/dashboard" size="lg">Go to My Dashboard</LinkButton>
        <LinkButton href="/" variant="outline" size="lg">Home</LinkButton>
      </div>
    </div>
  );
}
