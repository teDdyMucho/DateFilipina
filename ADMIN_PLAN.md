# Admin Panel — Implementation Plan

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[-]` skipped

---

## ✅ Decisions (all answered)

- [x] **Phase order** — sequential 1→9
- [x] **User detail** — separate admin-only screen with full activity
- [x] **Impersonate user** — SKIP
- [x] **Ghost-mod in live streams** — SKIP
- [x] **Reports system** — add Report buttons to posts/users/streams in regular UI
- [x] **Banned users** — visible ban screen with reason
- [x] **Maintenance mode** — kick everyone out (already-logged-in users redirected on next action)
- [x] **Password** — `123456789`

---

## 🗂️ Files to Create / Modify

### New files
- [ ] `database/fix_admin.sql` — one big migration (columns, tables, RLS)
- [ ] `app/admin/_layout.tsx` — admin guard
- [ ] `app/admin/index.tsx` — dashboard
- [ ] `app/admin/users.tsx` — user list
- [ ] `app/admin/user/[id].tsx` — single user detail + actions
- [ ] `app/admin/posts.tsx` — all posts list + actions
- [ ] `app/admin/streams.tsx` — live streams + actions
- [ ] `app/admin/wallet.tsx` — transactions + coin grants
- [ ] `app/admin/reports.tsx` — report queue
- [ ] `app/admin/system.tsx` — maintenance / announce / force-update
- [ ] `app/admin/audit.tsx` — action log
- [ ] `services/adminService.ts` — all admin API calls
- [ ] `hooks/useAdmin.ts` — React Query admin hooks
- [ ] `components/admin/StatCard.tsx`
- [ ] `components/admin/UserRow.tsx`
- [ ] `components/admin/AdminTopTabs.tsx`
- [ ] `components/admin/ConfirmDialog.tsx`

### Modified files
- [ ] `app/(tabs)/_layout.tsx` — conditionally show Admin tab for admins
- [ ] `store/authStore.ts` — add `isAdmin`, `isBanned` to user object
- [ ] `services/profileService.ts` — return `isAdmin`, `isBanned`
- [ ] `constants/types.ts` — add `isAdmin`, `isBanned` to `User`
- [ ] `hooks/useAuth.ts` — block login if banned, show ban screen
- [ ] `app/auth/login.tsx` — handle banned-user response
- [ ] `app/(tabs)/home.tsx` — hide posts where `is_hidden = true`; show pinned first
- [ ] `app/(tabs)/discover.tsx` — exclude banned users + admin from swipe pool
- [ ] `app/(tabs)/live.tsx` — block "Go Live" if `can_stream = false`

---

## 📊 Database Migration Checklist

`database/fix_admin.sql` should add:

### profiles columns
- [ ] `is_admin BOOLEAN DEFAULT false`
- [ ] `is_banned BOOLEAN DEFAULT false`
- [ ] `banned_at TIMESTAMPTZ`
- [ ] `banned_reason TEXT`
- [ ] `can_stream BOOLEAN DEFAULT true`

### posts columns
- [ ] `is_pinned BOOLEAN DEFAULT false`
- [ ] `is_hidden BOOLEAN DEFAULT false`

### New tables
- [ ] `reports` (id, reporter_id, target_type, target_id, reason, status, created_at, resolved_at, resolved_by)
- [ ] `admin_actions` (id, admin_id, action, target_type, target_id, details JSONB, created_at)
- [ ] `app_settings` (key PK, value JSONB, updated_at, updated_by)

### Seeded app_settings rows
- [ ] `maintenance_mode` (bool, default false)
- [ ] `announcement` (string, default null)
- [ ] `min_app_version` (string, default current version)
- [ ] `interest_tags` (array, copied from current constants)
- [ ] `gift_catalog` (array, copied from current GIFTS)
- [ ] `coin_packages` (array, copied from current COIN_PACKAGES)

### RLS policies (admin bypass on all major tables)
- [ ] `profiles` — admin can SELECT/UPDATE/DELETE any row
- [ ] `posts` — admin can SELECT/UPDATE/DELETE any row
- [ ] `post_likes` — admin can SELECT/DELETE
- [ ] `post_comments` — admin can SELECT/UPDATE/DELETE any row
- [ ] `live_streams` — admin can SELECT/UPDATE/DELETE any row
- [ ] `coin_transactions` — admin can SELECT all, INSERT manual grants
- [ ] `follows` — admin can SELECT/DELETE any row
- [ ] `user_blocks` — admin can SELECT all (read-only)
- [ ] `conversations` — admin can SELECT (read-only, no message access)

### RLS policies (banned-user restrictions)
- [ ] `posts` INSERT blocked if `is_banned = true`
- [ ] `post_comments` INSERT blocked if `is_banned = true`
- [ ] `live_streams` INSERT blocked if `is_banned = true` OR `can_stream = false`
- [ ] `messages` INSERT blocked if `is_banned = true`

### Admin account creation
- [ ] User signs up `Admin@gmail.com` via Supabase Auth dashboard
- [ ] Run: `UPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = 'Admin@gmail.com');`

---

## 🚀 Phase 1 — Foundation

- [x] Write `database/fix_admin.sql` (full migration)
- [x] User runs migration in Supabase
- [x] User creates Admin@gmail.com account
- [x] User confirms admin flag is set
- [x] Update `User` type with `isAdmin`, `isBanned`, `bannedReason`, `canStream`
- [x] Update `profileService.dbToUser` AND `authService.dbToUser` to map new fields
- [x] Add admin redirect logic in `app/admin/_layout.tsx` (non-admins → home)
- [x] Add conditional Admin tab in `(tabs)/_layout.tsx` (uses `href: null` to hide)
- [x] Build `components/admin/AdminTopTabs.tsx` (segmented tabs at top of admin screen)
- [x] Build `components/admin/StatCard.tsx`
- [x] Build `components/admin/ConfirmDialog.tsx`
- [x] Create dashboard `app/(tabs)/admin.tsx`
- [x] Create placeholder admin sub-screens (users, posts, streams, wallet, reports, system, audit)
- [ ] Test: admin user sees Admin tab, regular user doesn't

---

## 👥 Phase 2 — Users Management

- [x] `adminService.getAllUsers(search, page)` — paginated user list
- [x] `adminService.banUser(userId, reason)` + audit log entry
- [x] `adminService.unbanUser(userId)` + audit log entry
- [x] `adminService.deleteUser(userId)` + cascade + audit log
- [x] `adminService.setVerified(userId, verified)` + audit log
- [x] `adminService.setCanStream(userId, canStream)` + audit log
- [x] `adminService.updateUserProfile(userId, updates)` + audit log
- [x] `adminService.removeAvatar(userId)`
- [x] `adminService.removeCover(userId)`
- [x] `adminService.getUserActivity(userId)` — posts, gifts, transactions
- [x] `hooks/useAdmin.ts` — React Query hooks for all admin user ops
- [x] `app/admin/users.tsx` — search bar + filters + infinite list
- [x] `app/admin/user/[id].tsx` — detail + ban / unban / delete / verify / streaming / avatar / cover
- [x] `components/admin/UserRow.tsx` — reusable list row
- [x] Toast on every action via `useSheet` ("User banned", "Profile updated")
- [x] Confirm dialog on destructive actions (ban with reason input, delete)
- [x] Update login flow to redirect banned users to `/auth/banned`
- [x] `app/auth/banned.tsx` — styled "account suspended" screen with reason

---

## 📝 Phase 3 — Posts Management

- [x] `adminService.getAllPosts(search, filter, page)` + paginated infinite query
- [x] `adminService.getPostComments(postId)` for the comments manager
- [x] `adminService.deletePostAsAdmin(postId)` + audit log
- [x] `adminService.updatePostCaptionAsAdmin(postId, caption)` + audit log
- [x] `adminService.setPinned(postId, pinned)` + audit log (handles pin & unpin)
- [x] `adminService.setHidden(postId, hidden)` + audit log (handles hide & unhide)
- [x] `adminService.deleteCommentAsAdmin(commentId)` + audit log
- [x] React Query hooks for all post + comment operations
- [x] `app/admin/posts.tsx` — feed-style list, search, filter pills, infinite scroll, action sheet per post
- [x] Edit caption modal
- [x] Comments manager modal (full list with per-comment delete)
- [x] Confirm dialog for post deletion
- [x] Update `feedService.getFeed` to skip `is_hidden` posts and show `is_pinned` first (with migration fallback)

---

## 🔴 Phase 4 — Live Streams Management

- [x] `adminService.getAllActiveStreams()` — returns active streams with host info
- [x] `adminService.endStreamAsAdmin(streamId, hostId, reason)` — broadcasts force-end + marks DB
- [x] `adminService.muteStreamVideo(streamId, hostId)` — broadcasts to host
- [x] `adminService.muteStreamAudio(streamId, hostId)` — broadcasts to host
- [x] `adminService.setCanStream(userId, canStream)` — reused from Phase 2 user actions
- [x] React Query hooks for all stream operations (auto-refreshes every 10s)
- [x] `liveService.adminBroadcast` — one-shot channel broadcast for admin events
- [x] Extended `createLiveRoom` to handle `onAdminForceEnd`, `onAdminMuteAudio`, `onAdminMuteVideo`
- [x] Host's live.tsx mutes mic/cam when admin sends signal + shows "Stream Ended by Admin" with reason
- [x] `app/admin/streams.tsx` — card list with blurred host avatar, LIVE badge, viewer count, gift total, "started" time, 3-dot actions
- [x] Force-end modal with reason input
- [x] Update `live.tsx` `GoLiveModal` to check `canStream` before allowing stream start
- [-] (Optional) Ghost-mod join — see chat without appearing in viewer list  — SKIPPED

---

## 💎 Phase 5 — Wallet / Economy

- [x] `adminService.getAllTransactions(filter, page)` — paginated infinite list
- [x] `adminService.getEconomyStats()` — total coins, today's movement, totals
- [x] `adminService.grantCoins(userId, amount, reason)` — bumps balance + adds tx row + audit log
- [x] `adminService.revokeCoins(userId, amount, reason)` — same in reverse + audit log
- [x] React Query hooks for transactions, stats, grant, revoke
- [x] `app/admin/wallet.tsx` — stat cards · quick action buttons · filter pills · paginated transaction feed
- [x] Grant/Revoke modal with user search picker, amount input, reason field, confirm button
- [-] `adminService.refundTransaction(txId)` — SKIPPED for v1 (use revoke instead)

---

## 🚨 Phase 6 — Reports

- [x] `reportService.submitReport(targetType, targetId, reason)` — for regular users
- [x] `REPORT_REASONS` const — 9 standard categories + Other
- [x] `components/ReportSheet.tsx` — reusable modal with reason picker + optional note + submit
- [x] **Report** wired in home post 3-dot menu (replaces fake "Thank you for reporting")
- [x] **Report** added to stalk profile header (3-dot button next to message icon)
- [x] **Report** added to live stream viewer (3-dot in top bar opens ActionSheet → Report Stream)
- [x] `adminService.getReports(status, page)` — paginated infinite list with reporter + resolver info
- [x] `adminService.resolveReport(reportId, action, note)` — `'resolved'` / `'ignored'` + audit log
- [x] React Query hooks (useAdminReports, useResolveReport)
- [x] `app/admin/reports.tsx` — queue with status filter pills (All/Pending/Resolved/Ignored)
- [x] Per-report ActionSheet: view reported target · view reporter · mark resolved · mark ignored

---

## 📊 Phase 7 — Analytics Dashboard

- [ ] `adminService.getDashboardStats()` — counts, totals, today's metrics
- [ ] `adminService.getTopHosts()` — sorted by gifts received
- [ ] `adminService.getServerHealth()` — Supabase + Agora ping
- [ ] `app/admin/index.tsx` — stat cards grid + quick action buttons
- [ ] Simple bar/line chart for "users joined this week" (no new lib — pure SVG)
- [ ] "Quick actions" row at top: pending reports, active streams, banned users

---

## ⚙️ Phase 8 — System Settings

- [ ] `adminService.updateAppSetting(key, value)` + audit log
- [ ] `adminService.sendAnnouncement(title, body)` — Expo push to all users
- [ ] `adminService.logoutAllSessions()` — invalidates all refresh tokens
- [ ] `app/admin/system.tsx` — sections:
  - [ ] Maintenance mode toggle (with confirm)
  - [ ] Announcement composer (title, body, send button)
  - [ ] Interest tags editor (add/remove/rename)
  - [ ] Gift catalog editor (emoji, name, coin cost, add/remove)
  - [ ] Coin packages editor (coins, bonus, price)
  - [ ] Force update — set `min_app_version`
  - [ ] Logout all sessions button (red, with confirm)
- [ ] Update app boot to check `maintenance_mode` and show maintenance screen
- [ ] Update app boot to check `min_app_version` and show update prompt

---

## 📜 Phase 9 — Audit Log

- [ ] `adminService.getAuditLog(filter, page)`
- [ ] `app/admin/audit.tsx` — list with: admin avatar, action, target, timestamp
- [ ] Filter by admin / action type / date range
- [ ] Tap to expand details JSON
- [ ] (Optional) "Suspicious activity" tab — heuristic flags

---

## 🧪 Final Pass

- [ ] Test every admin action end-to-end as Admin@gmail.com
- [ ] Test as a regular user that nothing admin-only is accessible
- [ ] Test as a banned user (login blocked + visible reason)
- [ ] Test RLS policies by trying admin actions as a regular user (should fail)
- [ ] Verify audit log captures every action
- [ ] Final UI polish — consistent spacing, icons, haptics, toasts

---

## 📝 Notes / Decisions Log

(Add notes here as we go — design choices, things skipped, gotchas, etc.)
