import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { format } from 'date-fns';
import { getDisplayName } from '@/components/utils/displayName';

export default function AcknowledgementsListDialog({ open, onOpenChange, policy }) {
  const [employees, setEmployees] = useState([]);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open && policy) {
      loadData();
    }
  }, [open, policy]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Get all active employees (Scope: "All active employees" as per prompt)
      const allEmployees = await base44.entities.Employee.filter({ status: 'active' });
      
      // 2. Get all acknowledgements for this policy
      const acks = await base44.entities.PolicyAcknowledgement.filter({ policy_id: policy.id });
      
      setEmployees(allEmployees);
      setAcknowledgements(acks);
    } catch (error) {
      console.error("Failed to load acknowledgement data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatus = (employeeId) => {
    const ack = acknowledgements.find(a => a.employee_id === employeeId);
    return ack ? { status: 'accepted', date: ack.acknowledged_at } : { status: 'pending', date: null };
  };

  const filteredEmployees = employees.filter(emp => {
    const name = getDisplayName(emp).toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Policy Acknowledgements: {policy?.name}</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search employees..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acknowledged At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-gray-500">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => {
                    const { status, date } = getStatus(emp.id);
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{getDisplayName(emp)}</span>
                            <span className="text-xs text-gray-500">{emp.job_title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {status === 'accepted' ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Accepted</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {date ? format(new Date(date), 'MMM d, yyyy h:mm a') : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {!isLoading && (
            <div className="text-sm text-gray-500 flex justify-between items-center">
              <span>Total Employees: {employees.length}</span>
              <div className="space-x-4">
                <span className="text-green-600 font-medium">
                  Accepted: {acknowledgements.length}
                </span>
                <span className="text-amber-600 font-medium">
                  Pending: {employees.length - acknowledgements.length}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}