import React, { createContext, useContext, useState, useEffect } from 'react';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { useTenantApi } from '@/components/utils/useTenantApi';

const DEFAULT_STEPS = [
  {
    id: "welcome",
    title: "Welcome to FoundersCrew",
    description: "I'll guide you through the key setup steps in a few clicks.",
    route: "/home",
    targetSelector: "body"
  },
  {
    id: "company-settings",
    title: "Company Settings",
    description: "This is where your core company details live.",
    route: "/companysettings",
    targetSelector: "[data-tutorial='company-settings-tile']"
  },
  {
    id: "entities",
    title: "Entities",
    description: "Entities represent your legal structures. Let's make sure you have at least one.",
    route: "/entities",
    targetSelector: "[data-tutorial='entities-list']"
  },
  {
    id: "locations",
    title: "Office Locations",
    description: "Offices determine time zones and public holidays.",
    route: "/locations",
    targetSelector: "[data-tutorial='locations-list']"
  },
  {
    id: "departments",
    title: "Departments",
    description: "Organise your people into departments for approvals and reporting.",
    route: "/departments",
    targetSelector: "[data-tutorial='departments-list']"
  },
  {
    id: "leave-policies",
    title: "Leave Policies",
    description: "Your leave rules live here. Start with annual and personal leave.",
    route: "/leavepolicies",
    targetSelector: "[data-tutorial='leave-policies-table']"
  },
  {
    id: "branding",
    title: "Branding & Theme",
    description: "Make the workspace yours with your logo and colours.",
    route: "/companysettings",
    targetSelector: "[data-tutorial='branding-panel']"
  },
  {
    id: "invite-team",
    title: "Invite Your Team",
    description: "Optionally invite your first teammates so they can log in.",
    route: "/employees",
    targetSelector: "[data-tutorial='invite-employee-button']"
  },
  {
    id: "complete",
    title: "All Done!",
    description: "Your workspace is ready. You can re-run this tour any time later.",
    route: "/home",
    targetSelector: "body"
  }
];

const TutorialContext = createContext(null);

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
}

export function TutorialProvider({ children }) {
  const employeeCtx = useEmployeeContext();
  const api = useTenantApi();
  const [active, setActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [onFinishCallback, setOnFinishCallback] = useState(null);
  const steps = DEFAULT_STEPS;

  const startTutorial = () => {
    console.log('[TutorialContext] Starting tutorial');
    setActive(true);
    setCurrentStepIndex(0);
  };

  const endTutorial = async (options = {}) => {
    setActive(false);
    
    // Mark as seen in backend (whether skipped or completed)
    try {
      const userId = employeeCtx?.user?.id;
      if (userId && api?.userPreferences) {
        const prefs = await api.userPreferences.filter({ user_id: userId }).catch(() => []);
        if (prefs.length > 0) {
          await api.userPreferences.update(prefs[0].id, { has_seen_intro_tour: true });
        } else {
          await api.userPreferences.create({ user_id: userId, has_seen_intro_tour: true });
        }
      }
    } catch (err) {
      console.error('Error marking tour as seen:', err);
    }
    
    if (options.markSkipped) {
      localStorage.setItem('fcw_tutorial_skipped', 'true');
    } else {
      // Mark as completed
      localStorage.setItem('fcw_tutorial_completed', 'true');
      
      // Call finish callback if provided (for setup completion)
      if (onFinishCallback) {
        try {
          await onFinishCallback();
        } catch (err) {
          console.error('[Tutorial] Error in finish callback:', err);
        }
      }
    }
  };

  const nextStep = () => {
    if (currentStepIndex >= steps.length - 1) {
      endTutorial();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const setStepById = (id) => {
    const index = steps.findIndex((s) => s.id === id);
    if (index !== -1) {
      setCurrentStepIndex(index);
    }
  };

  const restartTutorial = () => {
    console.log('[TutorialContext] Restarting tutorial');
    setCurrentStepIndex(0);
    setActive(true);
  };

  // Expose for dev debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__devStartTutorial = startTutorial;
      window.__devEndTutorial = endTutorial;
      window.__devRestartTutorial = restartTutorial;
    }
  }, []);

  const value = {
    active,
    currentStepIndex,
    steps,
    currentStep: steps[currentStepIndex],
    startTutorial,
    endTutorial,
    nextStep,
    prevStep,
    setStepById,
    restartTutorial,
    setOnFinishCallback: (callback) => setOnFinishCallback(() => callback),
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}