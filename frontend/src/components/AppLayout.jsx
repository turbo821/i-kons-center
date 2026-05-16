import { useState } from "react";

import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { useAuth } from "../context/AuthContext";


export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-100">
      {user && <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />}

      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
