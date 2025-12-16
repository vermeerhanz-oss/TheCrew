import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Loader2, ArrowRight, ArrowLeft, Home } from 'lucide-react';
import { CURRENT_BOOTSTRAP_VERSION, BASELINE_METADATA, getLocationBaselineKey } from '@/components/utils/bootstrapConstants';

const { Location } = base44.entities;

const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
];

export default function SetupLocationStep({ wizardData, onNext, onBack, nextStepLabel }) {
  const [locationType, setLocationType] = useState('office'); // 'office', 'remote', or 'hybrid'
  const [formData, setFormData] = useState({
    name: wizardData.locationName || '',
    suburb: wizardData.locationCity || '',
    state: wizardData.locationState || '',
    country: 'Australia',
  });
  
  console.log('[FoundersCreW][SetupLocationStep] wizardData:', { entityId: wizardData.entityId, locationType });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (locationType === 'office' && !formData.name) {
      setError('Office name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const entityId = wizardData.entityId;
      if (!entityId) {
        throw new Error('No entity ID found');
      }

      // Create location
      let locationData;
      let locationName;
      
      if (locationType === 'remote') {
        locationName = 'Remote';
        locationData = {
          entity_id: entityId,
          name: locationName,
          location_type: 'remote',
          country: 'Australia',
          timezone: 'Australia/Sydney',
          is_default: true,
          // Baseline metadata
          ...BASELINE_METADATA,
          bootstrapVersion: CURRENT_BOOTSTRAP_VERSION,
          baselineKey: getLocationBaselineKey(locationName) || 'location:remote',
        };
      } else if (locationType === 'hybrid') {
        locationName = formData.name || 'Hybrid Office';
        locationData = {
          entity_id: entityId,
          name: locationName,
          location_type: 'hybrid',
          suburb: formData.suburb,
          state: formData.state,
          country: formData.country,
          timezone: 'Australia/Sydney',
          is_default: true,
          // Baseline metadata
          ...BASELINE_METADATA,
          bootstrapVersion: CURRENT_BOOTSTRAP_VERSION,
          baselineKey: getLocationBaselineKey(locationName) || `location:${locationName.toLowerCase().replace(/\s+/g, '_')}`,
        };
      } else {
        locationName = formData.name;
        locationData = {
          entity_id: entityId,
          name: locationName,
          location_type: 'office',
          suburb: formData.suburb,
          state: formData.state,
          country: formData.country,
          timezone: 'Australia/Sydney',
          is_default: true,
          // Baseline metadata
          ...BASELINE_METADATA,
          bootstrapVersion: CURRENT_BOOTSTRAP_VERSION,
          baselineKey: getLocationBaselineKey(locationName) || `location:${locationName.toLowerCase().replace(/\s+/g, '_')}`,
        };
      }
      
      console.log('[FoundersCreW][SetupLocationStep] Creating location:', locationData);

      const existingLocations = await Location.filter({ entity_id: entityId });
      let location;

      if (existingLocations.length > 0) {
        location = existingLocations[0];
        await Location.update(location.id, locationData);
      } else {
        location = await Location.create(locationData);
      }

      onNext({
        locationId: location.id,
        locationName: locationData.name,
        locationCity: locationData.suburb,
        locationState: locationData.state,
        locationType,
      });
    } catch (err) {
      console.error('[SetupLocationStep] Error:', err);
      setError('Could not save location details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-slate-900">Office Location</h2>
        </div>
        <p className="text-slate-500 text-sm">Where is your team based?</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {/* Location Type Selector */}
      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setLocationType('office')}
          className={`
            p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all
            ${locationType === 'office'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-200 hover:border-slate-300'
            }
          `}
        >
          <MapPin className={`h-6 w-6 ${locationType === 'office' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className={`font-medium text-sm ${locationType === 'office' ? 'text-indigo-900' : 'text-slate-600'}`}>
            Office
          </span>
        </button>

        <button
          type="button"
          onClick={() => setLocationType('remote')}
          className={`
            p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all
            ${locationType === 'remote'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-200 hover:border-slate-300'
            }
          `}
        >
          <Home className={`h-6 w-6 ${locationType === 'remote' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className={`font-medium text-sm ${locationType === 'remote' ? 'text-indigo-900' : 'text-slate-600'}`}>
            Remote
          </span>
        </button>
        
        <button
          type="button"
          onClick={() => setLocationType('hybrid')}
          className={`
            p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all
            ${locationType === 'hybrid'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-200 hover:border-slate-300'
            }
          `}
        >
          <MapPin className={`h-6 w-6 ${locationType === 'hybrid' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className={`font-medium text-sm ${locationType === 'hybrid' ? 'text-indigo-900' : 'text-slate-600'}`}>
            Hybrid
          </span>
        </button>
      </div>

      {/* Office Details (shown for office and hybrid) */}
      {(locationType === 'office' || locationType === 'hybrid') && (
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="name" className="text-slate-800">
              Office Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Head Office"
              className="bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="suburb" className="text-slate-800">City</Label>
              <Input
                id="suburb"
                value={formData.suburb}
                onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                placeholder="Sydney"
                className="bg-white"
              />
            </div>
            <div>
              <Label htmlFor="state" className="text-slate-800">State</Label>
              <Select
                value={formData.state}
                onValueChange={(v) => setFormData({ ...formData, state: v })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {AUSTRALIAN_STATES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {locationType === 'remote' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <p className="text-sm text-indigo-900">
            Your team will be listed as "Remote" with no physical office location.
          </p>
        </div>
      )}
      
      {locationType === 'hybrid' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            Hybrid work arrangement - employees work from multiple locations.
          </p>
        </div>
      )}

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
          disabled={isSubmitting}
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