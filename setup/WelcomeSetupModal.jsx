import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';

export default function WelcomeSetupModal({ open, onStartSetup, onSkipSetup }) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-indigo-600" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSkipSetup}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogTitle className="text-2xl">Welcome to FoundersCrew!</DialogTitle>
          <DialogDescription className="text-base">
            We'll guide you through setting up your company workspace, configuring leave
            policies, and inviting your team. This takes about 10 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-green-700">1</span>
            </div>
            <div>
              <p className="font-medium text-sm">Company & Locations</p>
              <p className="text-sm text-gray-600">Set up your entities and offices</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-blue-700">2</span>
            </div>
            <div>
              <p className="font-medium text-sm">Leave & Policies</p>
              <p className="text-sm text-gray-600">Configure annual and personal leave</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-purple-700">3</span>
            </div>
            <div>
              <p className="font-medium text-sm">Invite Your Team</p>
              <p className="text-sm text-gray-600">Add employees and managers</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={onStartSetup} className="w-full bg-indigo-600 hover:bg-indigo-700">
            Start Guided Setup
          </Button>
          <Button onClick={onSkipSetup} variant="ghost" className="w-full">
            Skip for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}