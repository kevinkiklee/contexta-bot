import { DASHBOARD_URL } from './Nav';

export default function Footer() {
  return (
    <footer className="border-t border-border px-6 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-text-dim">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple to-cyan flex items-center justify-center text-white text-[8px] font-bold">
            C
          </div>
          <span>Contexta</span>
        </div>
        <div className="flex items-center gap-5">
          <a href={DASHBOARD_URL} className="hover:text-text-muted transition">Dashboard</a>
          <span className="text-text-dim/50 cursor-default">Add to Discord</span>
        </div>
      </div>
    </footer>
  );
}
