import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const DocumentTemplate = base44.entities.DocumentTemplate;

export default function TemplateDocumentViewer({ templateId, className }) {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!templateId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        // Try get first, fallback to filter
        let tmpl = null;
        try {
          tmpl = await DocumentTemplate.get(templateId);
        } catch {
          const list = await DocumentTemplate.filter({ id: templateId });
          if (list.length > 0) tmpl = list[0];
        }
        setTemplate(tmpl);
      } catch (err) {
        console.error("Failed to load template", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [templateId]);

  if (loading) {
    return (
      <div className={`flex justify-center items-center p-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className={`p-6 bg-red-50 text-red-600 rounded-lg flex items-center gap-3 ${className}`}>
        <AlertCircle className="h-5 w-5" />
        <p>Failed to load document.</p>
      </div>
    );
  }

  // Viewer logic
  const isPdf = template.file_mime_type === 'application/pdf' || template.file_name?.toLowerCase().endsWith('.pdf');
  
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded border shadow-sm">
            <FileText className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{template.name}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {template.version_label && <span className="bg-gray-200 px-1.5 py-0.5 rounded">{template.version_label}</span>}
              <span>{template.file_name}</span>
            </div>
          </div>
        </div>
        {template.file_url && (
          <a href={template.file_url} target="_blank" rel="noopener noreferrer" download>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </a>
        )}
      </div>

      {isPdf && template.file_url ? (
        <iframe 
          src={template.file_url} 
          className="w-full h-[600px] rounded-lg border border-gray-200 bg-gray-50"
          title="Document Preview"
        />
      ) : (
        <Card className="bg-gray-50 border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Preview not available</h3>
            <p className="text-gray-500 max-w-md mt-2">
              This document type cannot be previewed directly. Please download the file to view its contents.
            </p>
            {template.file_url && (
              <a href={template.file_url} target="_blank" rel="noopener noreferrer" download className="mt-6">
                <Button>Download File</Button>
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}