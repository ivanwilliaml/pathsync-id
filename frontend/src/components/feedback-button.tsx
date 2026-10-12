"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { api, getLastRequestId } from "@/lib/api";
import { getStudentId } from "@/lib/student";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "./kit";

/** "Report a problem": sends the message with the page and the last request id so the team can trace it. */
export function FeedbackButton({ className }: { className?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post("/feedback", { message, contact, page: path, request_id: getLastRequestId() ?? "", student_id: getStudentId() });
      toast.success("Thanks, we got your message.");
      setMessage("");
      setOpen(false);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className={className} />}>
        <MessageSquareWarning aria-hidden="true" /> Report a Problem
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a Problem or Idea</DialogTitle>
          <DialogDescription>Tell us what went wrong or what would help. We attach the page you are on, but never your documents.</DialogDescription>
        </DialogHeader>
        <form onSubmit={send} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fb-msg">What happened?</Label>
            <Textarea id="fb-msg" value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-28" required minLength={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-contact">Email or WhatsApp (optional, if you want a reply)</Label>
            <Input id="fb-contact" value={contact} onChange={(e) => setContact(e.target.value)} className="h-10" autoComplete="off" />
          </div>
          <ErrorNote error={err} />
          <Button type="submit" size="lg" className="h-10 w-full" disabled={busy || message.trim().length < 3}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
