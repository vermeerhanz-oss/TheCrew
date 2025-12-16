import React from 'react';
import MoonManIcon from "@/components/brand/MoonManIcon";
import { cn } from "@/lib/utils";
import { useAssistant } from './AssistantContext';

// Global AI Assistant launcher (Moon-Man)
export default function AssistantLauncher({ className }) {
  const { isOpen, toggleAssistant } = useAssistant();

  // Default Floating Launcher
  return (
    <button
      onClick={toggleAssistant}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "h-14 w-14 rounded-full",
        "bg-gradient-to-br from-indigo-600 to-purple-600",
        "shadow-lg shadow-indigo-500/30",
        "flex items-center justify-center",
        "hover:scale-105 active:scale-95",
        "transition-all duration-200",
        isOpen && "ring-4 ring-indigo-300 ring-opacity-50",
        className
      )}
      aria-label="Open AI Assistant"
    >
      <MoonManIcon size={32} className="text-white" />
    </button>
  );
}