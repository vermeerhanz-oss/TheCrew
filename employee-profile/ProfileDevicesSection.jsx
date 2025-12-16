import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Laptop, Smartphone, Tablet, Monitor, Headphones, Package, Loader2, Plus, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

const DeviceAssignment = base44.entities.DeviceAssignment;

const DEVICE_ICONS = {
  'Laptop': Laptop,
  'Phone': Smartphone,
  'Tablet': Tablet,
  'Monitor': Monitor,
  'Headphones': Headphones,
  'Other': Package,
};

export default function ProfileDevicesSection({ employee, canEdit }) {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadDevices();
  }, [employee]);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const allDevices = await DeviceAssignment.filter({ employee_id: employee.id });
      setDevices(allDevices);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignDevice = () => {
    setFormData({
      device_type: 'Laptop',
      label: '',
      device_id_or_serial: '',
      assigned_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowAssignDialog(true);
  };

  const handleSaveAssignment = async () => {
    if (!formData.label || !formData.device_id_or_serial) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSaving(true);
    try {
      await DeviceAssignment.create({
        ...formData,
        employee_id: employee.id,
        is_active: true,
      });
      toast.success('Device assigned');
      await loadDevices();
      setShowAssignDialog(false);
    } catch (error) {
      console.error('Error assigning device:', error);
      toast.error('Failed to assign device');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkReturned = (device) => {
    setSelectedDevice(device);
    setFormData({
      returned_date: new Date().toISOString().split('T')[0],
      notes: device.notes || '',
    });
    setShowReturnDialog(true);
  };

  const handleSaveReturn = async () => {
    setIsSaving(true);
    try {
      await DeviceAssignment.update(selectedDevice.id, {
        returned_date: formData.returned_date,
        is_active: false,
        notes: formData.notes,
      });
      toast.success('Device marked as returned');
      await loadDevices();
      setShowReturnDialog(false);
    } catch (error) {
      console.error('Error returning device:', error);
      toast.error('Failed to mark device as returned');
    } finally {
      setIsSaving(false);
    }
  };

  const activeDevices = devices.filter(d => !d.returned_date);
  const pastDevices = devices.filter(d => d.returned_date);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Laptop className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No devices recorded yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Track laptops and other equipment here so you know who has what.
            </p>
            {canEdit === true && (
              <Button onClick={handleAssignDevice}>
                <Plus className="h-4 w-4 mr-1" />
                Assign device
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const DeviceCard = ({ device }) => {
    const Icon = DEVICE_ICONS[device.device_type] || Package;
    const isActive = !device.returned_date;

    return (
      <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900">{device.label}</p>
                <p className="text-sm text-gray-500">{device.device_id_or_serial}</p>
              </div>
              <Badge className={isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                {isActive ? 'Active' : 'Returned'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Assigned: {format(parseISO(device.assigned_date), 'dd MMM yyyy')}
              {device.returned_date && ` • Returned: ${format(parseISO(device.returned_date), 'dd MMM yyyy')}`}
            </p>
            {device.notes && (
              <p className="text-xs text-gray-600 mt-1">{device.notes}</p>
            )}
            {isActive && canEdit === true && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => handleMarkReturned(device)}
              >
                Mark as returned
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Devices</h2>
            {canEdit === true && (
              <Button onClick={handleAssignDevice}>
                <Plus className="h-4 w-4 mr-1" />
                Assign device
              </Button>
            )}
          </div>

          {activeDevices.length > 0 && (
            <>
              <h3 className="font-medium text-gray-900 mb-4">Active Devices ({activeDevices.length})</h3>
              <div className="grid gap-4 mb-6">
                {activeDevices.map(device => (
                  <DeviceCard key={device.id} device={device} />
                ))}
              </div>
            </>
          )}

          {pastDevices.length > 0 && (
            <>
              <hr className="my-6" />
              <h3 className="font-medium text-gray-900 mb-4">Past Devices ({pastDevices.length})</h3>
              <div className="grid gap-4">
                {pastDevices.map(device => (
                  <DeviceCard key={device.id} device={device} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Assign Device Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Device Type</Label>
              <Select
                value={formData.device_type}
                onValueChange={(v) => setFormData({ ...formData, device_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Laptop">Laptop</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="Tablet">Tablet</SelectItem>
                  <SelectItem value="Monitor">Monitor</SelectItem>
                  <SelectItem value="Headphones">Headphones</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label <span className="text-red-500">*</span></Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g. MacBook Pro 14"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Device ID / Serial <span className="text-red-500">*</span></Label>
              <Input
                value={formData.device_id_or_serial}
                onChange={(e) => setFormData({ ...formData, device_id_or_serial: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Assigned Date</Label>
              <Input
                type="date"
                value={formData.assigned_date}
                onChange={(e) => setFormData({ ...formData, assigned_date: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAssignment} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Assign Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Device Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Device as Returned</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Return Date</Label>
              <Input
                type="date"
                value={formData.returned_date}
                onChange={(e) => setFormData({ ...formData, returned_date: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveReturn} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Mark as Returned
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}