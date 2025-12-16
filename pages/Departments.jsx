import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from '../components/ui/Card';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

export default function Departments() {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId || null;
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    if (!tenantId) return;
    try {
      const data = await api.departments.filter({ entity_id: tenantId });
      setDepartments(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading departments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      await api.departments.create({ name: newName.trim(), entity_id: tenantId });
      setNewName('');
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      console.error('Error creating department:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await api.departments.update(id, { name: editName.trim() });
      setEditingId(null);
      await loadData();
    } catch (error) {
      console.error('Error updating department:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (dept) => {
    setEditingId(dept.id);
    setEditName(dept.name);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showAddForm ? 'Cancel' : 'Add Department'}
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Input
                placeholder="Department name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button onClick={handleCreate} disabled={isSaving}>
                {isSaving ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-tutorial="departments-list">
        <CardContent className="p-0 divide-y divide-gray-200">
          {departments.length === 0 ? (
            <p className="p-4 text-center text-gray-500">No departments yet</p>
          ) : (
            departments.map((dept) => (
              <div key={dept.id} className="p-4 flex items-center justify-between">
                {editingId === dept.id ? (
                  <div className="flex gap-3 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(dept.id)}
                      autoFocus
                    />
                    <Button onClick={() => handleUpdate(dept.id)} disabled={isSaving} size="icon">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setEditingId(null)} size="icon">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-gray-900">{dept.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(dept)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}