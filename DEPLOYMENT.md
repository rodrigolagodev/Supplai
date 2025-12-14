# Production Deployment Guide

This guide will help you configure your production environment correctly.

## Step 1: Configure Vercel Environment Variable

1. Go to your Vercel project: https://vercel.com/your-team/supplai
2. Navigate to: **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `NEXT_PUBLIC_SITE_URL`
   - **Value**: `https://supplai-web.vercel.app`
   - **Environment**: Select **Production**, **Preview**, and **Development**
4. Click **Save**

## Step 2: Configure Supabase Redirect URLs

1. Go to your Supabase project dashboard
2. Navigate to: **Authentication** → **URL Configuration**
3. Update the following settings:

   **Site URL**:

   ```
   https://supplai-web.vercel.app
   ```

   **Redirect URLs** (add all of these):

   ```
   https://supplai-web.vercel.app/auth/callback
   https://supplai-web.vercel.app/auth/confirm
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/confirm
   ```

4. Click **Save**

## Step 3: Redeploy Your Application

After setting the environment variable in Vercel:

1. Go to your Vercel project **Deployments** tab
2. Find the latest deployment
3. Click the **•••** menu → **Redeploy**
4. Ensure "Use existing Build Cache" is **unchecked**
5. Click **Redeploy**

## Step 4: Test Email Confirmation

1. Wait for deployment to complete
2. Go to: https://supplai-web.vercel.app/register
3. Register with a new email address
4. Check your email
5. Verify the confirmation link now points to `https://supplai-web.vercel.app` (not localhost)
6. Click the link and confirm it works

## Troubleshooting

**Issue**: Email still points to localhost

- **Solution**: Make sure you redeployed AFTER setting the environment variable
- Check that the environment variable is set in the correct environment (Production)

**Issue**: "Access denied" error when clicking email link

- **Solution**: Verify all redirect URLs are configured correctly in Supabase
- The URL must match exactly (including https://)

**Issue**: Link works but shows "Email link has expired"

- **Solution**: The link expires after a short time (5-10 minutes)
- Request a new confirmation email by registering again with a different email
