import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { CURRENT_BOOTSTRAP_VERSION, BASELINE_METADATA } from '@/components/utils/bootstrapConstants';

const { CompanyEntity } = base44.entities;

export default function SetupEntityStep({ wizardData, onNext, onBack, nextStepLabel }) {
  const [formData, setFormData] = useState({
    name: wizardData.entityName || wizardData.companyTradingName || wizardData.companyName || '',
    abbreviation: wizardData.entityAbbreviation || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      setError('Entity name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('[SetupEntityStep] Creating new entity for this tenant');
      
      // 🔥 CRITICAL FIX: Always create a new entity for each tenant
      // Never reuse existing entities - this was causing cross-tenant contamination
      const entity = await CompanyEntity.create({
        name: formData.name,
        abbreviation: formData.abbreviation || formData.name.slice(0, 6).toUpperCase(),
        country: 'Australia',
        timezone: 'Australia/Sydney',
        status: 'active',
        // Baseline metadata for tracking and reset safety
        ...BASELINE_METADATA,
        bootstrapVersion: CURRENT_BOOTSTRAP_VERSION,
        baselineKey: 'entity:primary',
      });
      
      console.log('[SetupEntityStep] Created entity:', entity.id, entity.name);

      onNext({
        entityId: entity.id,
        entityName: formData.name,
        entityAbbreviation: formData.abbreviation,
      });
    } catch (err) {
      console.error('[SetupEntityStep] Error:', err);
      setError('Could not save entity details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-slate-900">Primary Entity</h2>
        </div>
        <p className="text-slate-500 text-sm">Your legal structure or trading entity</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-slate-800">
            Entity Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Acme"
            className="bg-white"
            required
          />
        </div>

        <div>
          <Label htmlFor="abbreviation" className="text-slate-800">
            Abbreviation
          </Label>
          <Input
            id="abbreviation"
            value={formData.abbreviation}
            onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
            placeholder="ACME"
            className="bg-white"
            maxLength={10}
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