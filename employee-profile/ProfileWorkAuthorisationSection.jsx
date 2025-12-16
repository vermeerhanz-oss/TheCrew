import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pencil, Save, X, Loader2, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

const WorkAuthorisation = base44.entities.WorkAuthorisation;

export default function ProfileWorkAuthorisationSection({ employee, canEdit }) {
  const [auth, setAuth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    loadAuth();
  }, [employee]);

  const loadAuth = async () => {
    setIsLoading(true);
    try {
      const auths = await WorkAuthorisation.filter({ employee_id: employee.id });
      setAuth(auths[0] || null);
    } catch (error) {
      console.error('Error loading work authorisation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = () => {
    setFormData({
      status: auth?.status || 'Citizen / PR',
      expiry_date: auth?.expiry_date || '',
      document_url: auth?.document_url || '',
      notes: auth?.notes || '',
    });
    setIsEditing(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, document_url: result.file_url });
      toast.success('Document uploaded');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (auth) {
        await WorkAuthorisation.update(auth.id, formData);
      } else {
        await WorkAuthorisation.create({ ...formData, employee_id: employee.id });
      }
      toast.success('Work authorisation saved');
      await loadAuth();
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving work authorisation:', error);
      toast.error('Failed to save work authorisation');
    } finally {
      setIsSaving(false);
    }
  };

  const getExpiryWarning = (expiryDate) => {
    if (!expiryDate) return null;
    const days = differenceInDays(parseISO(expiryDate), new Date());
    if (days < 0) return { type: 'expired', message: 'Expired' };
    if (days <= 90) return { type: 'warning', message: `Expires in ${days} days` };
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!auth && !isEditing) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No work authorisation recorded</h3>
            <p className="text-sm text-gray-500 mb-6">
              Add work authorisation so you don't lose track of visas or right-to-work documents.
            </p>
            {canEdit === true && (
              <Button onClick={startEditing}>
                Add work authorisation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const expiryWarning = auth?.expiry_date ? getExpiryWarning(auth.expiry_date) : null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Work Authorisation</h2>
          {canEdit === true && !isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          )}
        </div>

        {expiryWarning && !isEditing && (
          <Alert className={`mb-6 ${expiryWarning.type === 'expired' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
            <AlertTriangle className={`h-4 w-4 ${expiryWarning.type === 'expired' ? 'text-red-600' : 'text-amber-600'}`} />
            <AlertDescription className={expiryWarning.type === 'expired' ? 'text-red-800' : 'text-amber-800'}>
              {expiryWarning.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-xs text-gray-500">Status</Label>
            {isEditing ? (
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Citizen / PR">Citizen / PR</SelectItem>
                  <SelectItem value="Visa">Visa</SelectItem>
                  <SelectItem value="Student visa">Student visa</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1">
                <Badge className={auth?.status === 'Citizen / PR' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                  {auth?.status}
                </Badge>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs text-gray-500">Expiry Date</Label>
            {isEditing ? (
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-gray-900 mt-1">
                {auth?.expiry_date ? format(parseISO(auth.expiry_date), 'dd MMM yyyy') : '—'}
              </p>
            )}
          </div>
        </div>

        <hr className="my-6" />

        <div>
          <Label className="text-xs text-gray-500">Document</Label>
          {isEditing ? (
            <div className="mt-1">
              <Input
                type="file"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="mt-1"
              />
              {uploadingFile && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
              {formData.document_url && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Document uploaded
                </p>
              )}
            </div>
          ) : (
            auth?.document_url ? (
              <a
                href={auth.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 mt-1 block text-sm"
              >
                View document
              </a>
            ) : (
              <p className="text-gray-900 mt-1">—</p>
            )
          )}
        </div>

        {(isEditing || auth?.notes) && (
          <>
            <hr className="my-6" />
            <div>
              <Label className="text-xs text-gray-500">Notes</Label>
              {isEditing ? (
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes"
                  className="mt-1"
                  rows={3}
                />
              ) : (
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{auth?.notes || '—'}</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}