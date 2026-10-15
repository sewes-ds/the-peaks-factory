import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  createAdminActivityType,
  deactivateAdminActivityType,
  saveAdminAdditionalWorkType,
  saveAdminEmployee,
  saveAdminMachine,
  saveAdminPosition,
  saveAdminSku
} from './api';
import type { ActivityClass, AdminDirectory } from './contracts';

type Employee = AdminDirectory['employees'][number];
type Position = AdminDirectory['positions'][number];
type Machine = AdminDirectory['machines'][number];
type Sku = AdminDirectory['skus'][number];
type AdditionalWorkType = AdminDirectory['additional_work_types'][number];
type ActivityType = AdminDirectory['activity_types'][number];

export type CatalogEditorTarget =
  | { kind: 'employee'; value?: Employee }
  | { kind: 'position'; value?: Position }
  | { kind: 'machine'; value?: Machine }
  | { kind: 'sku'; value?: Sku }
  | { kind: 'additional-work-type'; value?: AdditionalWorkType }
  | { kind: 'activity-type' }
  | { kind: 'deactivate-activity-type'; value: ActivityType };

export function CatalogEditorDialog({
  target,
  directory,
  onClose,
  onSaved
}: {
  target: CatalogEditorTarget;
  directory: AdminDirectory;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      {target.kind === 'employee' && <EmployeeEditor value={target.value} directory={directory} onClose={onClose} onSaved={onSaved} />}
      {target.kind === 'position' && <PositionEditor value={target.value} onClose={onClose} onSaved={onSaved} />}
      {target.kind === 'machine' && <MachineEditor value={target.value} directory={directory} onClose={onClose} onSaved={onSaved} />}
      {target.kind === 'sku' && <SkuEditor value={target.value} directory={directory} onClose={onClose} onSaved={onSaved} />}
      {target.kind === 'additional-work-type' && <AdditionalWorkTypeEditor value={target.value} onClose={onClose} onSaved={onSaved} />}
      {target.kind === 'activity-type' && <ActivityTypeEditor directory={directory} onClose={onClose} onSaved={onSaved} />}
      {target.kind === 'deactivate-activity-type' && <DeactivateActivityTypeEditor value={target.value} onClose={onClose} onSaved={onSaved} />}
    </div>
  );
}

function EmployeeEditor({
  value,
  directory,
  onClose,
  onSaved
}: EditorProps<Employee> & { directory: AdminDirectory }) {
  const positions = directory.positions.filter((row) => row.is_active || row.position_id === value?.position_id);
  const statuses = directory.employee_statuses.filter((row) => row.is_active || row.employee_status_id === value?.employee_status_id);
  const [fullName, setFullName] = useState(value?.full_name ?? '');
  const [phone, setPhone] = useState(value?.phone_e164 ?? '');
  const [positionId, setPositionId] = useState(value?.position_id ?? positions[0]?.position_id ?? '');
  const [statusId, setStatusId] = useState(value?.employee_status_id ?? statuses[0]?.employee_status_id ?? '');
  const mutation = useEditorMutation(onSaved);

  return (
    <EditorFrame title={value ? 'Изменить сотрудника' : 'Добавить сотрудника'} pending={mutation.pending} error={mutation.error} onClose={onClose} onSubmit={async () => {
      await mutation.run(
        () => saveAdminEmployee({
          employee_id: value?.employee_id,
          full_name: fullName,
          phone_e164: phone,
          position_id: positionId,
          employee_status_id: statusId,
          reason: mutation.reason
        }),
        value ? 'Данные сотрудника сохранены' : 'Сотрудник добавлен'
      );
    }}>
      <TextField label="Фамилия, имя, отчество" value={fullName} onChange={setFullName} maxLength={200} autoFocus />
      <TextField label="Телефон в формате E.164" value={phone} onChange={setPhone} placeholder="+998901234567" maxLength={16} />
      <SelectField label="Должность" value={positionId} onChange={setPositionId} options={positions.map((row) => ({ value: row.position_id, label: row.position_name }))} />
      <SelectField label="Статус" value={statusId} onChange={setStatusId} options={statuses.map((row) => ({ value: row.employee_status_id, label: row.employee_status_name }))} />
      <ReasonField mutation={mutation} />
    </EditorFrame>
  );
}

function PositionEditor({ value, onClose, onSaved }: EditorProps<Position>) {
  const [name, setName] = useState(value?.position_name ?? '');
  const [description, setDescription] = useState(value?.position_description ?? '');
  const [production, setProduction] = useState(value?.is_production_position ?? true);
  const [active, setActive] = useState(value?.is_active ?? true);
  const mutation = useEditorMutation(onSaved);

  return (
    <EditorFrame title={value ? 'Изменить должность' : 'Добавить должность'} pending={mutation.pending} error={mutation.error} onClose={onClose} onSubmit={async () => {
      await mutation.run(
        () => saveAdminPosition({
          position_id: value?.position_id,
          position_name: name,
          position_description: description || null,
          is_production_position: production,
          is_active: active,
          reason: mutation.reason
        }),
        value ? 'Должность сохранена' : 'Должность добавлена'
      );
    }}>
      <TextField label="Наименование" value={name} onChange={setName} maxLength={200} autoFocus />
      <TextAreaField label="Описание" value={description} onChange={setDescription} maxLength={500} />
      <CheckboxField label="Производственная должность" checked={production} onChange={setProduction} />
      <CheckboxField label="Активна" checked={active} onChange={setActive} />
      <ReasonField mutation={mutation} />
    </EditorFrame>
  );
}

function MachineEditor({
  value,
  directory,
  onClose,
  onSaved
}: EditorProps<Machine> & { directory: AdminDirectory }) {
  const statuses = directory.machine_use_statuses.filter((row) => row.is_active || row.machine_use_status_id === value?.machine_use_status_id);
  const [name, setName] = useState(value?.machine_name ?? '');
  const [workshop, setWorkshop] = useState(value?.workshop_name ?? '');
  const [statusId, setStatusId] = useState(value?.machine_use_status_id ?? statuses[0]?.machine_use_status_id ?? '');
  const [rotateQr, setRotateQr] = useState(false);
  const mutation = useEditorMutation(onSaved);

  return (
    <EditorFrame title={value ? 'Изменить станок' : 'Добавить станок'} pending={mutation.pending} error={mutation.error} onClose={onClose} onSubmit={async () => {
      await mutation.run(
        () => saveAdminMachine({
          machine_id: value?.machine_id,
          machine_name: name,
          workshop_name: workshop || null,
          machine_use_status_id: statusId,
          rotate_qr: rotateQr,
          reason: mutation.reason
        }),
        value ? 'Данные станка сохранены' : 'Станок добавлен, QR назначен'
      );
    }}>
      <TextField label="Наименование станка" value={name} onChange={setName} maxLength={200} autoFocus />
      <TextField label="Участок / цех" value={workshop} onChange={setWorkshop} maxLength={500} required={false} />
      <SelectField label="Использование" value={statusId} onChange={setStatusId} options={statuses.map((row) => ({ value: row.machine_use_status_id, label: row.machine_use_status_name }))} />
      {value && <>
        <CheckboxField label="Заменить QR станка" checked={rotateQr} onChange={setRotateQr} danger />
        {rotateQr && <p className="editor-warning">Старый QR сразу перестанет работать. Новый ярлык потребуется распечатать.</p>}
      </>}
      {!value && <p className="editor-note">Уникальный QR будет назначен автоматически.</p>}
      <ReasonField mutation={mutation} />
    </EditorFrame>
  );
}

function SkuEditor({
  value,
  directory,
  onClose,
  onSaved
}: EditorProps<Sku> & { directory: AdminDirectory }) {
  const units = directory.sku_units.filter((row) => row.is_active || row.sku_unit_id === value?.sku_unit_id);
  const [code, setCode] = useState(value?.sku_code ?? '');
  const [name, setName] = useState(value?.sku_name ?? '');
  const [unitId, setUnitId] = useState(value?.sku_unit_id ?? units[0]?.sku_unit_id ?? '');
  const [productivity, setProductivity] = useState(value?.planned_productivity_per_hour ?? '');
  const [tariff, setTariff] = useState(value?.current_sku_tariff_uzs ?? '0');
  const [active, setActive] = useState(value?.is_active ?? true);
  const [rotateQr, setRotateQr] = useState(false);
  const mutation = useEditorMutation(onSaved);

  return (
    <EditorFrame title={value ? 'Изменить SKU' : 'Добавить SKU'} pending={mutation.pending} error={mutation.error} onClose={onClose} onSubmit={async () => {
      await mutation.run(
        () => saveAdminSku({
          sku_id: value?.sku_id,
          sku_code: code,
          sku_name: name || null,
          sku_unit_id: unitId,
          planned_productivity_per_hour: productivity || null,
          current_sku_tariff_uzs: tariff,
          is_active: active,
          rotate_qr: rotateQr,
          reason: mutation.reason
        }),
        value ? 'Данные SKU сохранены' : 'SKU добавлен, QR назначен'
      );
    }}>
      <div className="editor-grid">
        <TextField label="Код SKU" value={code} onChange={setCode} maxLength={100} autoFocus />
        <SelectField label="Единица измерения" value={unitId} onChange={setUnitId} options={units.map((row) => ({ value: row.sku_unit_id, label: row.sku_unit_name }))} />
      </div>
      <TextField label="Наименование" value={name} onChange={setName} maxLength={500} required={false} />
      <div className="editor-grid">
        <TextField label="Производительность в час" value={productivity} onChange={setProductivity} inputMode="decimal" placeholder="12.500" required={false} />
        <TextField label="Тариф, сум" value={tariff} onChange={setTariff} inputMode="decimal" placeholder="1500.0000" />
      </div>
      <CheckboxField label="Активен" checked={active} onChange={setActive} />
      {value && <>
        <CheckboxField label="Заменить QR SKU" checked={rotateQr} onChange={setRotateQr} danger />
        {rotateQr && <p className="editor-warning">Старый QR сразу перестанет работать. Новый ярлык потребуется распечатать.</p>}
      </>}
      {!value && <p className="editor-note">Уникальный QR будет назначен автоматически. Изменение тарифа не переписывает прошлые начисления.</p>}
      <ReasonField mutation={mutation} />
    </EditorFrame>
  );
}

function AdditionalWorkTypeEditor({ value, onClose, onSaved }: EditorProps<AdditionalWorkType>) {
  const [name, setName] = useState(value?.additional_work_type_name ?? '');
  const [active, setActive] = useState(value?.is_active ?? true);
  const mutation = useEditorMutation(onSaved);
  return (
    <EditorFrame title={value ? 'Изменить вид работы' : 'Добавить вид работы'} pending={mutation.pending} error={mutation.error} onClose={onClose} onSubmit={async () => {
      await mutation.run(
        () => saveAdminAdditionalWorkType({
          additional_work_type_id: value?.additional_work_type_id,
          additional_work_type_name: name,
          is_active: active,
          reason: mutation.reason
        }),
        value ? 'Вид работы сохранен' : 'Вид работы добавлен'
      );
    }}>
      <TextField label="Наименование" value={name} onChange={setName} maxLength={200} autoFocus />
      <CheckboxField label="Активен" checked={active} onChange={setActive} />
      <ReasonField mutation={mutation} />
    </EditorFrame>
  );
}

function ActivityTypeEditor({ directory, onClose, onSaved }: Omit<EditorProps<never>, 'value'> & { directory: AdminDirectory }) {
  const [activityClass, setActivityClass] = useState<ActivityClass>('BREAK');
  const profiles = directory.activity_profiles.filter((row) => row.activity_class === activityClass && row.is_active);
  const [profileId, setProfileId] = useState(
    directory.activity_profiles.find((row) => row.activity_class === 'BREAK' && row.is_active)?.profile_id ?? ''
  );
  const [name, setName] = useState('');
  const mutation = useEditorMutation(onSaved);

  function changeClass(next: string) {
    const nextClass = next as ActivityClass;
    setActivityClass(nextClass);
    setProfileId(directory.activity_profiles.find((row) => row.activity_class === nextClass && row.is_active)?.profile_id ?? '');
  }

  return (
    <EditorFrame title="Добавить перерыв или простой" pending={mutation.pending} error={mutation.error} onClose={onClose} onSubmit={async () => {
      await mutation.run(
        () => createAdminActivityType({
          activity_class: activityClass,
          display_name: name,
          profile_id: profileId,
          reason: mutation.reason
        }),
        'Вид перерыва или простоя добавлен'
      );
    }}>
      <SelectField label="Класс" value={activityClass} onChange={changeClass} options={[
        { value: 'BREAK', label: 'Перерыв' },
        { value: 'OPERATIONAL', label: 'Операционный простой' },
        { value: 'CRITICAL', label: 'Критический простой' }
      ]} />
      <TextField label="Наименование" value={name} onChange={setName} maxLength={200} autoFocus />
      <SelectField label="Утвержденный профиль поведения" value={profileId} onChange={setProfileId} options={profiles.map((row) => ({ value: row.profile_id, label: row.profile_name }))} />
      <p className="editor-note">Новый пункт появится в конце выбранного раздела; положение можно изменить стрелками в списке.</p>
      <p className="editor-note">Системные правила профиля и сроки уведомлений здесь не изменяются.</p>
      <ReasonField mutation={mutation} />
    </EditorFrame>
  );
}

function DeactivateActivityTypeEditor({ value, onClose, onSaved }: EditorProps<ActivityType> & { value: ActivityType }) {
  const mutation = useEditorMutation(onSaved);
  return (
    <EditorFrame title="Отключить вид" pending={mutation.pending} error={mutation.error} onClose={onClose} submitLabel="Отключить" danger onSubmit={async () => {
      await mutation.run(
        () => deactivateAdminActivityType({
          activity_class: value.activity_class,
          activity_type_id: value.activity_type_id,
          reason: mutation.reason
        }),
        'Вид отключен; история сохранена'
      );
    }}>
      <p className="confirmation-copy">«{value.display_name}» исчезнет из нового выбора. Уже созданные записи сохранятся.</p>
      <ReasonField mutation={mutation} autoFocus />
    </EditorFrame>
  );
}

type EditorProps<TValue> = {
  value?: TValue;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
};

type EditorMutation = ReturnType<typeof useEditorMutation>;

function useEditorMutation(onSaved: (message: string) => Promise<void>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function run(action: () => Promise<unknown>, message: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await action();
      await onSaved(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить изменения');
    } finally {
      setPending(false);
    }
  }

  return { pending, error, reason, setReason, run };
}

function EditorFrame({
  title,
  pending,
  error,
  onClose,
  onSubmit,
  children,
  submitLabel = 'Сохранить',
  danger = false
}: {
  title: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  children: ReactNode;
  submitLabel?: string;
  danger?: boolean;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    void onSubmit();
  }
  return (
    <section className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className="editor-heading">
        <div><div className="eyebrow">ИЗМЕНЕНИЕ СПРАВОЧНИКА</div><h2 id="editor-title">{title}</h2></div>
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <form onSubmit={submit}>
        <div className="editor-body">
          {children}
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
        <div className="editor-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={pending}>Отмена</button>
          <button className={'save-button' + (danger ? ' is-danger' : '')} type="submit" disabled={pending}>
            {pending ? 'Сохраняем…' : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  inputMode,
  autoFocus = false,
  required = true
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel';
  autoFocus?: boolean;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input required={required} autoFocus={autoFocus} value={value} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select required value={value} onChange={(event) => onChange(event.target.value)}>
        {options.length === 0 && <option value="">Нет доступных вариантов</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function CheckboxField({ label, checked, onChange, danger = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; danger?: boolean }) {
  return (
    <label className={'editor-checkbox' + (danger ? ' is-danger' : '')}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function ReasonField({ mutation, autoFocus = false }: { mutation: EditorMutation; autoFocus?: boolean }) {
  return (
    <label className="field reason-field">
      <span>Причина изменения</span>
      <textarea required autoFocus={autoFocus} minLength={3} maxLength={500} value={mutation.reason} onChange={(event) => mutation.setReason(event.target.value)} placeholder="Кратко укажите основание — оно попадет в журнал" />
    </label>
  );
}
