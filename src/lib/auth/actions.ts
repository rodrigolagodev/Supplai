'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      success: false,
      error: getAuthErrorMessage(error.message),
    };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

import { acceptInvitation } from '@/lib/organizations/actions';

/**
 * Sign up with email, password, and full name
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  invitationToken?: string
): Promise<AuthActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/confirm`,
    },
  });

  if (error) {
    console.error('SignUp error:', error);
    return {
      success: false,
      error: getAuthErrorMessage(error.message),
    };
  }

  // If there's an invitation token, try to accept it
  if (invitationToken) {
    try {
      const acceptResult = await acceptInvitation(invitationToken);
      if (!acceptResult.success) {
        console.error('Error accepting invitation after signup:', acceptResult.error);
        // We don't fail the signup if invitation acceptance fails,
        // but we log it. The user can try to accept it later.
      }
    } catch (e) {
      console.error('Unexpected error accepting invitation:', e);
    }
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect('/login' as any);
}

/**
 * Request password reset email
 */
export async function resetPassword(email: string): Promise<AuthActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  });

  if (error) {
    return {
      success: false,
      error: getAuthErrorMessage(error.message),
    };
  }

  return { success: true };
}

/**
 * Update password (when user has reset token)
 */
export async function updatePassword(newPassword: string): Promise<AuthActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return {
      success: false,
      error: getAuthErrorMessage(error.message),
    };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Update user profile
 */
export async function updateProfile(fullName: string): Promise<AuthActionResult> {
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

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', user.id);

  if (error) {
    return {
      success: false,
      error: 'Error al actualizar el perfil',
    };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Translate auth error messages to Spanish
 */
function getAuthErrorMessage(errorMessage: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'Email o contraseña incorrectos',
    'Email not confirmed': 'Por favor confirma tu email antes de iniciar sesión',
    'Email link is invalid or has expired': 'El enlace de confirmación ha expirado o es inválido',
    'User already registered': 'Ya existe una cuenta con este email',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
    'Unable to validate email address: invalid format': 'El formato del email no es válido',
    'Email rate limit exceeded': 'Demasiados intentos. Por favor espera unos minutos',
    'For security purposes, you can only request this once every 60 seconds':
      'Por seguridad, solo puedes solicitar esto cada 60 segundos',
  };

  return errorMap[errorMessage] || 'Ha ocurrido un error. Inténtalo de nuevo.';
}
