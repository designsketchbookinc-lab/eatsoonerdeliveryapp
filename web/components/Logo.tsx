// The Eat Sooner logo exactly as Katherine approved it: graffiti script on a gold splash
// with color sprinkles, and two wheels standing in for the "oo". Drawn at 640x216 and scaled.
// Do not redraw or simplify it; change the width prop to resize.

export default function Logo({ width = 320 }: { width?: number }) {
  const scale = width / 640;
  return (
    <div
      role="img"
      aria-label="Eat Sooner"
      style={{ width, height: Math.round(216 * scale), position: 'relative', flexShrink: 0 }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 640,
          height: 216,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg aria-hidden="true" width="640" height="216" viewBox="0 0 640 216" style={{ position: 'absolute', left: '0', top: '0' }}>
        <path d="M70 96 C52 44 150 20 226 32 C300 12 384 22 452 28 C540 16 612 52 596 104 C618 150 540 176 452 166 C372 182 292 174 222 172 C136 184 44 160 70 96 Z" fill="#F2B600" />
        <rect x="150" y="150" width="14" height="50" rx="7" fill="#F2B600" />
        <rect x="300" y="160" width="10" height="34" rx="5" fill="#F2B600" />
        <rect x="420" y="150" width="16" height="58" rx="8" fill="#F2B600" />
        <rect x="520" y="148" width="10" height="38" rx="5" fill="#F2B600" />
        <g fill="#D1350F"><circle cx="40" cy="40" r="5" /><circle cx="96" cy="24" r="3" /><circle cx="180" cy="12" r="4" /><circle cx="330" cy="6" r="3" /><circle cx="470" cy="8" r="5" /><circle cx="560" cy="18" r="3" /><circle cx="622" cy="70" r="4" /><circle cx="628" cy="130" r="3" /><circle cx="30" cy="130" r="4" /><circle cx="110" cy="192" r="3" /><circle cx="250" cy="198" r="4" /><circle cx="370" cy="204" r="3" /><circle cx="480" cy="206" r="2.5" /><circle cx="580" cy="188" r="4" /><circle cx="16" cy="84" r="2.5" /></g>
        <g fill="#355E3B"><circle cx="120" cy="52" r="5" /><circle cx="240" cy="40" r="3.5" /><circle cx="400" cy="36" r="4" /><circle cx="540" cy="60" r="5" /><circle cx="566" cy="130" r="4" /><circle cx="180" cy="152" r="4" /><circle cx="340" cy="162" r="3.5" /><circle cx="90" cy="120" r="3.5" /></g>
        <g fill="#F2B600"><circle cx="22" cy="60" r="6" /><circle cx="612" cy="178" r="7" /><circle cx="596" cy="26" r="4" /><circle cx="64" cy="198" r="4" /><circle cx="200" cy="206" r="3" /><circle cx="440" cy="4" r="3" /><circle cx="636" cy="100" r="2.5" /><circle cx="8" cy="160" r="3" /></g>
        <g fill="#8FA0FF"><circle cx="140" cy="8" r="3" /><circle cx="540" cy="200" r="3.5" /><circle cx="604" cy="152" r="2.5" /><circle cx="50" cy="172" r="3" /><circle cx="310" cy="208" r="2.5" /></g>
        <g fill="#1F2A6E"><circle cx="150" cy="70" r="2.5" /><circle cx="500" cy="46" r="2.5" /><circle cx="476" cy="152" r="3" /><circle cx="210" cy="160" r="2" /></g>
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '26px', fontFamily: 'Pacifico, cursive', fontSize: '88px', lineHeight: '1.5', color: '#1F2A6E', textShadow: '4px 4px 0 #D1350F' }}>
        <span>eat</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
        <span>s</span>
        <svg role="img" aria-label="Two wheels standing in for the letters o o" width="104" height="50" viewBox="0 0 112 54"><circle cx="27" cy="27" r="21" fill="none" stroke="#D1350F" strokeWidth="10" /><circle cx="85" cy="27" r="21" fill="none" stroke="#D1350F" strokeWidth="10" /><circle cx="27" cy="27" r="5" fill="#1F2A6E" /><circle cx="85" cy="27" r="5" fill="#1F2A6E" /></svg>
        <span>ner</span>
        </div>
        </div>
      </div>
    </div>
  );
}
