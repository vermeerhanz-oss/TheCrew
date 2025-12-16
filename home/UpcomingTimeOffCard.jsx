import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Flag, ChevronRight, Plane, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function UpcomingTimeOffCard({ 
  nextLeave,
  nextLeaveChargeable,
  upcomingHolidays = [],
  teamOnLeave = [],
  isManager = false, 
  className = '' 
}) {
  const hasContent = nextLeave || upcomingHolidays.length > 0 || teamOnLeave.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Upcoming Time Off & Holidays
          </CardTitle>
          <Link to={createPageUrl('MyLeave')}>
            <Button variant="ghost" size="sm" className="text-indigo-600">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next approved leave */}
        {nextLeave && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Plane className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Your next leave</p>
                <p className="text-sm text-gray-600">
                  {format(parseISO(nextLeave.start_date), 'dd MMM')} - {format(parseISO(nextLeave.end_date), 'dd MMM yyyy')}
                </p>
                {nextLeaveChargeable && (
                  <p className="text-sm text-gray-500">
                    {nextLeaveChargeable.chargeableDays} chargeable day(s)
                    {nextLeaveChargeable.holidayCount > 0 && (
                      <span className="text-gray-400"> (excl. {nextLeaveChargeable.holidayCount} holiday{nextLeaveChargeable.holidayCount > 1 ? 's' : ''})</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Team on leave this week */}
        {isManager && teamOnLeave.length > 0 && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Team on leave this week</p>
                <div className="mt-1 space-y-1">
                  {teamOnLeave.slice(0, 3).map((lr, idx) => (
                    <p key={idx} className="text-sm text-gray-600">
                      {lr.employee_name} • {format(parseISO(lr.start_date), 'dd MMM')} - {format(parseISO(lr.end_date), 'dd MMM')}
                    </p>
                  ))}
                  {teamOnLeave.length > 3 && (
                    <p className="text-xs text-purple-600">+{teamOnLeave.length - 3} more</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming public holidays */}
        {upcomingHolidays.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Flag className="h-4 w-4 text-red-500" />
              Upcoming Public Holidays
            </p>
            <div className="space-y-2">
              {upcomingHolidays.map((holiday, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-900">{holiday.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {format(parseISO(holiday.date), 'EEE, dd MMM')}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}