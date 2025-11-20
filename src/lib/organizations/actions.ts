'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database';
import { sendInvitationEmail } from '@/lib/email/resend';

type MembershipRole = Database['public']['Enums']['membership_role'];

export interface OrganizationActionResult {
  success: boolean;
  error?: string;
  data?: {
    organizationId?: string;
    slug?: string;
    invitationToken?: string;
  };
}

/**
 * Create a new organization with current user as admin
 */
export async function createOrganization(
  name: string,
  slug?: string
): Promise<OrganizationActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_organization_with_membership', {
    org_name: name,
    org_slug: slug || '', // RPC expects string, not null
  });

  if (error) {
    if (error.message.includes('duplicate key')) {
      return {
        success: false,
        error: 'Ya existe una organización con ese identificador',
      };
    }
    return {
      success: false,
      error: 'Error al crear la organización',
    };
  }

  // Get the slug for the created organization
  const { data: org } = await supabase.from('organizations').select('slug').eq('id', data).single();

  revalidatePath('/', 'layout');
  return {
    success: true,
    data: {
      organizationId: data,
      slug: org?.slug,
    },
  };
}

/**
 * Update organization details
 */
export async function updateOrganization(
  organizationId: string,
  name: string
): Promise<OrganizationActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from('organizations').update({ name }).eq('id', organizationId);

  if (error) {
    return {
      success: false,
      error: 'Error al actualizar la organización',
    };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Invite a user to the organization
 */
export async function inviteMember(
  organizationId: string,
  email: string,
  role: MembershipRole = 'member'
): Promise<OrganizationActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'No hay sesión activa',
    };
  }

  // Check if user is already a member
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .single();

  if (!existingMembership) {
    return {
      success: false,
      error: 'No tienes permisos para invitar a esta organización',
    };
  }

  // Check for existing pending invitation
  const { data: existingInvitation } = await supabase
    .from('invitations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .single();

  if (existingInvitation) {
    return {
      success: false,
      error: 'Ya existe una invitación pendiente para este email',
    };
  }

  // Get organization name and inviter info for the email
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single();

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  // Create invitation and get the token
  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({
      organization_id: organizationId,
      email: email.toLowerCase(),
      role,
      invited_by: user.id,
    })
    .select('token')
    .single();

  if (error || !invitation) {
    return {
      success: false,
      error: 'Error al crear la invitación',
    };
  }

  // Send invitation email
  try {
    await sendInvitationEmail({
      to: email.toLowerCase(),
      inviterName: inviterProfile?.full_name || user.email || 'Un usuario',
      organizationName: orgData?.name || 'una organización',
      invitationToken: invitation.token,
      role,
    });
  } catch (emailError) {
    // Log error but don't fail the invitation creation
    console.error('Error sending invitation email:', emailError);
    // Optionally, you could delete the invitation here if email is critical
  }

  revalidatePath('/', 'layout');
  return {
    success: true,
    data: {
      invitationToken: invitation.token,
    },
  };
}

/**
 * Accept an invitation by token
 */
export async function acceptInvitation(token: string): Promise<OrganizationActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('accept_invitation', {
    token_uuid: token,
  });

  if (error) {
    const errorMessage = error.message.includes('expired')
      ? 'La invitación ha expirado'
      : error.message.includes('already a member')
        ? 'Ya eres miembro de esta organización'
        : 'Invitación inválida o expirada';

    return {
      success: false,
      error: errorMessage,
    };
  }

  // Get the slug for redirect
  const { data: org } = await supabase.from('organizations').select('slug').eq('id', data).single();

  revalidatePath('/', 'layout');
  return {
    success: true,
    data: {
      organizationId: data,
      slug: org?.slug,
    },
  };
}

/**
 * Remove a member from the organization
 */
export async function removeMember(
  organizationId: string,
  userId: string
): Promise<OrganizationActionResult> {
  const supabase = await createClient();

  // Check if trying to remove the last admin
  const { data: admins } = await supabase
    .from('memberships')
    .select('id, user_id')
    .eq('organization_id', organizationId)
    .eq('role', 'admin');

  const firstAdmin = admins?.[0];
  if (admins?.length === 1 && firstAdmin?.user_id === userId) {
    return {
      success: false,
      error: 'No puedes eliminar al único administrador',
    };
  }

  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId);

  if (error) {
    return {
      success: false,
      error: 'Error al eliminar el miembro',
    };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: MembershipRole
): Promise<OrganizationActionResult> {
  const supabase = await createClient();

  // If demoting to member, check not removing last admin
  if (role === 'member') {
    const { data: admins } = await supabase
      .from('memberships')
      .select('id, user_id')
      .eq('organization_id', organizationId)
      .eq('role', 'admin');

    const firstAdmin = admins?.[0];
    if (admins?.length === 1 && firstAdmin?.user_id === userId) {
      return {
        success: false,
        error: 'Debe haber al menos un administrador',
      };
    }
  }

  const { error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('organization_id', organizationId)
    .eq('user_id', userId);

  if (error) {
    return {
      success: false,
      error: 'Error al actualizar el rol',
    };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(invitationId: string): Promise<OrganizationActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from('invitations').delete().eq('id', invitationId);

  if (error) {
    return {
      success: false,
      error: 'Error al cancelar la invitación',
    };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Reject an invitation by token (expires it immediately)
 */
export async function rejectInvitation(token: string): Promise<OrganizationActionResult> {
  const supabase = await createClient();

  // Set expires_at to now to invalidate the invitation
  const { error } = await supabase
    .from('invitations')
    .update({ expires_at: new Date().toISOString() })
    .eq('token', token)
    .is('accepted_at', null);

  if (error) {
    return {
      success: false,
      error: 'Error al rechazar la invitación',
    };
  }

  return { success: true };
}

/**
 * Get invitation details by token
 */
export async function getInvitationByToken(token: string) {
  const supabase = await createClient();

  // Fetch invitation with organization details
  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('*, organizations(name)')
    .eq('token', token)
    .single();

  if (error || !invitation) {
    console.error('Error getting invitation:', error);
    return null;
  }

  // Fetch inviter profile
  let invitedByName = 'Un usuario';
  if (invitation.invited_by) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', invitation.invited_by)
      .single();

    if (profile?.full_name) {
      invitedByName = profile.full_name;
    }
  }

  const now = new Date();
  const expiresAt = new Date(invitation.expires_at);
  const isValid = now < expiresAt && !invitation.accepted_at;

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    organization_id: invitation.organization_id,
    organization_name: invitation.organizations?.name || 'Organización desconocida',
    invited_by_name: invitedByName,
    is_valid: isValid,
  };
}
