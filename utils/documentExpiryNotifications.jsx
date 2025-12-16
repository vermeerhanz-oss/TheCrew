export async function checkDocumentExpiryNotifications() {
  try {
    const [documents, employees, adminUsers] = await Promise.all([
      Document.list(),
      Employee.list(),
      base44.entities.User.filter({ role: 'admin' }),
    ]);

    const today = new Date();
    const employeeMap = {};
    employees.forEach(e => { employeeMap[e.id] = e; });

    const expiringDocs = documents.filter(doc => {
      if (!doc.expiry_date) return false;
      const expiryDate = parseISO(doc.expiry_date);
      const daysUntilExpiry = differenceInDays(expiryDate, today);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    });

    for (const doc of expiringDocs) {
      const employee = employeeMap[doc.owner_employee_id];
      if (!employee) continue;

      const expiryDateFormatted = format(parseISO(doc.expiry_date), 'MMM d, yyyy');
      const link = `EmployeeProfile?id=${employee.id}`;

      // Employee notification
      if (employee.user_id) {
        await sendNotification({
          userId: employee.user_id,
          type: 'document_expiring',
          title: 'Document expiring soon',
          message: `${doc.file_name} expires on ${expiryDateFormatted}`,
          link,
          relatedEmployeeId: employee.id,
        });
      }

      // Manager notification
      if (doc.visibility === 'manager' || doc.visibility === 'admin') {
        if (employee.manager_id) {
          const manager = employeeMap[employee.manager_id];
          if (manager?.user_id) {
            await sendNotification({
              userId: manager.user_id,
              type: 'document_expiring',
              title: 'Team document expiring soon',
              message: `${doc.file_name} for ${employee.first_name} ${employee.last_name} expires on ${expiryDateFormatted}`,
              link,
              relatedEmployeeId: employee.id,
            });
          }
        }
      }

      // Admin notifications
      if (doc.visibility === 'admin') {
        for (const admin of adminUsers) {
          if (admin.id === employee.user_id) continue;
          const managerEmployee = employee.manager_id ? employeeMap[employee.manager_id] : null;
          if (managerEmployee?.user_id === admin.id) continue;

          await sendNotification({
            userId: admin.id,
            type: 'document_expiring',
            title: 'Employee document expiring soon',
            message: `${doc.file_name} for ${employee.first_name} ${employee.last_name} expires on ${expiryDateFormatted}`,
            link,
            relatedEmployeeId: employee.id,
          });
        }
      }
    }

    return { checked: expiringDocs.length };
  } catch (error) {
    console.error('Error checking document expiry notifications:', error);
    return { error: error.message };
  }
}
