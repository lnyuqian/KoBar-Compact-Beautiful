import React from 'react';

// Cartoon big eye (open) — for the expanded eye button
export const CartoonEye: React.FC<{ size?: number }> = ({ size = 34 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        {/* Eye white */}
        <ellipse cx="24" cy="25" rx="17" ry="15" fill="#F2EDE3" stroke="#3B2A1A" strokeWidth="2.2" />
        {/* Upper eyelid line */}
        <path d="M8 19 Q24 11 40 19" stroke="#3B2A1A" strokeWidth="2.2" strokeLinecap="round" />
        {/* Iris */}
        <circle cx="24" cy="26" r="11" fill="#7A4A21" />
        {/* Pupil */}
        <circle cx="24" cy="26" r="5.5" fill="#241505" />
        {/* Highlights */}
        <circle cx="20" cy="21" r="3" fill="#FFFFFF" />
        <circle cx="27.5" cy="25" r="1.6" fill="#FFFFFF" />
        {/* Lashes */}
        <line x1="10" y1="13" x2="7" y2="7" stroke="#3B2A1A" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="17" y1="10.5" x2="15.5" y2="4.5" stroke="#3B2A1A" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="24" y1="10" x2="24" y2="3.5" stroke="#3B2A1A" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="31" y1="10.5" x2="32.5" y2="4.5" stroke="#3B2A1A" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="38" y1="13" x2="41" y2="7" stroke="#3B2A1A" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
);

// Cartoon eye closed (sleeping) — shown when fully collapsed
export const CartoonEyeClosed: React.FC<{ size?: number }> = ({ size = 34 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        {/* Closed eyelid arc (∩ shape) */}
        <path d="M8 28 Q24 12 40 28" stroke="#C4A97C" strokeWidth="2.6" strokeLinecap="round" />
        {/* Lashes */}
        <line x1="10" y1="21" x2="7" y2="15" stroke="#C4A97C" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="17" y1="17.5" x2="15.5" y2="11.5" stroke="#C4A97C" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="24" y1="16.5" x2="24" y2="10" stroke="#C4A97C" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="31" y1="17.5" x2="32.5" y2="11.5" stroke="#C4A97C" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="38" y1="21" x2="41" y2="15" stroke="#C4A97C" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
);
