import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { AvatarWithRing } from '@/components/AvatarWithRing';
import { MessageBubble } from '@/components/MessageBubble';
import { Colors, Gradients } from '@/constants/colors';
import { useMessages, useSendMessage } from '@/hooks/useChat';
import { useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { messageService } from '@/services/messageService';
import { useSheet } from '@/components/GlobalActionSheet';
import { GIFTS } from '@/constants';
import { useWalletStore } from '@/store/walletStore';
import { EMOJI_CATEGORIES } from '@/constants/emoji';
import { ChatSettingsModal } from '@/components/ChatSettingsModal';
import { useChatStore as useChatStoreImport } from '@/store/chatStore';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [text, setText] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0].id);
  const [blockStatus, setBlockStatus] = useState({ iBlocked: false, blockedMe: false });
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const showSheet = useSheet();
  const { markRead, conversations: storeConvs, setConversations } = useChatStore();
  const qc = useQueryClient();
  const { spendCoins, coins } = useWalletStore();
  const authUser = useAuthStore(s => s.user);
  const myId = authUser?.id || '';

  // Get partner from store; if not found, load conversations from Supabase
  const conversation = storeConvs.find(c => c.id === id);
  const partner = conversation?.participant;

  useEffect(() => {
    if (!partner && authUser?.id && id) {
      setPartnerLoading(true);
      messageService.getConversations(authUser.id).then(convs => {
        setConversations(convs);
      }).catch(() => {}).finally(() => setPartnerLoading(false));
    }
  }, [id, authUser?.id]);

  const messages = useMessages(id || '');
  const { mutate: sendMessage, isPending } = useSendMessage(id || '');

  // Reliable auto-scroll to latest: scroll when messages first load AND when count grows
  useEffect(() => {
    if (messages.length === 0) return;
    const t1 = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    const t2 = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [messages.length]);

  useEffect(() => {
    if (id && myId) {
      markRead(id);
      messageService.markConversationRead(id, myId).then(() => {
        qc.invalidateQueries({ queryKey: ['conversations', myId] });
      }).catch(() => {});
    }
  }, [id, myId]);

  // Check block status (both directions) when partner loads
  const refreshBlockStatus = useCallback(async () => {
    if (!myId || !partner?.id) return;
    const status = await messageService.getBlockStatus(myId, partner.id);
    setBlockStatus(status);
  }, [myId, partner?.id]);

  useEffect(() => { refreshBlockStatus(); }, [refreshBlockStatus]);

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  const handleSend = useCallback(() => {
    if (!text.trim() || isPending) return;
    if (blockStatus.iBlocked || blockStatus.blockedMe) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(text.trim());
    setText('');
  }, [text, isPending, blockStatus]);

  const handleSendGift = (gift: typeof GIFTS[number]) => {
    if (coins < gift.coins) {
      showSheet({
        title: 'Not Enough Coins',
        message: `You need ${gift.coins} coins.`,
        options: [
          { label: 'Buy Coins', onPress: () => router.push('/(tabs)/profile') },
          { label: 'Cancel' },
        ],
      });
      return;
    }
    spendCoins(gift.coins, `Gift to ${partner?.name}: ${gift.name}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendMessage(`Sent you a ${gift.name} ${gift.emoji}`, 'gift');
    setShowGifts(false);
  };

  const uploadAndSendPhoto = async (localUri: string) => {
    if (!authUser?.id || !id) return;
    setSendingPhoto(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const url = await messageService.uploadPhoto(localUri, authUser.id);
      sendMessage({ content: url, type: 'image' });
    } catch (e: any) {
      showSheet({ title: 'Upload Failed', message: e.message || 'Could not send photo.', options: [{ label: 'OK' }] });
    } finally {
      setSendingPhoto(false);
    }
  };

  const handleCamera = () => {
    showSheet({
      title: 'Send Photo',
      options: [
        {
          label: 'Camera',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') { showSheet({ title: 'Permission needed', message: 'Allow camera access.', options: [{ label: 'OK' }] }); return; }
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
            if (!result.canceled) uploadAndSendPhoto(result.assets[0].uri);
          },
        },
        {
          label: 'Photo Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') { showSheet({ title: 'Permission needed', message: 'Allow photo library access.', options: [{ label: 'OK' }] }); return; }
            const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
            if (!result.canceled) uploadAndSendPhoto(result.assets[0].uri);
          },
        },
        { label: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleBlock = async () => {
    if (!partner || !myId) return;
    try {
      await messageService.blockUser(myId, partner.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshBlockStatus();
    } catch (e: any) {
      showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] });
    }
  };

  const handleUnblock = async () => {
    if (!partner || !myId) return;
    try {
      await messageService.unblockUser(myId, partner.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshBlockStatus();
    } catch (e: any) {
      showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] });
    }
  };

  const handleDelete = async () => {
    if (!id || !myId) return;
    try {
      await messageService.clearConversationForUser(id, myId);
      qc.invalidateQueries({ queryKey: ['conversations', myId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      showSheet({ title: 'Error', message: e.message, options: [{ label: 'OK' }] });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>

          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            {partner ? (
              <TouchableOpacity style={styles.userInfo} activeOpacity={0.8} onPress={() => setShowSettings(true)}>
                <AvatarWithRing uri={partner.avatar} size={40} isOnline={partner.isOnline} />
                <View>
                  <Text style={styles.userName}>{partner.name}</Text>
                  <Text style={styles.userStatus}>{partner.isOnline ? '🟢 Online' : 'Last seen recently'}</Text>
                </View>
              </TouchableOpacity>
            ) : partnerLoading ? (
              <View style={[styles.userInfo, { gap: 10 }]}>
                <ActivityIndicator color={Colors.primary} size="small" />
                <Text style={styles.userStatus}>Loading...</Text>
              </View>
            ) : (
              <View style={styles.userInfo}>
                <Text style={styles.userStatus}>Conversation</Text>
              </View>
            )}
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerBtn, (blockStatus.iBlocked || blockStatus.blockedMe) && { opacity: 0.3 }]}
                disabled={blockStatus.iBlocked || blockStatus.blockedMe}
                onPress={() => router.push({
                  pathname: '/call/video',
                  params: {
                    type: 'video',
                    partnerName: partner?.name || '',
                    partnerAvatar: partner?.avatar || '',
                    partnerOnline: partner?.isOnline ? '1' : '0',
                    calleeId: partner?.id || '',
                  },
                } as any)}
              >
                <Ionicons name="videocam-outline" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerBtn, (blockStatus.iBlocked || blockStatus.blockedMe) && { opacity: 0.3 }]}
                disabled={blockStatus.iBlocked || blockStatus.blockedMe}
                onPress={() => router.push({
                  pathname: '/call/video',
                  params: {
                    type: 'audio',
                    partnerName: partner?.name || '',
                    partnerAvatar: partner?.avatar || '',
                    partnerOnline: partner?.isOnline ? '1' : '0',
                    calleeId: partner?.id || '',
                  },
                } as any)}
              >
                <Ionicons name="call-outline" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSettings(true); }}
              >
                <Ionicons name="information-circle-outline" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollToBottom(true)}
            onLayout={() => scrollToBottom(false)}
            renderItem={({ item }) => <MessageBubble message={item} isOwn={item.senderId === myId} />}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>No messages yet. Say hello! 👋</Text>
              </View>
            }
          />

          {showEmoji && (
            <View style={styles.emojiPanel}>
              {/* Category tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiCatTabs}>
                {EMOJI_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.emojiCatTab, emojiCat === cat.id && styles.emojiCatTabActive]}
                    onPress={() => { setEmojiCat(cat.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <Text style={styles.emojiCatIcon}>{cat.icon}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* Emoji grid */}
              <ScrollView contentContainerStyle={styles.emojiGrid} showsVerticalScrollIndicator={false}>
                {(EMOJI_CATEGORIES.find(c => c.id === emojiCat)?.emojis ?? []).map((emoji, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.emojiBtn}
                    onPress={() => {
                      setText(t => t + emoji);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={styles.emojiChar}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {showGifts && (
            <View style={styles.giftPanel}>
              <View style={styles.giftPanelHeader}>
                <Text style={styles.giftPanelTitle}>Send a Gift 🎁</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ color: Colors.primaryLight, fontSize: 13, fontWeight: '600' }}>💰 {coins}</Text>
                  <TouchableOpacity onPress={() => setShowGifts(false)}>
                    <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.giftGrid}>
                {GIFTS.map(gift => (
                  <TouchableOpacity key={gift.id} style={[styles.giftItem, coins < gift.coins && { opacity: 0.4 }]} onPress={() => handleSendGift(gift)}>
                    <Text style={styles.giftEmoji}>{gift.emoji}</Text>
                    <Text style={styles.giftName}>{gift.name}</Text>
                    <Text style={styles.giftCoins}>{gift.coins} 💰</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Block banner — replaces input area when either party blocked */}
          {(blockStatus.iBlocked || blockStatus.blockedMe) && (
            <View style={styles.blockBanner}>
              <Ionicons name="ban" size={20} color={blockStatus.iBlocked ? '#FF9F0A' : '#FF453A'} />
              <View style={{ flex: 1 }}>
                <Text style={styles.blockTitle}>
                  {blockStatus.iBlocked
                    ? `You blocked ${partner?.name || 'this user'}`
                    : `You are blocked by ${partner?.name || 'this user'}`}
                </Text>
                <Text style={styles.blockSubtitle}>
                  {blockStatus.iBlocked
                    ? 'Unblock to send messages again.'
                    : 'You cannot send messages or call.'}
                </Text>
              </View>
              {blockStatus.iBlocked && (
                <TouchableOpacity style={styles.unblockBtn} onPress={handleUnblock}>
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={[styles.inputArea, (blockStatus.iBlocked || blockStatus.blockedMe) && { opacity: 0.4 }]} pointerEvents={(blockStatus.iBlocked || blockStatus.blockedMe) ? 'none' : 'auto'}>
            <TouchableOpacity style={styles.inputBtn} onPress={() => { setShowGifts(g => !g); setShowEmoji(false); Keyboard.dismiss(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <Ionicons name="gift-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.inputBtn} onPress={handleCamera} disabled={sendingPhoto}>
              {sendingPhoto
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="camera-outline" size={20} color={Colors.textSecondary} />}
            </TouchableOpacity>
            <View style={styles.textInputWrapper}>
              <TextInput
                ref={textInputRef}
                style={styles.textInput}
                value={text}
                onChangeText={setText}
                placeholder="Message..."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                onFocus={() => { setShowGifts(false); setShowEmoji(false); }}
                editable={!blockStatus.iBlocked && !blockStatus.blockedMe}
              />
              <TouchableOpacity
                style={styles.emojiToggle}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowGifts(false);
                  setShowEmoji(e => !e);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons
                  name={showEmoji ? 'keypad-outline' : 'happy-outline'}
                  size={20}
                  color={showEmoji ? Colors.primary : Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || isPending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || isPending}
            >
              <LinearGradient
                colors={text.trim() ? Gradients.primary : ['#333', '#222']}
                style={styles.sendBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.sendIcon}>➤</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ChatSettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        partnerName={partner?.name || 'User'}
        partnerAvatar={partner?.avatar || ''}
        messages={messages}
        isBlocked={blockStatus.iBlocked}
        onBlock={handleBlock}
        onUnblock={handleUnblock}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.separator, gap: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: Colors.textPrimary, fontSize: 32, fontWeight: '300', lineHeight: 36 },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  userName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  userStatus: { fontSize: 12, color: Colors.textMuted },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 2, flexGrow: 1, paddingBottom: 20 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatText: { color: Colors.textMuted, fontSize: 14 },
  giftPanel: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  giftPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  giftPanelTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  giftItem: { alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 12, width: '30%' },
  giftEmoji: { fontSize: 28 },
  giftName: { color: Colors.textPrimary, fontSize: 11, fontWeight: '600' },
  giftCoins: { color: Colors.primaryLight, fontSize: 10 },
  inputArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 6, borderTopWidth: 1, borderTopColor: Colors.separator, backgroundColor: Colors.background },
  inputBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  textInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.glassBorder, paddingLeft: 14, paddingRight: 6, paddingVertical: 4, maxHeight: 100 },
  textInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 19, paddingVertical: 2 },
  emojiToggle: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  blockBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginHorizontal: 12, marginBottom: 6, borderRadius: 14, backgroundColor: 'rgba(255,69,58,0.08)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.25)' },
  blockTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  blockSubtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.primary },
  unblockText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emojiPanel: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderTopColor: Colors.glassBorder, paddingBottom: 8, maxHeight: 320 },
  emojiPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  emojiPanelTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  emojiCatTabs: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6, gap: 4 },
  emojiCatTab: { width: 42, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: 'transparent' },
  emojiCatTabActive: { backgroundColor: 'rgba(255,61,110,0.15)', borderBottomWidth: 2, borderBottomColor: Colors.primary },
  emojiCatIcon: { fontSize: 22 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  emojiBtn: { width: '16.66%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emojiChar: { fontSize: 28 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
