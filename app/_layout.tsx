import '../global.css';
import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Colors } from '@/constants/colors';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { callService, CallSession } from '@/services/callService';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import { GlobalActionSheetProvider } from '@/components/GlobalActionSheet';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30000 },
    mutations: { retry: 0 },
  },
});

type IncomingCall = CallSession & { callerName: string; callerAvatar: string };

function AppInit() {
  const { setAuth } = useAuthStore();
  const { setCoins } = useWalletStore();
  useEffect(() => {
    authService.restoreSession()
      .then((result) => {
        if (result) {
          setAuth(result.user, result.token);
          setCoins(result.user.coins);
        }
      })
      .catch(() => {})
      .finally(() => SplashScreen.hideAsync());
  }, []);
  return null;
}

// Refresh profile from DB every time app is foregrounded so avatar stays fresh
function ProfileRefresher() {
  const { user, setUser } = useAuthStore();
  const { setCoins } = useWalletStore();
  useEffect(() => {
    if (!user?.id) return;
    import('@/services/profileService').then(({ profileService }) => {
      profileService.getProfile(user.id).then(fresh => {
        setUser(fresh);
        setCoins(fresh.coins);
      }).catch(() => {});
    });
  }, [user?.id]);
  return null;
}

function IncomingCallListener() {
  const authUser = useAuthStore(s => s.user);
  const router = useRouter();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!authUser?.id) return;

    channelRef.current = callService.subscribeToIncomingCalls(
      authUser.id,
      (session) => {
        setIncomingCall(session as IncomingCall);
      },
    );

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [authUser?.id]);

  const handleAnswer = async () => {
    if (!incomingCall) return;
    const session = incomingCall;
    setIncomingCall(null);
    try {
      await callService.answerCall(session.id);
    } catch {}
    router.push({
      pathname: '/call/video',
      params: {
        sessionId: session.id,
        calleeId: session.callerId,
        type: session.callType,
        partnerName: session.callerName,
        partnerAvatar: session.callerAvatar,
      },
    } as any);
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    const sessionId = incomingCall.id;
    setIncomingCall(null);
    try {
      await callService.declineCall(sessionId);
    } catch {}
  };

  if (!incomingCall) return null;

  return (
    <IncomingCallModal
      visible
      callerName={incomingCall.callerName}
      callerAvatar={incomingCall.callerAvatar}
      callType={incomingCall.callType}
      onAnswer={handleAnswer}
      onDecline={handleDecline}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GlobalActionSheetProvider>
          <StatusBar style="light" />
          <AppInit />
          <ProfileRefresher />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: 'fade',
            }}
          />
          <IncomingCallListener />
          </GlobalActionSheetProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}