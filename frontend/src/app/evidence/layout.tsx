import type { Metadata } from "next";

export const metadata: Metadata = { title: "Evidence Saya" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
