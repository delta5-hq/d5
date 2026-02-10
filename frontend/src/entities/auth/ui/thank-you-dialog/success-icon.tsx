export const SuccessIcon = () => (
  <div className="flex justify-center mb-6">
    <svg className="w-20 h-20 animate-in zoom-in-95 duration-500" fill="none" viewBox="0 0 100 100">
      <circle className="stroke-success/20" cx="50" cy="50" r="45" strokeWidth="2" />
      <circle className="fill-success/10" cx="50" cy="50" r="35" />
      <path
        className="stroke-success"
        d="M30 50 L42 62 L70 34"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <circle className="fill-success/40 animate-pulse" cx="30" cy="30" r="3" />
      <circle className="fill-success/30 animate-pulse" cx="70" cy="35" r="2" style={{ animationDelay: '0.2s' }} />
      <circle className="fill-success/35 animate-pulse" cx="65" cy="65" r="2.5" style={{ animationDelay: '0.4s' }} />
    </svg>
  </div>
)
