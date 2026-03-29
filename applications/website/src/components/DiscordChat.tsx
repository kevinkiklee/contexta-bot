export interface ChatMessage {
  username: string;
  avatar: string;
  avatarColor: string;
  content: string;
  isBot?: boolean;
  timestamp?: string;
}

export interface ChatDay {
  label: string;
  messages: ChatMessage[];
}

export default function DiscordChat({
  days,
  className = '',
}: {
  days: ChatDay[];
  className?: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden shadow-2xl shadow-black/40 text-left ${className}`} style={{ background: '#313338' }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5" style={{ background: '#2b2d31' }}>
        <span className="text-[#80848e] text-sm font-semibold"># general</span>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-1">
        {days.map((day, di) => (
          <div key={di}>
            {/* Day divider */}
            <div className="flex items-center gap-3 my-4 first:mt-0">
              <div className="flex-1 h-px" style={{ background: '#3f4147' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#80848e' }}>{day.label}</span>
              <div className="flex-1 h-px" style={{ background: '#3f4147' }} />
            </div>

            {day.messages.map((msg, mi) => (
              <div key={mi} className="flex items-start gap-3 py-1 px-1 rounded hover:bg-white/[0.02] group">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                  style={{ background: msg.isBot ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : msg.avatarColor }}
                >
                  {msg.isBot ? '🧠' : msg.avatar}
                </div>

                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm" style={{ color: msg.isBot ? '#7c3aed' : msg.avatarColor }}>
                      {msg.username}
                    </span>
                    {msg.isBot && (
                      <span className="text-[10px] font-semibold px-1 py-0.5 rounded" style={{ background: '#5865f2', color: 'white' }}>
                        BOT
                      </span>
                    )}
                    {msg.timestamp && (
                      <span className="text-[11px]" style={{ color: '#80848e' }}>{msg.timestamp}</span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5 leading-relaxed text-left" style={{ color: '#dbdee1' }}>
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
