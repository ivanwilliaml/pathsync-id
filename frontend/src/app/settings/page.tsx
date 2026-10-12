"use client";

import { useState } from "react";
import { Copy, Download, Eye, EyeOff, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Student } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { useApi } from "@/lib/hooks";
import { accessKey, setStudent } from "@/lib/student";
import { requireKeySave } from "@/components/key-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RequireStudent } from "@/components/require-student";
import { ErrorNote, Loading, NativeSelect, PageHeader, Panel, SectionTitle, Tag } from "@/components/kit";

export default function SettingsPage() {
  return <RequireStudent>{(sid) => <Settings sid={sid} />}</RequireStudent>;
}

function Settings({ sid }: { sid: string }) {
  const st = useApi<Student & { semester: number | null; cohort_id: string | null; study_arm: string | null; consent_at: string | null; consent_version: string }>(
    `/students/${sid}`,
  );
  if (st.error) return <ErrorNote error={st.error} />;
  if (!st.data) return <Loading />;
  const s = st.data;
  return (
    <div className="space-y-8">
      <PageHeader title="Settings & Data" description="Your profile, your access key, classes and studies you join, and control over your personal data." />
      <Profile sid={sid} s={s} onSaved={st.reload} />
      <AccessKey />
      <Research sid={sid} on={!!(s as { research_consent_at?: string | null }).research_consent_at} onChange={st.reload} />
      <Joins sid={sid} cohort={s.cohort_id} arm={s.study_arm} onChange={st.reload} />
      <Privacy sid={sid} consentAt={s.consent_at} version={s.consent_version} />
    </div>
  );
}

function Profile({ sid, s, onSaved }: { sid: string; s: Student & { semester: number | null }; onSaved: () => void }) {
  const [name, setName] = useState(s.display_name);
  const [semester, setSemester] = useState(s.semester ?? 0);
  const [hours, setHours] = useState(Number(s.preferences.weekly_hours ?? 6));
  const [format, setFormat] = useState(String(s.preferences.format ?? ""));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api.patch(`/students/${sid}`, {
      display_name: name,
      semester: semester || null,
      preferences: { weekly_hours: hours, format: format || null },
    });
    toast.success("Saved");
    onSaved();
  }
  return (
    <Panel>
      <SectionTitle>Profile</SectionTitle>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nm">Name</Label>
          <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sem">Semester</Label>
          <NativeSelect id="sem" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
            <option value={0}>Not set</option>
            {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hrs">Hours per week for your route</Label>
          <Input id="hrs" type="number" min={1} max={40} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fmt">Preferred material format</Label>
          <NativeSelect id="fmt" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">No preference</option>
            <option value="video">Video</option>
            <option value="teks">Article</option>
            <option value="kursus">Course</option>
            <option value="latihan">Practice</option>
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Save Profile</Button>
        </div>
      </form>
    </Panel>
  );
}

function AccessKey() {
  const [show, setShow] = useState(false);
  const key = accessKey() ?? "";
  return (
    <Panel>
      <SectionTitle>Your Access Key</SectionTitle>
      <p className="mb-3 text-sm text-ink/70">
        PathSync has no passwords. This key opens your profile on another device. Keep it private: anyone with it can see your evidence.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-sm" translate="no">
          {show ? key : "•".repeat(28)}
        </code>
        <Button variant="outline" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide key" : "Show key"}>
          {show ? <EyeOff /> : <Eye />}
        </Button>
        <Button variant="outline" onClick={() => navigator.clipboard?.writeText(key).then(() => toast.success("Access key copied"))}>
          <Copy /> Copy
        </Button>
      </div>
      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            const id = key.split(".")[0];
            if (!confirm("Create a new key? The old key stops working on every device.")) return;
            const r = await api.post<{ id: string; token: string }>(`/students/${id}/rotate-key`);
            setStudent({ id: r.id, token: r.token });
            requireKeySave();
            window.location.reload();
          }}
        >
          Create a New Key
        </Button>
      </div>
    </Panel>
  );
}

function Research({ sid, on, onChange }: { sid: string; on: boolean; onChange: () => void }) {
  return (
    <Panel>
      <SectionTitle>Research Participation</SectionTitle>
      <label className="flex cursor-pointer gap-3 text-sm text-ink/80">
        <Checkbox
          checked={on}
          onCheckedChange={async (v) => {
            await api.put(`/students/${sid}/research-consent`, { consent: v === true });
            toast.success(v === true ? "Thanks for helping the research" : "Research participation withdrawn");
            onChange();
          }}
          className="mt-0.5"
        />
        <span>
          I allow anonymised use of my data for PathSync research (user studies and model calibration). Optional: it never changes the features you get.
          Withdrawing also removes you from any running study.
        </span>
      </label>
    </Panel>
  );
}

function Joins({ sid, cohort, arm, onChange }: { sid: string; cohort: string | null; arm: string | null; onChange: () => void }) {
  const [classCode, setClassCode] = useState("");
  const [studyCode, setStudyCode] = useState("");
  const [err, setErr] = useState<unknown>(null);
  async function join(kind: "cohort" | "study", code: string) {
    setErr(null);
    try {
      const r = await api.post<{ privacy?: string; arm?: string }>(`/students/${sid}/${kind}`, { join_code: code });
      toast.success(kind === "cohort" ? "Joined your class" : "Joined the study", { description: r.privacy });
      onChange();
    } catch (x) {
      setErr(x);
    }
  }
  return (
    <Panel>
      <SectionTitle>Class and Study</SectionTitle>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cls">Class code from your lecturer</Label>
          {cohort ? (
            <div className="flex items-center gap-2">
              <Tag tone="mint">Joined</Tag>
              <Button variant="outline" size="sm" onClick={async () => { await api.del(`/students/${sid}/cohort`); onChange(); }}>
                Leave Class
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input id="cls" value={classCode} onChange={(e) => setClassCode(e.target.value.toUpperCase())} className="h-10 font-mono" />
              <Button onClick={() => join("cohort", classCode)} disabled={classCode.length < 4}>
                Join
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Your lecturer sees class-level summaries only, and only once at least 5 students have joined.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="std">Study code (research participants)</Label>
          {arm ? (
            <Tag tone="indigo">Enrolled</Tag>
          ) : (
            <div className="flex gap-2">
              <Input id="std" value={studyCode} onChange={(e) => setStudyCode(e.target.value.toUpperCase())} className="h-10 font-mono" />
              <Button onClick={() => join("study", studyCode)} disabled={studyCode.length < 4}>
                Join
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Participants are assigned to one version of PathSync at random. You can withdraw any time by deleting your data.</p>
        </div>
      </div>
      <ErrorNote error={err} />
    </Panel>
  );
}

function Privacy({ sid, consentAt, version }: { sid: string; consentAt: string | null; version: string }) {
  const [confirm, setConfirm] = useState(false);
  async function exportData() {
    const data = await api.get(`/students/${sid}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pathsync-data-${sid}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function erase() {
    await api.del(`/students/${sid}`);
    setStudent(null);
    toast.success("Your profile and all its data were deleted.");
    window.location.href = "/";
  }
  return (
    <Panel>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-5 text-indigo" aria-hidden="true" /> Your Personal Data
        </span>
      </SectionTitle>
      <p className="text-sm text-ink/75">
        Under Indonesia&rsquo;s Personal Data Protection Law (UU No. 27/2022) you can see everything we store and delete it. We use your data to build your own route; a
        sample of uploaded projects is read by a PathSync reviewer for quality, and lecturers see class totals only if you join a class.{" "}
        <a href="/privacy" className="font-medium text-indigo underline">Read the privacy policy</a>. Consent given {consentAt ? new Date(consentAt + "Z").toLocaleDateString() : "–"} (policy version {version || "–"}).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportData}>
          <Download /> Download My Data
        </Button>
        <Button variant="destructive" onClick={() => setConfirm(true)}>
          <Trash2 /> Delete My Profile
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Your evidence, answers, plans, reflections and route history are deleted permanently. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep My Profile</AlertDialogCancel>
            <AlertDialogAction onClick={erase}>Delete Everything</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
