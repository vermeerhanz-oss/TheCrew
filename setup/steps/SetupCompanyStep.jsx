import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, ArrowRight } from 'lucide-react';

const { Company } = base44.entities;

export default function SetupCompanyStep({ wizardData, onNext, isFirstStep, nextStepLabel }) {
  const [formData, setFormData] = useState({
    name: wizardData.companyName || '',
    trading_name: wizardData.companyTradingName || '',
    abn: wizardData.companyAbn || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      setError('Company name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create or update company
      const existingCompanies = await Company.list().catch(() => []);
      let company;

      if (existingCompanies.length > 0) {
        company = existingCompanies[0];
        await Company.update(company.id, formData);
      } else {
        company = await Company.create(formData);
      }

      onNext({
        companyId: company.id,
        companyName: formData.name,
        companyTradingName: formData.trading_name,
        companyAbn: formData.abn,
      });
    } catch (err) {
      console.error('[SetupCompanyStep] Error:', err);
      setError('Could not save company details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-slate-900">Company Details</h2>
        </div>
        <p className="text-slate-500 text-sm">Tell us about your business</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-slate-800">
            Company Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Acme Pty Ltd"
            className="bg-white"
            required
          />
        </div>

        <div>
          <Label htmlFor="trading_name" className="text-slate-800">
            Trading Name
          </Label>
          <Input
            id="trading_name"
            value={formData.trading_name}
            onChange={(e) => setFormData({ ...formData, trading_name: e.target.value })}
            placeholder="Acme"
            className="bg-white"
          />
        </div>

        <div>
          <Label htmlFor="abn" className="text-slate-800">
            ABN
          </Label>
          <Input
            id="abn"
            value={formData.abn}
            onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
            placeholder="12 345 678 901"
            className="bg-white"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          disabled={isSubmitting || !formData.name}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {nextStepLabel ? `Next: ${nextStepLabel}` : 'Next'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}