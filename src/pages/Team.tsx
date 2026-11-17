import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Copy, KeyRound, Mail, MailPlus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { errMessage, must } from '../lib/errors';
import { displayName, useInstructors } from '../lib/queries';
import { appBaseUrl } from '../lib/config';
import { fmtDate, fmtDateTime, titleCase } from '../lib/format';
import type { Invitation, Profile, Role } from '../lib/types';
import { Badge, Button, Card, Check, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, useToast } from '../components/ui';

interface LinkResult {
  email: string;
  link: string;
  valid_for: string;
  kind: 'invite' | 'reset';
}

async function callInviteFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('invite-user', { body: { ...body, app_url: appBaseUrl() } });
  if (error) {
    // Surface the function's own error message when present.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null);
      if (j?.error) throw new Error(j.error);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data as { email: string; link: string; valid_for: string };
}

export default function Team() {
  const { profile, isSuper, isAdmin, facilities } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'people' | 'invites'>('people');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [membersFor, setMembersFor] = useState<Profile | null>(null);
  const { data: people = [], isLoading } = useInstructors();

  const { data: memberships = [] } = useQuery({
    queryKey: ['memberships'],
    queryFn: async () => must(await supabase.from('facility_members').select('profile_id, facility_id'), 'memberships') as { profile_id: string; facility_id: string }[],
  });
  const { data: invites = [], isLoading: invLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => must(await supabase.from('invitations').select('*').order('created_at', { ascending: false }).limit(300), 'invitations') as Invitation[],
  });

  const facName = (id: string) => facilities.find((f) => f.id === id)?.short_code ?? '—';
  const facsOf = (pid: string) => memberships.filter((m) => m.profile_id === pid).map((m) => m.facility_id);

  async function toggleActive(p: Profile) {
    if (!confirm(`${p.active ? 'Deactivate' : 'Reactivate'} ${displayName(p)}?`)) return;
    try {
      must(await supabase.rpc('set_user_active', { p_user: p.id, p_active: !p.active }), 'set_user_active');
      await qc.invalidateQueries({ queryKey: ['instructors'] });
      toast('success', p.active ? 'Instructor deactivated' : 'Instructor reactivated');
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  async function setRole(p: Profile, role: Role) {
    try {
      must(await supabase.rpc('set_user_role', { p_user: p.id, p_role: role }), 'set_user_role');
      await qc.invalidateQueries({ queryKey: ['instructors'] });
      toast('success', `${displayName(p)} is now ${titleCase(role)}`);
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  async function resetLink(p: Profile) {
    try {
      const r = await callInviteFn({ action: 'reset_link', user_id: p.id });
      setResult({ ...r, kind: p.last_sign_in_at ? 'reset' : 'invite' });
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  async function revokeInvite(inv: Invitation) {
    try {
      must(await supabase.from('invitations').update({ status: 'revoked' }).eq('id', inv.id), 'revoke invite');
      await qc.invalidateQueries({ queryKey: ['invitations'] });
      toast('success', 'Invitation revoked');
    } catch (e) {
      toast('error', errMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title="Instructors & invitations"
        subtitle="Only approved instructors can invite new instructors. Every invitation is logged."
        actions={
          <Button icon={<MailPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
            Invite instructor
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'people', label: `Instructors (${people.length})`, icon: <UserCheck className="h-4 w-4" /> },
          { id: 'invites', label: `Invitations (${invites.filter((i) => i.status === 'pending').length} pending)`, icon: <Mail className="h-4 w-4" /> },
        ]}
      />
      {tab === 'people' && (
        <Card>
          <div className="-m-5 overflow-x-auto">
            {isLoading ? (
              <Spinner />
            ) : (
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Instructor</th>
                    <th className="th">Role</th>
                    <th className="th">Facilities</th>
                    <th className="th">HWC cert. expires</th>
                    <th className="th">Last sign-in</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {people.map((p) => {
                    const self = p.id === profile?.id;
                    const isSuperRow = p.role === 'super_admin';
                    const canManage = !self && !isSuperRow && (isSuper || (isAdmin && p.role === 'instructor'));
                    return (
                      <tr key={p.id} className={p.active ? '' : 'opacity-60'}>
                        <td className="td">
                          <div className="font-medium text-slate-900">
                            {displayName(p)} {self && <span className="text-xs text-slate-400">(you)</span>}
                          </div>
                          <div className="text-xs text-slate-500">{p.email}</div>
                        </td>
                        <td className="td">
                          {isSuper && !isSuperRow && !self ? (
                            <Select
                              className="!w-36 !py-1"
                              value={p.role}
                              onChange={(e) => void setRole(p, e.target.value as Role)}
                              options={[
                                { value: 'instructor', label: 'Instructor' },
                                { value: 'admin', label: 'Facility admin' },
                              ]}
                            />
                          ) : (
                            <Badge tone={isSuperRow ? 'amber' : p.role === 'admin' ? 'teal' : 'gray'} icon={isSuperRow ? <ShieldCheck className="h-3 w-3" /> : undefined}>
                              {isSuperRow ? 'Super admin' : p.role === 'admin' ? 'Facility admin' : 'Instructor'}
                            </Badge>
                          )}
                        </td>
                        <td className="td">
                          <div className="flex flex-wrap gap-1">
                            {isSuperRow ? <Badge tone="amber">All</Badge> : facsOf(p.id).map((f) => <Badge key={f}>{facName(f)}</Badge>)}
                            {isAdmin && !isSuperRow && (
                              <button className="text-xs text-brand-600 hover:underline" onClick={() => setMembersFor(p)}>
                                edit
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="td tabular-nums">{fmtDate(p.hwc_cert_expires)}</td>
                        <td className="td text-xs">{p.last_sign_in_at ? fmtDateTime(p.last_sign_in_at) : <Badge tone="blue">Invite pending</Badge>}</td>
                        <td className="td">{p.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</td>
                        <td className="td text-right whitespace-nowrap">
                          {(canManage || (p.invited_by === profile?.id && !p.last_sign_in_at)) && p.active && (
                            <Button size="sm" variant="ghost" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => void resetLink(p)}>
                              {p.last_sign_in_at ? 'Reset link' : 'Resend link'}
                            </Button>
                          )}
                          {canManage && (
                            <Button size="sm" variant="ghost" icon={p.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />} onClick={() => void toggleActive(p)}>
                              {p.active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
      {tab === 'invites' && (
        <Card>
          <div className="-m-5 overflow-x-auto">
            {invLoading ? (
              <Spinner />
            ) : !invites.length ? (
              <Empty icon={<Mail className="h-6 w-6" />} title="No invitations yet" />
            ) : (
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Email</th>
                    <th className="th">Role</th>
                    <th className="th">Facilities</th>
                    <th className="th">Invited by</th>
                    <th className="th">Sent</th>
                    <th className="th">Status</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td className="td">
                        <div className="font-medium text-slate-900">{i.email}</div>
                        {i.full_name && <div className="text-xs text-slate-500">{i.full_name}</div>}
                      </td>
                      <td className="td">{titleCase(i.role)}</td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {i.facility_ids.map((f) => (
                            <Badge key={f}>{facName(f)}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="td">{displayName(people.find((p) => p.id === i.invited_by))}</td>
                      <td className="td text-xs">{fmtDateTime(i.created_at)}</td>
                      <td className="td">
                        <Badge tone={i.status === 'accepted' ? 'green' : i.status === 'pending' ? 'blue' : 'gray'}>{titleCase(i.status)}</Badge>
                      </td>
                      <td className="td text-right">
                        {i.status === 'pending' && (
                          <Button size="sm" variant="ghost" onClick={() => void revokeInvite(i)}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={(r) => {
          setInviteOpen(false);
          setResult({ ...r, kind: 'invite' });
          void qc.invalidateQueries({ queryKey: ['invitations'] });
          void qc.invalidateQueries({ queryKey: ['instructors'] });
        }}
      />
      <LinkResultModal result={result} onClose={() => setResult(null)} inviterName={displayName(profile)} />
      <MembershipModal profile={membersFor} current={membersFor ? facsOf(membersFor.id) : []} onClose={() => setMembersFor(null)} />
    </>
  );
}

function InviteModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: { email: string; link: string; valid_for: string }) => void }) {
  const { facilities, isAdmin, scope } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'instructor' | 'admin'>('instructor');
  const [facs, setFacs] = useState<string[]>(scope ? [scope] : facilities.length === 1 ? [facilities[0].id] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    if (!facs.length) return setError('Choose at least one facility.');
    setBusy(true);
    try {
      const r = await callInviteFn({ action: 'invite', email: email.trim(), full_name: name.trim(), role, facility_ids: facs });
      setEmail('');
      setName('');
      onCreated(r);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite an instructor">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">You'll get a secure one-time link to send to the new instructor. They choose their own password when they open it.</p>
        <ErrorNote error={error} />
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {isAdmin && (
          <Field label="Role">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as 'instructor' | 'admin')}
              options={[
                { value: 'instructor', label: 'Instructor' },
                { value: 'admin', label: 'Facility admin (can manage instructors)' },
              ]}
            />
          </Field>
        )}
        <div>
          <div className="label">Facilities</div>
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            {facilities.map((f) => (
              <Check key={f.id} label={f.name} checked={facs.includes(f.id)} onChange={(v) => setFacs((x) => (v ? [...x, f.id] : x.filter((y) => y !== f.id)))} />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<MailPlus className="h-4 w-4" />} loading={busy} onClick={send} disabled={!email.trim()}>
            Create invitation
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LinkResultModal({ result, onClose, inviterName }: { result: LinkResult | null; onClose: () => void; inviterName: string }) {
  const toast = useToast();
  if (!result) return null;
  const subject = result.kind === 'invite' ? 'Your invitation to the Handle With Care Trainer Suite' : 'Reset your Handle With Care Trainer Suite password';
  const body =
    result.kind === 'invite'
      ? `Hello,\n\n${inviterName} has invited you to join the Handle With Care Trainer Suite as an instructor.\n\nOpen this secure link to set your password (valid for ${result.valid_for}, one use only):\n${result.link}\n\nThank you.`
      : `Hello,\n\nUse this secure link to set a new password for the Handle With Care Trainer Suite (valid for ${result.valid_for}, one use only):\n${result.link}\n`;
  return (
    <Modal open onClose={onClose} title={result.kind === 'invite' ? 'Invitation ready' : 'Password link ready'}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Send this one-time link to <strong>{result.email}</strong>. It is valid for {result.valid_for} and can only be used once. Treat it like a password.
        </p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs break-all text-slate-700">{result.link}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => navigator.clipboard.writeText(result.link).then(() => toast('success', 'Link copied'))}>
            Copy link
          </Button>
          <a href={`mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
            <Button icon={<Mail className="h-4 w-4" />}>Open email draft</Button>
          </a>
        </div>
      </div>
    </Modal>
  );
}

function MembershipModal({ profile, current, onClose }: { profile: Profile | null; current: string[]; onClose: () => void }) {
  const { facilities } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!profile) return null;

  async function toggle(fid: string, on: boolean) {
    setBusy(fid);
    try {
      if (on) must(await supabase.from('facility_members').insert({ profile_id: profile!.id, facility_id: fid }), 'add member');
      else must(await supabase.from('facility_members').delete().eq('profile_id', profile!.id).eq('facility_id', fid), 'remove member');
      await qc.invalidateQueries({ queryKey: ['memberships'] });
    } catch (e) {
      toast('error', errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Facilities for ${displayName(profile)}`}>
      <div className="space-y-2">
        {facilities.map((f) => (
          <Check key={f.id} label={f.name} checked={current.includes(f.id)} disabled={busy === f.id} onChange={(v) => void toggle(f.id, v)} />
        ))}
      </div>
    </Modal>
  );
}
