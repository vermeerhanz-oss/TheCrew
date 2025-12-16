import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from '../components/ui/Card';
import { Plus, Pencil, Check, X, MapPin, Home, Building2 } from 'lucide-react';
import { useTenantApi } from '@/components/utils/useTenantApi';
import { useEmployeeContext } from '@/components/utils/EmployeeContext';

export default function Locations() {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId || null;
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', address: '', location_type: 'office' });
  const [newData, setNewData] = useState({ name: '', address: '', location_type: 'office' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    if (!tenantId) return;
    try {
      const data = await api.locations.filter({ entity_id: tenantId });
      setLocations(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newData.name.trim()) return;
    
    // Remote locations don't require address
    if (newData.location_type !== 'remote' && !newData.address.trim()) {
      alert('Address is required for office and hybrid locations');
      return;
    }
    
    setIsSaving(true);
    try {
      await api.locations.create({ 
        name: newData.name.trim(), 
        address: newData.address.trim() || null,
        location_type: newData.location_type || 'office',
        entity_id: tenantId
      });
      setNewData({ name: '', address: '', location_type: 'office' });
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      console.error('Error creating location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editData.name.trim()) return;
    
    // Remote locations don't require address
    if (editData.location_type !== 'remote' && !editData.address.trim()) {
      alert('Address is required for office and hybrid locations');
      return;
    }
    
    setIsSaving(true);
    try {
      await api.locations.update(id, { 
        name: editData.name.trim(), 
        address: editData.address.trim() || null,
        location_type: editData.location_type || 'office'
      });
      setEditingId(null);
      await loadData();
    } catch (error) {
      console.error('Error updating location:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setEditData({ 
      name: loc.name, 
      address: loc.address || '', 
      location_type: loc.location_type || 'office' 
    });
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
        <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showAddForm ? 'Cancel' : 'Add Location'}
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Location Type</Label>
              <Select
                value={newData.location_type}
                onValueChange={(v) => setNewData({ ...newData, location_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Location name"
              value={newData.name}
              onChange={(e) => setNewData({ ...newData, name: e.target.value })}
            />
            {newData.location_type !== 'remote' && (
              <Input
                placeholder="Address"
                value={newData.address}
                onChange={(e) => setNewData({ ...newData, address: e.target.value })}
              />
            )}
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Adding...' : 'Add Location'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card data-tutorial="locations-list">
        <CardContent className="p-0 divide-y divide-gray-200">
          {locations.length === 0 ? (
            <p className="p-4 text-center text-gray-500">No locations yet</p>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="p-4">
                {editingId === loc.id ? (
                  <div className="space-y-3">
                    <div>
                      <Label>Location Type</Label>
                      <Select
                        value={editData.location_type}
                        onValueChange={(v) => setEditData({ ...editData, location_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="office">Office</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      autoFocus
                    />
                    {editData.location_type !== 'remote' && (
                      <Input
                        placeholder="Address"
                        value={editData.address}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      />
                    )}
                    <div className="flex gap-3">
                      <Button onClick={() => handleUpdate(loc.id)} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{loc.name}</span>
                        {loc.location_type === 'remote' && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            <Home className="h-3 w-3 mr-1" />
                            Remote
                          </Badge>
                        )}
                        {loc.location_type === 'hybrid' && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                            <Building2 className="h-3 w-3 mr-1" />
                            Hybrid
                          </Badge>
                        )}
                        {(!loc.location_type || loc.location_type === 'office') && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                            <MapPin className="h-3 w-3 mr-1" />
                            Office
                          </Badge>
                        )}
                      </div>
                      {loc.address && <p className="text-sm text-gray-500 mt-1">{loc.address}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(loc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}