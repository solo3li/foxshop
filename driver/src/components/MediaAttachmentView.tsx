import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Platform } from 'react-native';
import { FileText, Download, X, Film } from 'lucide-react-native';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { normalizeMediaUrl } from '../utils/media';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';

interface MediaAttachmentViewProps {
  attachment: string;
  type?: 'image' | 'audio' | 'video' | 'file' | null;
  isDriver?: boolean;
}

export const MediaAttachmentView: React.FC<MediaAttachmentViewProps> = ({
  attachment,
  type,
  isDriver = false,
}) => {
  const { colors } = useThemeStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const normalizedUrl = normalizeMediaUrl(attachment);

  const lower = attachment.toLowerCase();
  const isAudio = type === 'audio' || lower.match(/\.(webm|weba|mp3|ogg|wav|m4a)$/) || lower.includes('voice_');
  const isVideo = type === 'video' || lower.match(/\.(mp4|mov|mkv|webm)$/);
  const isImage = !isAudio && !isVideo && (type === 'image' || lower.match(/\.(png|jpg|jpeg|gif|webp|svg)$/));

  if (isAudio) {
    return (
      <View style={styles.audioWrapper}>
        <VoiceNotePlayer src={normalizedUrl} isDriver={isDriver} />
      </View>
    );
  }

  if (isVideo) {
    return (
      <View style={styles.videoWrapper}>
        {Platform.OS === 'web' ? (
          <video
            src={normalizedUrl}
            controls
            style={{
              maxHeight: 220,
              width: '100%',
              borderRadius: 12,
              backgroundColor: '#000000',
            }}
          />
        ) : (
          <View style={[styles.videoFallback, { backgroundColor: colors.surface }]}>
            <Film size={28} color={colors.primary} />
            <Text style={[styles.fileName, { color: colors.text, fontFamily: Fonts.medium }]}>
              مقطع فيديو مرفق
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (isImage) {
    return (
      <>
        <TouchableOpacity
          onPress={() => setIsModalOpen(true)}
          activeOpacity={0.85}
          style={styles.imageContainer}
        >
          <Image source={{ uri: normalizedUrl }} style={styles.thumbnail} resizeMode="cover" />
        </TouchableOpacity>

        {/* Fullscreen Image Modal */}
        <Modal visible={isModalOpen} transparent animationType="fade" onRequestClose={() => setIsModalOpen(false)}>
          <View style={styles.fullscreenBackdrop}>
            <TouchableOpacity
              onPress={() => setIsModalOpen(false)}
              style={styles.closeModalBtn}
              activeOpacity={0.8}
            >
              <X size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <Image source={{ uri: normalizedUrl }} style={styles.fullscreenImage} resizeMode="contain" />
          </View>
        </Modal>
      </>
    );
  }

  // Generic document or unknown file
  const fileName = attachment.split('/').pop() || 'مستند مرفق';
  return (
    <TouchableOpacity
      onPress={() => {
        if (Platform.OS === 'web') {
          window.open(normalizedUrl, '_blank');
        }
      }}
      style={[
        styles.fileBox,
        {
          backgroundColor: isDriver ? 'rgba(255, 255, 255, 0.2)' : colors.surface,
        },
      ]}
    >
      <FileText size={18} color={isDriver ? '#FFFFFF' : colors.primary} />
      <Text
        numberOfLines={1}
        style={[
          styles.fileName,
          {
            color: isDriver ? '#FFFFFF' : colors.text,
            fontFamily: Fonts.medium,
          },
        ]}
      >
        {fileName}
      </Text>
      <Download size={14} color={isDriver ? '#FFFFFF' : colors.textSecondary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  audioWrapper: {
    marginTop: 4,
  },
  videoWrapper: {
    marginTop: 6,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    maxWidth: 280,
  },
  videoFallback: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    gap: 6,
  },
  imageContainer: {
    marginTop: 6,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    maxWidth: 240,
    maxHeight: 200,
  },
  thumbnail: {
    width: 240,
    height: 160,
    borderRadius: Radius.lg,
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullscreenImage: {
    width: '90%',
    height: '80%',
  },
  fileBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: 6,
    maxWidth: 240,
  },
  fileName: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
});
