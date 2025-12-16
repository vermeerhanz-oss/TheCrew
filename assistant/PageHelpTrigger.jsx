import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useAssistant } from '@/components/assistant/AssistantContext';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function PageHelpTrigger() {
  const { openWithMessage } = useAssistant();

  const handleClick = () => {
    openWithMessage("Explain this page and how to use it.");
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
            onClick={handleClick}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ask the Assistant about this page</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}