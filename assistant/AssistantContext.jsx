import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AssistantContext = createContext(null);

// Provider is used in layout.js to wrap the entire app
export function AssistantProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeContext, setActiveContext] = useState({ key: 'global', prompt: null });
  
  // Page-aware context state
  const [pageContext, setPageContext] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);

  const openAssistant = useCallback((params = {}) => {
    if (params.systemPrompt) {
      setActiveContext({ 
        key: params.contextKey || 'custom', 
        prompt: params.systemPrompt 
      });
    }
    setIsOpen(true);
  }, []);

  const openWithMessage = useCallback((message) => {
    setPendingMessage(message);
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => setIsOpen(false), []);
  
  const toggleAssistant = useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <AssistantContext.Provider value={{ 
      isOpen, 
      activeContext, 
      pageContext,
      setPageContext,
      pendingMessage,
      setPendingMessage,
      openAssistant, 
      openWithMessage,
      closeAssistant, 
      toggleAssistant 
    }}>
      {children}
    </AssistantContext.Provider>
  );
}

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
};

export const usePageAssistant = (config) => {
  const { setPageContext } = useAssistant();
  
  // Use a ref or memo to avoid infinite loops if config object is recreated on every render
  // But for simplicity, we'll rely on JSON.stringify for dependency checking in useEffect
  // or assume the user wraps config in useMemo if it's dynamic.
  // Actually, simpler: just stringify the dependency.
  const configStr = JSON.stringify(config);

  useEffect(() => {
    setPageContext(config);
    return () => setPageContext(null);
  }, [configStr, setPageContext]);
};