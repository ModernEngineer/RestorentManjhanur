import { useEffect, useState } from 'react';
import { adminApi } from '@/api/endpoints';
import { ErrorBanner, RowsSkeleton, Spinner } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAsync, usePageTitle } from '@/hooks/useAsync';

/**
 * App settings - WhatsApp number, GST %, delivery radius, packaging fee waghera.
 * Ye values API aur frontend dono padhte hain (jaise WhatsApp button ka number).
 */

const GROUPS: { title: string; keys: string[]; hint?: string }[] = [
  {
    title: 'Site aur contact',
    keys: ['SiteName', 'SupportPhone', 'WhatsAppNumber', 'WhatsAppMessage', 'CurrencySymbol', 'DefaultCity'],
    hint: 'Enter the WhatsApp number with country code, without + (e.g. 919810000000).',
  },
  {
    title: 'Delivery',
    keys: ['MaxDeliveryRadiusKm', 'PackagingFeeSmall', 'PackagingFeeLarge'],
    hint: 'Each restaurant also has its own delivery radius - this is the global reference.',
  },
  {
    title: 'Tax aur booking',
    keys: ['GstPercentFood', 'GstPercentHall', 'HallAdvancePercent'],
    hint: 'GST % differs for orders and hall bookings.',
  },
];

export default function AdminSettings() {
  usePageTitle('Settings');

  const toast = useToast();
  const { data, isLoading, error, reload } = useAsync(() => adminApi.settings(), []);

  const [values, setValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setValues(Object.fromEntries(data.map((s) => [s.settingKey, s.settingValue])));
  }, [data]);

  const save = async (key: string) => {
    const description = data?.find((s) => s.settingKey === key)?.description;

    setSavingKey(key);
    try {
      await adminApi.saveSetting({
        settingKey: key,
        settingValue: values[key] ?? '',
        description,
      });
      toast.success(`${key} saved.`);
      reload();
    } catch (err) {
      toast.fromError(err, 'Could not save the setting.');
    } finally {
      setSavingKey(null);
    }
  };

  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (isLoading || !data) return <RowsSkeleton rows={8} />;

  const known = new Set(GROUPS.flatMap((g) => g.keys));
  const others = data.filter((s) => !known.has(s.settingKey));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">
          Both the API and the website read these values - changes go live immediately.
        </p>
      </div>

      {GROUPS.map((group) => {
        const rows = data.filter((s) => group.keys.includes(s.settingKey));
        if (rows.length === 0) return null;

        return (
          <section key={group.title} className="card p-5">
            <h2 className="text-base font-semibold text-ink-900">{group.title}</h2>
            {group.hint && <p className="mt-0.5 mb-4 text-xs text-ink-500">{group.hint}</p>}

            <div className="space-y-3">
              {rows.map((s) => (
                <SettingRow
                  key={s.settingKey}
                  settingKey={s.settingKey}
                  description={s.description}
                  value={values[s.settingKey] ?? ''}
                  onChange={(v) => setValues((prev) => ({ ...prev, [s.settingKey]: v }))}
                  onSave={() => save(s.settingKey)}
                  saving={savingKey === s.settingKey}
                  dirty={(values[s.settingKey] ?? '') !== s.settingValue}
                />
              ))}
            </div>
          </section>
        );
      })}

      {others.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Baaki settings</h2>

          <div className="space-y-3">
            {others.map((s) => (
              <SettingRow
                key={s.settingKey}
                settingKey={s.settingKey}
                description={s.description}
                value={values[s.settingKey] ?? ''}
                onChange={(v) => setValues((prev) => ({ ...prev, [s.settingKey]: v }))}
                onSave={() => save(s.settingKey)}
                saving={savingKey === s.settingKey}
                dirty={(values[s.settingKey] ?? '') !== s.settingValue}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ================================================================= */

function SettingRow({
  settingKey,
  description,
  value,
  onChange,
  onSave,
  saving,
  dirty,
}: {
  settingKey: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-100 p-3.5">
      <div className="min-w-56 flex-1">
        <label htmlFor={`set-${settingKey}`} className="label">
          {settingKey}
        </label>
        <input
          id={`set-${settingKey}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input"
        />
        {description && <p className="mt-1 text-xs text-ink-400">{description}</p>}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving || !dirty}
        className={dirty ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
      >
        {saving && <Spinner className="size-3.5" />}
        {dirty ? 'Save' : 'Saved'}
      </button>
    </div>
  );
}
