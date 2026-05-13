export function fixAvatarUri(uri: string | undefined | null, seed?: string): string {
  const fallback = `https://api.dicebear.com/7.x/avataaars/png?seed=${seed || 'user'}`;
  if (!uri || uri.trim() === '' || uri.startsWith('file://')) return fallback;
  if (uri.includes('avataaars/svg')) return uri.replace('avataaars/svg', 'avataaars/png');
  return uri;
}
