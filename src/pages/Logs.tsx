import { Fragment, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Bug, CheckCircle2, ChevronDown, ChevronRight, Download, History, KeyRound, ScrollText, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { errMessage, must } from '../lib/errors';
import { fmtDateTime, safeSearch, titleCase } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { Badge, Button, Card, Empty, Input, PageHeader, Pager, Select, Spinner, Stat, Tabs, useToast } from '../components/ui';

const SIZE = 50;

interface ErrorRow {
  id: number;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  route: string | null;
  user_email: string | null;
  user_agent: string | null;
  context: unknown;
  resolved: boolean;
  created_at: string;
}
interface AuditRow {
  id: number;
  table_name: string;
  record_id: string | null;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  actor_email: string | null;
  created_at: string;
}
interface AuthRow {
  id: number;
  event: string;
  email: string | null;
  detail: unknown;
  user_agent: string | null;
  created_at: string;
}

export default function Logs() {
  const [tab, setTab] = useState<'health' | 'errors' | 'audit' | 'auth'>('health');
  return (
    <>
      <PageHeader icon={<ScrollText className="h-5 w-5" />} title="System logs" subtitle="Visible only to the suite owner. Errors, data changes and sign-in activity." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'health', label: 'Health', icon: <Activity className="h-4 w-4" /> },
          { id: 'errors', label: 'Errors', icon: <Bug className="h-4 w-4" /> },
          { id: 'audit', label: 'Audit trail', icon: <History className="h-4 w-4" /> },
          { id: 'auth', label: 'Sign-ins & access', icon: <KeyRound className="h-4 w-4" /> },
        ]}
      />
      {tab === 'health' && <Health />}
      {tab === 'errors' && <Errors />}
      {tab === 'audit' && <Audit />}
      {tab === 'auth' && <AuthEvents />}
    </>
  );
}

function Health() {
  const { data, isLoading } = useQuery({
    queryKey: ['log-health'],
    queryFn: async () => {
      const since = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
      const c = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
        const r = await q;
        if (r.error) throw r.error;
        return r.count ?? 0;
      };
      const head = { count: 'exact' as const, head: true };
      const [err24, err7, unresolved, fatal7, signins24, failed24, changes24, invites7] = await Promise.all([
        c(supabase.from('app_errors').select('id', head).gte('created_at', since(24))),
        c(supabase.from('app_errors').select('id', head).gte('created_at', since(168))),
        c(supabase.from('app_errors').select('id', head).eq('resolved', false)),
        c(supabase.from('app_errors').select('id', head).eq('level', 'fatal').gte('created_at', since(168))),
        c(supabase.from('auth_events').select('id', head).eq('event', 'sign_in').gte('created_at', since(24))),
        c(supabase.from('auth_events').select('id', head).eq('event', 'sign_in_failed').gte('created_at', since(24))),
        c(supabase.from('audit_log').select('id', head).gte('created_at', since(24))),
        c(supabase.from('auth_events').select('id', head).eq('event', 'invite_sent').gte('created_at', since(168))),
      ]);
      const recent = must(await supabase.from('app_errors').select('message, level, created_at').eq('resolved', false).order('created_at', { ascending: false }).limit(5), 'recent errors') as ErrorRow[];
      return { err24, err7, unresolved, fatal7, signins24, failed24, changes24, invites7, recent };
    },
  });
  if (isLoading || !data) return <Spinner />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Bug className="h-5 w-5" />} tone={data.unresolved ? 'red' : 'green'} label="Unresolved errors" value={data.unresolved} sub={`${data.err24} in 24h · ${data.err7} in 7 days`} />
        <Stat icon={<Bug className="h-5 w-5" />} tone={data.fatal7 ? 'red' : 'green'} label="Page crashes (7 days)" value={data.fatal7} />
        <Stat icon={<KeyRound className="h-5 w-5" />} tone={data.failed24 > 10 ? 'gold' : 'brand'} label="Sign-ins (24h)" value={data.signins24} sub={`${data.failed24} failed attempts`} />
        <Stat icon={<History className="h-5 w-5" />} tone="teal" label="Data changes (24h)" value={data.changes24} sub={`${data.invites7} invitations this week`} />
      </div>
      <Card title="Latest unresolved errors">
        {data.recent.length === 0 ? (
          <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="All clear — no unresolved errors" />
        ) : (
          <ul className="-my-2 divide-y divide-slate-100">
            {data.recent.map((e, i) => (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <LevelBadge level={e.level} />
                <span className="flex-1 truncate text-slate-800">{e.message}</span>
                <span className="text-xs text-slate-500">{fmtDateTime(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const tone = level === 'fatal' || level === 'error' ? 'red' : level === 'warn' ? 'amber' : 'gray';
  return <Badge tone={tone}>{level.toUpperCase()}</Badge>;
}

function Errors() {
  const qc = useQueryClient();
  const toast = useToast();
  const [level, setLevel] = useState('');
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['app-errors', level, show, q, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from('app_errors').select('*', { count: 'exact' });
      if (level) query = query.eq('level', level);
      if (show === 'open') query = query.eq('resolved', false);
      const s = safeSearch(q);
      if (s) query = query.or(`message.ilike.%${s}%,user_email.ilike.%${s}%,route.ilike.%${s}%,source.ilike.%${s}%`);
      const res = await query.order('created_at', { ascending: false }).range(page * SIZE, page * SIZE + SIZE - 1);
      must(res, 'errors');
      return { rows: (res.data ?? []) as ErrorRow[], total: res.count ?? 0 };
    },
  });

  async function resolve(ids: number[], resolved = true) {
    try {
      must(await supabase.from('app_errors').update({ resolved, resolved_at: resolved ? new Date().toISOString() : null }).in('id', ids), 'resolve');
      await qc.invalidateQueries({ queryKey: ['app-errors'] });
      await qc.invalidateQueries({ queryKey: ['log-health'] });
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  async function purge() {
    if (!confirm('Permanently delete all resolved errors older than 30 days?')) return;
    try {
      must(await supabase.from('app_errors').delete().eq('resolved', true).lt('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()), 'purge');
      await qc.invalidateQueries({ queryKey: ['app-errors'] });
      toast('success', 'Old resolved errors deleted');
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  return (
    <Card>
      <div className="-m-5 mb-0 flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <Input className="max-w-xs" placeholder="Search message, user, page…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
        <Select className="w-36" value={level} onChange={(e) => (setLevel(e.target.value), setPage(0))} options={['fatal', 'error', 'warn', 'info'].map((v) => ({ value: v, label: v.toUpperCase() }))} placeholder="All levels" />
        <Select
          className="w-36"
          value={show}
          onChange={(e) => (setShow(e.target.value as 'open' | 'all'), setPage(0))}
          options={[
            { value: 'open', label: 'Unresolved' },
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="ml-auto flex gap-2">
          {!!data?.rows.filter((r) => !r.resolved).length && (
            <Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => void resolve(data.rows.filter((r) => !r.resolved).map((r) => r.id))}>
              Resolve page
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={purge}>
            Purge old
          </Button>
        </div>
      </div>
      <div className="-mx-5 -mb-5 overflow-x-auto">
        {isLoading ? (
          <Spinner />
        ) : !data?.rows.length ? (
          <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="No errors to show" />
        ) : (
          <>
            <table className="w-full min-w-[860px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th w-8" />
                  <th className="th">When</th>
                  <th className="th">Level</th>
                  <th className="th">Message</th>
                  <th className="th">User</th>
                  <th className="th">Source</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className={r.resolved ? 'opacity-50' : ''}>
                      <td className="td">
                        <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-label="Details" className="text-slate-400 hover:text-slate-700">
                          {open === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="td text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                      <td className="td">
                        <LevelBadge level={r.level} />
                      </td>
                      <td className="td max-w-md truncate">{r.message}</td>
                      <td className="td text-xs">{r.user_email ?? 'anonymous'}</td>
                      <td className="td text-xs">{r.source}</td>
                      <td className="td text-right">
                        <Button size="sm" variant="ghost" onClick={() => void resolve([r.id], !r.resolved)}>
                          {r.resolved ? 'Reopen' : 'Resolve'}
                        </Button>
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50 px-6 py-4">
                          <div className="grid gap-3 text-xs">
                            <div>
                              <span className="font-semibold">Page:</span> {r.route ?? '—'}
                            </div>
                            <div className="break-all">
                              <span className="font-semibold">Browser:</span> {r.user_agent ?? '—'}
                            </div>
                            {r.stack && <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 whitespace-pre-wrap text-slate-100">{r.stack}</pre>}
                            {r.context != null && <pre className="max-h-48 overflow-auto rounded-lg bg-white p-3 ring-1 ring-slate-200">{JSON.stringify(r.context, null, 2)}</pre>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={SIZE} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
    </Card>
  );
}

function diff(oldD: Record<string, unknown> | null, newD: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(oldD ?? {}), ...Object.keys(newD ?? {})]);
  const out: { key: string; from: unknown; to: unknown }[] = [];
  keys.forEach((k) => {
    if (['updated_at', 'created_at'].includes(k)) return;
    const a = oldD?.[k];
    const b = newD?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ key: k, from: a, to: b });
  });
  return out;
}

const show = (v: unknown) => (v == null ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function Audit() {
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['audit', table, action, q, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from('audit_log').select('*', { count: 'exact' });
      if (table) query = query.eq('table_name', table);
      if (action) query = query.eq('action', action);
      const s = safeSearch(q);
      if (s) query = query.or(`actor_email.ilike.%${s}%,record_id.ilike.%${s}%`);
      const res = await query.order('created_at', { ascending: false }).range(page * SIZE, page * SIZE + SIZE - 1);
      must(res, 'audit');
      return { rows: (res.data ?? []) as AuditRow[], total: res.count ?? 0 };
    },
  });
  const tables = ['students', 'certificates', 'training_sessions', 'enrollments', 'training_incidents', 'profiles', 'facility_members', 'invitations', 'facilities', 'lookup_values', 'app_settings'];
  return (
    <Card>
      <div className="-m-5 mb-0 flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <Input className="max-w-xs" placeholder="Search user or record id…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
        <Select className="w-48" value={table} onChange={(e) => (setTable(e.target.value), setPage(0))} options={tables.map((t) => ({ value: t, label: titleCase(t) }))} placeholder="All tables" />
        <Select className="w-36" value={action} onChange={(e) => (setAction(e.target.value), setPage(0))} options={['insert', 'update', 'delete'].map((v) => ({ value: v, label: titleCase(v) }))} placeholder="All actions" />
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={() => downloadCsv('hwc-audit-page', (data?.rows ?? []).map((r) => ({ when: r.created_at, table: r.table_name, action: r.action, record: r.record_id, user: r.actor_email, changes: diff(r.old_data, r.new_data) })))}
        >
          Export page
        </Button>
      </div>
      <div className="-mx-5 -mb-5 overflow-x-auto">
        {isLoading ? (
          <Spinner />
        ) : !data?.rows.length ? (
          <Empty title="No audit entries" />
        ) : (
          <>
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th w-8" />
                  <th className="th">When</th>
                  <th className="th">Who</th>
                  <th className="th">Action</th>
                  <th className="th">Table</th>
                  <th className="th">Changed fields</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => {
                  const d = diff(r.old_data, r.new_data);
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        <td className="td">
                          <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-label="Details" className="text-slate-400 hover:text-slate-700">
                            {open === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="td text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                        <td className="td text-xs">{r.actor_email ?? 'system'}</td>
                        <td className="td">
                          <Badge tone={r.action === 'delete' ? 'red' : r.action === 'insert' ? 'green' : 'blue'}>{r.action}</Badge>
                        </td>
                        <td className="td text-xs">{titleCase(r.table_name)}</td>
                        <td className="td max-w-sm truncate text-xs text-slate-500">{d.map((x) => x.key).join(', ')}</td>
                      </tr>
                      {open === r.id && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50 px-6 py-4">
                            <div className="mb-2 text-xs text-slate-500">Record {r.record_id}</div>
                            <table className="w-full text-xs">
                              <tbody>
                                {d.map((x) => (
                                  <tr key={x.key} className="border-b border-slate-200">
                                    <td className="py-1 pr-3 font-semibold">{x.key}</td>
                                    <td className="py-1 pr-3 break-all text-red-700">{show(x.from)}</td>
                                    <td className="py-1 break-all text-green-700">{show(x.to)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <Pager page={page} pageSize={SIZE} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
    </Card>
  );
}

function AuthEvents() {
  const [event, setEvent] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ['auth-events', event, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from('auth_events').select('*', { count: 'exact' });
      if (event) query = query.eq('event', event);
      const res = await query.order('created_at', { ascending: false }).range(page * SIZE, page * SIZE + SIZE - 1);
      must(res, 'auth events');
      return { rows: (res.data ?? []) as AuthRow[], total: res.count ?? 0 };
    },
  });
  const events = ['sign_in', 'sign_in_failed', 'sign_out', 'invite_sent', 'invite_accepted', 'password_set', 'password_reset_requested', 'reset_link_created', 'user_deactivated', 'user_reactivated', 'role_changed'];
  return (
    <Card>
      <div className="-m-5 mb-0 border-b border-slate-100 p-4">
        <Select className="w-56" value={event} onChange={(e) => (setEvent(e.target.value), setPage(0))} options={events.map((v) => ({ value: v, label: titleCase(v) }))} placeholder="All events" />
      </div>
      <div className="-mx-5 -mb-5 overflow-x-auto">
        {isLoading ? (
          <Spinner />
        ) : !data?.rows.length ? (
          <Empty title="No events" />
        ) : (
          <>
            <table className="w-full min-w-[720px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">When</th>
                  <th className="th">Event</th>
                  <th className="th">Email</th>
                  <th className="th">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                    <td className="td">
                      <Badge tone={r.event.includes('failed') || r.event.includes('deactivated') ? 'red' : r.event.startsWith('invite') ? 'violet' : 'gray'}>{titleCase(r.event)}</Badge>
                    </td>
                    <td className="td text-xs">{r.email ?? '—'}</td>
                    <td className="td max-w-md truncate text-xs text-slate-500">{r.detail ? JSON.stringify(r.detail) : r.user_agent ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={SIZE} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
    </Card>
  );
}
