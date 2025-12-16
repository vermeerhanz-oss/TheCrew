
import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'; // Note: CardHeader/Title might need check if exported
import { Badge } from '../ui/Badge';
import { Button } from '@/components/ui/button'; // Shadcn button
import { format } from 'date-fns';
import { FileText, ExternalLink, Plus } from 'lucide-react';
import { canViewDocument } from '@/components/utils/permissions';
import CreateAgreementDialog from './CreateAgreementDialog';

const Document = base44.entities.Document;

export function EmployeeDocuments({ employeeId, employee, user, currentEmployee, canEdit }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true); // Ensure loading state is true when data is being fetched
    try {
      const docs = await Document.filter({ employee_id: employeeId });
      // Filter by permission
      const visibleDocs = docs.filter(doc => canViewDocument(user, doc, employee, currentEmployee));
      setDocuments(visibleDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, user, employee, currentEmployee]); // Dependencies for useCallback

  useEffect(() => {
    loadData();
  }, [loadData]); // useEffect depends on the memoized loadData function

  const typeColors = {
    policy: 'danger',
    contract: 'success',
    handbook: 'warning',
    form: 'info',
    other: 'default',
    employment_agreement: 'success'
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
           <h3 className="font-medium text-gray-900">Documents ({documents.length})</h3>
           {canEdit && (
             <Button size="sm" onClick={() => setShowCreateDialog(true)}>
               <Plus className="h-4 w-4 mr-2" />
               Create Agreement
             </Button>
           )}
        </div>
        <CardContent className="p-0 divide-y divide-gray-200">
          {documents.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No documents assigned to this employee
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{doc.name || doc.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={typeColors[doc.category] || 'default'}>{doc.category}</Badge>
                      <span className="text-xs text-gray-500">
                        {doc.issued_date ? format(new Date(doc.issued_date), 'dd MMM yyyy') : format(new Date(doc.created_date || new Date()), 'dd MMM yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <CreateAgreementDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        employee={employee}
        onSuccess={loadData}
      />
    </>
  );
}
