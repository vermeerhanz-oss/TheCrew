import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Pencil, 
  Trash2, 
  Upload, 
  MoreVertical,
  Loader2,
  File,
  Calendar,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useRequirePermission } from '@/components/utils/useRequirePermission';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';
import { toast } from 'sonner';
import { useTenantApi } from '@/components/utils/useTenantApi';

const CATEGORIES = [
  "POLICY",
  "EMPLOYMENT_AGREEMENT",
  "ONBOARDING",
  "OFFBOARDING",
  "GENERAL"
];

export default function DocumentTemplates() {
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId;
  const api = useTenantApi();

  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  // Permission check
  const { isAllowed, isLoading: permLoading } = useRequirePermission(employeeCtx, 'canManageCompanySettings', {
    requireAdminMode: true
  });

  useEffect(() => {
    if (tenantId && isAllowed) {
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isAllowed]);

  const loadTemplates = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const data = await api.documentTemplates?.list('-updated_at', 100) || [];
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load documents", error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setShowModal(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowModal(true);
  };

  const handleToggleStatus = async (template) => {
    try {
      const newStatus = template.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      
      // Validation: cannot activate without file
      if (newStatus === 'ACTIVE' && !template.file_url) {
        toast.error("Cannot activate a document without a file");
        return;
      }

      await api.documentTemplates?.update(template.id, { status: newStatus });
      
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? { ...t, status: newStatus } : t
      ));
      
      toast.success(`Document ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error("Error updating status", error);
      toast.error("Failed to update status");
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAllowed) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 mt-1">Store and manage reusable company documents.</p>
        </div>
        <Button onClick={handleCreate}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No documents found</h3>
          <p className="text-gray-500 mt-1 mb-4">Get started by uploading your first document.</p>
          <Button onClick={handleCreate} variant="outline">Upload Document</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard 
              key={template.id} 
              template={template} 
              onEdit={() => handleEdit(template)}
              onToggleStatus={() => handleToggleStatus(template)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <TemplateFormDialog 
        open={showModal} 
        onOpenChange={setShowModal}
        template={editingTemplate}
        onSuccess={loadTemplates}
      />
    </div>
  );
}

function TemplateCard({ template, onEdit, onToggleStatus }) {
  const isInactive = template.status === 'INACTIVE';
  
  return (
    <Card className={`transition-all hover:shadow-sm ${isInactive ? 'opacity-75 bg-gray-50' : 'bg-white'}`}>
      <div className="p-4 flex items-start gap-4">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isInactive ? 'bg-gray-200' : 'bg-indigo-50'}`}>
          <FileText className={`h-5 w-5 ${isInactive ? 'text-gray-500' : 'text-indigo-600'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
              <Badge variant={isInactive ? "secondary" : "outline"} className={isInactive ? "bg-gray-200" : "bg-green-50 text-green-700 border-green-200"}>
                {template.status}
              </Badge>
              {template.version_label && (
                <Badge variant="outline" className="text-gray-500">
                  {template.version_label}
                </Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Details
                </DropdownMenuItem>
                {template.file_url && (
                  <DropdownMenuItem asChild>
                    <a href={template.file_url} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-4 w-4 mr-2" />
                      Download Document
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggleStatus}>
                  {isInactive ? 'Activate Document' : 'Deactivate Document'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {template.category}
              {template.subcategory && <span className="text-gray-400"> / {template.subcategory}</span>}
            </span>
            
            {template.effective_from && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Effective: {template.effective_from}
              </span>
            )}
            
            {template.file_name && (
              <span className="flex items-center gap-1">
                <File className="h-3 w-3" />
                {template.file_name}
                {template.file_size_bytes && (
                  <span className="text-gray-400">
                    ({Math.round(template.file_size_bytes / 1024)} KB)
                  </span>
                )}
              </span>
            )}
          </div>
          
          {template.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{template.description}</p>
          )}
          
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {template.tags.map(tag => (
                <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function TemplateFormDialog({ open, onOpenChange, template, onSuccess }) {
  const api = useTenantApi();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'POLICY',
    subcategory: '',
    description: '',
    version_label: '',
    effective_from: '',
    status: 'ACTIVE',
    tags: [],
    file_url: '',
    file_name: '',
    file_mime_type: '',
    file_size_bytes: 0
  });
  
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        category: template.category || 'POLICY',
        subcategory: template.subcategory || '',
        description: template.description || '',
        version_label: template.version_label || '',
        effective_from: template.effective_from || '',
        status: template.status || 'ACTIVE',
        tags: template.tags || [],
        file_url: template.file_url || '',
        file_name: template.file_name || '',
        file_mime_type: template.file_mime_type || '',
        file_size_bytes: template.file_size_bytes || 0
      });
    } else {
      // Reset for new
      setFormData({
        name: '',
        category: 'POLICY',
        subcategory: '',
        description: '',
        version_label: '',
        effective_from: '',
        status: 'ACTIVE',
        tags: [],
        file_url: '',
        file_name: '',
        file_mime_type: '',
        file_size_bytes: 0
      });
    }
  }, [template, open]);

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setIsSubmitting(true);
      // Upload file using Base44 integration (not tenant-scoped data)
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setFormData(prev => ({
        ...prev,
        file_url,
        file_name: file.name,
        file_mime_type: file.type,
        file_size_bytes: file.size
      }));
      
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("File upload failed", error);
      toast.error("File upload failed");
    } finally {
      setIsSubmitting(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error("Document name is required");
      return;
    }
    if (formData.status === 'ACTIVE' && !formData.file_url) {
      toast.error("An active document must have a file");
      return;
    }

    setIsSubmitting(true);
    try {
      if (template) {
        await api.documentTemplates?.update(template.id, formData);
        toast.success("Document updated");
      } else {
        await api.documentTemplates?.create(formData);
        toast.success("Document created");
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Save failed", error);
      toast.error("Failed to save document");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Document' : 'Upload Document'}</DialogTitle>
          <DialogDescription>
            Manage document details and file.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Document Name *</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Standard Employment Agreement"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Subcategory</Label>
              <Input 
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                placeholder="e.g. IT, Sales, Casual"
                className="mt-1"
              />
            </div>
            
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Briefly describe what this document is used for..."
                className="mt-1"
                rows={3}
              />
            </div>
            
            <div>
              <Label>Version Label</Label>
              <Input 
                value={formData.version_label}
                onChange={(e) => setFormData({ ...formData, version_label: e.target.value })}
                placeholder="e.g. v1.0 or 2025-Q1"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Effective From</Label>
              <Input 
                type="date"
                value={formData.effective_from}
                onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div className="sm:col-span-2">
              <Label>Tags (Press Enter to add)</Label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md mt-1 bg-white">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input 
                  className="flex-1 outline-none bg-transparent min-w-[120px] text-sm"
                  placeholder={formData.tags.length === 0 ? "Type tags..." : ""}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                />
              </div>
            </div>
          </div>

          {/* File Upload */}
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="p-6">
              <div className="text-center">
                {formData.file_url ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 text-indigo-600">
                      <FileText className="h-8 w-8" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{formData.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {(formData.file_size_bytes / 1024).toFixed(1)} KB • {formData.file_mime_type}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={formData.file_url} target="_blank" rel="noopener noreferrer" download>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Replace Document
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Replacing updates the content for new documents. Existing issued documents remain unchanged.
                    </p>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900">Upload document file</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOCX, or TXT up to 10MB</p>
                    <Button variant="secondary" size="sm" className="mt-3">Choose File</Button>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={handleFileUpload}
                />
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
            <div>
              <Label className="text-base">Active Status</Label>
              <p className="text-sm text-gray-500">
                Inactive documents won't appear in selection lists.
              </p>
            </div>
            <Switch 
              checked={formData.status === 'ACTIVE'}
              onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'ACTIVE' : 'INACTIVE' })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {template ? 'Save Changes' : 'Upload Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}