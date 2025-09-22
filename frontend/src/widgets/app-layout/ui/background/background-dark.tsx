import React from 'react'

export const BackgroundDark: React.FC = () => (
  <div
    className="absolute inset-0 pointer-events-none bg-[length:150%_auto] md:bg-[length:100%_auto]"
    style={{
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`
          <svg width="100%" height="100%" viewBox="0 0 1920 8000" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="emboss" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                <feOffset dx="3" dy="3" result="offset"/>
                <feFlood flood-color="rgba(255,255,255,0.1)"/>
                <feComposite in2="offset" operator="in"/>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="textEmboss" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                <feOffset dx="2" dy="2" result="offset"/>
                <feFlood flood-color="rgba(0,0,0,0.3)"/>
                <feComposite in2="offset" operator="in"/>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="oklch(0.145 0 0)"/>
            <circle cx="250" cy="220" r="180" fill="oklch(55% 0.18 250)" opacity="1" filter="url(#emboss)"/>
            <text x="250" y="220" text-anchor="middle" dominant-baseline="central" font-family="Verdana, Geneva, sans-serif" font-size="220" font-weight="bold" transform="scale(0.66, 1)" transform-origin="250 220" fill="oklch(59% 0.18 250)" filter="url(#textEmboss)">D5</text>
            <circle cx="1650" cy="480" r="290" fill="oklch(55% 0.18 250)" opacity="1" filter="url(#emboss)"/>
            <text x="1650" y="480" text-anchor="middle" dominant-baseline="central" font-family="Verdana, Geneva, sans-serif" font-size="350" font-weight="bold" transform="scale(0.66, 1)" transform-origin="1650 480" fill="oklch(59% 0.18 250)" filter="url(#textEmboss)">D5</text>
            <circle cx="150" cy="1080" r="110" fill="oklch(55% 0.18 250)" opacity="1" filter="url(#emboss)"/>
            <text x="150" y="1080" text-anchor="middle" dominant-baseline="central" font-family="Verdana, Geneva, sans-serif" font-size="135" font-weight="bold" transform="scale(0.66, 1)" transform-origin="150 1080" fill="oklch(59% 0.18 250)" filter="url(#textEmboss)">D5</text>
            <circle cx="1750" cy="1420" r="200" fill="oklch(55% 0.18 250)" opacity="1" filter="url(#emboss)"/>
            <text x="1750" y="1420" text-anchor="middle" dominant-baseline="central" font-family="Verdana, Geneva, sans-serif" font-size="240" font-weight="bold" transform="scale(0.66, 1)" transform-origin="1750 1420" fill="oklch(59% 0.18 250)" filter="url(#textEmboss)">D5</text>
            
            <circle cx="800" cy="2100" r="160" fill="oklch(55% 0.18 250)" opacity="1" filter="url(#emboss)"/>
            <text x="800" y="2100" text-anchor="middle" dominant-baseline="central" font-family="Verdana, Geneva, sans-serif" font-size="190" font-weight="bold" transform="scale(0.66, 1)" transform-origin="800 2100" fill="oklch(59% 0.18 250)" filter="url(#textEmboss)">D5</text>
            
            <circle cx="1200" cy="3200" r="190" fill="oklch(55% 0.18 250)" opacity="1" filter="url(#emboss)"/>
            <text x="1200" y="3200" text-anchor="middle" dominant-baseline="central" font-family="Verdana, Geneva, sans-serif" font-size="230" font-weight="bold" transform="scale(0.66, 1)" transform-origin="1200 3200" fill="oklch(59% 0.18 250)" filter="url(#textEmboss)">D5</text>
            <circle cx="450" cy="3650" r="150" fill="oklch(55% 0.18 250)" opacity="1" filter="url(#emboss)"/>
            <text x="450" y="3650" text-anchor="middle" dominant-baseline="central" font-family="Verdana, Geneva, sans-serif" font-size="180" font-weight="bold" transform="scale(0.66, 1)" transform-origin="450 3650" fill="oklch(59% 0.18 250)" filter="url(#textEmboss)">D5</text>
          </svg>
        `)}")`,
      backgroundRepeat: 'repeat-y',
      backgroundPosition: 'center top',
    }}
  />
)
