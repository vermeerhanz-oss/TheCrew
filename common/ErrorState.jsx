import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn’t load this section. Please try again.',
  onRetry,
}) {
  return (
    <Card className="w-full max-w-md mx-auto border-red-100 bg-red-50/50 shadow-sm">
      <CardContent className="flex flex-col items-center p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6 max-w-xs mx-auto">
          {message}
        </p>
        {onRetry && (
          <Button 
            onClick={onRetry}
            variant="outline"
            className="gap-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}