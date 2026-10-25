import { MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useRepositories } from '@/lib/repositories/provider';
import { defaultProjectSettings, defaultQuoteSettings, newProjectDoc } from '@epd/domain/defaults';
import type { ProjectMeta } from '@epd/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Menu } from '@/components/ui/Menu';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';

type Editing = { mode: 'create' } | { mode: 'rename'; project: ProjectMeta } | null;

export function ProjectsPage({ basePath = '/projects' }: { basePath?: string }) {
  const { t, i18n } = useTranslation();
  const { projects } = useRepositories();
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState<ProjectMeta[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<ProjectMeta | null>(null);

  const [generation, setGeneration] = useState(0);
  const reload = useCallback(() => setGeneration((g) => g + 1), []);

  useEffect(() => {
    let active = true;
    projects
      .list()
      .then((l) => active && setList(l))
      .catch(() => {
        if (!active) return;
        toast(t('projects.loadFailed'), 'error');
        setList([]);
      });
    return () => {
      active = false;
    };
  }, [projects, t, toast, generation]);

  async function remove(project: ProjectMeta) {
    setDeleting(null);
    try {
      await projects.delete(project.id);
      reload();
    } catch {
      toast(t('projects.deleteFailed'), 'error');
    }
  }

  const dateFormat = new Intl.DateTimeFormat(i18n.language === 'it' ? 'it-IT' : 'en-GB', {
    dateStyle: 'medium',
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('pages.projects')}</h1>
        <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
          {t('projects.new')}
        </Button>
      </div>
      {list === null ? (
        <p className="text-text-muted">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <div className="rounded border border-dashed border-border p-8 text-center">
          <p className="mb-3 text-text-muted">{t('projects.empty')}</p>
          <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
            {t('projects.new')}
          </Button>
        </div>
      ) : (
        <ul
          className="divide-y divide-border rounded border border-border"
          aria-label={t('pages.projects')}
        >
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <Link to={`${basePath}/${p.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-text-muted">
                  {[p.clientName, p.address].filter(Boolean).join(' · ')}
                </span>
              </Link>
              <span className="hidden text-text-muted sm:block">
                {dateFormat.format(new Date(p.updatedAt))}
              </span>
              <Menu
                trigger={
                  <Button variant="ghost" aria-label={t('projects.actions', { name: p.name })}>
                    <MoreHorizontal size={16} />
                  </Button>
                }
                items={[
                  {
                    key: 'rename',
                    label: t('projects.rename'),
                    onSelect: () => setEditing({ mode: 'rename', project: p }),
                  },
                  {
                    key: 'delete',
                    label: t('projects.delete'),
                    danger: true,
                    onSelect: () => setDeleting(p),
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ProjectDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            try {
              if (editing.mode === 'create') {
                const settings = defaultProjectSettings();
                const created = await projects.create({
                  ...values,
                  settings,
                  quote: { settings: defaultQuoteSettings(), issued: [] },
                  doc: newProjectDoc(t('projects.firstFloorName'), settings),
                });
                navigate(`${basePath}/${created.id}`);
              } else {
                await projects.updateMeta(editing.project.id, values);
                setEditing(null);
                reload();
              }
            } catch {
              toast(t('projects.saveFailed'), 'error');
            }
          }}
        />
      ) : null}

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('projects.deleteTitle', { name: deleting?.name ?? '' })}
        description={t('projects.deleteBody')}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => deleting && void remove(deleting)}>
              {t('projects.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function ProjectDialog({
  editing,
  onClose,
  onSubmit,
}: {
  editing: NonNullable<Editing>;
  onClose: () => void;
  onSubmit: (values: { name: string; clientName: string; address: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const initial = editing.mode === 'rename' ? editing.project : undefined;
  const [name, setName] = useState(initial?.name ?? '');
  const [clientName, setClientName] = useState(initial?.clientName ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(editing.mode === 'create' ? 'projects.newTitle' : 'projects.renameTitle')}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onSubmit({
            name: name.trim(),
            clientName: clientName.trim(),
            address: address.trim(),
          });
          setBusy(false);
        }}
      >
        <TextField
          label={t('projects.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <TextField
          label={t('projects.client')}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
        <TextField
          label={t('projects.address')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim() === ''}>
            {t(editing.mode === 'create' ? 'projects.create' : 'common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
