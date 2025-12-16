import React from 'react';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export function SessionExpired() {
  const loginUrl = base44.config?.LOGIN_URL || '/auth/login';

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Your session has expired
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You’ve been logged out or your session is no longer valid. Please sign in again to continue using FoundersCreW.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button
            asChild
            className="text-sm"
          >
            <a href={loginUrl}>
              <LogIn className="mr-1.5 h-4 w-4" />
              Go to login
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SessionExpired;