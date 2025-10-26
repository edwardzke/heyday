# Database Integration Summary

## What Was Added

This document summarizes the Supabase + PostgreSQL integration that has been added to the Heyday Mobile app.

## New Files Created

### 1. **Database & Configuration**
- `supabase-schema.sql` - Complete PostgreSQL schema for Supabase
- `lib/supabase.ts` - Supabase client configuration
- `.env.example` - Environment variable template

### 2. **Authentication Pages**
- `app/login.tsx` - User login page
- `app/signup.tsx` - User registration page

### 3. **Documentation**
- `SUPABASE_SETUP.md` - Comprehensive setup guide
- `DATABASE_INTEGRATION_SUMMARY.md` - This file

## Modified Files

### `app/addplant.tsx`
**Added:**
- Supabase integration for saving plants
- Image upload to Supabase Storage
- User authentication check
- New form fields:
  - Watering schedule (float for waters per day)
  - Notes (multiline text area)
- Loading states during submission
- Error handling for database operations

### `app/index.tsx`
**Added:**
- Login and Sign Up buttons
- Updated navigation flow
- Better button organization

### `app/camerapage.tsx`
**Modified earlier:**
- Photo capture with redirect to addplant page
- Automatic photo population in form

## Database Schema

### Tables Created

#### `profiles` (User Profiles)
```sql
- id (UUID) - References auth.users
- username (TEXT) - Unique username
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `plants` (Plant Entries)
```sql
- id (UUID)
- user_id (UUID) - Owner of the plant
- species (TEXT) - Plant species name
- nickname (TEXT) - Optional friendly name
- age (TEXT) - Plant age
- watering_schedule (FLOAT) - Waters per day
- notes (TEXT) - Care notes
- image_url (TEXT) - Supabase Storage or S3 URL
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `friendships` (Friend Connections)
```sql
- id (UUID)
- user_id (UUID)
- friend_id (UUID)
- status (TEXT) - 'pending', 'accepted', 'rejected'
- created_at (TIMESTAMP)
```

## Security Features

### Row Level Security (RLS)
All tables have RLS policies that ensure:
- Users can only access their own data
- Plants are private to their owners
- Friendships are managed by participants

### Authentication
- Email/password authentication via Supabase Auth
- Secure session management
- Password validation (minimum 6 characters)
- Automatic profile creation on signup

## Installation Steps (Quick)

1. **Install dependencies** (already done):
   ```bash
   npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
   ```

2. **Create Supabase project**:
   - Go to https://app.supabase.com
   - Create new project
   - Run `supabase-schema.sql` in SQL Editor

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Create storage bucket**:
   - In Supabase dashboard: Storage → Create bucket
   - Name: `plant-images`
   - Type: Public bucket

5. **Start the app**:
   ```bash
   npm start
   ```

## Usage Flow

### For New Users
1. Open app → Landing page
2. Click "Create Account"
3. Enter username, email, password
4. Account created → Redirected to login
5. Sign in → Access dashboard

### Adding a Plant
1. From dashboard, tap camera button OR
2. From landing page, tap "Add Plant"
3. Option A: Take photo → Redirected to form with photo
4. Option B: Direct to form → Add photo later
5. Fill in:
   - Species (required)
   - Age (required)
   - Nickname (optional)
   - Watering schedule (required, default 1.0)
   - Notes (optional)
   - Photo (optional)
6. Submit → Plant saved to database

### Data Flow
```
User → Camera/Form → Supabase Storage (image)
                   → Supabase Database (plant data)
                   → Success → Dashboard
```

## API Integration Points

### Authentication
- `supabase.auth.signUp()` - User registration
- `supabase.auth.signInWithPassword()` - User login
- `supabase.auth.signOut()` - User logout
- `supabase.auth.getUser()` - Get current user

### Database Operations
- `supabase.from('plants').insert()` - Create plant
- `supabase.from('plants').select()` - Read plants
- `supabase.from('plants').update()` - Update plant
- `supabase.from('plants').delete()` - Delete plant

### Storage Operations
- `supabase.storage.from('plant-images').upload()` - Upload image
- `supabase.storage.from('plant-images').getPublicUrl()` - Get image URL

## Next Steps / TODO

### Immediate
- [ ] Configure Supabase project
- [ ] Add environment variables
- [ ] Test authentication flow
- [ ] Create storage bucket

### Features to Implement
- [ ] Display user's plants on dashboard
- [ ] Edit existing plants
- [ ] Delete plants
- [ ] Friend request system
- [ ] Share plants with friends
- [ ] Watering reminders based on schedule
- [ ] Plant care history tracking
- [ ] Search and filter plants
- [ ] User profile page with logout

### Enhancements
- [ ] Profile pictures
- [ ] Social feed of friends' plants
- [ ] Plant health tracking
- [ ] Export plant data
- [ ] Offline mode with local caching
- [ ] Push notifications for watering

## TypeScript Types

All database types are defined in `lib/supabase.ts`:

```typescript
interface Profile {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

interface Plant {
  id: string;
  user_id: string;
  species: string;
  nickname: string | null;
  age: string | null;
  watering_schedule: number;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}
```

## Troubleshooting

See `SUPABASE_SETUP.md` for detailed troubleshooting steps.

Common issues:
- **Can't create account**: Check Supabase email auth is enabled
- **Image won't upload**: Verify storage bucket exists and is public
- **Can't save plant**: Ensure user is authenticated
- **Environment variables not loading**: Restart Expo dev server

## Support

For detailed setup instructions, see: `SUPABASE_SETUP.md`

For Supabase documentation: https://supabase.com/docs
