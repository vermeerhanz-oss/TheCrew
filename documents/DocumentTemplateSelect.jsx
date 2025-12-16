import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const DocumentTemplate = base44.entities.DocumentTemplate;

export function useDocumentTemplates({ category, status = 'ACTIVE' } = {}) {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        // Build filter
        const filter = { status };
        if (category) {
          filter.category = category;
        }
        
        // Sort by name
        const results = await DocumentTemplate.filter(filter, 'name', 100);
        setTemplates(results);
      } catch (err) {
        console.error("Failed to load templates", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [category, status]);

  return { templates, isLoading, error };
}

export default function DocumentTemplateSelect({ 
  value, 
  onChange, 
  category, 
  label,
  placeholder = "Select a document...",
  className,
  disabled
}) {
  const { templates, isLoading } = useDocumentTemplates({ category });

  const handleChange = (val) => {
    onChange(val);
  };

  return (
    <Select 
      value={value || ""} 
      onValueChange={handleChange} 
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {templates.map((tmpl) => (
          <SelectItem key={tmpl.id} value={tmpl.id}>
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">{tmpl.name}</span>
              {tmpl.version_label && (
                <span className="text-xs text-gray-500">
                  {tmpl.version_label} • {tmpl.category}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
        {!isLoading && templates.length === 0 && (
          <div className="p-2 text-sm text-gray-500 text-center">
            No active documents found
          </div>
        )}
      </SelectContent>
    </Select>
  );
}