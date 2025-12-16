
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import { BrandingProvider, useBranding } from '@/components/branding/BrandingProvider';
import BrandedLogo from '@/components/branding/BrandedLogo';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

import AssistantLauncher from '@/components/assistant/AssistantLauncher';
import AssistantSidebar from '@/components/assistant/AssistantSidebar';
import { AssistantProvider, useAssistant } from '@/components/assistant/AssistantContext';
import { AssistantContextRegistry } from '@/components/assistant/contextRegistry';
import { TutorialProvider, useTutorial } from '@/components/tutorial/TutorialContext';
import TutorialOverlay from '@/components/tutorial/TutorialOverlay';
import ScopeDebugBadge from '@/components/dev/ScopeDebugBadge';

import { getCurrentUserEmployeeContextSafe } from '@/components/utils/authClient';
import { EmployeeProvider } from '@/components/utils/EmployeeContext';
import { SessionReloadContext } from '@/components/utils/SessionContext';

import { SessionExpired } from '@/components/auth/SessionExpired';
import ErrorState from '@/components/common/ErrorState';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { ConfigProvider } from '@/components/providers/ConfigProvider';

import { X, Loader2 } from 'lucide-react';
import Home from '@/pages/Home';

const BARE_PAGES = ['Login', 'ForgotPassword', 'ResetPassword', 'Setup'];

function AppShell({ children, currentPageName }) {
  const [context, setContext] = useState(null);
  const { setPageContext } = useAssistant();
  const tutorial = useTutorial();

  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null); // 'SESSION_EXPIRED' | 'LOAD_FAILED' | null
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const branding = useBranding();

  // Debug: AppShell render
  console.log('🟦 [AppShell] render, page =', currentPageName);

  // Keep assistant page context in sync
  useEffect(() => {
    const contextConfig = AssistantContextRegistry[currentPageName];
    setPageContext(contextConfig || null);

    if (typeof window !== 'undefined') {
      window.__fcwAssistantDebug = {
        pageId: currentPageName,
        ctx: contextConfig,
      };
    }
  }, [currentPageName, setPageContext]);

  useEffect(() => {
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadContext() {
    setIsLoading(true);
    setAuthError(null);

    try {
      console.log('🟦 [AppShell] loadContext() starting');
      const result = await getCurrentUserEmployeeContextSafe();

      // Multi-tenant debug logs
      console.log('🟦 [AppShell] tenantId:', result?.tenantId ?? null);
      console.log('🟦 [AppShell] employeeId:', result?.employee?.id ?? null);
      console.log('🟦 [AppShell] userEmail:', result?.user?.email ?? null);
      console.log('🟦 [AppShell] employees count:', result?.employees?.length ?? 0);
      console.log('🟦 [AppShell] isAuthenticated:', result?.isAuthenticated);

      if (!result.isAuthenticated) {
        console.log('🟦 [AppShell] Not authenticated - showing session expired');
        setAuthError('SESSION_EXPIRED');
        setContext(null);
        setIsLoading(false);
        return;
      }

      // 🔐 Read local setup completion override (breaks the loop even if tenantFlags lag or never flip)
      let localSetupCompleted = false;
      if (typeof window !== 'undefined') {
        try {
          localSetupCompleted = window.localStorage.getItem('fcw_setup_completed') === 'true';
        } catch (e) {
          console.warn('🟦 [AppShell] Failed to read local setup flag', e);
        }
      }

      // Check bootstrap completion status from tenantFlags
      const hasCompletedBootstrapFlag = result.tenantFlags?.hasCompletedBootstrap;
      console.log(
        '🟦 [AppShell] hasCompletedBootstrapFlag =',
        hasCompletedBootstrapFlag,
        'localSetupCompleted =',
        localSetupCompleted
      );

      // Decide whether we should force the user back into Setup
      let shouldForceSetup = false;

      if (hasCompletedBootstrapFlag === false) {
        // Backend says "not complete" → only force Setup if we *also* don't have a local completed flag
        shouldForceSetup = !localSetupCompleted;
      } else if (typeof hasCompletedBootstrapFlag === 'undefined') {
        // No flag from backend → fall back to local flag
        shouldForceSetup = !localSetupCompleted;
      } else {
        // hasCompletedBootstrapFlag === true
        shouldForceSetup = false;
      }

      if (shouldForceSetup && result.isAdmin && currentPageName !== 'Setup') {
        console.log('🟦 [AppShell] bootstrap not complete (or no local completion) – redirecting admin to Setup');
        window.location.href = createPageUrl('Setup');
        return;
      }

      // Normal path – set context
      console.log(
        '🟦 [AppShell] Setting context - user:',
        !!result.user,
        'employee:',
        !!result.employee
      );
      setContext(result);
      setIsLoading(false);

      // Auto-start intro tour overlay for new users on Home
      const hasSeenIntroTour = result.userFlags?.hasSeenIntroTour ?? false;
      if (!hasSeenIntroTour && !tutorial.active && currentPageName === 'Home') {
        console.log('🟦 [AppShell] Auto-starting intro tour for new user');
        setTimeout(() => tutorial.startTutorial(), 500);
      }
    } catch (err) {
      console.error('Failed to load user context', err);
      setAuthError('LOAD_FAILED');
      setContext(null);
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <BrandedLogo size="lg" darkBg className="mb-6" />
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (authError === 'SESSION_EXPIRED') {
    return <SessionExpired />;
  }

  if (authError === 'LOAD_FAILED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <ErrorState
            title="Something went wrong"
            message="We couldn’t load your company workspace. Please refresh or contact support."
            onRetry={loadContext}
          />
        </div>
      </div>
    );
  }

  const sidebarBg = branding?.useBranding ? branding.secondaryColor : '#0D1117';

  return (
    <div className="min-h-screen bg-gray-50">
      {branding?.useBranding && (
        <style>{`:root { --brand-primary: ${branding.primaryColor}; --brand-secondary: ${branding.secondaryColor}; }`}</style>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        style={{ backgroundColor: sidebarBg }}
      >
        <div className="h-16 flex-shrink-0 flex items-center justify-between px-4 border-b border-slate-700/50">
          <Link to={createPageUrl('Home')} onClick={() => setSidebarOpen(false)}>
            <BrandedLogo size="sm" darkBg />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar
            currentPageName={currentPageName}
            context={context}
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <EmployeeProvider value={context}>
          <TopBar onMenuToggle={() => setSidebarOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        </EmployeeProvider>
      </div>

      <AssistantLauncher />
      <AssistantSidebar />
      <TutorialOverlay />
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const [sessionVersion, setSessionVersion] = useState(0);
  const location = useLocation();

  // Debug: Layout render
  console.log('🟦 [Layout] render, route =', location.pathname, 'pageName =', currentPageName);

  // Treat "/" as the Home page and component
  const effectivePageName = location.pathname === '/' ? 'Home' : currentPageName;
  const content = location.pathname === '/' ? <Home /> : children;

  const handleContextReload = useCallback(() => {
    setSessionVersion((v) => v + 1);
  }, []);

  // Bare pages (no shell chrome)
  if (BARE_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <SessionReloadContext.Provider value={handleContextReload}>
      <ConfigProvider key={sessionVersion}>
        <BrandingProvider>
          <TutorialProvider>
            <AssistantProvider>
              <AppShell currentPageName={effectivePageName}>{content}</AppShell>
            </AssistantProvider>
          </TutorialProvider>
        </BrandingProvider>
      </ConfigProvider>
    </SessionReloadContext.Provider>
  );
}
