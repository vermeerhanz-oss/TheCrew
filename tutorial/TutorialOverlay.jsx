import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useTutorial } from './TutorialContext';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function TutorialOverlay() {
  const { active, currentStep, nextStep, prevStep, endTutorial, currentStepIndex, steps } = useTutorial();
  const navigate = useNavigate();
  const location = useLocation();
  const [targetRect, setTargetRect] = useState(null);

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Navigate to step route when step changes
  useEffect(() => {
    if (!active || !currentStep) return;

    const targetRoute = createPageUrl(getPageNameFromRoute(currentStep.route));
    if (location.pathname !== targetRoute) {
      navigate(targetRoute);
    }
  }, [currentStep, active, navigate, location.pathname]);

  // Find and track target element
  useEffect(() => {
    if (!active || !currentStep) return;

    const updateTargetRect = () => {
      const target = document.querySelector(currentStep.targetSelector);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    // Initial calculation
    setTimeout(updateTargetRect, 100);

    // Update on scroll/resize
    window.addEventListener('scroll', updateTargetRect, true);
    window.addEventListener('resize', updateTargetRect);

    return () => {
      window.removeEventListener('scroll', updateTargetRect, true);
      window.removeEventListener('resize', updateTargetRect);
    };
  }, [active, currentStep]);

  if (!active) return null;

  const handleSkip = () => {
    endTutorial({ markSkipped: true });
  };

  const handleFinish = () => {
    endTutorial({ markSkipped: false });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999]"
      >
        {/* Light overlay - not fully blocking */}
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleSkip} />

        {/* Highlight box around target */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none"
            style={{
              left: targetRect.left - 8,
              top: targetRect.top - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              border: '3px solid #6366F1',
              borderRadius: '12px',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 30px rgba(99, 102, 241, 0.5)',
            }}
          />
        )}

        {/* Moon Man bubble */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="absolute pointer-events-auto"
          style={getMoonManPosition(targetRect)}
        >
          <Card className="w-96 shadow-2xl border-2 border-indigo-500/30 bg-white/95 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              {/* Moon Man avatar */}
              <div className="flex items-start gap-4">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl flex-shrink-0"
                >
                  🌙
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-bold text-lg text-gray-900">{currentStep.title}</h3>
                    <button
                      onClick={handleSkip}
                      className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{currentStep.description}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2 px-1">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      idx === currentStepIndex
                        ? 'bg-indigo-600'
                        : idx < currentStepIndex
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  onClick={prevStep}
                  disabled={isFirstStep}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSkip}
                    variant="ghost"
                    size="sm"
                    className="text-gray-500"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={isLastStep ? handleFinish : nextStep}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                  >
                    {isLastStep ? 'Finish' : 'Next'}
                    {!isLastStep && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper to convert route to page name
function getPageNameFromRoute(route) {
  const routeMap = {
    '/home': 'Home',
    '/companysettings': 'CompanySettings',
    '/entities': 'Entities',
    '/locations': 'Locations',
    '/departments': 'Departments',
    '/leavepolicies': 'LeavePolicies',
    '/employees': 'Employees',
  };
  return routeMap[route] || 'Home';
}

// Calculate Moon Man bubble position
function getMoonManPosition(targetRect) {
  if (!targetRect) {
    // Center if no target
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const padding = 24;
  const bubbleWidth = 384; // w-96 = 24rem = 384px

  // Try to position to the right of target
  if (targetRect.right + padding + bubbleWidth < window.innerWidth) {
    return {
      top: targetRect.top,
      left: targetRect.right + padding,
    };
  }

  // Try to position to the left
  if (targetRect.left - padding - bubbleWidth > 0) {
    return {
      top: targetRect.top,
      left: targetRect.left - padding - bubbleWidth,
    };
  }

  // Position below
  return {
    top: targetRect.bottom + padding,
    left: Math.max(padding, Math.min(targetRect.left, window.innerWidth - bubbleWidth - padding)),
  };
}