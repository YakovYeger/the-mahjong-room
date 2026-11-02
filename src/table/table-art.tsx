/** Quiet, local vector artwork; the playable tile engravings stay untouched. */
export function TableBotanicals() {
  return <svg className="table-botanicals" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M-20 344Q90 337 158 232M4 314Q69 292 96 212M44 326Q110 305 177 297M868 114Q916 59 1020 38M911 71Q895 34 902-10M940 60Q966 94 1008 105" />
      <g fill="currentColor" stroke="none">
        <path d="M35 322Q8 283 10 262Q37 280 35 322M62 309Q50 270 62 250Q78 275 62 309M88 287Q83 247 98 231Q109 263 88 287M119 265Q121 227 143 217Q145 247 119 265M77 310Q107 276 129 282Q114 307 77 310M117 299Q146 272 167 279Q153 300 117 299M912 69Q912 35 932 26Q934 52 912 69M949 57Q954 28 975 25Q973 46 949 57M978 48Q986 19 1008 23Q1001 44 978 48M950 61Q967 80 985 77Q977 60 950 61M903 41Q879 28 878 8Q900 15 903 41" />
      </g>
      <g transform="translate(163 240)"><path d="M0 0C-20-20-15-32 0-18C18-35 25-15 9-8C35-5 22 15 9 7C9 31-11 29-8 8C-30 15-32-8-10-7Z" /><circle r="4" /></g>
      <g transform="translate(884 100) scale(.8)"><path d="M0 0C-20-20-15-32 0-18C18-35 25-15 9-8C35-5 22 15 9 7C9 31-11 29-8 8C-30 15-32-8-10-7Z" /><circle r="4" /></g>
    </g>
  </svg>;
}

export function PlayerPortrait({ seat }: { seat: string }) {
  const variant = ['east', 'south', 'west', 'north'].indexOf(seat);
  const skin = ['#d9a47b', '#e8bfa2', '#ad795b', '#d7aa88'][variant] ?? '#d9a47b';
  const shirt = ['#a5b69a', '#d5a195', '#d8bd7d', '#9ab3bb'][variant] ?? '#a5b69a';
  return <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <circle cx="24" cy="24" r="24" fill="#eee2c8" />
    <path d="M6 49Q7 33 24 34Q41 33 42 49" fill={shirt} />
    <path d="M20 29V37Q24 41 28 37V29" fill={skin} />
    <path d="M12 21Q9 7 24 7Q39 7 36 24L32 30H16Z" fill={variant === 1 ? '#66594f' : '#3d4035'} />
    <ellipse cx="24" cy="23" rx="11" ry="13" fill={skin} />
    <path d={variant % 2 ? 'M13 21Q18 19 20 12Q27 21 36 19Q35 6 23 7Q10 7 13 21' : 'M12 20Q19 14 34 17L36 22Q39 9 26 7Q12 5 12 20'} fill={variant === 1 ? '#66594f' : '#3d4035'} />
    <g fill="#37372e"><circle cx="20" cy="23" r="1" /><circle cx="28" cy="23" r="1" /></g>
    <path d="M21 29Q24 31 27 29" fill="none" stroke="#895845" strokeWidth="1.2" strokeLinecap="round" />
    {variant === 2 ? <g fill="none" stroke="#554a34" strokeWidth="1"><circle cx="19" cy="24" r="4" /><circle cx="29" cy="24" r="4" /><path d="M23 24H25" /></g> : null}
  </svg>;
}
