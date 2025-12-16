import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useTenantApi } from "@/components/utils/useTenantApi";
import { useEmployeeContext } from "@/components/utils/EmployeeContext";
import { createPageUrl } from "@/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
  User,
  Globe,
  Bell,
  Palette,
  Shield,
  Users,
  Loader2,
  Save,
  Check,
  UserPlus,
  UserX,
  KeyRound,
  Mail,
  PlayCircle,
  Sparkles,
  Settings as SettingsIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { isAdmin } from "@/components/utils/permissions";
import { TIMEZONES, LANGUAGES, DATE_FORMATS } from "@/components/utils/dateFormatting";
import { getDisplayName } from "@/components/utils/displayName";
import { getEmployeeForUser } from "@/components/utils/setupHelpers";
import { clearEmployeeContextCache, updateUserFlags } from "@/components/utils/EmployeeContext";
import { useSessionReload } from "@/components/utils/SessionContext";

export default function Settings() {
  const api = useTenantApi();
  const employeeCtx = useEmployeeContext();
  const tenantId = employeeCtx?.tenantId || null;

  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);

  const [preferences, setPreferences] = useState(null);
  const [notificationPrefs, setNotificationPrefs] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ---- Resolve API handles safely (schema/key differences after migrations)
  const userPreferencesApi = api?.userPreferences;
  // try multiple likely keys for notification prefs (since your registry doesn’t currently include it)
  const notificationPrefsApi =
    api?.notificationPreferences ||
    api?.userNotificationPreferences ||
    api?.userNotificationPrefs ||
    null;

  const companySettingsApi = api?.companySettings || null;

  const canUseApi = !!api && !!api.__entityId; // scope ready check

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const emp = await getEmployeeForUser(currentUser);
      setEmployee(emp);

      // ---- User preferences (safe create-or-load)
      let loadedPrefs = null;
      if (userPreferencesApi) {
        const allPrefs = await userPreferencesApi.filter({ user_id: currentUser.id }).catch(() => []);
        loadedPrefs = allPrefs?.[0] || null;
      }

      setPreferences(
        loadedPrefs || {
          language: "en-AU",
          date_format: "DD/MM/YYYY",
          timezone: "Australia/Sydney",
        }
      );

      // ---- Notification prefs (safe even if api key missing)
      let loadedNotif = null;
      if (notificationPrefsApi) {
        const allNotif = await notificationPrefsApi.filter({ user_id: currentUser.id }).catch(() => []);
        loadedNotif = allNotif?.[0] || null;
      }

      setNotificationPrefs(
        loadedNotif || {
          leave_updates: true,
          approvals: true,
          onboarding: true,
          offboarding: true,
          policies: true,
          system_messages: true,
        }
      );
    } catch (error) {
      console.error("[Settings] Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const flashSaved = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const savePreferences = async (updates) => {
    if (!user) return;
    if (!userPreferencesApi) {
      console.warn("[Settings] userPreferences API not available (check scopeRegistry)");
      return;
    }

    setIsSaving(true);
    try {
      const next = { ...(preferences || {}), ...updates };

      if (preferences?.id) {
        await userPreferencesApi.update(preferences.id, updates);
        setPreferences((p) => ({ ...p, ...updates }));
      } else {
        const created = await userPreferencesApi.create({ user_id: user.id, ...next });
        setPreferences({ ...next, id: created.id });
      }

      flashSaved();
    } catch (error) {
      console.error("[Settings] Error saving preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveNotificationPrefs = async (updates) => {
    if (!user) return;

    if (!notificationPrefsApi) {
      console.warn(
        "[Settings] notification prefs API not available. Add it to scopeRegistry with the correct entityName."
      );
      return;
    }

    setIsSaving(true);
    try {
      const next = { ...(notificationPrefs || {}), ...updates };

      if (notificationPrefs?.id) {
        await notificationPrefsApi.update(notificationPrefs.id, updates);
        setNotificationPrefs((p) => ({ ...p, ...updates }));
      } else {
        const created = await notificationPrefsApi.create({ user_id: user.id, ...next });
        setNotificationPrefs({ ...next, id: created.id });
      }

      flashSaved();
    } catch (error) {
      console.error("[Settings] Error saving notification preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const sections = useMemo(
    () => [
      { id: "profile", label: "Profile Settings", icon: User },
      { id: "regional", label: "Language & Regional", icon: Globe },
      { id: "notifications", label: "Notification Preferences", icon: Bell },
      { id: "theme", label: "Theme & Branding", icon: Palette, adminOnly: true },
      { id: "admin", label: "Admin Mode", icon: Shield, adminOnly: true },
      { id: "accounts", label: "Account Management", icon: Users, adminOnly: true },
    ],
    []
  );

  const visibleSections = useMemo(
    () => sections.filter((s) => !s.adminOnly || isAdmin(user)),
    [sections, user]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      {!canUseApi && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Workspace scope is still loading. If buttons don’t work, wait 1–2 seconds then refresh.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <nav className="lg:w-64 flex-shrink-0">
          <Card>
            <CardContent className="p-2">
              <div className="space-y-1">
                {visibleSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      activeSection === section.id
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <section.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === "profile" && (
            <ProfileSection user={user} employee={employee} onEmployeeUpdate={loadData} />
          )}
          {activeSection === "regional" && (
            <RegionalSection
              preferences={preferences}
              onSave={savePreferences}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
            />
          )}
          {activeSection === "notifications" && (
            <NotificationsSection
              preferences={notificationPrefs}
              onSave={saveNotificationPrefs}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
              hasApi={!!notificationPrefsApi}
            />
          )}
          {activeSection === "theme" && isAdmin(user) && (
            <ThemeSection tenantId={tenantId} companySettingsApi={companySettingsApi} />
          )}
          {activeSection === "admin" && isAdmin(user) && (
            <AdminSection
              preferences={preferences}
              onSave={savePreferences}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
            />
          )}
          {activeSection === "accounts" && isAdmin(user) && <AccountsSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ user, employee, onEmployeeUpdate }) {
  const api = useTenantApi();

  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    preferred_name: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        first_name: employee.first_name || "",
        middle_name: employee.middle_name || "",
        last_name: employee.last_name || "",
        preferred_name: employee.preferred_name || "",
      });
    }
  }, [employee]);

  const handleSave = async () => {
    if (!employee) return;
    if (!api?.employees) return;

    setIsSaving(true);
    try {
      await api.employees.update(employee.id, {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        preferred_name: formData.preferred_name,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onEmployeeUpdate?.();
    } catch (error) {
      console.error("[Settings] Error saving profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = employee ? getDisplayName(employee) : user?.full_name || user?.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Your display name</p>
          <p className="text-lg font-medium text-gray-900">{displayName}</p>
          {formData.preferred_name && (
            <p className="text-xs text-gray-500 mt-1">
              Using preferred name "{formData.preferred_name}"
            </p>
          )}
        </div>

        {employee ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData((f) => ({ ...f, first_name: e.target.value }))}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label>Middle Name</Label>
              <Input
                value={formData.middle_name}
                onChange={(e) => setFormData((f) => ({ ...f, middle_name: e.target.value }))}
                placeholder="Middle name (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData((f) => ({ ...f, last_name: e.target.value }))}
                placeholder="Last name"
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred Name</Label>
              <Input
                value={formData.preferred_name}
                onChange={(e) => setFormData((f) => ({ ...f, preferred_name: e.target.value }))}
                placeholder="Preferred name (optional)"
              />
              <p className="text-xs text-gray-500">This name will be displayed in the app</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            No employee profile found. Contact your administrator to set up your profile.
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled className="bg-gray-50" />
          <p className="text-xs text-gray-500">Contact your administrator to change your email</p>
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <div>
            <Badge variant="secondary" className="capitalize">
              {user?.role || "user"}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || !employee || !formData.first_name || !formData.last_name}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saveSuccess ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RegionalSection({ preferences, onSave, isSaving, saveSuccess }) {
  const [language, setLanguage] = useState(preferences?.language || "en-AU");
  const [timezone, setTimezone] = useState(preferences?.timezone || "Australia/Sydney");
  const [dateFormat, setDateFormat] = useState(preferences?.date_format || "DD/MM/YYYY");

  useEffect(() => {
    if (preferences) {
      setLanguage(preferences.language || "en-AU");
      setTimezone(preferences.timezone || "Australia/Sydney");
      setDateFormat(preferences.date_format || "DD/MM/YYYY");
    }
  }, [preferences]);

  const handleSave = () => onSave({ language, timezone, date_format: dateFormat });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language & Regional Settings</CardTitle>
        <CardDescription>Customize language and regional preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date Format</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((fmt) => (
                <SelectItem key={fmt.value} value={fmt.value}>
                  {fmt.label} <span className="text-gray-400 ml-2">({fmt.example})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saveSuccess ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsSection({ preferences, onSave, isSaving, saveSuccess, hasApi }) {
  const [prefs, setPrefs] = useState({
    leave_updates: true,
    approvals: true,
    onboarding: true,
    offboarding: true,
    policies: true,
    system_messages: true,
  });

  useEffect(() => {
    if (preferences) {
      setPrefs({
        leave_updates: preferences.leave_updates ?? true,
        approvals: preferences.approvals ?? true,
        onboarding: preferences.onboarding ?? true,
        offboarding: preferences.offboarding ?? true,
        policies: preferences.policies ?? true,
        system_messages: preferences.system_messages ?? true,
      });
    }
  }, [preferences]);

  const handleToggle = (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    onSave?.({ [key]: value });
  };

  const categories = [
    { key: "leave_updates", label: "Leave Updates", description: "Notifications about leave requests and approvals" },
    { key: "approvals", label: "Manager Approvals", description: "When you need to approve something" },
    { key: "onboarding", label: "Onboarding Tasks", description: "Notifications about onboarding tasks" },
    { key: "offboarding", label: "Offboarding Tasks", description: "Notifications about offboarding tasks" },
    { key: "policies", label: "Policy Updates", description: "When policies are updated and require acknowledgement" },
    { key: "system_messages", label: "System Announcements", description: "Important system-wide announcements" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose which notifications you want to receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasApi && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Notification preferences entity is not wired into <code>scopeRegistry</code> yet.
            Toggles will change UI state but won’t persist until you add it.
          </div>
        )}

        {categories.map((cat) => (
          <div key={cat.key} className="flex items-center justify-between py-3 border-b last:border-0">
            <div>
              <p className="font-medium text-gray-900">{cat.label}</p>
              <p className="text-sm text-gray-500">{cat.description}</p>
            </div>
            <Switch
              checked={!!prefs[cat.key]}
              onCheckedChange={(val) => handleToggle(cat.key, val)}
              disabled={isSaving || !hasApi}
            />
          </div>
        ))}

        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600 pt-2">
            <Check className="h-4 w-4" />
            Preferences saved
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ThemeSection({ tenantId, companySettingsApi }) {
  const [settings, setSettings] = useState({
    logo_url: "",
    primary_color: "#6366F1",
    secondary_color: "#0D1117",
    use_branding: false,
  });
  const [settingsId, setSettingsId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);

  useEffect(() => {
    if (tenantId && companySettingsApi) loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const loadSettings = async () => {
    const all = await companySettingsApi.list().catch(() => []);
    if (all.length > 0) {
      setSettings({
        logo_url: all[0].logo_url || "",
        primary_color: all[0].primary_color || "#6366F1",
        secondary_color: all[0].secondary_color || "#0D1117",
        use_branding: all[0].use_branding || false,
      });
      setSettingsId(all[0].id);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSettings((s) => ({ ...s, logo_url: file_url }));
    } catch (error) {
      console.error("[Settings] Error uploading logo:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !companySettingsApi) return;

    setLocalSaving(true);
    try {
      const payload = { ...settings, entity_id: tenantId };
      if (settingsId) {
        await companySettingsApi.update(settingsId, payload);
      } else {
        const created = await companySettingsApi.create(payload);
        setSettingsId(created.id);
      }
      setLocalSuccess(true);
      setTimeout(() => setLocalSuccess(false), 2000);
      window.location.reload();
    } catch (error) {
      console.error("[Settings] Error saving company settings:", error);
    } finally {
      setLocalSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme & Branding</CardTitle>
        <CardDescription>Customize the look and feel of your HRIS</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Company Logo</Label>
          <div className="flex items-center gap-4">
            {settings.logo_url ? (
              <div className="h-16 w-40 border rounded-lg flex items-center justify-center bg-gray-50 p-2">
                <img src={settings.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="h-16 w-40 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 text-gray-400">
                No logo
              </div>
            )}

            <div className="space-y-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <Button variant="outline" size="sm" asChild disabled={isUploading}>
                  <span>{isUploading ? "Uploading..." : "Upload Logo"}</span>
                </Button>
              </label>

              {settings.logo_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSettings((s) => ({ ...s, logo_url: "" }))}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">Recommended: PNG or SVG, max 200x60px</p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.primary_color}
              onChange={(e) => setSettings((s) => ({ ...s, primary_color: e.target.value }))}
              className="h-10 w-20 rounded border cursor-pointer"
            />
            <Input
              value={settings.primary_color}
              onChange={(e) => setSettings((s) => ({ ...s, primary_color: e.target.value }))}
              className="w-32"
            />
          </div>
          <p className="text-xs text-gray-500">Used for buttons, links, and accents</p>
        </div>

        <div className="space-y-2">
          <Label>Secondary Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.secondary_color}
              onChange={(e) => setSettings((s) => ({ ...s, secondary_color: e.target.value }))}
              className="h-10 w-20 rounded border cursor-pointer"
            />
            <Input
              value={settings.secondary_color}
              onChange={(e) => setSettings((s) => ({ ...s, secondary_color: e.target.value }))}
              className="w-32"
            />
          </div>
          <p className="text-xs text-gray-500">Used for sidebar and header backgrounds</p>
        </div>

        <Separator />

        <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
          <div>
            <p className="font-medium">Use Company Branding</p>
            <p className="text-sm text-gray-500">Apply logo and colors across the application</p>
          </div>
          <Switch checked={settings.use_branding} onCheckedChange={(val) => setSettings((s) => ({ ...s, use_branding: val }))} />
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={localSaving || !companySettingsApi}>
            {localSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : localSuccess ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {localSuccess ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminSection({ preferences, onSave, isSaving, saveSuccess }) {
  const [actingMode, setActingMode] = useState(preferences?.acting_mode || "admin");
  const reloadSession = useSessionReload();

  useEffect(() => {
    if (preferences) setActingMode(preferences.acting_mode || "admin");
  }, [preferences]);

  const handleToggle = async (checked) => {
    const newMode = checked ? "admin" : "staff";
    setActingMode(newMode);
    await onSave?.({ acting_mode: newMode });
    reloadSession?.();
  };

  const isAdminMode = actingMode === "admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Mode</CardTitle>
        <CardDescription>Switch between administrator and staff access levels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", isAdminMode ? "bg-indigo-100" : "bg-gray-200")}>
              <Shield className={cn("h-5 w-5", isAdminMode ? "text-indigo-600" : "text-gray-500")} />
            </div>
            <div>
              <p className="font-medium text-gray-900">Act as Administrator</p>
              <p className="text-sm text-gray-500">
                {isAdminMode ? "Full admin access enabled" : "Restricted to personal actions only"}
              </p>
            </div>
          </div>
          <Switch checked={isAdminMode} onCheckedChange={handleToggle} disabled={isSaving} />
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Mode updated successfully
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountsSection() {
  const api = useTenantApi();
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [inviteForm, setInviteForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "user",
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const all = await api?.employees?.list().catch(() => []);
      setEmployees(all.filter((e) => e.status === "active"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.first_name || !inviteForm.last_name || !inviteForm.email) return;
    if (!api?.employees) return;

    setIsProcessing(true);
    try {
      await api.employees.create({
        first_name: inviteForm.first_name,
        last_name: inviteForm.last_name,
        email: inviteForm.email,
        status: "onboarding",
        start_date: new Date().toISOString().split("T")[0],
        job_title: "New Employee",
      });

      await base44.integrations.Core.SendEmail({
        to: inviteForm.email,
        subject: "Welcome to the Team!",
        body: `Hi ${inviteForm.first_name},\n\nYou have been invited to join our HRIS system.\n\nBest regards,\nHR Team`,
      });

      setSuccessMessage(`Invitation sent to ${inviteForm.email}`);
      setShowInviteDialog(false);
      setInviteForm({ first_name: "", last_name: "", email: "", role: "user" });
      await loadData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("[Settings] Error inviting user:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedEmployee || !api?.employees) return;

    setIsProcessing(true);
    try {
      await api.employees.update(selectedEmployee.id, {
        status: "terminated",
        termination_date: new Date().toISOString().split("T")[0],
      });

      setSuccessMessage(`${selectedEmployee.first_name} ${selectedEmployee.last_name} has been deactivated`);
      setShowDeactivateDialog(false);
      setSelectedEmployee(null);
      await loadData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("[Settings] Error deactivating user:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedEmployee) return;

    setIsProcessing(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: selectedEmployee.email,
        subject: "Password Reset Request",
        body: `Hi ${selectedEmployee.first_name},\n\nA password reset has been requested. Use the forgot password link on the login page.\n\nBest regards,\nHR Team`,
      });

      setSuccessMessage(`Password reset email sent to ${selectedEmployee.email}`);
      setShowResetDialog(false);
      setSelectedEmployee(null);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("[Settings] Error sending reset email:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Management</CardTitle>
          <CardDescription>Invite, deactivate, and manage user accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <Check className="h-4 w-4" />
              {successMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div
              onClick={() => setShowInviteDialog(true)}
              className="p-4 border rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Invite New Staff</p>
                  <p className="text-xs text-gray-500">Add a new team member</p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setShowDeactivateDialog(true)}
              className="p-4 border rounded-lg hover:border-orange-300 hover:bg-orange-50/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <UserX className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Deactivate User</p>
                  <p className="text-xs text-gray-500">Revoke access</p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setShowResetDialog(true)}
              className="p-4 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Reset Password</p>
                  <p className="text-xs text-gray-500">Send reset email</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to={createPageUrl("Employees")}>
              <Users className="h-4 w-4 mr-2" />
              View All Employees
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Setup & Tutorial */}
      <Card>
        <CardHeader>
          <CardTitle>Setup & Onboarding</CardTitle>
          <CardDescription>Re-run setup wizard or product tour at any time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <SettingsIcon className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Setup Wizard</p>
                <p className="text-sm text-gray-500">Re-configure company, entities, departments, locations</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // this assumes you store bootstrap flag on companySettings
                // if not, remove this and just clear cache + go to Setup
                try {
                  // best-effort
                  // eslint-disable-next-line no-unused-vars
                  const api2 = api;
                } catch {}
                clearEmployeeContextCache();
                window.location.href = createPageUrl("Setup");
              }}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Reset & Run Setup
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Product Tour</p>
                <p className="text-sm text-gray-500">See the guided overlay tutorial again</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (user?.id) {
                  await updateUserFlags(user.id, { has_seen_intro_tour: false });
                }
                window.location.href = createPageUrl("Home");
              }}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Launch Setup Tour Again
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Staff Member</DialogTitle>
            <DialogDescription>Enter the details for the new team member.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={inviteForm.first_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, first_name: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={inviteForm.last_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, last_name: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="john.smith@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Initial Role</Label>
              <Select value={inviteForm.role} onValueChange={(val) => setInviteForm((f) => ({ ...f, role: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Employee</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={isProcessing || !inviteForm.first_name || !inviteForm.last_name || !inviteForm.email}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>Select an employee to deactivate.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedEmployee?.id === emp.id ? "border-orange-400 bg-orange-50" : "hover:bg-gray-50"
                    )}
                  >
                    <p className="font-medium">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{emp.email}</p>
                  </div>
                ))}
                {employees.length === 0 && <p className="text-center text-gray-500 py-4">No active employees found</p>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeactivateDialog(false);
                setSelectedEmployee(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={isProcessing || !selectedEmployee}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserX className="h-4 w-4 mr-2" />}
              Deactivate User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Select an employee to send a password reset email.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedEmployee?.id === emp.id ? "border-blue-400 bg-blue-50" : "hover:bg-gray-50"
                    )}
                  >
                    <p className="font-medium">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{emp.email}</p>
                  </div>
                ))}
                {employees.length === 0 && <p className="text-center text-gray-500 py-4">No active employees found</p>}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResetDialog(false);
                setSelectedEmployee(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={isProcessing || !selectedEmployee}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Send Reset Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
