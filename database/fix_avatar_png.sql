-- Fix: Replace SVG dicebear URLs with PNG (expo-image on Android cannot render SVG URLs)
-- Also resets any broken file:// paths
-- Run this in Supabase SQL Editor

update public.profiles
  set avatar_url = 'https://api.dicebear.com/7.x/avataaars/png?seed=' || id
  where avatar_url like '%avataaars/svg%'
     or avatar_url like 'file://%'
     or avatar_url is null
     or avatar_url = '';
