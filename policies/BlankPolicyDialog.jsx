import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, FileText, Loader2, X, File } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

const CATEGORIES = [
  'HR',
  'IT',
  'Workplace Health & Safety',
  'Finance',
  'Legal',
  'Operations',
  'Other',
];

export default function BlankPolicyDialog({ open, onOpenChange, onSuccess }) {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  // const tenantId = employeeCtx?.tenantId || null; // currently unused

  const [creationMode, setCreationMode] = useState('editor'); // 'editor' | 'upload'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [entities, setEntities] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    entity_id: 'all',
    country: '',
    is_mandatory: false,
    is_active: true,
    content: '', // For editor mode or summary in upload mode
  });

  // File State
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState({
    file_url: '',
    file_name: '',
    file_mime_type: '',
    file_size_bytes: 0,
  });

  useEffect(() => {
    if (!open) return;

    // Reset state on open
    setCreationMode('editor');
    setFormData({
      name: '',
      code: '',
      category: '',
      entity_id: 'all',
      country: '',
      is_mandatory: false,
      is_active: true,
      content: '',
    });
    setFile(null);
    setFileData({
      file_url: '',
      file_name: '',
      file_mime_type: '',
      file_size_bytes: 0,
    });

    loadEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadEntities = async () => {
    if (!api) return;
    try {
      // Tenant-aware entity lookup via api
      const ents = await api.companyEntities.list();
      setEntities(ents || []);
    } catch (error) {
      console.error("Failed to load entities", error);
      toast.error("Failed to load entities");
    }
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({
        file: selectedFile,
      });

      setFileData({
        file_url,
        file_name: selectedFile.name,
        file_mime_type: selectedFile.type,
        file_size_bytes: selectedFile.size,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
      setFile(null);
      setFileData({
        file_url: '',
        file_name: '',
        file_mime_type: '',
        file_size_bytes: 0,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Policy name is required");
      return;
    }

    if (creationMode === 'upload' && !fileData.file_url) {
      toast.error("Please upload a policy document");
      return;
    }

    setIsSubmitting(true);
    try {
      const policyData = {
        name: formData.name,
        code: formData.code,
        category: formData.category,
        entity_id: formData.entity_id === 'all' ? null : formData.entity_id,
        country: formData.country,
        is_mandatory: formData.is_mandatory,
        is_active: formData.is_active,
        type: 'OTHER',

        // Content & File logic
        content: formData.content || '', // Markdown content or summary
        has_uploaded_file: creationMode === 'upload',
        file_url: creationMode === 'upload' ? fileData.file_url : null,
        file_name: creationMode === 'upload' ? fileData.file_name : null,
        file_mime_type: creationMode === 'upload' ? fileData.file_mime_type : null,
        file_size_bytes: creationMode === 'upload' ? fileData.file_size_bytes : null,
      };

      const created = await base44.entities.Policy.create(policyData);
      toast.success("Policy created successfully");
      onSuccess?.(created);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating policy", error);
      toast.error("Failed to create policy");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogChange = (nextOpen) => {
    // Don’t allow closing while submitting or uploading
    if (!nextOpen && (isSubmitting || isUploading)) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Policy</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Creation Mode Selection */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <Label className="mb-3 block text-slate-700">
              How would you like to create this policy?
            </Label>
            <RadioGroup
              value={creationMode}
              onValueChange={setCreationMode}
              className="grid grid-cols-1 gap-3"
            >
              <div
                className={`flex items-center space-x-3 p-3 rounded-md border transition-colors ${
                  creationMode === 'editor'
                    ? 'bg-white border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}
              >
                <RadioGroupItem value="editor" id="mode-editor" />
                <Label
                  htmlFor="mode-editor"
                  className="flex-1 cursor-pointer font-normal"
                >
                  <div className="font-medium text-slate-900">
                    Write policy in this app
                  </div>
                  <div className="text-xs text-slate-500">
                    Use the built-in editor to write and format your policy
                  </div>
                </Label>
                <FileText className="h-5 w-5 text-slate-400" />
              </div>

              <div
                className={`flex items-center space-x-3 p-3 rounded-md border transition-colors ${
                  creationMode === 'upload'
                    ? 'bg-white border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}
              >
                <RadioGroupItem value="upload" id="mode-upload" />
                <Label
                  htmlFor="mode-upload"
                  className="flex-1 cursor-pointer font-normal"
                >
                  <div className="font-medium text-slate-900">
                    Upload existing policy document
                  </div>
                  <div className="text-xs text-slate-500">
                    Upload a PDF, DOCX, or other file
                  </div>
                </Label>
                <Upload className="h-5 w-5 text-slate-400" />
              </div>
            </RadioGroup>
          </div>

          {/* Common Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Policy Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={
                  creationMode === 'upload'
                    ? 'e.g. Remote Work Policy (PDF)'
                    : 'e.g. Remote Work Policy'
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="entity">Scope</Label>
                <Select
                  value={formData.entity_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, entity_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {creationMode === 'upload' && (
              <div className="space-y-2">
                <Label>Upload Document</Label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
                  {!file ? (
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.txt"
                      />
                      <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <div className="text-sm text-slate-600 font-medium">
                        Click to upload file
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        PDF, DOCX up to 10MB
                      </div>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 text-left">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-indigo-100 p-2 rounded">
                          <File className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate text-slate-900">
                            {file.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                            {isUploading && (
                              <span className="ml-2 text-indigo-600">
                                Uploading...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setFile(null);
                          setFileData({
                            file_url: '',
                            file_name: '',
                            file_mime_type: '',
                            file_size_bytes: 0,
                          });
                        }}
                      >
                        <X className="h-4 w-4 text-slate-500" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Employees will be able to download and acknowledge this
                  document. The system does not validate the legal content of
                  uploaded policies.
                </p>
              </div>
            )}

            {creationMode === 'editor' && (
              <div className="bg-slate-50 p-4 rounded text-sm text-slate-600 border border-slate-200">
                You'll be able to write the policy content in the next step or in
                the policy editor view.
              </div>
            )}

            {creationMode === 'upload' && (
              <div>
                <Label htmlFor="summary">Summary / Notes (Optional)</Label>
                <Textarea
                  id="summary"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="Brief summary of what this policy covers..."
                  rows={3}
                />
              </div>
            )}

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="new-mandatory"
                  checked={formData.is_mandatory}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      is_mandatory: !!checked,
                    })
                  }
                />
                <Label
                  htmlFor="new-mandatory"
                  className="font-normal cursor-pointer"
                >
                  Mandatory
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="new-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      is_active: !!checked,
                    })
                  }
                />
                <Label
                  htmlFor="new-active"
                  className="font-normal cursor-pointer"
                >
                  Active
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleDialogChange(false)}
            disabled={isSubmitting || isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              isUploading ||
              !formData.name.trim() ||
              (creationMode === 'upload' && !fileData.file_url)
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Policy'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
