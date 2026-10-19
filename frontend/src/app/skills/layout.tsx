import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kenali Skill" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
