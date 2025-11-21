'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { inviteMember, removeMember, updateMemberRole, cancelInvitation } from '@/lib/organizations/actions';
import { AdminOnly } from '@/components/auth/role-gate';
import type { Database } from '@/types/database';

type MembershipRole = Database['public']['Enums']['membership_role'];

interface Member {
  id: string;
  user_id: string;
  role: MembershipRole;
  created_at: string;
  user: {
    email: string;
    full_name: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: MembershipRole;
  created_at: string;
  expires_at: string;
}

export default function MembersPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [userRole, setUserRole] = useState<MembershipRole>('member');
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MembershipRole>('member');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invitationLink, setInvitationLink] = useState('');

  useEffect(() => {
    loadData();
  }, [slug]);

  async function loadData() {
    const supabase = createClient();

    // Get organization
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!org) {
      setLoading(false);
      return;
    }

    setOrganizationId(org.id);

    // Get current user role
    const { data: roleData } = await supabase.rpc('get_user_role', {
      organization_id: org.id,
    });

    if (roleData) {
      setUserRole(roleData);
    }

    // Get members
    const { data: membersData } = await supabase
      .from('memberships')
      .select('id, user_id, role, joined_at')
      .eq('organization_id', org.id)
      .order('joined_at', { ascending: true });

    if (membersData) {
      // Get profiles for all members
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.id, p.full_name]) || []
      );

      const formattedMembers = membersData.map(m => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        created_at: m.joined_at,
        user: {
          email: m.user_id.slice(0, 8) + '...', // Placeholder
          full_name: profilesMap.get(m.user_id) || null,
        },
      }));

      setMembers(formattedMembers as Member[]);
    }

    // Get pending invitations
    const { data: invitationsData } = await supabase
      .from('invitations')
      .select('id, email, role, created_at, expires_at')
      .eq('organization_id', org.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (invitationsData) {
      setInvitations(invitationsData);
    }

    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInvitationLink('');
    setInviting(true);

    const result = await inviteMember(organizationId, inviteEmail, inviteRole);

    if (!result.success) {
      setError(result.error || 'Error al enviar invitación');
    } else {
      const token = result.data?.invitationToken;
      if (token) {
        const link = `${window.location.origin}/invite/${token}`;
        setInvitationLink(link);
        setSuccess(`Invitación creada para ${inviteEmail}. Comparte el enlace de abajo.`);
      } else {
        setSuccess(`Invitación enviada a ${inviteEmail}`);
      }
      setInviteEmail('');
      loadData();
    }

    setInviting(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setSuccess('Enlace copiado al portapapeles');
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar a este miembro?')) {
      return;
    }

    const result = await removeMember(organizationId, userId);

    if (!result.success) {
      setError(result.error || 'Error al eliminar miembro');
    } else {
      setSuccess('Miembro eliminado');
      loadData();
    }
  }

  async function handleUpdateRole(userId: string, newRole: MembershipRole) {
    const result = await updateMemberRole(organizationId, userId, newRole);

    if (!result.success) {
      setError(result.error || 'Error al actualizar rol');
    } else {
      setSuccess('Rol actualizado');
      loadData();
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    const result = await cancelInvitation(invitationId);

    if (!result.success) {
      setError(result.error || 'Error al cancelar invitación');
    } else {
      setSuccess('Invitación cancelada');
      loadData();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Miembros</h2>
        <p className="mt-1 text-sm text-gray-600">
          Gestiona los miembros de tu organización
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {invitationLink && (
        <div className="rounded-md bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">
            Enlace de invitación:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={invitationLink}
              className="flex-1 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-blue-900"
            />
            <button
              onClick={() => copyToClipboard(invitationLink)}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Copiar
            </button>
            <a
              href={invitationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
            >
              Abrir
            </a>
          </div>
          <p className="mt-2 text-xs text-blue-600">
            Comparte este enlace con la persona que quieres invitar. Expira en 48 horas.
          </p>
        </div>
      )}

      {/* Invite form - only for admins */}
      <AdminOnly userRole={userRole}>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900">Invitar miembro</h3>
          <form onSubmit={handleInvite} className="mt-4 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  required
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="role" className="sr-only">
                  Rol
                </label>
                <select
                  id="role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as MembershipRole)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="member">Miembro</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting ? 'Enviando...' : 'Invitar'}
              </button>
            </div>
          </form>
        </div>
      </AdminOnly>

      {/* Current members */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">
            Miembros actuales ({members.length})
          </h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="font-medium text-gray-900">
                  {member.user.full_name || 'Sin nombre'}
                </p>
                <p className="text-sm text-gray-500">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-4">
                <AdminOnly userRole={userRole}>
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.user_id, e.target.value as MembershipRole)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="member">Miembro</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Eliminar
                  </button>
                </AdminOnly>
                {userRole !== 'admin' && (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    {member.role === 'admin' ? 'Admin' : 'Miembro'}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pending invitations - only for admins */}
      <AdminOnly userRole={userRole}>
        {invitations.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900">
                Invitaciones pendientes ({invitations.length})
              </h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{invitation.email}</p>
                    <p className="text-sm text-gray-500">
                      Expira: {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                      {invitation.role === 'admin' ? 'Admin' : 'Miembro'}
                    </span>
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Cancelar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AdminOnly>
    </div>
  );
}
