import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, ArrowRight, ArrowLeft } from 'lucide-react';

export default function SetupProfileStep({ user, wizardData, onNext, onBack, nextStepLabel }) {
  const [formData, setFormData] = useState({
    first_name: wizardData.firstName || user?.full_name?.split(' ')[0] || '',
    last_name: wizardData.lastName || user?.full_name?.split(' ').slice(1).join(' ') || '',
    email: wizardData.email || user?.email || '',
    job_title: wizardData.jobTitle || 'Founder',
  });
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.first_name || !formData.last_name || !formData.email || !formData.job_title) {
      setError('All fields are required');
      return;
    }

    onNext({
      firstName: formData.first_name,
      lastName: formData.last_name,
      email: formData.email,
      jobTitle: formData.job_title,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-slate-900">Your Profile</h2>
        </div>
        <p className="text-slate-500 text-sm">Tell us about yourself</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name" className="text-slate-800">
              First Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              placeholder="John"
              className="bg-white"
              required
            />
          </div>
          <div>
            <Label htmlFor="last_name" className="text-slate-800">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              placeholder="Smith"
              className="bg-white"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email" className="text-slate-800">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@company.com"
            className="bg-white"
            required
          />
        </div>

        <div>
          <Label htmlFor="job_title" className="text-slate-800">
            Job Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="job_title"
            value={formData.job_title}
            onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
            placeholder="Founder / CEO"
            className="bg-white"
            required
          />
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {nextStepLabel ? `Next: ${nextStepLabel}` : 'Next'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}