import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const SuperProfile = base44.entities.SuperProfile;

export default function ProfileSuperSection({ employee, canEdit }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadProfile();
  }, [employee]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const profiles = await SuperProfile.filter({ employee_id: employee.id });
      setProfile(profiles[0] || null);
    } catch (error) {
      console.error('Error loading super profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = () => {
    setFormData({
      fund_name: profile?.fund_name || '',
      member_number: profile?.member_number || '',
      fund_type: profile?.fund_type || 'Default fund',
      notes: profile?.notes || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (profile) {
        await SuperProfile.update(profile.id, formData);
      } else {
        await SuperProfile.create({ ...formData, employee_id: employee.id });
      }
      toast.success('Super details saved');
      await loadProfile();
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving super profile:', error);
      toast.error('Failed to save super details');
    } finally {
      setIsSaving(false);
    }
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

  if (!profile && !isEditing) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No super details added yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Add them now so contributions go to the right fund.
            </p>
            {canEdit === true && (
              <Button onClick={startEditing}>
                Add super details
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Superannuation</h2>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-xs text-gray-500">Fund Name</Label>
            {isEditing ? (
              <Input
                value={formData.fund_name}
                onChange={(e) => setFormData({ ...formData, fund_name: e.target.value })}
                placeholder="e.g. AustralianSuper"
                className="mt-1"
              />
            ) : (
              <p className="text-gray-900 mt-1 font-medium">{profile?.fund_name || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-xs text-gray-500">Member Number</Label>
            {isEditing ? (
              <Input
                value={formData.member_number}
                onChange={(e) => setFormData({ ...formData, member_number: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-gray-900 mt-1">{profile?.member_number || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-xs text-gray-500">Fund Type</Label>
            {isEditing ? (
              <Select
                value={formData.fund_type}
                onValueChange={(v) => setFormData({ ...formData, fund_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Default fund">Default fund</SelectItem>
                  <SelectItem value="Employee choice">Employee choice</SelectItem>
                  <SelectItem value="Self-managed (SMSF)">Self-managed (SMSF)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-gray-900 mt-1">{profile?.fund_type || '—'}</p>
            )}
          </div>
        </div>

        {(isEditing || profile?.notes) && (
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
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{profile?.notes || '—'}</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}