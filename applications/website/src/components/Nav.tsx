export const DISCORD_INVITE = 'https://discord.com/oauth2/authorize?client_id=1485441632835866786&permissions=274877910016&scope=bot+applications.commands';
export const DASHBOARD_URL = 'https://contexta-bot.vercel.app';

export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border">
      <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between backdrop-blur-xl bg-bg/60">
        <div className="flex items-center gap-6">
          <a href="#" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple to-cyan flex items-center justify-center text-white text-xs font-bold">
              C
            </div>
            <span className="font-bold text-sm text-text">Contexta</span>
          </a>
          <div className="hidden sm:flex items-center gap-5 text-[13px] text-text-muted">
            <a href="#features" className="hover:text-text transition">Features</a>
            <a href="#how-it-works" className="hover:text-text transition">How It Works</a>
          </div>
        </div>
        <a
          href={DISCORD_INVITE}
          className="rounded-lg bg-blurple px-4 py-1.5 text-white text-[13px] font-semibold hover:bg-blurple-hover transition shadow-lg shadow-blurple/20"
        >
          Add to Discord
        </a>
      </div>
    </nav>
  );
}
