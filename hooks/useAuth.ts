import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';

export function useLogin() {
  const { setAuth } = useAuthStore();
  const { setCoins } = useWalletStore();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),
    onSuccess: ({ user, token }) => {
      setAuth(user, token);
      setCoins(user.coins);
      router.replace('/(tabs)/home');
    },
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  const { setCoins } = useWalletStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; age: number }) =>
      authService.register(data),
    onSuccess: ({ user, token }) => {
      setAuth(user, token);
      setCoins(user.coins);
      router.replace('/(tabs)/home');
    },
  });
}

export function useLogout() {
  const { user, logout } = useAuthStore();
  const { setCoins } = useWalletStore();
  const router = useRouter();

  return () => {
    authService.logout(user?.id);
    logout();
    setCoins(0);
    router.replace('/auth/login');
  };
}
