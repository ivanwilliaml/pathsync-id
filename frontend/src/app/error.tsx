"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/kit";
import { Mascot } from "@/components/mascot";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <Mascot name="offline" size={180} priority />
      <h1 className="mt-4 text-[28px] font-bold text-ink">Something got disconnected</h1>
      <p className="mt-2 text-muted-foreground">This page couldn&rsquo;t load. Check your connection and try again; your saved progress is safe.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={reset}>Try Again</Button>
        <LinkButton href="/" variant="outline" size="lg">Home</LinkButton>
      </div>
    </div>
  );
}
