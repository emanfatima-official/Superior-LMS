import { Settings as SettingsIcon, ShieldCheck, Palette, Database } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import branding from "../config/branding";

function Settings() {
  const { admin } = useAuth();

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">
      <PageHeader
        title="Settings"
        description="Only settings backed by the current LMS configuration or existing admin data are shown."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><ShieldCheck size={19} /></span>
            <div><h2 className="font-semibold text-slate-900 dark:text-white">Admin Account</h2><p className="text-xs text-slate-500">Backed by the existing admins table.</p></div>
          </div>
          <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-4 text-sm">
            <dt className="text-slate-400">Name</dt><dd className="font-medium">{admin?.full_name || "—"}</dd>
            <dt className="text-slate-400">Email</dt><dd className="break-all font-medium">{admin?.email || "—"}</dd>
            <dt className="text-slate-400">Role</dt><dd className="font-medium capitalize">{admin?.role || "admin"}</dd>
            <dt className="text-slate-400">Created</dt><dd className="font-medium">{admin?.created_at ? new Date(admin.created_at).toLocaleString() : "—"}</dd>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><Palette size={19} /></span>
            <div><h2 className="font-semibold text-slate-900 dark:text-white">White-label Branding</h2><p className="text-xs text-slate-500">Backed by the central branding configuration, not duplicated across pages.</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
            <img src={branding.logo} alt={branding.universityName} className="h-14 w-14 object-contain" />
            <div><p className="font-bold text-slate-900 dark:text-white">{branding.universityName}</p><p className="text-xs text-slate-500">{branding.lmsName} · {branding.panelName}</p></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs text-slate-400">Primary color</p><div className="mt-2 flex items-center gap-2"><span className="h-5 w-5 rounded-full border border-black/10" style={{ background: branding.primaryColor }} /><code className="text-xs">{branding.primaryColor}</code></div></div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs text-slate-400">Secondary color</p><div className="mt-2 flex items-center gap-2"><span className="h-5 w-5 rounded-full border border-black/10" style={{ background: branding.secondaryColor }} /><code className="text-xs">{branding.secondaryColor}</code></div></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">Change branding from <code>src/config/branding.js</code>. No unsupported database setting toggles are exposed here.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800"><Database size={19} /></span>
            <div><h2 className="font-semibold text-slate-900 dark:text-white">Supported Settings Scope</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">The current database does not contain system preference fields for email channels, push channels, file size defaults or default course rules, so those controls are intentionally not shown. Only settings that are backed by the current LMS configuration or database are displayed here.</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Settings;
