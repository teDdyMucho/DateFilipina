-- ════════════════════════════════════════════════════════════════════════════
-- NOTIFICATION TRIGGERS — surface every "ganap" (event) in the bell:
--   - someone likes your post
--   - someone comments on your post
--   - someone shares your post (insert into posts with shared_from_user_id)
--   - someone likes you (right-swipe in swipes table)
--   - someone follows you
--   - someone sends you a gift (gifts table)
-- The match trigger from 12_notifications.sql is left in place.
-- Run this once in Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

-- Extend the type check to include 'comment' and 'share' so the new triggers
-- can insert without violating the constraint. We drop and re-add it.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'match', 'message', 'like', 'follow', 'gift',
    'live_start', 'super_like', 'comment', 'share'
  ));

-- ── POST LIKE ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  post_owner UUID;
  actor_name TEXT;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner IS NULL OR post_owner = NEW.user_id THEN
    RETURN NEW; -- don't notify yourself
  END IF;
  SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, actor_id, data)
  VALUES (post_owner, 'like', 'New Like',
          COALESCE(actor_name, 'Someone') || ' liked your post',
          NEW.user_id, jsonb_build_object('post_id', NEW.post_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_post_like_created ON public.post_likes;
CREATE TRIGGER on_post_like_created
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_like();

-- ── POST COMMENT ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_post_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  post_owner UUID;
  actor_name TEXT;
  preview TEXT;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner IS NULL OR post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  preview := LEFT(NEW.content, 60);
  INSERT INTO public.notifications (user_id, type, title, body, actor_id, data)
  VALUES (post_owner, 'comment', 'New Comment',
          COALESCE(actor_name, 'Someone') || ': ' || preview,
          NEW.user_id, jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_post_comment_created ON public.post_comments;
CREATE TRIGGER on_post_comment_created
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_comment();

-- ── POST SHARE ─────────────────────────────────────────────────────────────
-- Triggered when a row is inserted into posts with shared_from_user_id set
-- (the original poster gets the notification). Skip if sharing your own post.
CREATE OR REPLACE FUNCTION public.notify_on_post_share()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  actor_name TEXT;
BEGIN
  IF NEW.shared_from_user_id IS NULL OR NEW.shared_from_user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, body, actor_id, data)
  VALUES (NEW.shared_from_user_id, 'share', 'Post Shared',
          COALESCE(actor_name, 'Someone') || ' shared your post',
          NEW.user_id, jsonb_build_object('post_id', NEW.id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_post_share_created ON public.posts;
CREATE TRIGGER on_post_share_created
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_share();

-- ── PROFILE LIKE (right-swipe) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_swipe_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  actor_name TEXT;
BEGIN
  IF NEW.direction NOT IN ('like', 'super_like') THEN
    RETURN NEW;
  END IF;
  SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.swiper_id;
  INSERT INTO public.notifications (user_id, type, title, body, actor_id, data)
  VALUES (NEW.swiped_id,
          CASE WHEN NEW.direction = 'super_like' THEN 'super_like' ELSE 'like' END,
          CASE WHEN NEW.direction = 'super_like' THEN 'Super Like!' ELSE 'Someone likes you' END,
          COALESCE(actor_name, 'Someone') ||
            CASE WHEN NEW.direction = 'super_like' THEN ' super-liked you' ELSE ' liked you' END,
          NEW.swiper_id, '{}'::jsonb);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_swipe_like_created ON public.swipes;
CREATE TRIGGER on_swipe_like_created
  AFTER INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_swipe_like();

-- ── FOLLOW ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  actor_name TEXT;
BEGIN
  SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, type, title, body, actor_id, data)
  VALUES (NEW.following_id, 'follow', 'New Follower',
          COALESCE(actor_name, 'Someone') || ' started following you',
          NEW.follower_id, '{}'::jsonb);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
CREATE TRIGGER on_follow_created
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ── GIFT ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_gift()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  actor_name TEXT;
BEGIN
  SELECT name INTO actor_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, actor_id, data)
  VALUES (NEW.receiver_id, 'gift', 'New Gift!',
          COALESCE(actor_name, 'Someone') || ' sent you a ' || NEW.gift_type || ' ' || NEW.gift_emoji,
          NEW.sender_id, jsonb_build_object('gift_id', NEW.id, 'coin_cost', NEW.coin_cost));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_gift_created ON public.gifts;
CREATE TRIGGER on_gift_created
  AFTER INSERT ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_gift();
