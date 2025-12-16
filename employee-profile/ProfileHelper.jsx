import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import BrandedLogo from '@/components/branding/BrandedLogo';

/**
 * Small contextual helper modal for guiding users through profile completion.
 * Matches the black & white branding of Setup wizard.
 */
export default function ProfileHelper({ title, body, primaryLabel, secondaryLabel, onPrimary, onSecondary, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-8 animate-in slide-in-from-bottom-4">
        {/* Close button */}
        <button
          onClick={onClose || onSecondary}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo header */}
        <div className="flex flex-col items-center mb-6">
          <BrandedLogo size="sm" className="mb-3" />
          <div className="h-px w-12 bg-slate-200" />
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h2 className="mb-3 text-2xl font-semibold text-slate-900">
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            {body}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={onPrimary}
            className="w-full bg-slate-900 hover:bg-black text-white"
            size="lg"
          >
            {primaryLabel}
          </Button>
          {secondaryLabel && (
            <Button
              onClick={onSecondary}
              variant="ghost"
              className="w-full text-slate-500 hover:text-slate-700"
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}