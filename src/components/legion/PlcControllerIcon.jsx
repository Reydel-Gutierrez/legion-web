import React from "react";

const LEDS = [];
for (let col = 0; col < 3; col += 1) {
  for (let row = 0; row < 5; row += 1) {
    LEDS.push({
      key: `${col}-${row}`,
      x: 12.35 + col * 2.55,
      y: 6.55 + row * 2.2,
    });
  }
}

/**
 * Landscape CGM/PLC controller: DIN rails, left keypad/display, right I/O LEDs.
 * Stroke mark so it matches overview line-art and stays clear at 16–24px.
 */
export default function PlcControllerIcon({ className = "" }) {
  return (
    <svg
      className={`plc-controller-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 3.15h17M3.5 20.85h17" />
      <rect x="3.25" y="5.15" width="17.5" height="13.7" rx="1.7" />
      <path d="M10.85 5.15v13.7M3.25 11.2h7.6" />
      <rect x="4.7" y="6.55" width="2.35" height="2.35" rx="0.3" />
      <rect x="7.45" y="6.55" width="2.35" height="2.35" rx="0.3" />
      <rect x="5" y="12.55" width="4.5" height="4.7" rx="0.4" />
      {LEDS.map((led) => (
        <rect key={led.key} x={led.x} y={led.y} width="1.85" height="0.95" rx="0.45" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}
