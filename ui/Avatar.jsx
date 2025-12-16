import React from "react";

// Simple Avatar primitives so imports like
// { Avatar, AvatarImage, AvatarFallback } work.

export function Avatar({ className = "", children }) {
  return (
    <div
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function AvatarImage({ src, alt = "", className = "" }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={["h-full w-full object-cover", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export function AvatarFallback({ className = "", children }) {
  return (
    <span
      className={[
        "text-xs font-medium text-gray-700 flex items-center justify-center h-full w-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
