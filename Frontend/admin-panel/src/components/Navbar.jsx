import { Menu, Sun, Moon, Maximize } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

function Navbar({ darkMode, setDarkMode, setMobileOpen }) {
  const { admin } = useAuth();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-950/90">
      {/* Left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Menu size={22} />
      </button>

      <div className="hidden lg:block">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Welcome back, {admin?.full_name?.split(" ")[0] || "Administrator"} 👋
        </p>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-2 md:gap-4">
        {/* Theme */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="hidden rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 md:block dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Maximize size={19} />
        </button>

        {/* Notification */}
        <NotificationBell />

        {/* Admin */}
        <div className="ml-1 flex items-center gap-3 border-l border-slate-200 pl-3 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
            {admin?.full_name?.[0]?.toUpperCase() || "A"}
          </div>

          <div className="hidden md:block">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {admin?.full_name || "Administrator"}
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Super Admin
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
