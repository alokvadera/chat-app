# Google OAuth Setup Guide

## ✅ Code Implementation Complete

The following files have been updated:
- `src/config/supabase.js` - Added `loginWithGoogle()` function
- `src/pages/Login/Login.jsx` - Added "Continue with Google" button
- `src/pages/Login/Login.css` - Added Google button styling

## 📋 Configuration Steps

### 1. Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Create/select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen (if first time):
   - Add app name
   - Add support email
   - Add authorized domain (optional for testing)
6. Select **Web application** as type
7. Add **Authorized redirect URIs**:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Replace `<your-project-ref>` with your actual Supabase project reference
8. Click **Create**
9. **Copy the Client ID and Client Secret** (you'll need these next)

### 2. Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard/project/<your-project-ref>
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the provider list
4. Toggle it **ON**
5. Paste your **Client ID** from Google Cloud Console
6. Paste your **Client Secret** from Google Cloud Console
7. Click **Save**

### 3. Configure Redirect URLs

Still in Supabase Dashboard:
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain:
   ```
   https://chatappalokvadera.dev
   ```
3. Add **Redirect URLs** (one per line):
   ```
   https://chatappalokvadera.dev
   https://your-vercel-app.vercel.app
   http://localhost:5173
   ```
4. Click **Save**

### 4. Environment Variables

Ensure your `.env` file has:
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

For Vercel deployment, set these in **Project Settings** → **Environment Variables**

## 🔄 How It Works

1. User clicks "Continue with Google"
2. `loginWithGoogle()` redirects to Google OAuth consent screen
3. User authorizes the app
4. Google redirects back to your app with auth tokens in URL
5. Supabase client (with `detectSessionInUrl: true`) automatically:
   - Extracts tokens from URL
   - Creates session
   - Triggers `onAuthStateChange` event
6. App calls `loadUserData()` which:
   - Calls `ensureUserProfile()` to create/update user in `users` table
   - Extracts name, email, avatar from Google metadata
   - Creates chat record in `chats` table
   - Navigates to `/profile-update` or `/chat`

## 📊 Profile Data from Google

The `ensureUserProfile()` function automatically extracts:
- **Name**: `user.user_metadata.full_name` or email prefix
- **Email**: `user.email`
- **Avatar**: Can be added by modifying `ensureUserProfile()` to use `user.user_metadata.avatar_url`
- **Username**: Generated from email or name

## 🎨 Customization

### Add Google Icon to Button

Install a package or use an SVG:
```jsx
<button onClick={loginWithGoogle} className="google-login-btn">
  <img src="/google-icon.svg" alt="" width="18" />
  Continue with Google
</button>
```

### Extract Google Avatar

Modify `src/config/supabase.js` in `ensureUserProfile()`:
```javascript
const safeAvatar = 
  fallback.avatar || 
  user.user_metadata?.avatar_url || 
  user.user_metadata?.picture || 
  "";

// Then in the insert:
avatar: safeAvatar,
```

## 🧪 Testing

1. Start dev server: `npm run dev`
2. Go to http://localhost:5173
3. Click "Continue with Google"
4. Authorize with your Google account
5. Should redirect back and create session
6. Check Supabase **Authentication** → **Users** to see new user
7. Check **Table Editor** → **users** to see profile created

## ⚠️ Troubleshooting

### "Redirect URI mismatch" error
- Verify the redirect URI in Google Cloud Console exactly matches:
  `https://<project-ref>.supabase.co/auth/v1/callback`

### User created but no profile
- Check Supabase RLS policies on `users` and `chats` tables
- Ensure authenticated users can INSERT their own records

### Redirect loops
- Verify `Site URL` in Supabase matches your actual domain
- Check that redirect URLs include your domain

### OAuth popup blocked
- Browser may block popups; user needs to allow them
- Or use redirect flow (already implemented)

## 🚀 Production Checklist

- [ ] Google OAuth credentials created
- [ ] Supabase Google provider enabled
- [ ] Redirect URIs configured in both Google and Supabase
- [ ] Environment variables set in Vercel
- [ ] Site URL set to production domain
- [ ] Test login flow on production URL
- [ ] Verify profile creation in Supabase
