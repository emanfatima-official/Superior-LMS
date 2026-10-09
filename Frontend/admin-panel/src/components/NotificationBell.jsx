import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Loader2 } from "lucide-react";

import { useRecentActivity, timeAgo } from "../hooks/useRecentActivity";

const SEEN_KEY = "campusz_notifications_seen_at";

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(() => localStorage.getItem(SEEN_KEY));
  const containerRef = useRef(null);

  const { activities, loading, reload } = useRecentActivity(15);

  const unreadCount = useMemo(() => {
    if (!seenAt) return activities.length;
    return activities.filter((a) => new Date(a.time) > new Date(seenAt)).length;
  }, [activities, seenAt]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);

    if (next) {
      reload();
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(SEEN_KEY, now);
      setSeenAt(now);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-fade-in-up absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Notifications
            </p>
            {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!loading && activities.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications yet.
              </p>
            )}

            {activities.map((a) => {
              const isUnread = seenAt ? new Date(a.time) > new Date(seenAt) : true;

              return (
                <div
                  key={a.id}
                  className={`flex gap-3 border-b border-slate-50 px-4 py-3 last:border-0 dark:border-slate-800/60 ${
                    isUnread ? "bg-blue-50/40 dark:bg-blue-500/5" : ""
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    {a.letter}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {a.title}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {a.description}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {timeAgo(a.time)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
