import { Mail } from "lucide-react";
import { FaGithub } from "react-icons/fa";

const APP_VERSION = "1.0.0";


export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-slate-900 text-slate-400">
      <div className="flex flex-col items-center justify-between gap-2 px-6 py-3 text-xs md:flex-row">
        <div className="flex items-center gap-3">
          <span>© {year} I-Kons Center</span>
          <span className="text-slate-600">•</span>
          <span>Инструмент бизнес-аналитики</span>
        </div>

        <div className="flex items-center gap-2">
          <span>v{APP_VERSION}</span>
          <a
            href="https://github.com/turbo821/i-kons-center"
            className="flex items-center gap-1 transition hover:text-white"
          >
            <FaGithub size={12} />
          </a>
          <a
            href="mailto:turbo3735@gmail.com"
            className="flex items-center gap-1 transition hover:text-white"
          >
            <Mail size={12} />
          </a>
          Контакты
        </div>
      </div>
    </footer>
  );
}
