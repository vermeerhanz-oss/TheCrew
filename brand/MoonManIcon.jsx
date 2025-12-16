import React from "react";
// Assuming the asset will be placed here by the developer
// If using a real URL for now to prevent breakage:
// const moonManUrl = "https://illustrations.popsy.co/amber/astronaut.svg"; 
// But sticking to the requested import for the "real" implementation:
// import moonMan from "@/assets/moon-man.png";

// Fallback SVG if image is missing (for immediate visual feedback)
const FallbackMoonMan = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <circle cx="12" cy="12" r="10" fill="#0F172A" />
    <path d="M12 6C14.2091 6 16 7.79086 16 10V11C16 13.2091 14.2091 15 12 15C9.79086 15 8 13.2091 8 11V10C8 7.79086 9.79086 6 12 6Z" fill="white"/>
    <path d="M8 16C5.79086 16 4 17.7909 4 20V22H20V20C20 17.7909 18.2091 16 16 16H8Z" fill="white"/>
  </svg>
);

export default function MoonManIcon({ size = 24, className = "" }) {
  const dimension = typeof size === "number" ? `${size}px` : size;
  
  const moonManSrc = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69250351a830bf7f30cb08f3/f769cc7de_ChatGPTImageNov27202510_43_14AM.png"; 

  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      <img
        src={moonManSrc}
        alt="Moon Man Assistant"
        className="w-full h-full object-cover"
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.parentNode.classList.add('bg-slate-900');
        }}
      />
    </div>
  );
}