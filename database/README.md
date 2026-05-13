# Database Setup Guide

## Option 1: Supabase (Recommended - Free & Easy)

1. Go to https://supabase.com → Create account → New project
2. Go to **SQL Editor** → paste the entire `schema.sql` → click **Run**
3. Copy your project URL and anon key from **Settings → API**
4. Add to your app's `.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Option 2: Local PostgreSQL

```bash
# Install PostgreSQL, then:
psql -U postgres -c "CREATE DATABASE dateafilipina;"
psql -U postgres -d dateafilipina -f schema.sql
```

## Tables Overview

| Table               | Purpose                          |
|---------------------|----------------------------------|
| users               | All user accounts                |
| auth_tokens         | JWT refresh tokens               |
| user_photos         | Profile photos                   |
| interests           | Interest tags                    |
| follows             | Follow relationships             |
| swipes              | Discover swipe history           |
| matches             | Mutual likes = matches           |
| conversations       | Chat threads                     |
| messages            | Individual messages              |
| posts               | Home feed posts                  |
| post_likes          | Post likes                       |
| stories             | 24h stories                      |
| live_streams        | Live stream sessions             |
| gifts_sent          | Virtual gifts                    |
| coin_transactions   | Coin purchase/spend history      |
| coin_packages       | Available coin bundles           |
| notifications       | Push notification records        |
| reports             | User reports                     |
| blocks              | Blocked users                    |
