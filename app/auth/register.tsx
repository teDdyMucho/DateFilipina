import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity, Image,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '@/components/GradientButton';
import { Colors } from '@/constants/colors';
import { useRegister } from '@/hooks/useAuth';

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

export default function RegisterScreen() {
  const { mutate: register, isPending, error } = useRegister();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', age: '' });
  const [validationError, setValidationError] = useState<string | null>(null);

  const update = (key: string) => (val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    if (validationError) setValidationError(null);
  };

  const handleRegister = () => {
    setValidationError(null);
    if (!form.name.trim()) return setValidationError('Please enter your full name.');
    if (!form.email.trim()) return setValidationError('Please enter your email.');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setValidationError('Please enter a valid email address.');
    if (!form.age.trim()) return setValidationError('Please enter your age.');
    const age = parseInt(form.age);
    if (!age || isNaN(age)) return setValidationError('Age must be a number.');
    if (age < 18) return setValidationError('You must be 18 or older to register.');
    if (!form.password || form.password.length < 6) return setValidationError('Password must be at least 6 characters.');
    if (form.password !== form.confirmPassword) return setValidationError('Passwords do not match.');
    register({ name: form.name.trim(), email: form.email.trim(), password: form.password, age });
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(214,26,78,0.25)', 'rgba(214,26,78,0.05)', 'transparent']}
          style={styles.orbTop}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['rgba(214,26,78,0.30)', 'rgba(214,26,78,0.08)']}
                  style={styles.logoGlow}
                />
                <View style={styles.logoCircle}>
                  <Image source={require('@/assets/images/ApplicationLogo.png')} style={styles.logo} resizeMode="contain" />
                </View>
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join thousands finding love in the Philippines</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PERSONAL INFO</Text>
              </View>

              <ModernInput
                label="FULL NAME"
                placeholder="Your full name"
                value={form.name}
                onChangeText={update('name')}
                icon="person-outline"
              />
              <ModernInput
                label="EMAIL"
                placeholder="you@email.com"
                value={form.email}
                onChangeText={update('email')}
                keyboardType="email-address"
                icon="mail-outline"
              />
              <ModernInput
                label="AGE"
                placeholder="Must be 18 or older"
                value={form.age}
                onChangeText={update('age')}
                keyboardType="number-pad"
                icon="calendar-outline"
              />

              <View style={[styles.section, { marginTop: 4 }]}>
                <Text style={styles.sectionTitle}>SECURITY</Text>
              </View>

              <ModernInput
                label="PASSWORD"
                placeholder="Min. 6 characters"
                value={form.password}
                onChangeText={update('password')}
                secureTextEntry
                icon="lock-closed-outline"
              />
              <ModernInput
                label="CONFIRM PASSWORD"
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChangeText={update('confirmPassword')}
                secureTextEntry
                icon="shield-checkmark-outline"
              />

              {form.confirmPassword.length > 0 && (
                <View style={styles.matchRow}>
                  <Ionicons
                    name={form.password === form.confirmPassword ? 'checkmark-circle' : 'close-circle'}
                    size={14}
                    color={form.password === form.confirmPassword ? '#34C759' : Colors.error}
                  />
                  <Text style={form.password === form.confirmPassword ? styles.matchOk : styles.matchErr}>
                    {form.password === form.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </Text>
                </View>
              )}

              {(validationError || error) && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.error}>
                    {validationError || (error as any)?.message || 'Registration failed. Please try again.'}
                  </Text>
                </View>
              )}

              <Text style={styles.terms}>
                By creating an account, you agree to our{' '}
                <Text style={{ color: Colors.primaryLight }}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={{ color: Colors.primaryLight }}>Privacy Policy</Text>
              </Text>

              <GradientButton
                title={isPending ? 'Creating Account…' : 'Create Account'}
                onPress={handleRegister}
                loading={isPending}
                size="lg"
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity><Text style={styles.footerLink}>Sign In</Text></TouchableOpacity>
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

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30, gap: 24 },

  hero: { alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 4 },
  logoContainer: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  logoGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  logoCircle: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(214,26,78,0.4)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 66, height: 66 },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.7 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },

  form: { gap: 14 },

  section: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 6, marginBottom: -4 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.primaryLight, letterSpacing: 1.5 },

  label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  inputFocused: { borderColor: Colors.primaryLight, backgroundColor: 'rgba(214,26,78,0.05)' },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, height: 52, paddingHorizontal: 14, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  eyeBtn: { paddingHorizontal: 14, height: 52, alignItems: 'center', justifyContent: 'center' },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  matchOk: { fontSize: 12, color: '#34C759', fontWeight: '700' },
  matchErr: { fontSize: 12, color: Colors.error, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(220,38,38,0.10)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)',
  },
  error: { flex: 1, color: Colors.error, fontSize: 13, lineHeight: 18, fontWeight: '500' },

  terms: { fontSize: 11, color: Colors.textMuted, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 6 },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.primaryLight, fontSize: 14, fontWeight: '800' },
});
