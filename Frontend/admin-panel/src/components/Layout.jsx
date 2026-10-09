import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useTheme } from "../context/ThemeContext";

function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { darkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="lg:pl-64">
        <Navbar
          darkMode={darkMode}
          setDarkMode={toggleTheme}
          setMobileOpen={setMobileOpen}
        />

        <div className="animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Layout;
