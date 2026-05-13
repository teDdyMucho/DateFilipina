import { useQuery, useMutation } from '@tanstack/react-query';
import { discoverService, DiscoverFilters } from '@/services/discoverService';
import { useDiscoverStore } from '@/store/discoverStore';
import { useAuthStore } from '@/store/authStore';

export function useDiscoverProfiles(filters: DiscoverFilters = {}) {
  const { setProfiles } = useDiscoverStore();
  const user = useAuthStore(s => s.user);

  return useQuery({
    queryKey: ['discover', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];
      const profiles = await discoverService.getProfiles(user.id, filters);
      setProfiles(profiles);
      return profiles;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
}

export function useMatches() {
  const user = useAuthStore(s => s.user);
  const { setMatches } = useDiscoverStore();

  return useQuery({
    queryKey: ['matches', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const matches = await discoverService.getMatches(user.id);
      setMatches(matches);
      return matches;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useIncomingLikes() {
  const user = useAuthStore(s => s.user);
  const { setIncomingLikes } = useDiscoverStore();

  return useQuery({
    queryKey: ['incomingLikes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const likes = await discoverService.getIncomingLikes(user.id);
        setIncomingLikes(likes);
        return likes;
      } catch (e: any) {
        console.error('[incomingLikes] error:', e.message);
        return [];
      }
    },
    enabled: !!user?.id,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useSwipe() {
  const { swipeLeft, swipeRight, addMatch, profiles, currentIndex } = useDiscoverStore();
  const user = useAuthStore(s => s.user);

  const likeMutation = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      return discoverService.swipe(user.id, targetId, 'like');
    },
    onSuccess: (matchedUser) => {
      swipeRight();
      if (matchedUser) {
        addMatch(matchedUser);
        return matchedUser;
      }
      return null;
    },
  });

  const superLikeMutation = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      return discoverService.swipe(user.id, targetId, 'super_like');
    },
    onSuccess: (matchedUser) => {
      swipeRight();
      if (matchedUser) {
        addMatch(matchedUser);
        return matchedUser;
      }
      return null;
    },
  });

  const passMutation = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      return discoverService.swipe(user.id, targetId, 'pass');
    },
    onSuccess: () => swipeLeft(),
  });

  return { likeMutation, superLikeMutation, passMutation };
}
