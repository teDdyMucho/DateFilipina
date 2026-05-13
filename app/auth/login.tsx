import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Dimensions, Image,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '@/components/GradientButton';
import { Colors } from '@/constants/colors';
import { useLogin } from '@/hooks/useAuth';

const { height } = Dimensions.get('window');

function ModernInput({
  label, placeholder, value, onChangeText, secureTextEntry, keyboardType, icon,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; secureTextEntry?: boolean;
  keyboardType?: any; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, focused && styles.inputFocused]}>
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? Colors.primaryLight : Colors.textMuted} style={styles.inputIcon} />
        ) : null}
        <TextInput
          style={[styles.input, icon && { paddingLeft: 4 }]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry && !shown}
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShown(s => !s)} style={styles.eyeBtn}>
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { mutate: login, isPending, error } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email.trim()) return;
    if (!password.trim()) return;
    login({ email: email.trim(), password });
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Background gradient orbs */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(214,26,78,0.25)', 'rgba(214,26,78,0.05)', 'transparent']}
          style={styles.orbTop}
        />
        <LinearGradient
          colors={['transparent', 'rgba(120,40,200,0.12)']}
          style={styles.orbBottom}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['rgba(214,26,78,0.30)', 'rgba(214,26,78,0.08)']}
                  style={styles.logoGlow}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <View style={styles.logoCircle}>
                  <Image source={require('@/assets/images/ApplicationLogo.png')} style={styles.logo} resizeMode="contain" />
                </View>
              </View>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue your journey</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <ModernInput
                label="EMAIL"
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                icon="mail-outline"
              />
              <ModernInput
                label="PASSWORD"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                icon="lock-closed-outline"
              />

              <TouchableOpacity style={styles.forgotWrapper}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </TouchableOpacity>

              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.error}>
                    {(error as any)?.message || 'Invalid email or password.'}
                  </Text>
                </View>
              )}

              <GradientButton
                title={isPending ? 'Signing In…' : 'Sign In'}
                onPress={handleLogin}
                loading={isPending}
                style={{ marginTop: 4 }}
                size="lg"
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                  <Ionicons name="logo-apple" size={20} color={Colors.textPrimary} />
                  <Text style={styles.socialText}>Apple</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                  <Ionicons name="logo-google" size={20} color={Colors.textPrimary} />
                  <Text style={styles.socialText}>Google</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/auth/register" asChild>
                <TouchableOpacity><Text style={styles.footerLink}>Sign Up</Text></TouchableOpacity>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  orbTop: { position: 'absolute', top: -120, left: -80, right: -80, height: 380, borderRadius: 200 },
  orbBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220 },

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 30, gap: 30 },

  hero: { alignItems: 'center', gap: 12, paddingTop: 20, paddingBottom: 8 },
  logoContainer: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  logoGlow: { position: 'absolute', width: 130, height: 130, borderRadius: 65 },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(214,26,78,0.4)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 76, height: 76 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  form: { gap: 14 },

  label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  inputFocused: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(214,26,78,0.05)' },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, height: 54, paddingHorizontal: 14, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  eyeBtn: { paddingHorizontal: 14, height: 54, alignItems: 'center', justifyContent: 'center' },

  forgotWrapper: { alignSelf: 'flex-end', paddingVertical: 4 },
  forgot: { color: Colors.primaryLight, fontSize: 13, fontWeight: '600' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(220,38,38,0.10)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)',
  },
  error: { flex: 1, color: Colors.error, fontSize: 13, lineHeight: 18, fontWeight: '500' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: {
    flex: 1, height: 52, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  socialText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.primaryLight, fontSize: 14, fontWeight: '800' },
});
